import { useState, useEffect, useRef, useCallback } from 'react';
import { Book, Plus, Search, Trash2, Clock, AlignLeft, X, Save } from 'lucide-react';
import { studentApi, type StudentNote } from '../../api/student';
import toast from 'react-hot-toast';

export default function StudentNotebookPage() {
  const [notes, setNotes] = useState<StudentNote[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [context, setContext] = useState<{ classes: any[]; subjects: any[] }>({ classes: [], subjects: [] });

  // Editor State
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const activeNote = notes.find(n => n.id === activeNoteId);

  useEffect(() => {
    loadContext();
  }, []);

  useEffect(() => {
    loadNotes();
  }, [searchQuery, selectedClass, selectedSubject]);

  const loadContext = async () => {
    try {
      const data = await studentApi.notes.getContext();
      setContext(data);
    } catch (err) {
      console.error('Failed to load note context', err);
    }
  };

  const loadNotes = async () => {
    setLoading(true);
    try {
      const data = await studentApi.notes.list({
        q: searchQuery || undefined,
        classId: selectedClass || undefined,
        subjectId: selectedSubject || undefined,
      });
      setNotes(data);
    } catch (err) {
      toast.error('Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async () => {
    try {
      const newNote = await studentApi.notes.create({
        title: 'Untitled Note',
        content: '',
      });
      setNotes([newNote, ...notes]);
      setActiveNoteId(newNote.id);
      toast.success('Note created');
    } catch (err) {
      toast.error('Failed to create note');
    }
  };

  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this note?')) return;
    
    try {
      await studentApi.notes.delete(id);
      setNotes(notes.filter(n => n.id !== id));
      if (activeNoteId === id) setActiveNoteId(null);
      toast.success('Note deleted');
    } catch (err) {
      toast.error('Failed to delete note');
    }
  };

  // Editor updates
  const handleUpdateNote = (id: string, updates: Partial<StudentNote>) => {
    setNotes(notes.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n));
  };

  return (
    <div className="h-[calc(100vh-64px)] lg:h-screen flex flex-col md:flex-row bg-[#f8fafc] dark:bg-[#020817] overflow-hidden">
      {/* Sidebar: Notes List */}
      <div className={`${activeNoteId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Book className="w-5 h-5 text-indigo-500" />
              My Notebook
            </h1>
            <button
              onClick={handleCreateNote}
              className="p-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-xl transition-colors"
              title="New Note"
            >
              <Plus size={20} />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-indigo-500 dark:text-white transition-colors"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="">All Classes</option>
              {context.classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
              className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="">All Subjects</option>
              {context.subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {loading ? (
            <div className="text-center py-8 text-slate-500 text-sm">Loading notes...</div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8 px-4">
              <AlignLeft className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm font-medium">No notes found</p>
              <p className="text-slate-400 text-xs mt-1">Create a new note to get started.</p>
            </div>
          ) : (
            notes.map(note => (
              <div
                key={note.id}
                onClick={() => setActiveNoteId(note.id)}
                className={`p-3 rounded-xl cursor-pointer transition-all border ${
                  activeNoteId === note.id
                    ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/30'
                    : 'bg-white border-slate-100 hover:border-slate-300 dark:bg-slate-900/50 dark:border-slate-800 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className={`font-medium truncate text-sm ${activeNoteId === note.id ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-800 dark:text-slate-200'}`}>
                    {note.title || 'Untitled Note'}
                  </h3>
                  <button
                    onClick={(e) => handleDeleteNote(note.id, e)}
                    className="opacity-0 group-hover:opacity-100 md:opacity-100 text-slate-400 hover:text-rose-500 transition-colors p-1 -mr-1 -mt-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2 min-h-[2rem]">
                  {note.content || <span className="italic opacity-50">Empty note...</span>}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Clock size={10} />
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </div>
                  {(note.subject || note.session) && (
                    <div className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                      {note.subject?.name || 'Class Note'}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Area: Editor */}
      <div className={`${!activeNoteId ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-white dark:bg-[#020817] relative`}>
        {activeNote ? (
          <NoteEditor
            key={activeNote.id}
            note={activeNote}
            context={context}
            onClose={() => setActiveNoteId(null)}
            onChange={(updates) => handleUpdateNote(activeNote.id, updates)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
            <Book className="w-16 h-16 text-slate-200 dark:text-slate-800 mb-4" />
            <p className="text-lg font-medium text-slate-600 dark:text-slate-400">Select a note to view or edit</p>
            <p className="text-sm mt-2 text-center max-w-sm">
              Your notes auto-save as you type. You can organize them by class and subject.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Editor Component ─────────────────────────────────────────────────────────

function NoteEditor({
  note,
  context,
  onClose,
  onChange,
}: {
  note: StudentNote;
  context: { classes: any[]; subjects: any[] };
  onClose: () => void;
  onChange: (updates: Partial<StudentNote>) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [classId, setClassId] = useState(note.classId || '');
  const [subjectId, setSubjectId] = useState(note.subjectId || '');
  const [saving, setSaving] = useState(false);
  
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync state if note changes from outside (e.g. clicking another note)
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setClassId(note.classId || '');
    setSubjectId(note.subjectId || '');
  }, [note.id]);

  const saveToBackend = useCallback(async (updates: Partial<StudentNote>) => {
    setSaving(true);
    try {
      await studentApi.notes.update(note.id, updates);
    } catch (err) {
      toast.error('Failed to save note');
    } finally {
      setSaving(false);
    }
  }, [note.id]);

  const triggerSave = (updates: Partial<StudentNote>) => {
    onChange(updates);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveToBackend(updates);
    }, 1000);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    triggerSave({ title: e.target.value });
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    triggerSave({ content: e.target.value });
  };

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value || null;
    setClassId(val || '');
    triggerSave({ classId: val });
  };

  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value || null;
    setSubjectId(val || '');
    triggerSave({ subjectId: val });
  };

  return (
    <div className="flex-1 flex flex-col h-full max-h-full overflow-hidden">
      {/* Editor Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#020817] shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={onClose}
            className="md:hidden p-2 -ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <select
              value={classId}
              onChange={handleClassChange}
              className="bg-transparent border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 max-w-[120px] truncate"
            >
              <option value="">No Class</option>
              {context.classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            
            <select
              value={subjectId}
              onChange={handleSubjectChange}
              className="bg-transparent border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 max-w-[120px] truncate"
            >
              <option value="">No Subject</option>
              {context.subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 shrink-0 ml-4">
          {saving ? (
            <span className="flex items-center gap-1 text-indigo-500"><Save size={14} className="animate-pulse" /> Saving...</span>
          ) : (
            <span className="flex items-center gap-1"><CheckCircleIcon /> Saved</span>
          )}
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 flex flex-col p-6 lg:p-10 max-w-4xl mx-auto w-full overflow-hidden">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Note Title"
          className="text-3xl lg:text-4xl font-bold bg-transparent border-none outline-none text-slate-900 dark:text-white mb-6 placeholder:text-slate-300 dark:placeholder:text-slate-700 shrink-0"
        />
        
        <textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Start writing your notes here..."
          className="flex-1 w-full bg-transparent border-none outline-none text-slate-700 dark:text-slate-300 resize-none text-lg leading-relaxed placeholder:text-slate-400 custom-scrollbar"
        />
      </div>
    </div>
  );
}

function CheckCircleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  );
}
