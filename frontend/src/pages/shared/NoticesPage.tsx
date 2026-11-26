import { useState, useEffect } from 'react';
import { sharedApi } from '../../api/shared';
import type { Notice } from '../../api/shared';
import { useAuthStore } from '../../stores/authStore';
import { Megaphone, Pin, Clock, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NoticesPage() {
  const { user } = useAuthStore();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audienceType, setAudienceType] = useState('ALL');
  const [audienceRefId, setAudienceRefId] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  const canCreate = user?.role === ('IT_ADMIN' as any) || user?.role === 'IT_ADMIN' || user?.role === 'FACULTY';

  useEffect(() => {
    loadNotices();
  }, []);

  const loadNotices = async () => {
    setLoading(true);
    try {
      const data = await sharedApi.notices.list();
      setNotices(data);
    } catch (err) {
      toast.error('Failed to load notices');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) {
      toast.error('Title and body are required');
      return;
    }
    try {
      const newNotice = await sharedApi.notices.create({
        title,
        body,
        audienceType,
        audienceRefId: audienceRefId || null,
        isPinned,
      });
      setNotices([newNotice, ...notices].sort((a, b) => Number(b.isPinned) - Number(a.isPinned)));
      setShowCreateModal(false);
      setTitle('');
      setBody('');
      setAudienceType('ALL');
      setAudienceRefId('');
      setIsPinned(false);
      toast.success('Notice published');
    } catch (err) {
      toast.error('Failed to create notice');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-indigo-500" />
            Notice Board
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Important announcements and updates
          </p>
        </div>
        
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            Post Notice
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading notices...</div>
      ) : notices.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-3 opacity-50" />
          <p className="text-slate-500 font-medium">No notices found</p>
          <p className="text-sm text-slate-400 mt-1">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notices.map((notice) => (
            <div
              key={notice.id}
              className={`p-6 rounded-2xl border transition-all ${
                notice.isPinned
                  ? 'bg-indigo-50/50 border-indigo-200 dark:bg-indigo-500/5 dark:border-indigo-500/20'
                  : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  {notice.isPinned && <Pin size={16} className="text-indigo-500" />}
                  <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
                    {notice.title}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium whitespace-nowrap">
                  <Clock size={12} />
                  {new Date(notice.createdAt).toLocaleDateString()}
                </div>
              </div>
              
              <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed mt-3">
                {notice.body}
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Posted by {notice.createdBy.username}</span>
                <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 uppercase tracking-wider font-semibold">
                  {notice.audienceType.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Notice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Post New Notice</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white transition-all"
                  placeholder="e.g., Holiday Announcement"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Message
                </label>
                <textarea
                  required
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white transition-all resize-none"
                  placeholder="Enter the notice details here..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Audience Type
                  </label>
                  <select
                    value={audienceType}
                    onChange={e => setAudienceType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 dark:text-white transition-all"
                  >
                    <option value="ALL">All Users</option>
                    <option value="ALL_STUDENTS">All Students</option>
                    <option value="ALL_FACULTY">All Faculty</option>
                    <option value="BRANCH">Specific Branch</option>
                    <option value="CLASS">Specific Class</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Reference ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={audienceRefId}
                    onChange={e => setAudienceRefId(e.target.value)}
                    disabled={audienceType.startsWith('ALL')}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 dark:text-white disabled:opacity-50 transition-all"
                    placeholder={audienceType.startsWith('ALL') ? 'Not needed' : 'Paste Class/Branch ID'}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer mt-2 w-max">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={e => setIsPinned(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Pin this notice to the top
                </span>
              </label>

              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl font-medium transition-colors"
                >
                  Publish Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
