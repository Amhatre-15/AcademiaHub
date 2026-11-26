import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin';
import type { AcademicYear } from '../../api/admin';
import { PageHeader, EmptyState, FormField, LoadingPage } from '../../components/ui/AdminComponents';
import { Modal } from '../../components/ui/Modal';
import clsx from 'clsx';

interface FormData {
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const empty: FormData = { name: '', startDate: '', endDate: '', isActive: false };

export default function AcademicYearsPage() {
  const qc = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editYear, setEditYear] = useState<AcademicYear | null>(null);
  const [form, setForm] = useState<FormData>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const { data: years, isLoading } = useQuery({
    queryKey: ['academic-years'],
    queryFn: adminApi.getAcademicYears,
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => adminApi.createAcademicYear(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['academic-years'] }); toast.success('Academic year created.'); closeModal(); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FormData> }) =>
      adminApi.updateAcademicYear(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['academic-years'] }); toast.success('Updated.'); closeModal(); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed.'),
  });

  function validate() {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.startDate) e.startDate = 'Start date is required.';
    if (!form.endDate) e.endDate = 'End date is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    if (editYear) {
      updateMutation.mutate({ id: editYear.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function openCreate() {
    setEditYear(null);
    setForm(empty);
    setErrors({});
    setIsOpen(true);
  }

  function openEdit(year: AcademicYear) {
    setEditYear(year);
    setForm({
      name: year.name,
      startDate: year.startDate.split('T')[0],
      endDate: year.endDate.split('T')[0],
      isActive: year.isActive,
    });
    setErrors({});
    setIsOpen(true);
  }

  function closeModal() { setIsOpen(false); setEditYear(null); }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6">
      <PageHeader
        title="Academic Years"
        subtitle="Define academic years and mark the active one."
        action={
          <button onClick={openCreate} className="btn btn-primary btn-sm">
            <Plus size={15} className="mr-1" />Add Year
          </button>
        }
      />

      {isLoading ? <LoadingPage /> : !years?.length ? (
        <EmptyState title="No academic years" message="Add your first academic year to begin." action={<button onClick={openCreate} className="btn btn-primary btn-sm">Add Year</button>} />
      ) : (
        <div className="space-y-3">
          {years.map((year) => (
            <div key={year.id} className={clsx('card card-body flex items-center justify-between gap-4', year.isActive && 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10')}>
              <div className="flex items-center gap-3">
                {year.isActive && (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                    <Check size={10} /> Active
                  </span>
                )}
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{year.name}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(year.startDate).toLocaleDateString()} — {new Date(year.endDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button onClick={() => openEdit(year)} className="btn btn-secondary btn-sm">
                <Pencil size={13} className="mr-1" />Edit
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title={editYear ? 'Edit Academic Year' : 'Add Academic Year'}
        footer={
          <>
            <button onClick={closeModal} className="btn btn-secondary btn-sm" disabled={isSaving}>Cancel</button>
            <button onClick={handleSubmit} className="btn btn-primary btn-sm" disabled={isSaving}>
              {isSaving ? 'Saving...' : editYear ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Year Name" required error={errors.name} hint="e.g. 2024-25">
            <input className={`input ${errors.name ? 'input-error' : ''}`} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="2024-25" autoFocus />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Date" required error={errors.startDate}>
              <input type="date" className={`input ${errors.startDate ? 'input-error' : ''}`} value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </FormField>
            <FormField label="End Date" required error={errors.endDate}>
              <input type="date" className={`input ${errors.endDate ? 'input-error' : ''}`} value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
            </FormField>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" className="rounded" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
            <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">Mark as active academic year</label>
          </div>
          {form.isActive && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
              ⚠ Marking this as active will deactivate all other academic years.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
