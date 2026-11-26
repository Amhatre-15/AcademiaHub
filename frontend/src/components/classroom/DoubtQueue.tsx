import React, { useState, useEffect } from 'react';
import {
  MessageSquare, ThumbsUp, Send, UserX, CheckCircle, Eye, EyeOff, Sparkles, Filter
} from 'lucide-react';
import toast from 'react-hot-toast';
import { studentApi, type ClassroomDoubt } from '../../api/student';
import { facultyApi } from '../../api/faculty';

interface DoubtQueueProps {
  sessionId: string;
  isFaculty?: boolean;
  lastWsMessage?: any;
}

export default function DoubtQueue({ sessionId, isFaculty = false, lastWsMessage }: DoubtQueueProps) {
  const [doubts, setDoubts] = useState<ClassroomDoubt[]>([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'ANSWERED'>('ALL');

  useEffect(() => {
    fetchDoubts();
  }, [sessionId]);

  // Real-time WebSocket updates
  useEffect(() => {
    if (!lastWsMessage) return;

    if (lastWsMessage.type === 'DOUBT_CREATED') {
      const newDoubt = lastWsMessage.doubt;
      setDoubts(prev => {
        // Prevent duplicate if already added
        if (prev.some(d => d.id === newDoubt.id)) return prev;
        return [newDoubt, ...prev];
      });
      if (!isFaculty) {
        toast('New question in doubt queue! 💡', { icon: '❓', duration: 2500 });
      }
    }

    if (lastWsMessage.type === 'DOUBT_UPVOTED') {
      const { doubtId, upvotesCount } = lastWsMessage;
      setDoubts(prev =>
        prev.map(d =>
          d.id === doubtId ? { ...d, upvotesCount } : d
        ).sort((a, b) => {
          if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
          if (b.status === 'PENDING' && a.status !== 'PENDING') return 1;
          return b.upvotesCount - a.upvotesCount;
        })
      );
    }

    if (lastWsMessage.type === 'DOUBT_STATUS_UPDATED') {
      const { doubtId, status } = lastWsMessage;
      setDoubts(prev =>
        prev.map(d => (d.id === doubtId ? { ...d, status } : d))
      );
    }
  }, [lastWsMessage, isFaculty]);

  const fetchDoubts = async () => {
    try {
      setLoading(true);
      const list = isFaculty
        ? await facultyApi.doubts.list(sessionId)
        : await studentApi.doubts.list(sessionId);
      setDoubts(list);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDoubt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    try {
      setSubmitting(true);
      const created = await studentApi.doubts.create(sessionId, {
        question: question.trim(),
        isAnonymous,
      });
      setDoubts(prev => {
        if (prev.some(d => d.id === created.id)) return prev;
        return [created, ...prev];
      });
      setQuestion('');
      toast.success('Doubt submitted to live queue! 🙋‍♂️');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit doubt');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleUpvote = async (doubtId: string) => {
    if (isFaculty) return; // Faculty doesn't upvote
    try {
      // Optimistic update
      setDoubts(prev =>
        prev.map(d => {
          if (d.id !== doubtId) return d;
          const nextUpvoted = !d.hasUpvoted;
          return {
            ...d,
            hasUpvoted: nextUpvoted,
            upvotesCount: nextUpvoted ? d.upvotesCount + 1 : Math.max(0, d.upvotesCount - 1),
          };
        })
      );

      const result = await studentApi.doubts.toggleUpvote(sessionId, doubtId);
      setDoubts(prev =>
        prev.map(d =>
          d.id === doubtId
            ? { ...d, hasUpvoted: result.hasUpvoted, upvotesCount: result.upvotesCount }
            : d
        )
      );
    } catch {
      toast.error('Failed to update vote');
      fetchDoubts();
    }
  };

  const handleUpdateStatus = async (doubtId: string, status: 'ANSWERED' | 'DISMISSED') => {
    try {
      await facultyApi.doubts.updateStatus(sessionId, doubtId, status);
      setDoubts(prev =>
        prev.map(d => (d.id === doubtId ? { ...d, status } : d))
      );
      toast.success(`Doubt marked as ${status.toLowerCase()}`);
    } catch {
      toast.error('Failed to update doubt status');
    }
  };

  const filteredDoubts = doubts.filter(d => {
    if (filter === 'PENDING') return d.status === 'PENDING';
    if (filter === 'ANSWERED') return d.status === 'ANSWERED';
    return true;
  });

  const pendingCount = doubts.filter(d => d.status === 'PENDING').length;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shadow-sm">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">In-Session Doubt Queue</h3>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500 text-white animate-pulse">
                  {pendingCount} active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">Live student doubts with peer upvoting & faculty answers</p>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${filter === 'ALL' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
          >
            All ({doubts.length})
          </button>
          <button
            onClick={() => setFilter('PENDING')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${filter === 'PENDING' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Active ({pendingCount})
          </button>
        </div>
      </div>

      {/* Student Question Submission Form */}
      {!isFaculty && (
        <form onSubmit={handleSubmitDoubt} className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="relative">
            <input
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Ask a question without interrupting lecture..."
              className="w-full pl-4 pr-24 py-3 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 dark:text-white placeholder:text-slate-400 shadow-xs"
              maxLength={500}
            />
            <button
              type="submit"
              disabled={submitting || !question.trim()}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask</span>
            </button>
          </div>

          <div className="flex items-center justify-between mt-2.5 px-1 text-xs text-slate-500">
            <button
              type="button"
              onClick={() => setIsAnonymous(prev => !prev)}
              className={`flex items-center gap-1.5 font-medium transition-colors ${isAnonymous ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {isAnonymous ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{isAnonymous ? 'Asking Anonymously' : 'Ask with my name'}</span>
            </button>
            <span className="text-[11px] text-slate-400">Class peers can upvote your question (+1)</span>
          </div>
        </form>
      )}

      {/* Doubts List */}
      <div className="p-4 space-y-3 overflow-y-auto max-h-[420px] flex-1">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading classroom doubts...</div>
        ) : filteredDoubts.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-500" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No questions in the queue yet</p>
            <p className="text-xs text-slate-400 mt-1">Questions asked will appear live with peer upvotes</p>
          </div>
        ) : (
          filteredDoubts.map(d => {
            const isAnswered = d.status === 'ANSWERED';
            const isDismissed = d.status === 'DISMISSED';

            return (
              <div
                key={d.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isAnswered
                    ? 'bg-emerald-50/40 dark:bg-emerald-500/5 border-emerald-200/60 dark:border-emerald-500/20'
                    : isDismissed
                    ? 'bg-slate-50/50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-800 opacity-60'
                    : 'bg-white dark:bg-slate-800/60 border-slate-200/90 dark:border-slate-700/80 hover:border-amber-500/40 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {d.authorName}
                      </span>
                      {d.isAnonymous && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-500">
                          Anonymous
                        </span>
                      )}
                      {d.isAuthor && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                          You
                        </span>
                      )}
                      {isAnswered && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Answered
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-slate-900 dark:text-slate-100 break-words leading-relaxed font-normal">
                      {d.question}
                    </p>

                    <div className="text-[11px] text-slate-400">
                      {new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {/* Upvote & Action buttons */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {!isFaculty ? (
                      <button
                        onClick={() => handleToggleUpvote(d.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                          d.hasUpvoted
                            ? 'bg-amber-500 text-white shadow-amber-500/30'
                            : 'bg-slate-100 hover:bg-amber-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-amber-600'
                        }`}
                        title="Upvote / Me Too (+1)"
                      >
                        <ThumbsUp className={`w-3.5 h-3.5 ${d.hasUpvoted ? 'fill-white' : ''}`} />
                        <span>{d.upvotesCount}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-xl text-xs font-bold border border-amber-200/50 dark:border-amber-500/20">
                          <ThumbsUp className="w-3.5 h-3.5" />
                          {d.upvotesCount}
                        </span>

                        {!isAnswered && (
                          <button
                            onClick={() => handleUpdateStatus(d.id, 'ANSWERED')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-xl flex items-center gap-1 transition-colors shadow-xs"
                            title="Mark as Answered"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Answered</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
