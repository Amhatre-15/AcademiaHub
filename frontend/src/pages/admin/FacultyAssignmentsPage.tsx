import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin';
import type { FacultyAssignment } from '../../api/admin';
import { PageHeader, EmptyState, FormField, LoadingPage } from '../../components/ui/AdminComponents';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';

interface FormData {
  facultyId: string;
  subjectId: string;
  classId: string;
  divisionId: string;
  batchId: string;
  academicYearId: string;
  semesterId: string;
}
const empty: FormData = { facultyId: '', subjectId: '', classId: '', divisionId: '', batchId: '', academicYearId: '', semesterId: '' };

export default function FacultyAssignmentsPage() {
  const qc = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FacultyAssignment | null>(null);
  const [form, setForm] = useState<FormData>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const { data: assignments, isLoading } = useQuery({ queryKey: ['faculty-assignments'], queryFn: () => adminApi.getFacultyAssignments() });
  const { data: facultyData } = useQuery({ queryKey: ['faculty'], queryFn: () => adminApi.getFaculty({ limit: 100 }) });
  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: () => adminApi.getClasses() });
  const { data: years } = useQuery({ queryKey: ['academic-years'], queryFn: adminApi.getAcademicYears });

  const selectedClass = classes?.find((c) => c.id === form.classId);
  const { data: subjects } = useQuery({ queryKey: ['subjects'], queryFn: () => adminApi.getSubjects() });
  const { data: semesters } = useQuery({
    queryKey: ['semesters', form.academicYearId],
    queryFn: () => adminApi.getSemesters(form.academicYearId),
    enabled: !!form.academicYearId,
  });

  const createMut = useMutation({
    mutationFn: () => adminApi.createFacultyAssignment({
      facultyId: form.facultyId,
      subjectId: form.subjectId,
      classId: form.classId,
      divisionId: form.divisionId || undefined,
      batchId: form.batchId || undefined,
      academicYearId: form.academicYearId,
      semesterId: form.semesterId,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['faculty-assignments'] }); toast.success('Assignment created.'); closeModal(); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed — duplicate assignment?'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.removeFacultyAssignment(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['faculty-assignments'] }); toast.success('Assignment removed.'); setDeleteTarget(null); },
    onError: () => toast.error('Failed to remove assignment.'),
  });

  function validate() {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.facultyId) e.facultyId = 'Faculty is required.';
    if (!form.subjectId) e.subjectId = 'Subject is required.';
    if (!form.classId) e.classId = 'Class is required.';
    if (!form.academicYearId) e.academicYearId = 'Academic year is required.';
    if (!form.semesterId) e.semesterId = 'Semester is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function closeModal() { setIsOpen(false); setForm(empty); setErrors({}); }

  return (
    <div className="p-6">
      <PageHeader
        title="Faculty Assignments"
        subtitle="Assign faculty to subjects, classes, and batches."
        action={<button onClick={() => setIsOpen(true)} className="btn btn-primary btn-sm"><Plus size={15} className="mr-1" />Assign Faculty</button>}
      />

      {isLoading ? <LoadingPage /> : !assignments?.length ? (
        <EmptyState title="No assignments yet" message="Assign faculty to subjects and classes." action={<button onClick={() => setIsOpen(true)} className="btn btn-primary btn-sm">Assign Faculty</button>} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full table-auto-base">
            <thead><tr><th>Faculty</th><th>Subject</th><th>Class</th><th>Division</th><th>Batch</th><th>Semester</th><th className="w-16">Action</th></tr></thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium text-sm text-gray-900 dark:text-white">{a.faculty.firstName} {a.faculty.lastName}</td>
                  <td className="text-sm">{a.subject.name}</td>
                  <td className="text-sm text-gray-500">{a.class.name}</td>
                  <td className="text-sm text-gray-500">{a.division?.name ?? '—'}</td>
                  <td className="text-sm text-gray-500">{a.batch?.name ?? '—'}</td>
                  <td className="text-sm text-gray-500">Sem {a.semester?.number} · {a.academicYear?.name}</td>
                  <td>
                    <button onClick={() => setDeleteTarget(a)} className="btn btn-ghost btn-sm p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={isOpen} onClose={closeModal} title="Assign Faculty" size="lg"
        footer={<>
          <button onClick={closeModal} className="btn btn-secondary btn-sm" disabled={createMut.isPending}>Cancel</button>
          <button onClick={() => { if (validate()) createMut.mutate(); }} className="btn btn-primary btn-sm" disabled={createMut.isPending}>{createMut.isPending ? 'Saving...' : 'Create Assignment'}</button>
        </>}
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Faculty Member" required error={errors.facultyId}>
            <select className={`input ${errors.facultyId ? 'input-error' : ''}`} value={form.facultyId} onChange={(e) => setForm((f) => ({ ...f, facultyId: e.target.value }))}>
              <option value="">— Select Faculty —</option>
              {facultyData?.faculty.map((f) => <option key={f.id} value={f.id}>{f.firstName} {f.lastName}</option>)}
            </select>
          </FormField>
          <FormField label="Subject" required error={errors.subjectId}>
            <select className={`input ${errors.subjectId ? 'input-error' : ''}`} value={form.subjectId} onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}>
              <option value="">— Select Subject —</option>
              {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </FormField>
          <FormField label="Academic Year" required error={errors.academicYearId}>
            <select className={`input ${errors.academicYearId ? 'input-error' : ''}`} value={form.academicYearId} onChange={(e) => setForm((f) => ({ ...f, academicYearId: e.target.value, semesterId: '' }))}>
              <option value="">— Select Year —</option>
              {years?.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </FormField>
          <FormField label="Semester" required error={errors.semesterId}>
            <select className={`input ${errors.semesterId ? 'input-error' : ''}`} value={form.semesterId} onChange={(e) => setForm((f) => ({ ...f, semesterId: e.target.value }))} disabled={!form.academicYearId}>
              <option value="">— Select Semester —</option>
              {semesters?.map((s) => <option key={s.id} value={s.id}>Sem {s.number} — {s.academicLevel?.name}</option>)}
            </select>
          </FormField>
          <FormField label="Class" required error={errors.classId}>
            <select className={`input ${errors.classId ? 'input-error' : ''}`} value={form.classId} onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value, divisionId: '', batchId: '' }))}>
              <option value="">— Select Class —</option>
              {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="Division (optional)">
            <select className="input" value={form.divisionId} onChange={(e) => setForm((f) => ({ ...f, divisionId: e.target.value, batchId: '' }))} disabled={!form.classId}>
              <option value="">— All Divisions —</option>
              {selectedClass?.divisions?.map((d) => <option key={d.id} value={d.id}>Division {d.name}</option>)}
            </select>
          </FormField>
          <FormField label="Batch (optional)">
            <select className="input" value={form.batchId} onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value }))} disabled={!form.divisionId}>
              <option value="">— All Batches —</option>
              {selectedClass?.divisions?.find((d) => d.id === form.divisionId)?.batches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </FormField>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        title="Remove Assignment"
        message={`Remove assignment for ${deleteTarget?.faculty.firstName} ${deleteTarget?.faculty.lastName} — ${deleteTarget?.subject.name}? The assignment will be deactivated.`}
        confirmLabel="Remove" isDestructive isLoading={deleteMut.isPending}
      />
    </div>
  );
}
