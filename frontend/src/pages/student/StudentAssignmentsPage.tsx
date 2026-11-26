import { useState, useEffect } from 'react';
import { studentApi } from '../../api/student';
import type { StudentAssignment } from '../../api/student';
import { FileText, CheckCircle, Upload, Download, Clock, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<StudentAssignment | null>(null);
  
  // Submission Form
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const data = await studentApi.assignments.list();
      setAssignments(data);
    } catch (err) {
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const openAssignment = async (id: string) => {
    try {
      const data = await studentApi.assignments.get(id);
      setSelectedAssignment(data);
      setFile(null); // reset file input
    } catch (err) {
      toast.error('Failed to load assignment details');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment || !file) {
      toast.error('Please select a file to upload');
      return;
    }
    
    setSubmitting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await studentApi.assignments.submit(selectedAssignment.id, formData);
      toast.success('Assignment submitted successfully!');
      // Refresh assignment data to show submission status
      openAssignment(selectedAssignment.id);
      loadAssignments(); // update list view too
    } catch (err) {
      toast.error('Failed to submit assignment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-64px)] flex flex-col md:flex-row gap-6">
      {/* Assignments List */}
      <div className={`w-full md:w-1/3 flex flex-col gap-3 ${selectedAssignment ? 'hidden md:flex' : 'flex'}`}>
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-500" />
            My Assignments
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading assignments...</div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3 opacity-50" />
              <p className="text-slate-500 font-medium">No pending assignments</p>
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
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-1">{a.title}</h3>
                  {a.submissions && a.submissions.length > 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-1">
                  <span>{a.subject?.name}</span>
                  {a.deadline && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      Due {new Date(a.deadline).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Assignment Details */}
      <div className={`flex-1 flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden ${!selectedAssignment ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        {!selectedAssignment ? (
          <div className="text-center text-slate-400 p-8">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="font-medium text-slate-600 dark:text-slate-400">Select an assignment to view details</p>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-y-auto">
            {/* Header */}
            <div className="p-6 md:p-8 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <button 
                onClick={() => setSelectedAssignment(null)}
                className="md:hidden mb-4 text-sm text-indigo-600 font-medium flex items-center gap-1"
              >
                &larr; Back to list
              </button>
              
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedAssignment.title}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-slate-500 dark:text-slate-400">
                <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md font-medium text-slate-700 dark:text-slate-300">
                  {selectedAssignment.subject?.name}
                </span>
                <span>By Prof. {selectedAssignment.faculty?.lastName}</span>
                {selectedAssignment.maxMarks && <span>• Max Marks: {selectedAssignment.maxMarks}</span>}
                {selectedAssignment.deadline && (
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                    <Clock size={14} /> Due: {new Date(selectedAssignment.deadline).toLocaleString()}
                  </span>
                )}
              </div>
              
              <div className="mt-6 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {selectedAssignment.description || 'No description provided.'}
              </div>

              {selectedAssignment.files && selectedAssignment.files.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  <div className="w-full text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Attachments</div>
                  {selectedAssignment.files.map((f: any) => (
                    <a
                      key={f.id}
                      href={f.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Download size={14} />
                      {f.fileName}
                    </a>
                  ))}
                </div>
              )}
            </div>
            
            {/* Submission Section */}
            <div className="p-6 md:p-8 bg-slate-50/50 dark:bg-[#020817]/50 flex-1">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Your Submission</h3>
              
              {selectedAssignment.submission ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-500 font-medium text-sm">
                      <CheckCircle size={18} />
                      Submitted on {new Date(selectedAssignment.submission.submittedAt).toLocaleString()}
                    </div>
                    <span className="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded uppercase tracking-wider">
                      {selectedAssignment.submission.status}
                    </span>
                  </div>
                  
                  {selectedAssignment.submission.downloadUrl && (
                    <a
                      href={selectedAssignment.submission.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Download size={16} />
                      {selectedAssignment.submission.fileName}
                    </a>
                  )}

                  {selectedAssignment.submission.status === 'GRADED' && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-sm">
                        <span className="font-medium text-slate-500">Grade: </span>
                        <span className="font-bold text-green-600 dark:text-green-400 text-lg">
                          {selectedAssignment.submission.grade} <span className="text-sm text-slate-400">/ {selectedAssignment.maxMarks}</span>
                        </span>
                      </div>
                      {selectedAssignment.submission.feedback && (
                        <div className="mt-2 text-sm text-slate-700 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                          "{selectedAssignment.submission.feedback}"
                        </div>
                      )}
                    </div>
                  )}
                  
                  {selectedAssignment.submission.status !== 'GRADED' && (
                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-xs text-slate-500 mb-2">Want to update your submission?</p>
                      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 items-end">
                        <div className="flex-1 w-full">
                          <input 
                            type="file" 
                            required
                            onChange={e => setFile(e.target.files?.[0] || null)} 
                            className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-500/10 dark:file:text-indigo-400 border border-slate-200 dark:border-slate-700 rounded-lg p-1 bg-white dark:bg-slate-800" 
                          />
                        </div>
                        <button 
                          type="submit" 
                          disabled={submitting}
                          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap w-full sm:w-auto justify-center"
                        >
                          <Upload size={16} />
                          {submitting ? 'Uploading...' : 'Re-submit'}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 md:p-8">
                  <form onSubmit={handleSubmit} className="flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center mb-4">
                      <Upload className="w-8 h-8 text-indigo-500" />
                    </div>
                    <h4 className="font-medium text-slate-900 dark:text-white mb-2">Upload your work</h4>
                    <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                      Select a PDF, DOCX, or ZIP file to submit for this assignment. Make sure you submit before the deadline!
                    </p>
                    
                    <input 
                      type="file" 
                      required
                      onChange={e => setFile(e.target.files?.[0] || null)} 
                      className="mb-4 w-full max-w-sm text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-500/10 dark:file:text-indigo-400 border border-slate-200 dark:border-slate-700 rounded-lg p-1" 
                    />
                    
                    <button 
                      type="submit" 
                      disabled={submitting}
                      className="w-full max-w-sm py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {submitting ? 'Uploading...' : 'Submit Assignment'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
