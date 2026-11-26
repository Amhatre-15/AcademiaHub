import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, GitBranch } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin';
import type { Branch } from '../../api/admin';
import { PageHeader, EmptyState, StatusBadge, FormField, LoadingPage } from '../../components/ui/AdminComponents';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';

interface BranchFormData {
  name: string;
  code: string;
  description: string;
}

const empty: BranchFormData = { name: '', code: '', description: '' };

export default function BranchesPage() {
  const qc = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [form, setForm] = useState<BranchFormData>(empty);
  const [errors, setErrors] = useState<Partial<BranchFormData>>({});

  const { data: branches, isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: adminApi.getBranches,
  });

  const createMutation = useMutation({
    mutationFn: (data: BranchFormData) => adminApi.createBranch(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      toast.success('Branch created successfully.');
      setIsCreateOpen(false);
      setForm(empty);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to create branch.';
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BranchFormData> }) =>
      adminApi.updateBranch(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      toast.success('Branch updated.');
      setEditBranch(null);
      setForm(empty);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to update branch.';
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteBranch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      toast.success('Branch deleted.');
      setDeleteTarget(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to delete branch.';
      toast.error(msg);
    },
  });

  function validate(): boolean {
    const e: Partial<BranchFormData> = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.code.trim()) e.code = 'Code is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    if (editBranch) {
      updateMutation.mutate({ id: editBranch.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function openEdit(branch: Branch) {
    setEditBranch(branch);
    setForm({ name: branch.name, code: branch.code, description: branch.description ?? '' });
    setErrors({});
  }

  function openCreate() {
    setEditBranch(null);
    setForm(empty);
    setErrors({});
    setIsCreateOpen(true);
  }

  const isModalOpen = isCreateOpen || !!editBranch;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6">
      <PageHeader
        title="Branches"
        subtitle="Manage academic branches and departments."
        action={
          <button onClick={openCreate} className="btn btn-primary btn-sm gap-1.5">
            <Plus size={15} />
            Add Branch
          </button>
        }
      />

      {isLoading ? (
        <LoadingPage />
      ) : !branches?.length ? (
        <EmptyState
          title="No branches yet"
          message="Create the first branch to get started building your academic structure."
          action={
            <button onClick={openCreate} className="btn btn-primary btn-sm">
              <Plus size={14} className="mr-1" /> Add Branch
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full table-auto-base">
            <thead>
              <tr>
                <th>Branch Name</th>
                <th>Code</th>
                <th>Description</th>
                <th>Levels</th>
                <th>Subjects</th>
                <th>Status</th>
                <th className="w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                        <GitBranch size={13} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white text-sm">{branch.name}</span>
                    </div>
                  </td>
                  <td>
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded font-mono">
                      {branch.code}
                    </code>
                  </td>
                  <td className="text-gray-500 dark:text-gray-400 max-w-xs truncate">
                    {branch.description || '—'}
                  </td>
                  <td className="text-gray-600 dark:text-gray-300">{branch._count?.academicLevels ?? 0}</td>
                  <td className="text-gray-600 dark:text-gray-300">{branch._count?.subjects ?? 0}</td>
                  <td><StatusBadge status={branch.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(branch)}
                        className="btn btn-ghost btn-sm p-1.5"
                        title="Edit branch"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(branch)}
                        className="btn btn-ghost btn-sm p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
                        title="Delete branch"
                        disabled={(branch._count?.academicLevels ?? 0) > 0 || (branch._count?.subjects ?? 0) > 0}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsCreateOpen(false); setEditBranch(null); setErrors({}); }}
        title={editBranch ? 'Edit Branch' : 'Add Branch'}
        footer={
          <>
            <button onClick={() => { setIsCreateOpen(false); setEditBranch(null); }} className="btn btn-secondary btn-sm" disabled={isSaving}>
              Cancel
            </button>
            <button onClick={handleSubmit} className="btn btn-primary btn-sm" disabled={isSaving}>
              {isSaving ? 'Saving...' : editBranch ? 'Update Branch' : 'Create Branch'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Branch Name" required error={errors.name}>
            <input
              className={`input ${errors.name ? 'input-error' : ''}`}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. B.Sc Data Science"
              autoFocus
            />
          </FormField>
          <FormField label="Code" required error={errors.code} hint="Short identifier, e.g. BSCD">
            <input
              className={`input ${errors.code ? 'input-error' : ''}`}
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="BSCD"
              maxLength={10}
            />
          </FormField>
          <FormField label="Description">
            <textarea
              className="input resize-none"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional description"
            />
          </FormField>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Branch"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        isDestructive
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
