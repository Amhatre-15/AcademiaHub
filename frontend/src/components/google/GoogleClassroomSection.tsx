import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  googleClassroomApi,
  type GoogleMaterialItem,
} from '../../api/googleClassroom';
import { GoogleConnectButton } from './GoogleConnectButton';
import { getApiError } from '../../api/client';
import { Modal } from '../ui/Modal';
import toast from 'react-hot-toast';
import {
  BookOpen,
  FileText,
  MessageSquare,
  ClipboardList,
  Download,
  ExternalLink,
  Copy,
  Check,
  Plus,
  Unlink,
  RefreshCw,
  Search,
  Video,
  File,
  AlertCircle,
  Hash,
} from 'lucide-react';
import { format } from 'date-fns';

interface GoogleClassroomSectionProps {
  classId: string;
  subjectId?: string;
  isFaculty?: boolean;
  className?: string;
}

export function GoogleClassroomSection({
  classId,
  subjectId,
  isFaculty = false,
  className = '',
}: GoogleClassroomSectionProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'materials' | 'announcements' | 'assignments'>('materials');
  const [search, setSearch] = useState('');
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Link Form State
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [inputClassroomCode, setInputClassroomCode] = useState('');

  // Fetch linked classroom details
  const {
    data: details,
    isLoading: isDetailsLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['google-classroom-details', classId, subjectId],
    queryFn: () => googleClassroomApi.getDetails({ classId, subjectId }),
    enabled: !!classId,
  });

  // Fetch available courses (if faculty has connected Google)
  const { data: courses, isLoading: isCoursesLoading } = useQuery({
    queryKey: ['google-classroom-courses'],
    queryFn: googleClassroomApi.getCourses,
    enabled: isLinkModalOpen,
    retry: false,
  });

  // Link Mutation
  const linkMutation = useMutation({
    mutationFn: (data: { googleCourseId?: string; enrollmentCode?: string }) =>
      googleClassroomApi.linkCourse({
        classId,
        subjectId,
        ...data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-classroom-details', classId, subjectId] });
      toast.success('Google Classroom linked successfully!');
      setIsLinkModalOpen(false);
      setSelectedCourseId('');
      setInputClassroomCode('');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });

  // Unlink Mutation
  const unlinkMutation = useMutation({
    mutationFn: (linkId: string) => googleClassroomApi.unlinkCourse(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-classroom-details', classId, subjectId] });
      toast.success('Google Classroom unlinked');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success('Classroom code copied to clipboard!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId && !inputClassroomCode.trim()) {
      toast.error('Please select a course or enter a classroom code');
      return;
    }

    linkMutation.mutate({
      googleCourseId: selectedCourseId || undefined,
      enrollmentCode: inputClassroomCode.trim() || undefined,
    });
  };

  // Filter items based on search query
  const filteredMaterials = details?.materials?.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      (m.description && m.description.toLowerCase().includes(q))
    );
  });

  const filteredAnnouncements = details?.announcements?.filter((a) => {
    if (!search) return true;
    return a.text.toLowerCase().includes(search.toLowerCase());
  });

  const filteredAssignments = details?.courseWork?.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Banner / Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-900/80 dark:via-teal-900/80 dark:to-cyan-900/80 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 transform skew-x-12 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-semibold backdrop-blur-sm flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                Google Classroom Sync
              </span>
              {details?.link?.section && (
                <span className="px-2 py-0.5 rounded-md bg-black/20 text-white/90 text-xs font-medium">
                  Section: {details.link.section}
                </span>
              )}
            </div>

            <h2 className="text-2xl font-bold tracking-tight">
              {details?.linked
                ? details.link?.googleCourseName
                : 'Google Classroom Integration'}
            </h2>

            <p className="text-white/80 text-sm max-w-xl">
              {details?.linked
                ? 'All materials, announcements, and coursework synced directly from Google Classroom inside AcademicHub.'
                : 'Connect your Google account and link this subject to access course materials and announcements directly in the platform.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <GoogleConnectButton className="bg-white/10 backdrop-blur-sm rounded-xl p-1" />

            {details?.linked ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => refetch()}
                  disabled={isRefetching}
                  className="p-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all backdrop-blur-sm"
                  title="Refresh classroom content"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
                </button>

                {isFaculty && details.link && (
                  <button
                    type="button"
                    onClick={() => unlinkMutation.mutate(details.link!.id)}
                    disabled={unlinkMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-white border border-red-300/30 text-xs font-medium backdrop-blur-sm transition-all"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    Unlink
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-teal-800 hover:bg-white/90 font-semibold text-xs shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                {isFaculty ? 'Link Classroom' : 'Enter Classroom Code'}
              </button>
            )}
          </div>
        </div>

        {/* Classroom Code Banner (When linked and code is present) */}
        {details?.linked && details.link?.enrollmentCode && (
          <div className="mt-5 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-white/80">Classroom Code:</span>
              <span className="px-2.5 py-1 rounded-lg bg-black/25 font-mono font-bold tracking-widest text-emerald-200 border border-white/10">
                {details.link.enrollmentCode}
              </span>
              <button
                type="button"
                onClick={() => handleCopyCode(details.link!.enrollmentCode!)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Copy Classroom Code"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4 text-white/80" />}
              </button>
            </div>

            {details.link.alternateLink && (
              <a
                href={details.link.alternateLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-white/80 hover:text-white underline underline-offset-2"
              >
                Open in Google Classroom
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {isDetailsLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-teal-600" />
          <p className="text-sm font-medium">Loading Google Classroom content...</p>
        </div>
      ) : !details?.linked ? (
        /* Empty / Not Linked State */
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              No Google Classroom Linked
            </h3>
            <p className="text-sm text-slate-500">
              {isFaculty
                ? 'Link your Google Classroom course to this subject so students can access materials and announcements directly here.'
                : 'Your faculty has not linked a classroom yet, or you can enter the Classroom Code provided by your teacher.'}
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => setIsLinkModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm flex items-center gap-2 shadow-sm transition-all"
            >
              <Hash className="w-4 h-4" />
              {isFaculty ? 'Connect & Link Course' : 'Enter Classroom Code'}
            </button>
          </div>
        </div>
      ) : (
        /* Linked View with Tabs */
        <div className="space-y-5">
          {/* Controls: Search & Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setActiveTab('materials')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'materials'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Materials ({details.materials?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('announcements')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'announcements'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Announcements ({details.announcements?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('assignments')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'assignments'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Assignments ({details.courseWork?.length || 0})
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Warning notice if partial API error */}
          {details.errorNotice && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{details.errorNotice}</span>
            </div>
          )}

          {/* TAB 1: Materials */}
          {activeTab === 'materials' && (
            <div className="space-y-4">
              {filteredMaterials?.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <FileText className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-50" />
                  <p className="text-sm font-medium">No coursework materials found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredMaterials?.map((m) => (
                    <div
                      key={m.id}
                      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-teal-400 dark:hover:border-teal-500/50 transition-all space-y-3"
                    >
                      <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-1">
                          {m.title}
                        </h4>
                        {m.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                            {m.description}
                          </p>
                        )}
                        {m.updateTime && (
                          <p className="text-[11px] text-slate-400 mt-1">
                            Updated {format(new Date(m.updateTime), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>

                      {/* Attachments */}
                      {m.materials && m.materials.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                          {m.materials.map((mat, i) => (
                            <MaterialItemRenderer key={i} item={mat} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Announcements */}
          {activeTab === 'announcements' && (
            <div className="space-y-4">
              {filteredAnnouncements?.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <MessageSquare className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-50" />
                  <p className="text-sm font-medium">No announcements published.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAnnouncements?.map((a) => (
                    <div
                      key={a.id}
                      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-medium text-teal-600 dark:text-teal-400">
                          Class Announcement
                        </span>
                        <span>{a.updateTime ? format(new Date(a.updateTime), 'MMM d, yyyy h:mm a') : ''}</span>
                      </div>
                      <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {a.text}
                      </p>

                      {a.materials && a.materials.length > 0 && (
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                          {a.materials.map((mat, i) => (
                            <MaterialItemRenderer key={i} item={mat} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Assignments */}
          {activeTab === 'assignments' && (
            <div className="space-y-4">
              {filteredAssignments?.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <ClipboardList className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-50" />
                  <p className="text-sm font-medium">No coursework assignments found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredAssignments?.map((cw) => (
                    <div
                      key={cw.id}
                      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
                          {cw.title}
                        </h4>
                        {cw.maxPoints !== undefined && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold shrink-0">
                            {cw.maxPoints} pts
                          </span>
                        )}
                      </div>

                      {cw.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3">
                          {cw.description}
                        </p>
                      )}

                      {cw.dueDate && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                          <span>
                            Due:{' '}
                            {format(
                              new Date(cw.dueDate.year, cw.dueDate.month - 1, cw.dueDate.day),
                              'MMM d, yyyy'
                            )}
                          </span>
                          {cw.dueTime && (
                            <span>
                              {' '}
                              at {String(cw.dueTime.hours).padStart(2, '0')}:
                              {String(cw.dueTime.minutes || 0).padStart(2, '0')}
                            </span>
                          )}
                        </div>
                      )}

                      {cw.materials && cw.materials.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                          {cw.materials.map((mat, i) => (
                            <MaterialItemRenderer key={i} item={mat} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Link Classroom Modal */}
      {isLinkModalOpen && (
        <Modal
          isOpen={isLinkModalOpen}
          onClose={() => setIsLinkModalOpen(false)}
          title={isFaculty ? 'Link Google Classroom Course' : 'Enter Classroom Code'}
        >
          <form onSubmit={handleLinkSubmit} className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isFaculty
                ? 'Select a course from your connected Google account or enter the classroom code/ID directly.'
                : 'Enter the classroom code given by your teacher to access this course directly inside AcademicHub.'}
            </p>

            {/* If Faculty & Courses available */}
            {isFaculty && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Select from your Google Courses
                </label>
                {isCoursesLoading ? (
                  <div className="text-xs text-slate-400 py-2">Loading your courses...</div>
                ) : courses && courses.length > 0 ? (
                  <select
                    value={selectedCourseId}
                    onChange={(e) => {
                      setSelectedCourseId(e.target.value);
                      if (e.target.value) setInputClassroomCode('');
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="">-- Choose a Google Classroom course --</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.section ? `(${c.section})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-xs text-slate-400 py-1">
                    No courses found or Google account not connected yet. You can connect above or enter the code below.
                  </div>
                )}
              </div>
            )}

            {/* Classroom Code Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isFaculty ? 'Or enter Classroom Code / Course ID' : 'Classroom Code'}
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  value={inputClassroomCode}
                  onChange={(e) => {
                    setInputClassroomCode(e.target.value);
                    if (e.target.value) setSelectedCourseId('');
                  }}
                  placeholder="e.g. 7xkp9qa"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono tracking-wider uppercase focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={linkMutation.isPending}
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
              >
                {linkMutation.isPending ? 'Linking...' : 'Link to Subject'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/**
 * Helper to render individual Google Drive files, YouTube videos, and links
 */
function MaterialItemRenderer({ item }: { item: GoogleMaterialItem }) {
  if (item.driveFile?.driveFile) {
    const file = item.driveFile.driveFile;
    const downloadUrl = googleClassroomApi.getDriveDownloadUrl(file.id);

    return (
      <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs">
        <div className="flex items-center gap-2 truncate">
          <File className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
            {file.title}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            download
            className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-300 font-medium flex items-center gap-1 text-[11px] transition-colors"
            title="Download via AcademicHub Proxy"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </a>

          {file.alternateLink && (
            <a
              href={file.alternateLink}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              title="Open in Drive"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    );
  }

  if (item.youtubeVideo) {
    const vid = item.youtubeVideo;
    return (
      <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs">
        <div className="flex items-center gap-2 truncate">
          <Video className="w-4 h-4 text-red-500 shrink-0" />
          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
            {vid.title}
          </span>
        </div>
        <a
          href={vid.alternateLink}
          target="_blank"
          rel="noreferrer"
          className="text-red-600 hover:underline flex items-center gap-1 text-[11px] shrink-0"
        >
          Watch Video
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }

  if (item.link) {
    const link = item.link;
    return (
      <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs">
        <div className="flex items-center gap-2 truncate">
          <ExternalLink className="w-4 h-4 text-indigo-500 shrink-0" />
          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
            {link.title || link.url}
          </span>
        </div>
        <a
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="text-indigo-600 hover:underline text-[11px] shrink-0"
        >
          Open Link
        </a>
      </div>
    );
  }

  return null;
}
