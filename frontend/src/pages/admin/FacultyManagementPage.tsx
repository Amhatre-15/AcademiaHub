import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Key, UserX, UserCheck, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin';
import type { FacultyProfile } from '../../api/admin';
import { PageHeader, EmptyState, StatusBadge, FormField, LoadingPage } from '../../components/ui/AdminComponents';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';

interface FormData { firstName: string; lastName: string; email: string; employeeId: string; department: string; }
const empty: FormData = { firstName: '', lastName: '', email: '', employeeId: '', department: '' };

export default function FacultyManagementPage() {
  const qc = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editFaculty, setEditFaculty] = useState<FacultyProfile | null>(null);
  const [resetTarget, setResetTarget] = useState<FacultyProfile | null>(null);
  const [toggleTarget, setToggleTarget] = useState<FacultyProfile | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<FormData>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const LIMIT = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['faculty', { search, page }],
    queryFn: () => adminApi.getFaculty({ page, limit: LIMIT }),
  });

  const createMut = useMutation({
    mutationFn: (d: FormData) => adminApi.createFaculty(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['faculty'] }); toast.success('Faculty account created.'); closeModal(); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed.'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<FacultyProfile> }) => adminApi.updateFaculty(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['faculty'] }); toast.success('Updated.'); closeModal(); setToggleTarget(null); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed.'),
  });

  const resetMut = useMutation({
    mutationFn: (id: string) => adminApi.resetFacultyPassword(id),
    onSuccess: () => { toast.success('Password reset to sspu@123. Faculty must change on next login.'); setResetTarget(null); },
    onError: () => toast.error('Failed to reset password.'),
  });

  function validate() {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required.';
    if (!form.lastName.trim()) e.lastName = 'Last name is required.';
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    if (editFaculty) {
      updateMut.mutate({ id: editFaculty.id, d: form });
    } else {
      createMut.mutate(form);
    }
  }

  function openCreate() { setEditFaculty(null); setForm(empty); setErrors({}); setIsOpen(true); }
  function openEdit(f: FacultyProfile) {
    setEditFaculty(f);
    setForm({ firstName: f.firstName, lastName: f.lastName, email: f.email ?? '', employeeId: f.employeeId ?? '', department: f.department ?? '' });
    setErrors({});
    setIsOpen(true);
  }
  function closeModal() { setIsOpen(false); setEditFaculty(null); }

  const isSaving = createMut.isPending || updateMut.isPending;

  const filtered = data?.faculty.filter((f) =>
    !search ||
    `${f.firstName} ${f.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    f.user.username.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="p-6">
      <PageHeader
        title="Faculty"
        subtitle="Manage faculty accounts and credentials."
        action={<button onClick={openCreate} className="btn btn-primary btn-sm"><Plus size={15} className="mr-1" />Add Faculty</button>}
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-8"
            placeholder="Search faculty..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <span className="text-sm text-gray-500">{data?.total ?? 0} total</span>
      </div>

      {isLoading ? <LoadingPage /> : !data?.faculty.length ? (
        <EmptyState title="No faculty found" message={search ? 'Try a different search term.' : 'Add faculty members to get started.'} action={!search ? <button onClick={openCreate} className="btn btn-primary btn-sm">Add Faculty</button> : undefined} />
      ) : (
        <>
          <div className="card overflow-hidden mb-4">
            <table className="w-full table-auto-base">
              <thead><tr><th>Name</th><th>Username</th><th>Employee ID</th><th>Department</th><th>Assignments</th><th>Status</th><th>First Login</th><th>Actions</th></tr></thead>
              <tbody>
                {data.faculty.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                            {f.firstName.charAt(0)}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{f.firstName} {f.lastName}</span>
                      </div>
                    </td>
                    <td><code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{f.user.username}</code></td>
                    <td className="text-sm text-gray-500">{f.employeeId || '—'}</td>
                    <td className="text-sm text-gray-500">{f.department || '—'}</td>
                    <td className="text-sm text-gray-600">{f._count?.assignments ?? 0}</td>
                    <td><StatusBadge status={f.user.status} /></td>
                    <td>
                      {f.user.firstLogin ? (
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">Pending</span>
                      ) : (
                        <span className="text-xs text-gray-400">Done</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(f)} className="btn btn-ghost btn-sm p-1.5" title="Edit"><Pencil size={13} /></button>
                        <button onClick={() => setResetTarget(f)} className="btn btn-ghost btn-sm p-1.5 text-amber-600 hover:bg-amber-50" title="Reset password"><Key size={13} /></button>
                        <button
                          onClick={() => setToggleTarget(f)}
                          className={`btn btn-ghost btn-sm p-1.5 ${f.user.status === 'ACTIVE' ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10' : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/10'}`}
                          title={f.user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        >
                          {f.user.status === 'ACTIVE' ? <UserX size={13} /> : <UserCheck size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={data.totalPages}
              total={data.total}
              limit={LIMIT}
              onPageChange={setPage}
              itemLabel="faculty members"
            />
          )}
        </>
      )}

      {/* Create / Edit Modal */}
      <Modal isOpen={isOpen} onClose={closeModal} title={editFaculty ? 'Edit Faculty' : 'Add Faculty'}
        footer={<>
          <button onClick={closeModal} className="btn btn-secondary btn-sm" disabled={isSaving}>Cancel</button>
          <button onClick={handleSubmit} className="btn btn-primary btn-sm" disabled={isSaving}>{isSaving ? 'Saving...' : editFaculty ? 'Update' : 'Create'}</button>
        </>}
      >
        <div className="space-y-4">
          {!editFaculty && (
            <div className="text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
              Username will be auto-generated from first name. Default password: sspu@123 (must change on first login).
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="First Name" required error={errors.firstName}>
              <input className={`input ${errors.firstName ? 'input-error' : ''}`} value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} autoFocus />
            </FormField>
            <FormField label="Last Name" required error={errors.lastName}>
              <input className={`input ${errors.lastName ? 'input-error' : ''}`} value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="Email" error={errors.email}>
            <input type="email" className={`input ${errors.email ? 'input-error' : ''}`} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Employee ID">
              <input className="input" value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} />
            </FormField>
            <FormField label="Department">
              <input className="input" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* Reset Password Confirm */}
      <ConfirmDialog isOpen={!!resetTarget} onClose={() => setResetTarget(null)}
        onConfirm={() => resetTarget && resetMut.mutate(resetTarget.id)}
        title="Reset Password"
        message={`Reset password for ${resetTarget?.firstName} ${resetTarget?.lastName}? Their password will be reset to "sspu@123" and they'll be required to change it on next login.`}
        confirmLabel="Reset Password" isLoading={resetMut.isPending}
      />

      {/* Toggle Active/Inactive Confirm */}
      <ConfirmDialog
        isOpen={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={() => toggleTarget && updateMut.mutate({ id: toggleTarget.id, d: { status: toggleTarget.user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } as Parameters<typeof adminApi.updateFaculty>[1] })}
        title={toggleTarget?.user.status === 'ACTIVE' ? 'Deactivate Faculty' : 'Activate Faculty'}
        message={toggleTarget?.user.status === 'ACTIVE'
          ? `Deactivate ${toggleTarget?.firstName} ${toggleTarget?.lastName}? They will no longer be able to log in.`
          : `Activate ${toggleTarget?.firstName} ${toggleTarget?.lastName}?`}
        confirmLabel={toggleTarget?.user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        isDestructive={toggleTarget?.user.status === 'ACTIVE'}
        isLoading={updateMut.isPending}
      />
    </div>
  );
}
