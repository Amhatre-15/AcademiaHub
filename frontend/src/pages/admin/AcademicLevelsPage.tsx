import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin';
import type { AcademicLevel } from '../../api/admin';
import { PageHeader, EmptyState, FormField, LoadingPage } from '../../components/ui/AdminComponents';
import { Modal } from '../../components/ui/Modal';

interface FormData { branchId: string; name: string; description: string; order: number; }
const empty: FormData = { branchId: '', name: '', description: '', order: 0 };

export default function AcademicLevelsPage() {
  const qc = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editLevel, setEditLevel] = useState<AcademicLevel | null>(null);
  const [form, setForm] = useState<FormData>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const { data: levels, isLoading } = useQuery({ queryKey: ['academic-levels'], queryFn: () => adminApi.getAcademicLevels() });
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: adminApi.getBranches });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => adminApi.createAcademicLevel(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['academic-levels'] }); toast.success('Level created.'); closeModal(); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FormData> }) => adminApi.updateAcademicLevel(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['academic-levels'] }); toast.success('Updated.'); closeModal(); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed.'),
  });

  function validate() {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.branchId) e.branchId = 'Branch is required.';
    if (!form.name.trim()) e.name = 'Level name is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    if (editLevel) {
      updateMutation.mutate({ id: editLevel.id, data: { name: form.name, description: form.description, order: form.order } });
    } else {
      createMutation.mutate(form);
    }
  }

  function openCreate() { setEditLevel(null); setForm(empty); setErrors({}); setIsOpen(true); }
  function openEdit(l: AcademicLevel) {
    setEditLevel(l);
    setForm({ branchId: l.branchId, name: l.name, description: l.description ?? '', order: l.order });
    setErrors({});
    setIsOpen(true);
  }
  function closeModal() { setIsOpen(false); setEditLevel(null); }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Group by branch
  const grouped = levels?.reduce((acc, l) => {
    const branchName = l.branch.name;
    if (!acc[branchName]) acc[branchName] = [];
    acc[branchName].push(l);
    return acc;
  }, {} as Record<string, AcademicLevel[]>) ?? {};

  return (
    <div className="p-6">
      <PageHeader
        title="Academic Levels"
        subtitle="Define year levels (FY, SY, TY) for each branch."
        action={<button onClick={openCreate} className="btn btn-primary btn-sm"><Plus size={15} className="mr-1" />Add Level</button>}
      />

      {isLoading ? <LoadingPage /> : !levels?.length ? (
        <EmptyState title="No academic levels" message="Add year levels like FY, SY, TY for your branches." action={<button onClick={openCreate} className="btn btn-primary btn-sm">Add Level</button>} />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([branchName, lvls]) => (
            <div key={branchName}>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{branchName}</h2>
              <div className="card overflow-hidden">
                <table className="w-full table-auto-base">
                  <thead><tr><th>Level</th><th>Description</th><th>Order</th><th>Classes</th><th className="w-16">Actions</th></tr></thead>
                  <tbody>
                    {lvls.sort((a, b) => a.order - b.order).map((l) => (
                      <tr key={l.id}>
                        <td><span className="font-semibold text-gray-900 dark:text-white">{l.name}</span></td>
                        <td className="text-gray-500">{l.description || '—'}</td>
                        <td className="text-gray-500">{l.order}</td>
                        <td className="text-gray-600">{l._count?.classes ?? 0}</td>
                        <td>
                          <button onClick={() => openEdit(l)} className="btn btn-ghost btn-sm p-1.5"><Pencil size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isOpen} onClose={closeModal} title={editLevel ? 'Edit Academic Level' : 'Add Academic Level'}
        footer={
          <>
            <button onClick={closeModal} className="btn btn-secondary btn-sm" disabled={isSaving}>Cancel</button>
            <button onClick={handleSubmit} className="btn btn-primary btn-sm" disabled={isSaving}>{isSaving ? 'Saving...' : editLevel ? 'Update' : 'Create'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Branch" required error={errors.branchId}>
            <select className={`input ${errors.branchId ? 'input-error' : ''}`} value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))} disabled={!!editLevel}>
              <option value="">— Select Branch —</option>
              {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </FormField>
          <FormField label="Level Name" required error={errors.name} hint="e.g. FY, SY, TY, I, II, III">
            <input className={`input ${errors.name ? 'input-error' : ''}`} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="SY" autoFocus />
          </FormField>
          <FormField label="Description">
            <input className="input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Second Year" />
          </FormField>
          <FormField label="Sort Order">
            <input type="number" className="input" value={form.order} min={0} onChange={(e) => setForm((f) => ({ ...f, order: parseInt(e.target.value) || 0 }))} />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
