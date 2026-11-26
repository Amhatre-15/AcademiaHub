import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin';
import { PageHeader, EmptyState, FormField, LoadingPage } from '../../components/ui/AdminComponents';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';

interface FormData {
  studentId: string;
  classId: string;
  divisionId: string;
  batchId: string;
  academicYearId: string;
  semesterId: string;
}
const empty: FormData = { studentId: '', classId: '', divisionId: '', batchId: '', academicYearId: '', semesterId: '' };

export default function EnrollmentsPage() {
  const qc = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<FormData>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const LIMIT = 30;

  const { data: enrollmentsData, isLoading } = useQuery({
    queryKey: ['enrollments', filterClass, page],
    queryFn: () => adminApi.getEnrollments(filterClass ? { classId: filterClass, page, limit: LIMIT } : { page, limit: LIMIT }),
  });
  const { data: studentsData } = useQuery({ queryKey: ['students-all'], queryFn: () => adminApi.getStudents({ limit: 200 }) });
  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: () => adminApi.getClasses() });
  const { data: years } = useQuery({ queryKey: ['academic-years'], queryFn: adminApi.getAcademicYears });
  const { data: semesters } = useQuery({
    queryKey: ['semesters', form.academicYearId],
    queryFn: () => adminApi.getSemesters(form.academicYearId),
    enabled: !!form.academicYearId,
  });
  const selectedClass = classes?.find((c) => c.id === form.classId);

  const createMut = useMutation({
    mutationFn: () => adminApi.createEnrollment({
      studentId: form.studentId,
      classId: form.classId,
      divisionId: form.divisionId || undefined,
      batchId: form.batchId || undefined,
      academicYearId: form.academicYearId,
      semesterId: form.semesterId,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['enrollments'] }); toast.success('Student enrolled.'); closeModal(); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed — student may already be enrolled.'),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => adminApi.removeEnrollment(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['enrollments'] }); toast.success('Enrollment removed.'); setDeleteId(null); },
    onError: () => toast.error('Failed to remove enrollment.'),
  });

  function validate() {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.studentId) e.studentId = 'Student is required.';
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
        title="Enrollments"
        subtitle="Assign students to classes, divisions, and batches."
        action={<button onClick={() => setIsOpen(true)} className="btn btn-primary btn-sm"><Plus size={15} className="mr-1" />Enroll Student</button>}
      />

      <div className="mb-4">
        <select className="input max-w-xs" value={filterClass} onChange={(e) => { setFilterClass(e.target.value); setPage(1); }}>
          <option value="">All Classes</option>
          {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {isLoading ? <LoadingPage /> : !enrollmentsData?.enrollments?.length ? (
        <EmptyState title="No enrollments yet" message="Enroll students into classes to track their attendance and grades." action={<button onClick={() => setIsOpen(true)} className="btn btn-primary btn-sm">Enroll Student</button>} />
      ) : (
        <>
          <div className="card overflow-hidden mb-4">
            <table className="w-full table-auto-base">
              <thead><tr><th>Student</th><th>PRN</th><th>Class</th><th>Division</th><th>Batch</th><th>Academic Year</th><th>Sem</th><th className="w-16">Action</th></tr></thead>
              <tbody>
                {enrollmentsData.enrollments.map((e) => (
                  <tr key={e.id}>
                    <td className="text-sm font-medium text-gray-900 dark:text-white">{e.student?.firstName} {e.student?.lastName}</td>
                    <td><code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{e.student?.prn}</code></td>
                    <td className="text-sm text-gray-500">{e.class?.name}</td>
                    <td className="text-sm text-gray-500">{e.division?.name ?? '—'}</td>
                    <td className="text-sm text-gray-500">{e.batch?.name ?? '—'}</td>
                    <td className="text-sm text-gray-500">{e.academicYear?.name}</td>
                    <td className="text-sm text-gray-500">{e.semester?.number}</td>
                    <td>
                      <button onClick={() => setDeleteId(e.id)} className="btn btn-ghost btn-sm p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {enrollmentsData.totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={enrollmentsData.totalPages}
              total={enrollmentsData.total}
              limit={LIMIT}
              onPageChange={setPage}
              itemLabel="enrollments"
            />
          )}
        </>
      )}

      <Modal isOpen={isOpen} onClose={closeModal} title="Enroll Student" size="lg"
        footer={<>
          <button onClick={closeModal} className="btn btn-secondary btn-sm" disabled={createMut.isPending}>Cancel</button>
          <button onClick={() => { if (validate()) createMut.mutate(); }} className="btn btn-primary btn-sm" disabled={createMut.isPending}>{createMut.isPending ? 'Enrolling...' : 'Enroll'}</button>
        </>}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <FormField label="Student" required error={errors.studentId}>
              <select className={`input ${errors.studentId ? 'input-error' : ''}`} value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}>
                <option value="">— Select Student —</option>
                {studentsData?.students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} — {s.prn}</option>)}
              </select>
            </FormField>
          </div>
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

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && removeMut.mutate(deleteId)}
        title="Remove Enrollment" message="Remove this enrollment? The student will be unenrolled from this class."
        confirmLabel="Remove" isDestructive isLoading={removeMut.isPending}
      />
    </div>
  );
}
