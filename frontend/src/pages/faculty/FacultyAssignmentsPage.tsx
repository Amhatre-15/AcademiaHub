import { useState, useEffect } from 'react';
import type { FacultyAssignment } from '../../api/faculty';
import { Plus, FileText, CheckCircle, Download, BookOpen, X } from 'lucide-react';
import { facultyApi } from '../../api/faculty';
import toast from 'react-hot-toast';

export default function FacultyAssignmentsPage() {
  const [assignments, setAssignments] = useState<FacultyAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Selection
  const [selectedAssignment, setSelectedAssignment] = useState<FacultyAssignment | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [classId, setClassId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [maxMarks, setMaxMarks] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const data = await facultyApi.assignments.list();
      setAssignments(data);
    } catch (err) {
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !subjectId || !classId) {
      toast.error('Missing required fields');
      return;
    }
    
    const formData = new FormData();
    formData.append('title', title);
    if (description) formData.append('description', description);
    formData.append('subjectId', subjectId);
    formData.append('classId', classId);
    if (deadline) formData.append('deadline', new Date(deadline).toISOString());
    if (maxMarks) formData.append('maxMarks', maxMarks);
    if (file) formData.append('file', file);

    try {
      const newAssignment = await facultyApi.assignments.create(formData);
      setAssignments([newAssignment, ...assignments]);
      setShowCreateModal(false);
      resetForm();
      toast.success('Assignment created');
    } catch (err) {
      toast.error('Failed to create assignment');
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSubjectId('');
    setClassId('');
    setDeadline('');
    setMaxMarks('');
    setFile(null);
  };

  const openAssignment = async (id: string) => {
    try {
      const data = await facultyApi.assignments.get(id);
      setSelectedAssignment(data);
    } catch (err) {
      toast.error('Failed to load assignment details');
    }
  };

  const handleGrade = async (submissionId: string, grade: number, feedback: string) => {
    if (!selectedAssignment) return;
    try {
      await facultyApi.assignments.grade(selectedAssignment.id, submissionId, { grade, feedback });
      toast.success('Submission graded successfully');
      // Refresh
      openAssignment(selectedAssignment.id);
    } catch (err) {
      toast.error('Failed to grade submission');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-64px)] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-500" />
            Assignments
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Manage course assignments and grade submissions
          </p>
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          New Assignment
        </button>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Assignment List Sidebar */}
        <div className="w-1/3 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-2">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading assignments...</div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3 opacity-50" />
              <p className="text-slate-500 font-medium text-sm">No assignments yet</p>
            </div>
          ) : (
            assignments.map(a => (
              <div
                key={a.id}
                onClick={() => openAssignment(a.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedAssignment?.id === a.id
                    ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/30'
                    : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-white">{a.title}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    a.status === 'PUBLISHED' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {a.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-1">
                  <span>{a.subject?.name} • {a.class?.name}</span>
                  {a.deadline && (
                    <span className={new Date(a.deadline) < new Date() ? 'text-rose-500' : ''}>
                      Due: {new Date(a.deadline).toLocaleDateString()}
                    </span>
                  )}
                  <span className="font-medium text-indigo-600 dark:text-indigo-400 mt-1">
                    {a._count?.submissions || 0} Submissions
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detailed View & Grading */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
          {selectedAssignment ? (
            <div className="flex flex-col h-full">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedAssignment.title}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 whitespace-pre-wrap">
                  {selectedAssignment.description || 'No description provided.'}
                </p>
                {selectedAssignment.files && selectedAssignment.files.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedAssignment.files.map((f: any) => (
                      <a
                        key={f.id}
                        href={f.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Download size={14} />
                        {f.fileName}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-[#020817]/50">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  Student Submissions
                  <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full text-xs">
                    {selectedAssignment.submissions?.length || 0}
                  </span>
                </h3>
                
                <div className="space-y-4">
                  {selectedAssignment.submissions?.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm">
                      No submissions yet for this assignment.
                    </div>
                  ) : (
                    selectedAssignment.submissions?.map((sub: any) => (
                      <div key={sub.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                              {sub.student?.firstName} {sub.student?.lastName}
                              {sub.status === 'GRADED' && <CheckCircle size={14} className="text-green-500" />}
                            </div>
                            <div className="text-xs text-slate-500">PRN: {sub.student?.prn} • Submitted on {new Date(sub.submittedAt).toLocaleDateString()}</div>
                          </div>
                          {sub.downloadUrl && (
                            <a
                              href={sub.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs flex items-center gap-1 font-medium bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-lg"
                            >
                              <Download size={14} />
                              View Work
                            </a>
                          )}
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                          {sub.status === 'GRADED' ? (
                            <div className="bg-green-50 dark:bg-green-500/5 border border-green-100 dark:border-green-500/10 p-3 rounded-lg">
                              <div className="font-semibold text-green-800 dark:text-green-400 text-sm">Grade: {sub.grade} / {selectedAssignment.maxMarks || '-'}</div>
                              {sub.feedback && <p className="text-green-700 dark:text-green-500 text-xs mt-1">"{sub.feedback}"</p>}
                            </div>
                          ) : (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const fd = new FormData(e.currentTarget);
                                handleGrade(sub.id, Number(fd.get('grade')), fd.get('feedback') as string);
                              }}
                              className="flex items-end gap-3"
                            >
                              <div className="flex-1">
                                <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase tracking-wider">Feedback</label>
                                <input name="feedback" type="text" placeholder="Add comments..." className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:border-indigo-500 outline-none" />
                              </div>
                              <div className="w-24">
                                <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase tracking-wider">Marks / {selectedAssignment.maxMarks}</label>
                                <input name="grade" type="number" required max={selectedAssignment.maxMarks || undefined} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:border-indigo-500 outline-none" />
                              </div>
                              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
                                Grade
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select an assignment to view details and submissions.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Create Assignment</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Title</label>
                <input required value={title} onChange={e => setTitle(e.target.value)} type="text" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Class ID</label>
                  <input required value={classId} onChange={e => setClassId(e.target.value)} type="text" placeholder="UUID" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Subject ID</label>
                  <input required value={subjectId} onChange={e => setSubjectId(e.target.value)} type="text" placeholder="UUID" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Deadline</label>
                  <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Max Marks</label>
                  <input type="number" value={maxMarks} onChange={e => setMaxMarks(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Attachment (Optional)</label>
                <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
              </div>

              <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800 flex gap-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700">Publish</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
