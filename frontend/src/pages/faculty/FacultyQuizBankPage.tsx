import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, BookOpen, Trash2, Edit3, Play, ChevronRight, X, CheckCircle2, Clock, Sparkles, Search } from 'lucide-react';
import { facultyApi, type Quiz, type QuizQuestion } from '../../api/faculty';
import { Pagination } from '../../components/ui/Pagination';
import toast from 'react-hot-toast';

// ─── Quiz List ────────────────────────────────────────────────────────────────

export default function FacultyQuizBankPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const { data, isLoading: loading } = useQuery({
    queryKey: ['faculty-quizzes', { search, page }],
    queryFn: () => facultyApi.quiz.list({ page, limit: LIMIT, search: search || undefined }),
  });

  const quizzes = data?.quizzes ?? [];

  const openEditor = async (quiz: Quiz) => {
    try {
      const full = await facultyApi.quiz.get(quiz.id);
      setSelectedQuiz(full);
      setView('editor');
    } catch {
      toast.error('Failed to load quiz');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this quiz? This cannot be undone.')) return;
    try {
      await facultyApi.quiz.delete(id);
      toast.success('Quiz deleted');
      qc.invalidateQueries({ queryKey: ['faculty-quizzes'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete quiz');
    }
  };

  const handleStart = async (id: string) => {
    try {
      await facultyApi.quiz.start(id);
      toast.success('Quiz started! Students can now join.');
      qc.invalidateQueries({ queryKey: ['faculty-quizzes'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to start quiz');
    }
  };

  if (view === 'editor' && selectedQuiz) {
    return (
      <QuizEditor
        quiz={selectedQuiz}
        onBack={() => { setView('list'); qc.invalidateQueries({ queryKey: ['faculty-quizzes'] }); }}
        
      />
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quiz Bank</h1>
          <p className="text-slate-500 text-sm mt-1">Create and manage quizzes for your classes</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52"
              placeholder="Search quizzes..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-500/20"
          >
            <Plus size={18} />
            New Quiz
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500">Loading quizzes...</div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <BookOpen className="w-14 h-14 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No quizzes yet</h3>
          <p className="text-slate-500 text-sm mb-6">Create your first quiz to engage students during live sessions.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all"
          >
            Create Quiz
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-6">
            {quizzes.map(quiz => (
              <QuizCard
                key={quiz.id}
                quiz={quiz}
                onEdit={() => openEditor(quiz)}
                onDelete={() => handleDelete(quiz.id)}
                onStart={() => handleStart(quiz.id)}
              />
            ))}
          </div>
          {data && data.totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={data.totalPages}
              total={data.total}
              limit={LIMIT}
              onPageChange={setPage}
              itemLabel="quizzes"
            />
          )}
        </>
      )}

      {showCreateModal && (
        <CreateQuizModal
          onClose={() => setShowCreateModal(false)}
          onCreate={async (newQuiz) => {
            setShowCreateModal(false);
            qc.invalidateQueries({ queryKey: ['faculty-quizzes'] });
            // Open editor immediately
            const full = await facultyApi.quiz.get(newQuiz.id);
            setSelectedQuiz(full);
            setView('editor');
          }}
        />
      )}
    </div>
  );
}

// ─── Quiz Card ────────────────────────────────────────────────────────────────

function QuizCard({
  quiz,
  onEdit,
  onDelete,
  onStart,
}: {
  quiz: Quiz;
  onEdit: () => void;
  onDelete: () => void;
  onStart: () => void;
}) {
  const statusColors = {
    DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    CLOSED: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <h3 className="font-semibold text-slate-900 dark:text-white truncate">{quiz.title}</h3>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${statusColors[quiz.status]}`}>
            {quiz.status}
          </span>
        </div>
        <p className="text-sm text-slate-500">
          {quiz.subject?.name} • {quiz.class?.name}
          {quiz._count && ` • ${quiz._count.questions} questions • ${quiz._count.attempts} attempts`}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {quiz.status === 'DRAFT' && (
          <>
            <button
              onClick={onStart}
              title="Start quiz in active session"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Play size={14} />
              Launch
            </button>
            <button
              onClick={onEdit}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
              title="Edit quiz"
            >
              <Edit3 size={16} />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
              title="Delete quiz"
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
        {quiz.status !== 'DRAFT' && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            View Results
            <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Create Quiz Modal ────────────────────────────────────────────────────────

function CreateQuizModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (quiz: Quiz) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [classId, setClassId] = useState('');
  const [mode, setMode] = useState<'MANUAL' | 'AUTOMATIC'>('MANUAL');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  useEffect(() => {
    // Load faculty assignments to populate subject/class dropdowns
    import('../../api/admin').then(() => {
      // We get the faculty assignments via the faculty context
      fetch('/api/faculty/timetable', {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
      })
        .then(r => r.json())
        .then((data: any[]) => {
          // Extract unique subject+class combos from timetable
          const seen = new Set<string>();
          const combos: any[] = [];
          data.forEach(entry => {
            const key = `${entry.subjectId}:${entry.classId}`;
            if (!seen.has(key)) {
              seen.add(key);
              combos.push({
                subjectId: entry.subjectId,
                subjectName: entry.subject?.name,
                classId: entry.classId,
                className: entry.class?.name,
              });
            }
          });
          setAssignments(combos);
          if (combos.length > 0) {
            setSubjectId(combos[0].subjectId);
            setClassId(combos[0].classId);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingAssignments(false));
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subjectId || !classId) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      setLoading(true);
      const quiz = await facultyApi.quiz.create({
        title: title.trim(),
        description: description.trim() || undefined,
        subjectId,
        classId,
        mode,
      });
      toast.success('Quiz created!');
      onCreate(quiz);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create quiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create New Quiz</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Quiz Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Apache Kafka – Week 3 Quiz"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Subject & Class *
            </label>
            {loadingAssignments ? (
              <div className="text-sm text-slate-500">Loading your assignments...</div>
            ) : (
              <select
                value={`${subjectId}:${classId}`}
                onChange={e => {
                  const [sid, cid] = e.target.value.split(':');
                  setSubjectId(sid);
                  setClassId(cid);
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                {assignments.map(a => (
                  <option key={`${a.subjectId}:${a.classId}`} value={`${a.subjectId}:${a.classId}`}>
                    {a.subjectName} — {a.className}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Mode
            </label>
            <div className="flex gap-3">
              {(['MANUAL', 'AUTOMATIC'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    mode === m
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {m === 'MANUAL' ? '🖐 Manual' : '⏱ Automatic'}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {mode === 'MANUAL'
                ? 'You control when each question appears.'
                : 'Questions advance automatically after their timer.'}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-all"
            >
              {loading ? 'Creating...' : 'Create & Add Questions'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Quiz Editor ──────────────────────────────────────────────────────────────

function QuizEditor({
  quiz,
  onBack,
}: {
  quiz: Quiz;
  onBack: () => void;
}) {
  const [questions, setQuestions] = useState<QuizQuestion[]>(quiz.questions || []);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [activeTab, setActiveTab] = useState<'questions' | 'results'>('questions');
  
  const [aiTopic, setAiTopic] = useState('');
  const [aiNumQuestions, setAiNumQuestions] = useState(5);
  const [generating, setGenerating] = useState(false);

  const handleGenerateAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTopic.trim()) return;
    
    setGenerating(true);
    try {
      const generatedQuestions = await facultyApi.ai.generateQuiz(
        quiz.subject?.name || 'General', 
        aiTopic, 
        aiNumQuestions
      );
      
      // Save each generated question sequentially
      let added = 0;
      for (const gq of generatedQuestions) {
        try {
          const saved = await facultyApi.quiz.addQuestion(quiz.id, {
            text: gq.text,
            type: 'MCQ',
            durationSeconds: 30, // Need to specify duration since points replaced it
            options: gq.options.map((o: any, i: number) => ({
              text: o.text,
              isCorrect: o.isCorrect,
              order: i
            })),
          });
          setQuestions(prev => [...prev, saved]);
          added++;
        } catch (err) {
          console.error('Failed to save individual AI question', err);
        }
      }
      
      toast.success(`Successfully added ${added} questions via AI!`);
      setShowAiModal(false);
      setAiTopic('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to generate quiz with AI');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Delete this question?')) return;
    try {
      await facultyApi.quiz.deleteQuestion(quiz.id, questionId);
      setQuestions(questions.filter(q => q.id !== questionId));
      toast.success('Question deleted');
    } catch {
      toast.error('Failed to delete question');
    }
  };

  const handleQuestionSaved = (question: QuizQuestion, isNew: boolean) => {
    if (isNew) {
      setQuestions([...questions, question]);
    } else {
      setQuestions(questions.map(q => (q.id === question.id ? question : q)));
    }
    setShowAddQuestion(false);
    setEditingQuestion(null);
  };

  const statusBadge = {
    DRAFT: <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">DRAFT</span>,
    ACTIVE: <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 animate-pulse">● LIVE</span>,
    CLOSED: <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">CLOSED</span>,
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button
            onClick={onBack}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium mb-2 flex items-center gap-1"
          >
            ← Back to Quiz Bank
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{quiz.title}</h1>
            {statusBadge[quiz.status]}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {quiz.subject?.name} • {quiz.class?.name}
          </p>
        </div>

        {quiz.status === 'DRAFT' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAiModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium rounded-xl hover:opacity-90 transition-all text-sm shadow-sm"
            >
              <Sparkles size={16} />
              Generate with AI
            </button>
            <button
              onClick={() => setShowAddQuestion(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-all text-sm"
            >
              <Plus size={16} />
              Add Question
            </button>
          </div>
        )}
      </div>

      {/* Tabs (for CLOSED quizzes) */}
      {quiz.status === 'CLOSED' && (
        <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
          {(['questions', 'results'] as const).map(tab => (
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
      )}

      {/* Questions List */}
      {activeTab === 'questions' && (
        <>
          {questions.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 mb-4">No questions yet. Add your first question to get started.</p>
              {quiz.status === 'DRAFT' && (
                <button
                  onClick={() => setShowAddQuestion(true)}
                  className="px-5 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-all text-sm"
                >
                  Add First Question
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q, idx) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={idx}
                  canEdit={quiz.status === 'DRAFT'}
                  onEdit={() => setEditingQuestion(q)}
                  onDelete={() => handleDeleteQuestion(q.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Results Tab */}
      {activeTab === 'results' && quiz.status === 'CLOSED' && (
        <QuizResults quizId={quiz.id} />
      )}

      {/* Add/Edit Question Modal */}
      {(showAddQuestion || editingQuestion) && (
        <QuestionFormModal
          quizId={quiz.id}
          question={editingQuestion}
          onClose={() => { setShowAddQuestion(false); setEditingQuestion(null); }}
          onSaved={handleQuestionSaved}
        />
      )}

      {/* AI Generate Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
                <Sparkles size={20} />
                Generate Questions with AI
              </div>
              <button onClick={() => setShowAiModal(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleGenerateAi} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Topic Description
                </label>
                <textarea
                  required
                  value={aiTopic}
                  onChange={e => setAiTopic(e.target.value)}
                  placeholder="e.g. Basics of relational databases and normalization forms..."
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Number of Questions
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={aiNumQuestions}
                  onChange={e => setAiNumQuestions(parseInt(e.target.value))}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <>Generating...</>
                  ) : (
                    <>
                      <Sparkles size={18} /> Generate
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Question Card ────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  canEdit,
  onEdit,
  onDelete,
}: {
  question: QuizQuestion;
  index: number;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const typeLabels = { MCQ: 'MCQ', SHORT_ANSWER: 'Short Answer', NUMERICAL: 'Numerical', ONE_LINER: 'One Liner' };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
      <div className="flex items-start gap-4">
        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-bold shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {typeLabels[question.type]}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Clock size={11} />
              {question.durationSeconds}s
            </span>
          </div>
          <p className="font-medium text-slate-800 dark:text-slate-200 mb-3">{question.text}</p>

          {question.type === 'MCQ' && question.options.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {question.options.map((opt) => (
                <div
                  key={opt.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                    opt.isCorrect
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {opt.isCorrect && <CheckCircle2 size={14} className="shrink-0" />}
                  {opt.text}
                </div>
              ))}
            </div>
          )}

          {question.correctAnswer && question.type !== 'MCQ' && (
            <div className="mt-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
              ✓ Answer: {question.correctAnswer}
            </div>
          )}
        </div>

        {canEdit && (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={onEdit}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
            >
              <Edit3 size={15} />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Question Form Modal ──────────────────────────────────────────────────────

function QuestionFormModal({
  quizId,
  question,
  onClose,
  onSaved,
}: {
  quizId: string;
  question: QuizQuestion | null;
  onClose: () => void;
  onSaved: (question: QuizQuestion, isNew: boolean) => void;
}) {
  const [text, setText] = useState(question?.text || '');
  const [type, setType] = useState<'MCQ' | 'SHORT_ANSWER' | 'NUMERICAL' | 'ONE_LINER'>(question?.type || 'MCQ');
  const [duration, setDuration] = useState(question?.durationSeconds || 30);
  const [correctAnswer, setCorrectAnswer] = useState(question?.correctAnswer || '');
  const [explanation, setExplanation] = useState(question?.explanation || '');
  const [options, setOptions] = useState<Array<{ text: string; isCorrect: boolean }>>(
    question?.options?.map(o => ({ text: o.text, isCorrect: o.isCorrect })) ||
      [{ text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }]
  );
  const [saving, setSaving] = useState(false);

  const addOption = () => setOptions([...options, { text: '', isCorrect: false }]);
  const removeOption = (idx: number) => setOptions(options.filter((_, i) => i !== idx));
  const setCorrectOption = (idx: number) => setOptions(options.map((o, i) => ({ ...o, isCorrect: i === idx })));
  const updateOptionText = (idx: number, val: string) =>
    setOptions(options.map((o, i) => (i === idx ? { ...o, text: val } : o)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) { toast.error('Question text is required'); return; }
    if (type === 'MCQ' && options.filter(o => o.text.trim()).length < 2) {
      toast.error('MCQ needs at least 2 options'); return;
    }
    if (type === 'MCQ' && !options.some(o => o.isCorrect)) {
      toast.error('Select the correct option'); return;
    }

    try {
      setSaving(true);
      const payload = {
        text: text.trim(),
        type,
        durationSeconds: duration,
        correctAnswer: type !== 'MCQ' ? correctAnswer.trim() || undefined : undefined,
        explanation: explanation.trim() || undefined,
        options: type === 'MCQ' ? options.filter(o => o.text.trim()).map((o, i) => ({ ...o, order: i })) : [],
      } as any;

      let saved: QuizQuestion;
      if (question) {
        saved = await facultyApi.quiz.updateQuestion(quizId, question.id, payload);
        toast.success('Question updated');
        onSaved(saved, false);
      } else {
        saved = await facultyApi.quiz.addQuestion(quizId, payload);
        toast.success('Question added');
        onSaved(saved, true);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 my-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {question ? 'Edit Question' : 'Add Question'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Type selector */}
          <div className="flex gap-2 flex-wrap">
            {(['MCQ', 'SHORT_ANSWER', 'NUMERICAL', 'ONE_LINER'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  type === t
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Question text */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Question *</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Enter the question text..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              required
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Time Limit: <span className="text-indigo-600">{duration}s</span>
            </label>
            <input
              type="range"
              min={10}
              max={120}
              step={5}
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>10s</span><span>120s</span>
            </div>
          </div>

          {/* MCQ Options */}
          {type === 'MCQ' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Options (click circle to mark correct)
              </label>
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCorrectOption(idx)}
                      className={`w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${
                        opt.isCorrect ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'
                      }`}
                    />
                    <input
                      type="text"
                      value={opt.text}
                      onChange={e => updateOptionText(idx, e.target.value)}
                      placeholder={`Option ${idx + 1}`}
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addOption}
                className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
              >
                <Plus size={14} /> Add Option
              </button>
            </div>
          )}

          {/* Correct answer for non-MCQ */}
          {type !== 'MCQ' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Correct Answer
              </label>
              <input
                type="text"
                value={correctAnswer}
                onChange={e => setCorrectAnswer(e.target.value)}
                placeholder="The expected answer..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* Explanation */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Explanation (shown after quiz ends)
            </label>
            <input
              type="text"
              value={explanation}
              onChange={e => setExplanation(e.target.value)}
              placeholder="Optional explanation of the correct answer..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-all"
            >
              {saving ? 'Saving...' : question ? 'Update Question' : 'Add Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Quiz Results ─────────────────────────────────────────────────────────────

function QuizResults({ quizId }: { quizId: string }) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    facultyApi.quiz.getResults(quizId)
      .then(setQuiz)
      .catch(() => toast.error('Failed to load results'))
      .finally(() => setLoading(false));
  }, [quizId]);

  if (loading) return <div className="text-center py-8 text-slate-500">Loading results...</div>;
  if (!quiz) return <div className="text-center py-8 text-slate-500">No results available.</div>;

  const attempts = (quiz as any).attempts || [];
  const questions = quiz.questions || [];

  return (
    <div className="space-y-6">
      {/* Leaderboard */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="font-bold text-slate-900 dark:text-white mb-4">Leaderboard</h3>
        {attempts.length === 0 ? (
          <p className="text-slate-500 text-sm">No one participated.</p>
        ) : (
          <div className="space-y-2">
            {attempts.slice(0, 10).map((a: any, idx: number) => (
              <div key={a.id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                  idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                  idx === 1 ? 'bg-slate-100 text-slate-600' :
                  idx === 2 ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-50 dark:bg-slate-800 text-slate-500'
                }`}>
                  {idx + 1}
                </span>
                <span className="flex-1 font-medium text-slate-800 dark:text-slate-200">
                  {a.student.firstName} {a.student.lastName}
                </span>
                <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  {a.score}/{a.maxScore}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Question analysis */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="font-bold text-slate-900 dark:text-white mb-4">Question Analysis</h3>
        <div className="space-y-4">
          {questions.map((q: any, idx: number) => {
            const answers = q.answers || [];
            const correct = answers.filter((a: any) => a.isCorrect).length;
            const pct = answers.length > 0 ? Math.round((correct / answers.length) * 100) : 0;

            return (
              <div key={q.id} className="border border-slate-100 dark:border-slate-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    <span className="text-slate-400 mr-2">Q{idx + 1}.</span>{q.text}
                  </p>
                  <span className={`text-sm font-semibold shrink-0 ${pct >= 60 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {pct}% correct
                  </span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 60 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">{answers.length} responses</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
