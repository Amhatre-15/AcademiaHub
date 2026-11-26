import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, Timer, Sparkles, CheckCircle2, Trophy, AlertCircle, Zap,
  QrCode, Keyboard, PenTool, MessageSquare
} from 'lucide-react';
import { studentApi, type StudentQuizQuestion } from '../../api/student';
import type { ClassSession } from '../../api/faculty';
import { useLiveSession } from '../../hooks/useLiveSession';
import DynamicQrScanner from '../../components/attendance/DynamicQrScanner';
import CollaborativeWhiteboard from '../../components/classroom/CollaborativeWhiteboard';
import DoubtQueue from '../../components/classroom/DoubtQueue';
import toast from 'react-hot-toast';

// ─── Anti-cheat tracking ──────────────────────────────────────────────────────

interface CheatEvent {
  type: string;
  at: string;
}

type ViolationType = 'WINDOW_BLUR' | 'TAB_HIDDEN' | 'CONTEXT_MENU' | 'COPY' | 'PASTE';

function useAntiCheat(quizActive: boolean, quizId?: string | null) {
  const events = useRef<CheatEvent[]>([]);

  useEffect(() => {
    if (!quizActive || !quizId) return;

    const record = (type: ViolationType, label: string) => {
      events.current.push({ type: label, at: new Date().toISOString() });
      toast(`⚠️ ${label} detected. Your activity is being tracked.`, { icon: '🔍', duration: 3000 });
      // Fire-and-forget: the warning must never be blocked by telemetry.
      void studentApi.quiz.reportViolation(quizId, type).catch(() => {});
    };

    const onBlur = () => record('WINDOW_BLUR', 'Window blur');
    const onVisibility = () => { if (document.hidden) record('TAB_HIDDEN', 'Tab hidden'); };
    const onContextMenu = (e: MouseEvent) => { e.preventDefault(); record('CONTEXT_MENU', 'Right-click attempt'); };
    const onCopy = (e: ClipboardEvent) => { e.preventDefault(); record('COPY', 'Copy attempt'); };
    const onPaste = (e: ClipboardEvent) => { e.preventDefault(); record('PASTE', 'Paste attempt'); };

    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);

    return () => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
    };
  }, [quizActive, quizId]);

  return events;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudentLiveSessionPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ClassSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [attendanceMode, setAttendanceMode] = useState<'SCANNER' | 'MANUAL'>('SCANNER');
  const [attendanceRecorded, setAttendanceRecorded] = useState(false);

  // Quiz state
  const [quizData, setQuizData] = useState<{
    quiz: any | null;
    currentQuestion: StudentQuizQuestion | null;
    sessionId: string | null;
    eligible?: boolean;
    ineligible?: boolean;
    message?: string;
  } | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [lastAnswerResult, setLastAnswerResult] = useState<{ isCorrect: boolean } | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [quizEnded, setQuizEnded] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());

  const quizActive = !!(quizData?.quiz && !quizEnded);
  const antiCheatEvents = useAntiCheat(quizActive, quizData?.quiz?.id);
  const [activeInteractiveTab, setActiveInteractiveTab] = useState<'WHITEBOARD' | 'DOUBTS'>('WHITEBOARD');

  const { connected, lastMessage, sendMessage } = useLiveSession(session?.id);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage || !session) return;

    if (lastMessage.type === 'ATTENDANCE_CHECKPOINT_STARTED') {
      toast('Attendance window opened by faculty!', { icon: '📢' });
      fetchActiveSession();
    }
    if (lastMessage.type === 'ATTENDANCE_CHECKPOINT_ENDED') {
      toast('Attendance window closed.');
      fetchActiveSession();
    }
    if (lastMessage.type === 'SESSION_ENDED') {
      toast('Class session has ended.');
      setSession(null);
      navigate('/student');
    }
    if (lastMessage.type === 'QUIZ_STARTED') {
      toast('Quiz started! 🎯', { icon: '📝' });
      fetchQuizData();
    }
    if (lastMessage.type === 'QUIZ_QUESTION_LAUNCHED') {
      // Faculty launched a question — fetch fresh quiz data
      const q: StudentQuizQuestion = {
        id: lastMessage.question.id,
        text: lastMessage.question.text,
        type: lastMessage.question.type,
        durationSeconds: lastMessage.question.durationSeconds,
        endsAt: lastMessage.question.endsAt,
        options: lastMessage.question.options,
        alreadyAnswered: false,
      };
      setQuizData(prev => prev ? { ...prev, currentQuestion: q } : null);
      setSelectedOption(null);
      setAnswerText('');
      setLastAnswerResult(null);
      setQuestionStartTime(Date.now());
      toast('New question! 🧠', { icon: '⚡' });
    }
    if (lastMessage.type === 'QUIZ_QUESTION_ENDED') {
      setQuizData(prev => prev ? { ...prev, currentQuestion: null } : null);
    }
    if (lastMessage.type === 'QUIZ_ENDED') {
      setLeaderboard(lastMessage.leaderboard || []);
      setQuizEnded(true);
      setQuizData(prev => prev ? { ...prev, quiz: null, currentQuestion: null } : null);
      toast('Quiz ended! See results below 🎉');
    }
  }, [lastMessage]);

  useEffect(() => {
    fetchActiveSession();
  }, []);

  const fetchActiveSession = async () => {
    try {
      const active = await studentApi.sessions.getActive();
      setSession(active);
      if (active) {
        fetchQuizData();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuizData = useCallback(async () => {
    try {
      const data = await studentApi.quiz.getActive();
      setQuizData(data);
    } catch (error) {
      console.error('Failed to fetch quiz data:', error);
    }
  }, []);

  const handleQrScanSuccess = async (qrPayload: string) => {
    if (!session || submitting) return;
    setSubmitting(true);
    try {
      const res = await studentApi.sessions.submitAttendance(session.id, { qrPayload });
      toast.success(res.message || 'Attendance verified via Dynamic QR! 🎉', { icon: '🎉', duration: 3500 });
      setAttendanceRecorded(true);
      fetchActiveSession();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to verify QR code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !code.trim()) return;
    setSubmitting(true);
    try {
      const res = await studentApi.sessions.submitAttendance(session.id, { code: code.trim() });
      toast.success(res.message || 'Attendance recorded! 🎉');
      setAttendanceRecorded(true);
      setCode('');
      fetchActiveSession();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Invalid or expired code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswerSubmit = async () => {
    if (!quizData?.quiz || !quizData.currentQuestion) return;
    if (quizData.currentQuestion.type === 'MCQ' && !selectedOption) {
      toast.error('Please select an option');
      return;
    }
    if (quizData.currentQuestion.type !== 'MCQ' && !answerText.trim()) {
      toast.error('Please enter your answer');
      return;
    }

    const timeTaken = Math.floor((Date.now() - questionStartTime) / 1000);

    setSubmittingAnswer(true);
    try {
      const result = await studentApi.quiz.submit({
        quizId: quizData.quiz.id,
        questionId: quizData.currentQuestion.id,
        optionId: selectedOption || undefined,
        answerText: answerText.trim() || undefined,
        timeTakenSec: timeTaken,
      });
      setLastAnswerResult({ isCorrect: result.isCorrect });
      setQuizData(prev => prev ? {
        ...prev,
        currentQuestion: prev.currentQuestion ? { ...prev.currentQuestion, alreadyAnswered: true } : null,
      } : null);
      toast.success(result.isCorrect ? 'Correct! ✅' : 'Submitted ✓', {
        icon: result.isCorrect ? '🎯' : '📝',
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit answer');
    } finally {
      setSubmittingAnswer(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading session...</div>;
  }

  if (!session) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center mt-12">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200 dark:border-slate-800 shadow-xl">
          <Sparkles className="w-16 h-16 text-indigo-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">No Live Class Active</h2>
          <p className="text-slate-500 mb-8 text-lg">Your faculty hasn't started any live sessions yet.</p>
          <button
            onClick={() => navigate('/student')}
            className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-500/20"
          >
            Go Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // The API already filters for active windows; `isActive` is included for
  // clarity, but fall back to the first entry in case of older payloads.
  const activeCheckpoint =
    session.attendanceCheckpoints?.find(c => c.isActive) ?? session.attendanceCheckpoints?.[0];

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-7 mb-6 text-white relative overflow-hidden shadow-xl shadow-indigo-500/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                Live Now
              </span>
              <span className="text-indigo-100 text-sm">{connected ? 'Connected' : 'Connecting...'}</span>
            </div>
            <h1 className="text-2xl font-bold mb-1">{session.subject?.name}</h1>
            <p className="text-indigo-100 opacity-90">
              {session.faculty?.firstName} {session.faculty?.lastName} • {session.class?.name}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attendance Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-7 border border-slate-200 dark:border-slate-800 shadow-sm">
          {activeCheckpoint ? (
            <div>
              {attendanceRecorded ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                    <CheckCircle2 className="w-9 h-9 text-emerald-500 animate-pulse" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1.5">
                    Attendance Recorded! 🎉
                  </h3>
                  <p className="text-slate-500 text-sm mb-4">
                    Your presence has been cryptographically recorded for this session.
                  </p>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200 dark:border-emerald-500/20">
                    <Sparkles size={12} />
                    Verified via 1s Dynamic QR
                  </span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                        <Play className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                          {activeCheckpoint.checkpointType} Attendance Active
                        </h3>
                        <p className="text-slate-500 text-xs">
                          Point camera at classroom projector
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-300 font-mono text-sm font-semibold border border-slate-200 dark:border-slate-700">
                      <Timer className="w-4 h-4 text-indigo-500" />
                      <Countdown targetDate={activeCheckpoint.expiresAt} />
                    </div>
                  </div>

                  {/* Mode Selector Tabs */}
                  <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-4">
                    <button
                      type="button"
                      onClick={() => setAttendanceMode('SCANNER')}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                        attendanceMode === 'SCANNER'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <QrCode size={14} />
                      Scan Dynamic QR (1s)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendanceMode('MANUAL')}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                        attendanceMode === 'MANUAL'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <Keyboard size={14} />
                      Manual Code
                    </button>
                  </div>

                  {/* Tab 1: Live Dynamic QR Camera Scanner */}
                  {attendanceMode === 'SCANNER' ? (
                    <div className="py-1">
                      <DynamicQrScanner
                        sessionId={session.id}
                        onScanSuccess={handleQrScanSuccess}
                        submitting={submitting}
                      />
                    </div>
                  ) : (
                    /* Tab 2: Manual Code Input Fallback */
                    <form onSubmit={handleAttendanceSubmit} className="space-y-3 py-2">
                      <p className="text-xs text-slate-500 mb-2">
                        If camera is unavailable, enter the emergency backup code from the faculty:
                      </p>
                      <input
                        type="text"
                        value={code}
                        onChange={e => setCode(e.target.value.toUpperCase())}
                        placeholder="ENTER CODE"
                        maxLength={6}
                        className="w-full text-center text-4xl tracking-[0.3em] font-black uppercase p-4 bg-white dark:bg-slate-950 border-2 border-indigo-200 dark:border-indigo-900 focus:border-indigo-500 rounded-2xl outline-none transition-all dark:text-white"
                      />
                      <button
                        type="submit"
                        disabled={submitting || code.length < 4}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-bold text-lg rounded-2xl transition-all shadow-md shadow-indigo-500/20 disabled:shadow-none"
                      >
                        {submitting ? 'Submitting...' : 'Mark Present'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-200 dark:border-indigo-800">
                <QrCode className="w-8 h-8 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Waiting for Attendance Checkpoint</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">
                The faculty will launch the live 1-second rotating dynamic QR code on the projector screen when attendance begins.
              </p>
            </div>
          )}
        </div>

        {/* Quiz / Interactive Area */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {quizEnded && leaderboard.length > 0 ? (
            <QuizLeaderboard leaderboard={leaderboard} />
          ) : quizData?.ineligible ? (
            <div className="p-7 text-center">
              <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">Quiz Restricted</h3>
              <p className="text-slate-500 text-sm">{quizData.message}</p>
            </div>
          ) : quizData?.quiz && quizData.currentQuestion ? (
            <QuizQuestion
              quiz={quizData.quiz}
              question={quizData.currentQuestion}
              selectedOption={selectedOption}
              answerText={answerText}
              submitting={submittingAnswer}
              lastResult={lastAnswerResult}
              onSelectOption={setSelectedOption}
              onAnswerTextChange={setAnswerText}
              onSubmit={handleAnswerSubmit}
            />
          ) : quizData?.quiz && !quizData.currentQuestion ? (
            <div className="p-7 text-center">
              <Zap className="w-12 h-12 text-indigo-400 mx-auto mb-4 animate-pulse" />
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">Quiz in Progress</h3>
              <p className="text-slate-500 text-sm">{quizData.quiz.title}</p>
              <p className="text-slate-400 text-xs mt-2">Waiting for the next question...</p>
            </div>
          ) : (
            <div className="p-7 text-center flex flex-col items-center justify-center h-full min-h-[280px]">
              <Sparkles className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-base font-bold text-slate-600 dark:text-slate-400 mb-2">Interactive Learning</h3>
              <p className="text-slate-400 text-sm max-w-[200px]">
                Quizzes and activities will appear here when the faculty launches them.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Classroom 2.0 (Phase 19) */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <button
            onClick={() => setActiveInteractiveTab('WHITEBOARD')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-sm transition-all ${
              activeInteractiveTab === 'WHITEBOARD'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <PenTool size={16} />
            <span>Live Whiteboard Stream</span>
          </button>

          <button
            onClick={() => setActiveInteractiveTab('DOUBTS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-sm transition-all ${
              activeInteractiveTab === 'DOUBTS'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <MessageSquare size={16} />
            <span>In-Session Doubt Queue</span>
          </button>
        </div>

        {activeInteractiveTab === 'WHITEBOARD' ? (
          <CollaborativeWhiteboard
            sessionId={session.id}
            isFaculty={false}
            sendMessage={sendMessage}
            lastWsMessage={lastMessage}
            sessionTitle={session.subject?.name}
            classId={session.classId}
            subjectId={session.subjectId}
          />
        ) : (
          <DoubtQueue
            sessionId={session.id}
            isFaculty={false}
            lastWsMessage={lastMessage}
          />
        )}
      </div>
    </div>
  );
}

// ─── Quiz Question Component ──────────────────────────────────────────────────

function QuizQuestion({
  quiz,
  question,
  selectedOption,
  answerText,
  submitting,
  lastResult,
  onSelectOption,
  onAnswerTextChange,
  onSubmit,
}: {
  quiz: any;
  question: StudentQuizQuestion;
  selectedOption: string | null;
  answerText: string;
  submitting: boolean;
  lastResult: { isCorrect: boolean } | null;
  onSelectOption: (id: string) => void;
  onAnswerTextChange: (text: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="p-6 flex flex-col h-full">
      {/* Quiz header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider mb-0.5">Live Quiz</p>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{quiz.title}</p>
        </div>
        <div className="flex items-center gap-1.5 text-sm font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
          <Timer size={14} />
          <Countdown targetDate={question.endsAt} />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1">
        <p className="text-lg font-semibold text-slate-900 dark:text-white mb-5 leading-relaxed">
          {question.text}
        </p>

        {question.alreadyAnswered ? (
          <div className={`p-4 rounded-xl text-center ${
            lastResult?.isCorrect
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
              : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
          }`}>
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              {lastResult?.isCorrect ? '✅ Correct!' : '✓ Answer submitted'}
            </p>
            <p className="text-sm text-slate-500 mt-1">Waiting for next question...</p>
          </div>
        ) : question.type === 'MCQ' ? (
          <div className="space-y-2">
            {question.options.map((opt, idx) => {
              const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
              const selected = selectedOption === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => onSelectOption(opt.id)}
                  className={`w-full text-left flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all font-medium text-sm ${
                    selected
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}>
                    {letters[idx] || idx + 1}
                  </span>
                  {opt.text}
                </button>
              );
            })}
          </div>
        ) : (
          <div>
            <input
              type={question.type === 'NUMERICAL' ? 'number' : 'text'}
              value={answerText}
              onChange={e => onAnswerTextChange(e.target.value)}
              placeholder={question.type === 'NUMERICAL' ? 'Enter a number...' : 'Type your answer...'}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
        )}
      </div>

      {!question.alreadyAnswered && (
        <button
          onClick={onSubmit}
          disabled={submitting || (question.type === 'MCQ' ? !selectedOption : !answerText.trim())}
          className="mt-4 w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white font-bold rounded-xl transition-all disabled:text-slate-400 shadow-md shadow-indigo-500/20 disabled:shadow-none"
        >
          {submitting ? 'Submitting...' : 'Submit Answer'}
        </button>
      )}
    </div>
  );
}

// ─── Quiz Leaderboard ─────────────────────────────────────────────────────────

function QuizLeaderboard({ leaderboard }: { leaderboard: any[] }) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <Trophy className="w-6 h-6 text-yellow-500" />
        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Quiz Results</h3>
      </div>
      <div className="space-y-2">
        {leaderboard.map((entry: any) => (
          <div
            key={entry.rank}
            className={`flex items-center gap-3 py-2.5 px-3 rounded-xl ${
              entry.isMe ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800' : ''
            }`}
          >
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
              entry.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
              entry.rank === 2 ? 'bg-slate-200 text-slate-700' :
              entry.rank === 3 ? 'bg-amber-100 text-amber-700' :
              'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>
              {entry.rank}
            </span>
            <span className={`flex-1 font-medium text-sm ${entry.isMe ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
              {entry.studentName} {entry.isMe ? '(You)' : ''}
            </span>
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              {entry.score}/{entry.maxScore}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function Countdown({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const target = new Date(targetDate).getTime();
    const tick = () => {
      setTimeLeft(Math.max(0, Math.floor((target - Date.now()) / 1000)));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const s = (timeLeft % 60).toString().padStart(2, '0');
  return <span>{m}:{s}</span>;
}
