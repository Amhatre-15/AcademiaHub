import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facultyApi, type Material } from '../../api/faculty';
import { Modal } from '../../components/ui/Modal';
import { File, FileText, Trash2, Plus, Edit2, UploadCloud, Search, BookOpen } from 'lucide-react';
import { GoogleClassroomSection } from '../../components/google/GoogleClassroomSection';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function FacultyMaterialPage() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  
  const [mainTab, setMainTab] = useState<'platform' | 'google'>('platform');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  // Search & Filter
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('ALL');

  const { data: materials, isLoading } = useQuery({
    queryKey: ['faculty-materials'],
    queryFn: () => facultyApi.materials.getAll(),
  });

  const { data: timetable } = useQuery({
    queryKey: ['faculty-timetable'],
    queryFn: () => facultyApi.timetable.getWeekly(),
  });

  const assignedClasses = Array.from(new Map(timetable?.map((t) => [t.class.id, t.class])).values());
  const assignedSubjects = Array.from(new Map(timetable?.map((t) => [t.subject.id, t.subject])).values());

  // Set default class & subject if not chosen
  const activeClassId = selectedClassId || assignedClasses[0]?.id || '';
  const activeSubjectId = selectedSubjectId || assignedSubjects[0]?.id || '';

  const deleteMutation = useMutation({
    mutationFn: (id: string) => facultyApi.materials.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty-materials'] });
      toast.success('Material deleted');
    },
    onError: () => toast.error('Failed to delete material')
  });

  const filteredMaterials = materials?.filter(m => {
    if (filterClass !== 'ALL' && m.class?.name !== filterClass) return false;
    if (search) {
      const q = search.toLowerCase();
      return m.title.toLowerCase().includes(q) || m.fileName.toLowerCase().includes(q);
    }
    return true;
  });

  const uniqueClasses = Array.from(new Set(materials?.map(m => m.class?.name).filter(Boolean)));

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="text-indigo-600 dark:text-indigo-400" />
            Materials & Resources
          </h1>
          <p className="text-sm text-gray-500 mt-1">Upload and manage course materials</p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setMainTab('platform')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              mainTab === 'platform'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Platform Uploads
          </button>
          <button
            type="button"
            onClick={() => setMainTab('google')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              mainTab === 'google'
                ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Google Classroom
          </button>
        </div>
      </div>

      {mainTab === 'google' ? (
        <div className="space-y-6">
          {/* Class & Subject Selector for Google Classroom */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Class:</span>
              <select
                value={activeClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="input text-xs py-1.5 px-3 min-w-[140px]"
              >
                {assignedClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject:</span>
              <select
                value={activeSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="input text-xs py-1.5 px-3 min-w-[160px]"
              >
                {assignedSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code || 'N/A'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {activeClassId ? (
            <GoogleClassroomSection
              classId={activeClassId}
              subjectId={activeSubjectId || undefined}
              isFaculty={true}
            />
          ) : (
            <div className="p-8 text-center text-slate-400 text-sm">
              No assigned classes found. Please check your timetable assignments.
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search materials..."
                className="input pl-9 w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select 
              className="input w-40"
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
            >
              <option value="ALL">All Classes</option>
              {uniqueClasses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button 
              className="btn-primary whitespace-nowrap"
              onClick={() => setIsAddOpen(true)}
            >
              <Plus size={16} className="mr-1.5" />
              Upload File
            </button>
          </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-gray-500">Loading materials...</div>
        ) : filteredMaterials?.length === 0 ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-500 bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
            <FileText size={48} className="text-gray-300 dark:text-gray-700 mb-4" />
            <p>No materials found.</p>
          </div>
        ) : (
          filteredMaterials?.map(m => (
            <MaterialCard 
              key={m.id} 
              material={m} 
              onEdit={() => { setSelectedMaterial(m); setIsEditOpen(true); }}
              onDelete={() => {
                if(confirm('Are you sure you want to delete this material?')) {
                  deleteMutation.mutate(m.id);
                }
              }}
            />
          ))
        )}
      </div>
      </>
      )}

      {isAddOpen && <UploadModal onClose={() => setIsAddOpen(false)} />}
      {isEditOpen && selectedMaterial && (
        <EditModal 
          material={selectedMaterial} 
          onClose={() => { setIsEditOpen(false); setSelectedMaterial(null); }} 
        />
      )}
    </div>
  );
}

function MaterialCard({ material, onEdit, onDelete }: { material: Material, onEdit: () => void, onDelete: () => void }) {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm hover:shadow-md transition-shadow group relative flex flex-col">
      <div className="flex justify-between items-start mb-3">
        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
          <File size={24} />
        </div>
        <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
          <button onClick={onEdit} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1 mb-1" title={material.title}>
        {material.title}
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 flex-1">
        {material.description || 'No description provided.'}
      </p>
      
      <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
        <div className="flex items-center justify-between">
          <span className="font-medium bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{material.class?.name || 'No Class'}</span>
          <span className="text-gray-400">{formatSize(material.fileSize)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-2">
          <span>{material.subject?.code}</span>
          <span>{format(new Date(material.createdAt), 'MMM d, yyyy')}</span>
        </div>
      </div>
    </div>
  );
}

function UploadModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subjectId: '',
    classId: '',
    visibility: 'COURSE',
  });

  // We'll require user to know classId/subjectId or we should fetch them. Let's fetch timetable to get distinct classes/subjects.
  const { data: timetable } = useQuery({
    queryKey: ['faculty-timetable'],
    queryFn: () => facultyApi.timetable.getWeekly()
  });

  const uniqueClasses = Array.from(new Map(timetable?.map(t => [t.class.id, t.class])).values());
  const uniqueSubjects = Array.from(new Map(timetable?.map(t => [t.subject.id, t.subject])).values());

  const uploadMut = useMutation({
    mutationFn: (data: FormData) => facultyApi.materials.upload(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty-materials'] });
      toast.success('Uploaded successfully');
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Upload failed');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error('Please select a file');
    
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', formData.title);
    fd.append('description', formData.description);
    fd.append('subjectId', formData.subjectId);
    fd.append('classId', formData.classId);
    fd.append('visibility', formData.visibility);

    uploadMut.mutate(fd);
  };

  return (
    <Modal isOpen onClose={onClose} title="Upload Material" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* File Dropzone */}
        <div 
          className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <UploadCloud className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          {file ? (
            <p className="font-medium text-indigo-600 dark:text-indigo-400">{file.name}</p>
          ) : (
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-300">Click to upload a file</p>
              <p className="text-xs text-gray-500 mt-1">PDF, DOCX, PPTX up to 50MB</p>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Title *</label>
          <input 
            type="text" 
            className="input" 
            required
            value={formData.title}
            onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Class *</label>
            <select 
              className="input" 
              required
              value={formData.classId}
              onChange={e => setFormData(p => ({ ...p, classId: e.target.value }))}
            >
              <option value="">Select Class</option>
              {uniqueClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Subject *</label>
            <select 
              className="input" 
              required
              value={formData.subjectId}
              onChange={e => setFormData(p => ({ ...p, subjectId: e.target.value }))}
            >
              <option value="">Select Subject</option>
              {uniqueSubjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Visibility</label>
          <select 
            className="input"
            value={formData.visibility}
            onChange={e => setFormData(p => ({ ...p, visibility: e.target.value }))}
          >
            <option value="COURSE">Course (All students in class)</option>
            <option value="PRIVATE">Private (Only you)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Description</label>
          <textarea 
            className="input resize-none" 
            rows={3}
            value={formData.description}
            onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={uploadMut.isPending || !file}>
            {uploadMut.isPending ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditModal({ material, onClose }: { material: Material, onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: material.title,
    description: material.description || '',
    visibility: material.visibility,
  });

  const updateMut = useMutation({
    mutationFn: () => facultyApi.materials.update(material.id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty-materials'] });
      toast.success('Updated successfully');
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMut.mutate();
  };

  return (
    <Modal isOpen onClose={onClose} title="Edit Material" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Title</label>
          <input 
            type="text" 
            className="input" 
            required
            value={formData.title}
            onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Description</label>
          <textarea 
            className="input resize-none" 
            rows={3}
            value={formData.description}
            onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Visibility</label>
          <select 
            className="input"
            value={formData.visibility}
            onChange={e => setFormData(p => ({ ...p, visibility: e.target.value as any }))}
          >
            <option value="COURSE">Course (All students in class)</option>
            <option value="PRIVATE">Private (Only you)</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={updateMut.isPending}>
            {updateMut.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
