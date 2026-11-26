import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin';
import type { Class, Division } from '../../api/admin';
import { PageHeader, EmptyState, FormField, LoadingPage } from '../../components/ui/AdminComponents';
import { Modal } from '../../components/ui/Modal';
import clsx from 'clsx';

export default function ClassesPage() {
  const qc = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDivOpen, setIsDivOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [classForm, setClassForm] = useState({ academicLevelId: '', academicYearId: '', semesterId: '', name: '' });
  const [divForm, setDivForm] = useState({ name: '' });
  const [batchForm, setBatchForm] = useState({ name: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: classes, isLoading } = useQuery({ queryKey: ['classes'], queryFn: () => adminApi.getClasses() });
  const { data: years } = useQuery({ queryKey: ['academic-years'], queryFn: adminApi.getAcademicYears });
  const { data: levels } = useQuery({ queryKey: ['academic-levels'], queryFn: () => adminApi.getAcademicLevels() });


  const { data: semesters } = useQuery({
    queryKey: ['semesters', classForm.academicYearId],
    queryFn: () => adminApi.getSemesters(classForm.academicYearId),
    enabled: !!classForm.academicYearId,
  });

  const createClassMut = useMutation({
    mutationFn: () => adminApi.createClass(classForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['classes'] }); toast.success('Class created.'); setIsCreateOpen(false); setClassForm({ academicLevelId: '', academicYearId: '', semesterId: '', name: '' }); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed.'),
  });

  const createDivMut = useMutation({
    mutationFn: () => adminApi.createDivision(selectedClass!.id, divForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['classes'] }); toast.success('Division created.'); setIsDivOpen(false); setDivForm({ name: '' }); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed.'),
  });

  const createBatchMut = useMutation({
    mutationFn: () => adminApi.createBatch(selectedDivision!.id, batchForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['classes'] }); toast.success('Batch created.'); setIsBatchOpen(false); setBatchForm({ name: '' }); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed.'),
  });

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function validateClass() {
    const e: Record<string, string> = {};
    if (!classForm.academicYearId) e.academicYearId = 'Academic year is required.';
    if (!classForm.semesterId) e.semesterId = 'Semester is required.';
    if (!classForm.academicLevelId) e.academicLevelId = 'Level is required.';
    if (!classForm.name.trim()) e.name = 'Class name is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Classes"
        subtitle="Manage classes, divisions, and batches."
        action={
          <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary btn-sm">
            <Plus size={15} className="mr-1" /> Add Class
          </button>
        }
      />

      {isLoading ? <LoadingPage /> : !classes?.length ? (
        <EmptyState title="No classes yet" message="Create your first class to start organizing students." action={<button onClick={() => setIsCreateOpen(true)} className="btn btn-primary btn-sm">Add Class</button>} />
      ) : (
        <div className="card overflow-hidden">
          {classes.map((cls, idx) => (
            <div key={cls.id} className={clsx('border-b border-gray-100 dark:border-gray-800 last:border-b-0', idx === 0 && 'rounded-t-xl')}>
              {/* Class row */}
              <div
                className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                onClick={() => toggleExpand(cls.id)}
              >
                {expanded.has(cls.id) ? <ChevronDown size={15} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={15} className="text-gray-400 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{cls.name}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    {cls.academicLevel?.branch?.name} · {cls.academicYear?.name} · Sem {cls.semester?.number}
                  </span>
                </div>
                <span className="text-xs text-gray-400">{cls._count?.divisions ?? 0} divisions · {cls._count?.enrollments ?? 0} students</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedClass(cls); setIsDivOpen(true); }}
                  className="btn btn-ghost btn-sm text-xs ml-2"
                  title="Add division"
                >
                  + Division
                </button>
              </div>

              {/* Expanded divisions */}
              {expanded.has(cls.id) && cls.divisions && (
                <div className="pl-8 pb-2">
                  {cls.divisions.map((div) => (
                    <div key={div.id} className="py-1.5 px-4 border-l-2 border-blue-200 dark:border-blue-800 ml-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Division {div.name}</span>
                        <span className="text-xs text-gray-400">({div._count?.enrollments ?? 0} students)</span>
                        <button
                          onClick={() => { setSelectedClass(cls); setSelectedDivision(div); setIsBatchOpen(true); }}
                          className="btn btn-ghost btn-sm text-xs"
                        >
                          + Batch
                        </button>
                      </div>
                      {div.batches?.length > 0 && (
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {div.batches.map((b) => (
                            <span key={b.id} className="badge badge-blue">{b.name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Class Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add Class"
        footer={
          <>
            <button onClick={() => setIsCreateOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
            <button onClick={() => { if (validateClass()) createClassMut.mutate(); }} className="btn btn-primary btn-sm" disabled={createClassMut.isPending}>
              {createClassMut.isPending ? 'Creating...' : 'Create Class'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Academic Year" required error={errors.academicYearId}>
            <select className={`input ${errors.academicYearId ? 'input-error' : ''}`} value={classForm.academicYearId}
              onChange={(e) => setClassForm((f) => ({ ...f, academicYearId: e.target.value, semesterId: '', academicLevelId: '' }))}>
              <option value="">— Select Year —</option>
              {years?.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </FormField>
          <FormField label="Semester" required error={errors.semesterId}>
            <select className={`input ${errors.semesterId ? 'input-error' : ''}`} value={classForm.semesterId}
              onChange={(e) => {
                const sem = semesters?.find((s) => s.id === e.target.value);
                setClassForm((f) => ({ ...f, semesterId: e.target.value, academicLevelId: sem?.academicLevelId ?? '' }));
              }}
              disabled={!classForm.academicYearId}>
              <option value="">— Select Semester —</option>
              {semesters?.map((s) => <option key={s.id} value={s.id}>Sem {s.number} — {s.academicLevel?.name}</option>)}
            </select>
          </FormField>
          <FormField label="Academic Level" required error={errors.academicLevelId}>
            <select className={`input ${errors.academicLevelId ? 'input-error' : ''}`} value={classForm.academicLevelId}
              onChange={(e) => setClassForm((f) => ({ ...f, academicLevelId: e.target.value }))}
              disabled={!classForm.semesterId}>
              <option value="">— Select Level —</option>
              {levels?.map((l) => <option key={l.id} value={l.id}>{l.branch.name} — {l.name}</option>)}
            </select>
          </FormField>
          <FormField label="Class Name" required error={errors.name} hint="e.g. SY B.Sc DS Sem III">
            <input className={`input ${errors.name ? 'input-error' : ''}`} value={classForm.name} onChange={(e) => setClassForm((f) => ({ ...f, name: e.target.value }))} placeholder="SY B.Sc DS Sem III" />
          </FormField>
        </div>
      </Modal>

      {/* Create Division Modal */}
      <Modal isOpen={isDivOpen} onClose={() => setIsDivOpen(false)} title={`Add Division to ${selectedClass?.name}`}
        footer={
          <>
            <button onClick={() => setIsDivOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
            <button onClick={() => { if (divForm.name.trim()) createDivMut.mutate(); }} className="btn btn-primary btn-sm" disabled={createDivMut.isPending}>
              {createDivMut.isPending ? 'Creating...' : 'Create Division'}
            </button>
          </>
        }
      >
        <FormField label="Division Name" required hint="e.g. A, B, C">
          <input className="input" value={divForm.name} onChange={(e) => setDivForm({ name: e.target.value })} placeholder="A" autoFocus />
        </FormField>
      </Modal>

      {/* Create Batch Modal */}
      <Modal isOpen={isBatchOpen} onClose={() => setIsBatchOpen(false)} title={`Add Batch to Division ${selectedDivision?.name}`}
        footer={
          <>
            <button onClick={() => setIsBatchOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
            <button onClick={() => { if (batchForm.name.trim()) createBatchMut.mutate(); }} className="btn btn-primary btn-sm" disabled={createBatchMut.isPending}>
              {createBatchMut.isPending ? 'Creating...' : 'Create Batch'}
            </button>
          </>
        }
      >
        <FormField label="Batch Name" required hint="e.g. B1, B2">
          <input className="input" value={batchForm.name} onChange={(e) => setBatchForm({ name: e.target.value })} placeholder="B1" autoFocus />
        </FormField>
      </Modal>
    </div>
  );
}


