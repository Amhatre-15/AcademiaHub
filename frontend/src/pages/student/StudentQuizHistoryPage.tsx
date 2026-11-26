import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, BookOpen, Calendar, CheckCircle2, XCircle, ChevronRight, Award } from 'lucide-react';
import { studentApi, type QuizResultResponse } from '../../api/student';
import { Pagination } from '../../components/ui/Pagination';
import toast from 'react-hot-toast';

export default function StudentQuizHistoryPage() {
  const [page, setPage] = useState(1);
  const [selectedResult, setSelectedResult] = useState<QuizResultResponse | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);
  const LIMIT = 15;

  const { data, isLoading: loading } = useQuery({
    queryKey: ['student-quiz-history', page],
    queryFn: () => studentApi.quiz.getHistory({ page, limit: LIMIT }),
  });

  const attempts = data?.attempts ?? [];

  const viewResult = async (quizId: string, quizStatus: string) => {
    if (quizStatus !== 'CLOSED') {
      toast('This quiz is not yet closed.', { icon: '⏳' });
      return;
    }
    try {
      setLoadingResult(true);
      const result = await studentApi.quiz.getResult(quizId);
      setSelectedResult(result);
    } catch {
      toast.error('Failed to load quiz result');
    } finally {
      setLoadingResult(false);
    }
  };

  if (selectedResult) {
    return <QuizResultDetail result={selectedResult} onBack={() => setSelectedResult(null)} />;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quiz History</h1>
        <p className="text-slate-500 text-sm mt-1">Review your past quiz performance</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500">Loading your quiz history...</div>
      ) : attempts.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <BookOpen className="w-14 h-14 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No quizzes yet</h3>
          <p className="text-slate-500 text-sm">Participate in live class quizzes to see your history here.</p>
        </div>
      ) : (
        <>
          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              {
                label: 'Total Quizzes',
                value: data?.total ?? attempts.length,
                icon: BookOpen,
                color: 'text-indigo-600 dark:text-indigo-400',
                bg: 'bg-indigo-50 dark:bg-indigo-900/20',
              },
              {
                label: 'Avg Score',
                value: `${Math.round(
                  attempts.reduce((acc, a) => acc + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0), 0) /
                    (attempts.filter(a => a.maxScore > 0).length || 1)
                )}%`,
                icon: Trophy,
                color: 'text-yellow-600 dark:text-yellow-400',
                bg: 'bg-yellow-50 dark:bg-yellow-900/20',
              },
              {
                label: 'Best Score',
                value: `${Math.max(...attempts.filter(a => a.maxScore > 0).map(a => Math.round((a.score / a.maxScore) * 100)), 0)}%`,
                icon: Award,
                color: 'text-emerald-600 dark:text-emerald-400',
                bg: 'bg-emerald-50 dark:bg-emerald-900/20',
              },
              {
                label: 'Closed',
                value: attempts.filter(a => a.quizStatus === 'CLOSED').length,
                icon: CheckCircle2,
                color: 'text-slate-600 dark:text-slate-400',
                bg: 'bg-slate-50 dark:bg-slate-800',
              },
            ].map(stat => (
              <div key={stat.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                <div className={`w-8 h-8 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Attempt list */}
          <div className="space-y-3 mb-6">
            {attempts.map(attempt => (
              <button
                key={attempt.attemptId}
                onClick={() => viewResult(attempt.quizId, attempt.quizStatus)}
                disabled={loadingResult}
                className="w-full text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group"
              >
                <div className="flex items-center gap-4">
                  {/* Score ring */}
                  <div className="relative w-14 h-14 shrink-0">
                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-100 dark:text-slate-800" />
                      <circle
                        cx="28" cy="28" r="22"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeDasharray={`${2 * Math.PI * 22}`}
                        strokeDashoffset={`${2 * Math.PI * 22 * (1 - (attempt.percentage ?? 0) / 100)}`}
                        strokeLinecap="round"
                        className={`transition-all ${(attempt.percentage ?? 0) >= 70 ? 'text-emerald-500' : (attempt.percentage ?? 0) >= 40 ? 'text-amber-500' : 'text-rose-500'}`}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                      {attempt.percentage !== null ? `${attempt.percentage}%` : '—'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">{attempt.quizTitle}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {attempt.subject?.name} • {attempt.class?.name}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {new Date(attempt.startedAt).toLocaleDateString()}
                      </span>
                      <span>
                        {attempt.score}/{attempt.maxScore} correct
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      attempt.quizStatus === 'CLOSED'
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        : 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                    }`}>
                      {attempt.quizStatus}
                    </span>
                    {attempt.quizStatus === 'CLOSED' && (
                      <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
          {data && data.totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={data.totalPages}
              total={data.total}
              limit={LIMIT}
              onPageChange={setPage}
              itemLabel="quiz attempts"
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Quiz Result Detail ───────────────────────────────────────────────────────

function QuizResultDetail({ result, onBack }: { result: QuizResultResponse; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'answers' | 'leaderboard'>('answers');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={onBack}
        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium mb-4 flex items-center gap-1"
      >
        ← Back to History
      </button>

      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-7 mb-6 text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10">
          <p className="text-indigo-100 text-sm mb-1">{result.quiz.subject?.name} • {result.quiz.class?.name}</p>
          <h1 className="text-2xl font-bold mb-4">{result.quiz.title}</h1>
          {result.attempt ? (
            <div className="flex items-center gap-6">
              <div>
                <p className="text-4xl font-black">{result.attempt.score}/{result.attempt.maxScore}</p>
                <p className="text-indigo-200 text-sm mt-0.5">Your Score</p>
              </div>
              <div className="h-10 w-px bg-white/20" />
              <div>
                <p className="text-2xl font-bold">#{result.myRank}</p>
                <p className="text-indigo-200 text-sm mt-0.5">of {result.totalParticipants}</p>
              </div>
              <div className="h-10 w-px bg-white/20" />
              <div>
                <p className="text-2xl font-bold">
                  {result.attempt.maxScore > 0 ? Math.round((result.attempt.score / result.attempt.maxScore) * 100) : 0}%
                </p>
                <p className="text-indigo-200 text-sm mt-0.5">Accuracy</p>
              </div>
            </div>
          ) : (
            <p className="text-indigo-200">You did not participate in this quiz.</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {(['answers', 'leaderboard'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              activeTab === tab
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'answers' && result.attempt && (
        <div className="space-y-4">
          {result.attempt.answers.map((answer, idx) => (
            <div key={answer.questionId} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-start gap-3 mb-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  answer.isCorrect
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                }`}>
                  {answer.isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                </span>
                <div className="flex-1">
                  <p className="text-xs text-slate-500 mb-1">Q{idx + 1}</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200 mb-3">{answer.questionText}</p>

                  {answer.questionType === 'MCQ' && answer.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {answer.options.map(opt => {
                        const isYours = opt.text === answer.yourAnswer;
                        const isCorrect = opt.isCorrect;
                        return (
                          <div
                            key={opt.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${
                              isCorrect
                                ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                : isYours && !isCorrect
                                ? 'border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                                : 'border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {isCorrect && <CheckCircle2 size={13} />}
                            {isYours && !isCorrect && <XCircle size={13} />}
                            {opt.text}
                            {isYours && <span className="ml-auto text-xs opacity-70">Your answer</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {answer.questionType !== 'MCQ' && (
                    <div className="space-y-2">
                      <div className={`px-3 py-2 rounded-lg text-sm border ${
                        answer.isCorrect
                          ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                          : 'border-rose-200 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300'
                      }`}>
                        Your answer: <strong>{answer.yourAnswer ?? '—'}</strong>
                      </div>
                      {!answer.isCorrect && answer.correctAnswer && (
                        <div className="px-3 py-2 rounded-lg text-sm border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300">
                          Correct: <strong>{answer.correctAnswer}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {answer.explanation && (
                    <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-xs text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                      💡 {answer.explanation}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="space-y-2">
            {result.leaderboard.map(entry => (
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
                <span className={`flex-1 font-medium ${entry.isMe ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                  {entry.studentName} {entry.isMe ? '(You)' : ''}
                </span>
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                  {entry.score}/{entry.maxScore}
                </span>
                <span className="text-sm text-slate-400">
                  {entry.maxScore > 0 ? Math.round((entry.score / entry.maxScore) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
