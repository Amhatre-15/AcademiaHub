import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, Square, Timer, UserCheck, AlertCircle, Zap, ChevronRight,
  Trophy, BookOpen, BarChart2, QrCode, PenTool, MessageSquare
} from 'lucide-react';
import { facultyApi, type ClassSession, type Quiz, type QuizQuestion } from '../../api/faculty';
import { useLiveSession } from '../../hooks/useLiveSession';
import DynamicQrDisplay from '../../components/attendance/DynamicQrDisplay';
import CollaborativeWhiteboard from '../../components/classroom/CollaborativeWhiteboard';
import DoubtQueue from '../../components/classroom/DoubtQueue';
import toast from 'react-hot-toast';

export default function LiveSessionPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ClassSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ATTENDANCE_QUIZ' | 'WHITEBOARD'>('ATTENDANCE_QUIZ');

  // Quiz state
  const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [quizEnded, setQuizEnded] = useState(false);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);

  const { connected, lastMessage, sendMessage } = useLiveSession(session?.id);

  // Handle WS messages
  useEffect(() => {
    if (!lastMessage || !session) return;

    if (lastMessage.type === 'ATTENDANCE_CHECKPOINT_STARTED') {
      // The broadcast is shared with students, so it deliberately omits the QR
      // secret. Re-fetch the faculty-owned session to pick up the secret and to
      // mark the previous checkpoint inactive.
      void fetchActiveSession();
    }

    if (lastMessage.type === 'ATTENDANCE_CHECKPOINT_ENDED') {
      setSession(prev => prev ? {
        ...prev,
        attendanceCheckpoints: prev.attendanceCheckpoints?.map(c =>
          c.id === lastMessage.checkpointId ? { ...c, isActive: false } : c
        )
      } : null);
    }

    if (lastMessage.type === 'ATTENDANCE_SUBMITTED') {
      setSession(prev => prev ? {
        ...prev,
        attendanceCheckpoints: prev.attendanceCheckpoints?.map(c =>
          c.id === lastMessage.checkpointId
            ? { ...c, _count: { submissions: (c._count?.submissions ?? 0) + 1 } }
            : c
        )
      } : null);
      toast.success('New student attendance scanned! ⚡', { icon: '✅', duration: 2000 });
    }

    if (lastMessage.type === 'QUIZ_ENDED') {
      setLeaderboard(lastMessage.leaderboard || []);
      setQuizEnded(true);
      setActiveQuiz(null);
      setCurrentQuestion(null);
    }
  }, [lastMessage]);

  useEffect(() => {
    fetchActiveSession();
  }, []);

  const fetchActiveSession = async () => {
    try {
      setLoading(true);
      const active = await facultyApi.sessions.getActive();
      setSession(active);
      if (active) {
        if ((active as any).serverTime) {
          setServerTimeOffset((active as any).serverTime - Date.now());
        }
        loadQuizzes(active.classId);
      }
    } catch {
      toast.error('Failed to fetch active session');
    } finally {
      setLoading(false);
    }
  };

  const loadQuizzes = async (classId: string) => {
    try {
      const { quizzes } = await facultyApi.quiz.list();
      // Only DRAFT quizzes for the same class
      const relevant = quizzes.filter(q => q.classId === classId && (q.status === 'DRAFT' || q.status === 'ACTIVE'));
      setAvailableQuizzes(relevant);
      const active = relevant.find(q => q.status === 'ACTIVE');
      if (active) {
        const full = await facultyApi.quiz.get(active.id);
        setActiveQuiz(full);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateCode = async (type: 'START' | 'END') => {
    if (!session) return;
    try {
      const checkpoint = await facultyApi.sessions.generateCode(session.id, type, 60);
      if (checkpoint.serverTime) {
        setServerTimeOffset(checkpoint.serverTime - Date.now());
      }
      setSession(prev => prev ? {
        ...prev,
        attendanceCheckpoints: [...(prev.attendanceCheckpoints || []), checkpoint]
      } : null);
      toast.success(`${type} dynamic QR attendance generated!`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to generate code');
    }
  };

  const handleEndSession = async () => {
    if (!session || !confirm('End this session?')) return;
    try {
      await facultyApi.sessions.end(session.id);
      toast.success('Session ended successfully');
      setSession(null);
      navigate('/faculty');
    } catch {
      toast.error('Failed to end session');
    }
  };

  const handleStartQuiz = async (quizId: string) => {
    try {
      const result = await facultyApi.quiz.start(quizId);
      const full = await facultyApi.quiz.get(result.quiz.id);
      setActiveQuiz(full);
      setQuizEnded(false);
      toast.success('Quiz started! Eligible students will be notified.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to start quiz');
    }
  };

  const handleLaunchQuestion = async (questionId: string) => {
    if (!activeQuiz) return;
    try {
      await facultyApi.quiz.launchQuestion(activeQuiz.id, questionId);
      const full = await facultyApi.quiz.get(activeQuiz.id);
      setActiveQuiz(full);
      const launched = full.questions?.find(q => q.id === questionId);
      setCurrentQuestion(launched || null);
      toast.success('Question launched!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to launch question');
    }
  };

  const handleEndQuiz = async () => {
    if (!activeQuiz || !confirm('End quiz and show results?')) return;
    try {
      const result = await facultyApi.quiz.end(activeQuiz.id);
      setLeaderboard(result.leaderboard);
      setQuizEnded(true);
      setActiveQuiz(null);
      setCurrentQuestion(null);
      toast.success('Quiz ended. Results broadcast to students.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to end quiz');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading active session...</div>;
  }

  if (!session) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-slate-200 dark:border-slate-800 shadow-sm">
          <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">No Active Session</h2>
          <p className="text-slate-500 mb-6">You don't have any currently active live class sessions.</p>
          <button
            onClick={() => navigate('/faculty/timetable')}
            className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Go to Timetable to Start a Class
          </button>
        </div>
      </div>
    );
  }

  const activeCheckpoint = session.attendanceCheckpoints?.find(c => c.isActive);
  const startCompleted = session.attendanceCheckpoints?.some(c => c.checkpointType === 'START' && !c.isActive);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Live Classroom</h1>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-slate-500 text-sm">
            {session.subject?.name} • {session.class?.name}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="text-slate-500">{connected ? 'Live Sync' : 'Disconnected'}</span>
          </div>
          <button
            onClick={handleEndSession}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white font-medium rounded-xl hover:bg-rose-700 transition-colors"
          >
            <Square size={16} />
            End Session
          </button>
        </div>
      </div>

      {/* Classroom Module Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('ATTENDANCE_QUIZ')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-sm transition-all ${
            activeTab === 'ATTENDANCE_QUIZ'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <QrCode size={16} />
          <span>Dynamic Attendance & Quizzes</span>
        </button>

        <button
          onClick={() => setActiveTab('WHITEBOARD')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-sm transition-all ${
            activeTab === 'WHITEBOARD'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <PenTool size={16} />
          <span>Collaborative Whiteboard</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'WHITEBOARD' ? (
            <CollaborativeWhiteboard
              sessionId={session.id}
              isFaculty={true}
              sendMessage={sendMessage}
              lastWsMessage={lastMessage}
              sessionTitle={session.subject?.name}
              classId={session.classId}
              subjectId={session.subjectId}
            />
          ) : (
            <>
              {/* Attendance Panel */}
              {activeCheckpoint ? (
                <DynamicQrDisplay
                  checkpoint={activeCheckpoint}
                  sessionId={session.id}
                  serverTimeOffset={serverTimeOffset}
                />
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                        <QrCode className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-base">Dynamic QR Attendance</h3>
                        <p className="text-xs text-slate-500">Anti-proxy 1-second cryptographic rotating HMAC QR stream</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        1s Rotation Ready
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                    Click below to project a 1-second dynamic rotating QR code on screen. Students scan directly using their phone cameras to authenticate live presence in room.
                  </p>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleGenerateCode('START')}
                      disabled={!!startCompleted}
                      className={`flex items-center gap-2 px-5 py-3 font-semibold rounded-2xl transition-all text-sm shadow-md ${
                        startCompleted
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500 shadow-none'
                          : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-indigo-500/25 hover:scale-[1.02]'
                      }`}
                    >
                      <QrCode size={16} />
                      <span>Launch Dynamic QR (Start Checkpoint • 60s)</span>
                    </button>
                    <button
                      onClick={() => handleGenerateCode('END')}
                      disabled={!startCompleted}
                      className={`flex items-center gap-2 px-5 py-3 font-semibold rounded-2xl transition-all text-sm shadow-md ${
                        !startCompleted
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500 shadow-none'
                          : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white shadow-purple-500/25 hover:scale-[1.02]'
                      }`}
                    >
                      <QrCode size={16} />
                      <span>Launch Dynamic QR (End Checkpoint • 60s)</span>
                    </button>
                  </div>

                  {startCompleted && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-4 flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span>Start checkpoint recorded! You can now launch active classroom quizzes.</span>
                    </p>
                  )}
                </div>
              )}

              {/* Quiz Control Panel */}
              <QuizControlPanel
                availableQuizzes={availableQuizzes}
                activeQuiz={activeQuiz}
                currentQuestion={currentQuestion}
                leaderboard={leaderboard}
                quizEnded={quizEnded}
                startCompleted={!!startCompleted}
                onStartQuiz={handleStartQuiz}
                onLaunchQuestion={handleLaunchQuestion}
                onEndQuiz={handleEndQuiz}
                onGoToQuizBank={() => navigate('/faculty/quiz')}
              />
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Session Info */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Session Info</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Subject</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{session.subject?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Class</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{session.class?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Start</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {session.actualStart ? new Date(session.actualStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Attendance Summary */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Checkpoints</h3>
            <div className="space-y-2">
              {['START', 'END'].map(type => {
                const cp = session.attendanceCheckpoints?.find(c => c.checkpointType === type);
                return (
                  <div key={type} className="flex items-center gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full ${cp ? (cp.isActive ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500') : 'bg-slate-300 dark:bg-slate-600'}`} />
                    <span className="text-slate-600 dark:text-slate-400">{type}</span>
                    <span className="ml-auto text-slate-500">
                      {cp ? (cp.isActive ? `Active${cp._count?.submissions ? ` • ${cp._count.submissions} student${cp._count.submissions === 1 ? '' : 's'}` : ''}` : `${cp._count?.submissions ?? 0} students`) : 'Not generated'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* In-Session Live Doubt Queue */}
          <DoubtQueue
            sessionId={session.id}
            isFaculty={true}
            lastWsMessage={lastMessage}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Quiz Control Panel ───────────────────────────────────────────────────────

function QuizControlPanel({
  availableQuizzes,
  activeQuiz,
  currentQuestion,
  leaderboard,
  quizEnded,
  startCompleted,
  onStartQuiz,
  onLaunchQuestion,
  onEndQuiz,
  onGoToQuizBank,
}: {
  availableQuizzes: Quiz[];
  activeQuiz: Quiz | null;
  currentQuestion: QuizQuestion | null;
  leaderboard: any[];
  quizEnded: boolean;
  startCompleted: boolean;
  onStartQuiz: (id: string) => void;
  onLaunchQuestion: (questionId: string) => void;
  onEndQuiz: () => void;
  onGoToQuizBank: () => void;
}) {
  // Leaderboard after quiz ends
  if (quizEnded && leaderboard.length > 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Quiz Leaderboard</h3>
        </div>
        <div className="space-y-2">
          {leaderboard.map((entry: any) => (
            <div key={entry.rank} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                entry.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                entry.rank === 2 ? 'bg-slate-200 text-slate-700' :
                entry.rank === 3 ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}>{entry.rank}</span>
              <span className="flex-1 font-medium text-slate-800 dark:text-slate-200">{entry.studentName}</span>
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{entry.score}/{entry.maxScore}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Active quiz — question control
  if (activeQuiz && activeQuiz.questions) {
    const questions = activeQuiz.questions;
    const launchedIds = new Set(questions.filter(q => q.launchedAt).map(q => q.id));

    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-6 shadow-sm shadow-emerald-500/10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-emerald-500" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">
              Quiz Live: <span className="text-emerald-600 dark:text-emerald-400">{activeQuiz.title}</span>
            </h3>
          </div>
          <button
            onClick={onEndQuiz}
            className="px-4 py-1.5 bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-sm font-medium rounded-lg hover:bg-rose-200 dark:hover:bg-rose-900/40 transition-colors"
          >
            End Quiz
          </button>
        </div>

        {currentQuestion && (
          <div className="mb-5 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-1">Current Question</p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{currentQuestion.text}</p>
            {currentQuestion.endsAt && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                <Timer size={12} />
                <Countdown targetDate={currentQuestion.endsAt} small />
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          {questions.map((q, idx) => {
            const launched = launchedIds.has(q.id);
            const isCurrent = q.id === activeQuiz.currentQuestionId;

            return (
              <div
                key={q.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isCurrent
                    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20'
                    : launched
                    ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-60'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                  {idx + 1}
                </span>
                <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{q.text}</span>
                <span className="text-xs text-slate-400">{q.durationSeconds}s</span>
                {!launched && !isCurrent && (
                  <button
                    onClick={() => onLaunchQuestion(q.id)}
                    className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors shrink-0"
                  >
                    Launch
                  </button>
                )}
                {launched && <span className="text-xs text-slate-400 shrink-0">Done</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // No active quiz — show available quizzes or prompt to create one
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-indigo-500" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Launch a Quiz</h3>
        </div>
        <button
          onClick={onGoToQuizBank}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
        >
          Quiz Bank <ChevronRight size={14} />
        </button>
      </div>

      {!startCompleted ? (
        <div className="text-center py-6">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Complete the start attendance checkpoint before launching a quiz.</p>
        </div>
      ) : availableQuizzes.length === 0 ? (
        <div className="text-center py-6">
          <BarChart2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 mb-4">No quizzes available for this class.</p>
          <button
            onClick={onGoToQuizBank}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-all"
          >
            Create a Quiz
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {availableQuizzes.filter(q => q.status === 'DRAFT').map(quiz => (
            <div key={quiz.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">{quiz.title}</p>
                <p className="text-xs text-slate-500">{quiz._count?.questions ?? 0} questions</p>
              </div>
              <button
                onClick={() => onStartQuiz(quiz.id)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors shrink-0"
              >
                <Play size={14} />
                Start
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function Countdown({ targetDate, small }: { targetDate: string; small?: boolean }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const target = new Date(targetDate).getTime();
    const tick = () => {
      const now = Date.now();
      setTimeLeft(Math.max(0, Math.floor((target - now) / 1000)));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const display = `${Math.floor(timeLeft / 60).toString().padStart(2, '0')}:${(timeLeft % 60).toString().padStart(2, '0')}`;

  if (small) return <span className="font-mono font-semibold">{display}</span>;

  return (
    <span className="font-mono text-xl font-medium">
      {display}
    </span>
  );
}
