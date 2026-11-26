import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { studentApi } from '../../api/student';
import type { Material } from '../../api/faculty';
import { File, Download, Search, FileText, BookOpen } from 'lucide-react';
import { GoogleClassroomSection } from '../../components/google/GoogleClassroomSection';

import { useSearchParams } from 'react-router-dom';

export default function StudentMaterialPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'google' ? 'google' : 'platform';
  const [mainTab, setMainTab] = useState<'platform' | 'google'>(initialTab);
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState('ALL');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  const { data: materials, isLoading } = useQuery({
    queryKey: ['student-materials'],
    queryFn: () => studentApi.materials.getAll(),
  });

  const { data: overviewData } = useQuery({
    queryKey: ['student-overview'],
    queryFn: async () => {
      const res = await api.get('/student/overview');
      return res.data;
    },
  });

  const { data: timetable } = useQuery({
    queryKey: ['student-timetable-weekly'],
    queryFn: () => studentApi.timetable.getWeekly(),
  });

  const timetableList = Array.isArray(timetable) ? timetable : (timetable as any)?.entries || [];
  const studentClass = overviewData?.class || timetableList[0]?.class;
  const enrolledSubjects = Array.from(
    new Map(timetableList.map((t: any) => [t.subject?.id, t.subject]).filter(([id]) => Boolean(id))).values()
  ) as any[];

  const activeSubjectId = selectedSubjectId || enrolledSubjects[0]?.id || '';

  const filteredMaterials = materials?.filter((m) => {
    if (filterSubject !== 'ALL' && m.subject?.name !== filterSubject) return false;
    if (search) {
      const q = search.toLowerCase();
      return m.title.toLowerCase().includes(q) || m.fileName.toLowerCase().includes(q);
    }
    return true;
  });

  const uniqueSubjects = Array.from(
    new Set(materials?.map((m) => m.subject?.name).filter(Boolean))
  );

  const handleDownload = async (materialId: string) => {
    try {
      const url = await studentApi.materials.getDownloadUrl(materialId);
      window.open(url, '_blank');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <FileText size={24} />
            </div>
            Course Materials & Resources
          </h1>
          <p className="text-slate-500 mt-2 text-sm">
            Access slides, lecture notes, and synced Google Classroom materials.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60 self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              setMainTab('platform');
              setSearchParams({});
            }}
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
            onClick={() => {
              setMainTab('google');
              setSearchParams({ tab: 'google' });
            }}
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
          {/* Subject Switcher */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Select Subject:
              </span>
              <select
                value={activeSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="input text-xs py-1.5 px-3 min-w-[200px]"
              >
                {enrolledSubjects.length === 0 && (
                  <option value="">All Subjects</option>
                )}
                {enrolledSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code || 'N/A'})
                  </option>
                ))}
              </select>
            </div>

            {studentClass && (
              <span className="text-xs text-slate-500 font-medium">
                Enrolled Class: <strong className="text-slate-700 dark:text-slate-300">{studentClass.name}</strong>
              </span>
            )}
          </div>

          <GoogleClassroomSection
            classId={studentClass?.id || 'default'}
            subjectId={activeSubjectId || undefined}
            isFaculty={false}
          />
        </div>
      ) : (
        /* Regular Platform Uploads */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-end gap-3 w-full">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search files..."
                className="input pl-9 w-full bg-slate-50 dark:bg-slate-950"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="input w-full sm:w-48 bg-slate-50 dark:bg-slate-950"
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
            >
              <option value="ALL">All Subjects</option>
              {uniqueSubjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {isLoading ? (
              <div className="col-span-full py-12 text-center text-slate-500">
                Loading materials...
              </div>
            ) : filteredMaterials?.length === 0 ? (
              <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                <FileText size={48} className="text-slate-300 dark:text-slate-700 mb-4 opacity-50" />
                <p className="font-medium text-slate-600 dark:text-slate-400">
                  No materials available.
                </p>
                <p className="text-sm mt-1">Check back later when faculty uploads resources.</p>
              </div>
            ) : (
              filteredMaterials?.map((m) => (
                <StudentMaterialCard
                  key={m.id}
                  material={m}
                  onDownload={() => handleDownload(m.id)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StudentMaterialCard({
  material,
  onDownload,
}: {
  material: Material;
  onDownload: () => void;
}) {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group">
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl group-hover:scale-105 transition-transform">
            <File size={20} />
          </div>
          <span className="text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-md">
            {material.subject?.code || 'General'}
          </span>
        </div>

        <h3
          className="font-semibold text-slate-900 dark:text-white line-clamp-1 mb-1 text-sm"
          title={material.title}
        >
          {material.title}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
          {material.description || 'No description provided.'}
        </p>
      </div>

      <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>{formatSize(material.fileSize)}</span>
          <span>{material.createdAt ? new Date(material.createdAt).toLocaleDateString() : ''}</span>
        </div>

        <button
          onClick={onDownload}
          className="w-full btn-secondary text-xs py-2 flex items-center justify-center gap-2 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-200 dark:group-hover:bg-indigo-950/30 dark:group-hover:text-indigo-400 dark:group-hover:border-indigo-800/50 transition-colors"
        >
          <Download size={14} />
          Download File
        </button>
      </div>
    </div>
  );
}
