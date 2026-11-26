import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin';
import type { Subject } from '../../api/admin';
import { PageHeader, EmptyState, FormField, LoadingPage } from '../../components/ui/AdminComponents';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';

interface FormData { branchId: string; name: string; code: string; description: string; }
const empty: FormData = { branchId: '', name: '', code: '', description: '' };

export default function SubjectsPage() {
  const qc = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [filterBranch, setFilterBranch] = useState('');
  const [form, setForm] = useState<FormData>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const { data: subjects, isLoading } = useQuery({
    queryKey: ['subjects', filterBranch],
    queryFn: () => adminApi.getSubjects(filterBranch || undefined),
  });
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: adminApi.getBranches });

  const createMut = useMutation({
    mutationFn: (d: FormData) => adminApi.createSubject(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subjects'] }); toast.success('Subject created.'); closeModal(); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed.'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<FormData> }) => adminApi.updateSubject(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subjects'] }); toast.success('Updated.'); closeModal(); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed.'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteSubject(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subjects'] }); toast.success('Subject deleted.'); setDeleteTarget(null); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Cannot delete — subject may have assignments or sessions.'),
  });

  function validate() {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.branchId) e.branchId = 'Branch is required.';
    if (!form.name.trim()) e.name = 'Subject name is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    if (editSubject) {
      updateMut.mutate({ id: editSubject.id, d: form });
    } else {
      createMut.mutate(form);
    }
  }

  function openCreate() { setEditSubject(null); setForm(empty); setErrors({}); setIsOpen(true); }
  function openEdit(s: Subject) {
    setEditSubject(s);
    setForm({ branchId: s.branchId, name: s.name, code: s.code ?? '', description: s.description ?? '' });
    setErrors({});
    setIsOpen(true);
  }
  function closeModal() { setIsOpen(false); setEditSubject(null); }
  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="p-6">
      <PageHeader
        title="Subjects"
        subtitle="Manage academic subjects for each branch."
        action={<button onClick={openCreate} className="btn btn-primary btn-sm"><Plus size={15} className="mr-1" />Add Subject</button>}
      />

      <div className="mb-4">
        <select className="input max-w-xs" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
          <option value="">All Branches</option>
          {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {isLoading ? <LoadingPage /> : !subjects?.length ? (
        <EmptyState title="No subjects" message="Add subjects for your branches." action={<button onClick={openCreate} className="btn btn-primary btn-sm">Add Subject</button>} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full table-auto-base">
            <thead><tr><th>Subject</th><th>Code</th><th>Branch</th><th>Assignments</th><th>Actions</th></tr></thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                        <BookOpen size={13} className="text-green-600 dark:text-green-400" />
                      </div>
                      <span className="font-medium text-sm text-gray-900 dark:text-white">{s.name}</span>
                    </div>
                  </td>
                  <td>{s.code ? <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded font-mono">{s.code}</code> : '—'}</td>
                  <td className="text-sm text-gray-500">{s.branch.name}</td>
                  <td className="text-sm text-gray-600">{s._count?.facultyAssignments ?? 0}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(s)} className="btn btn-ghost btn-sm p-1.5"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteTarget(s)} className="btn btn-ghost btn-sm p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10" disabled={(s._count?.facultyAssignments ?? 0) > 0}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={isOpen} onClose={closeModal} title={editSubject ? 'Edit Subject' : 'Add Subject'}
        footer={<>
          <button onClick={closeModal} className="btn btn-secondary btn-sm" disabled={isSaving}>Cancel</button>
          <button onClick={handleSubmit} className="btn btn-primary btn-sm" disabled={isSaving}>{isSaving ? 'Saving...' : editSubject ? 'Update' : 'Create'}</button>
        </>}
      >
        <div className="space-y-4">
          <FormField label="Branch" required error={errors.branchId}>
            <select className={`input ${errors.branchId ? 'input-error' : ''}`} value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))} disabled={!!editSubject}>
              <option value="">— Select Branch —</option>
              {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </FormField>
          <FormField label="Subject Name" required error={errors.name}>
            <input className={`input ${errors.name ? 'input-error' : ''}`} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Apache Spark & Big Data" autoFocus />
          </FormField>
          <FormField label="Subject Code" hint="Optional short code, e.g. APACHE">
            <input className="input" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="APACHE" maxLength={20} />
          </FormField>
          <FormField label="Description">
            <textarea className="input resize-none" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </FormField>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        title="Delete Subject" message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete" isDestructive isLoading={deleteMut.isPending}
      />
    </div>
  );
}
