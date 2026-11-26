import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Key, UserX, UserCheck, Upload, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin';
import type { StudentProfile, ParsedStudentRow, ParsedInvalidRow } from '../../api/admin';
import { PageHeader, EmptyState, StatusBadge, FormField, LoadingPage } from '../../components/ui/AdminComponents';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import clsx from 'clsx';

interface SingleFormData { firstName: string; lastName: string; prn: string; email: string; }
const emptyForm: SingleFormData = { firstName: '', lastName: '', prn: '', email: '' };

type ActiveTab = 'list' | 'single' | 'bulk';

export default function StudentsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<ActiveTab>('list');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editStudent, setEditStudent] = useState<StudentProfile | null>(null);
  const [resetTarget, setResetTarget] = useState<StudentProfile | null>(null);
  const [toggleTarget, setToggleTarget] = useState<StudentProfile | null>(null);
  const [form, setForm] = useState<SingleFormData>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof SingleFormData, string>>>({});
  const LIMIT = 50;

  // Bulk import state
  const [rawText, setRawText] = useState('');
  const [parsedValid, setParsedValid] = useState<ParsedStudentRow[]>([]);
  const [parsedInvalid, setParsedInvalid] = useState<ParsedInvalidRow[]>([]);
  const [parseSummary, setParseSummary] = useState<{ totalRows: number; validRows: number; invalidRows: number; duplicatePrns: number } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [importResults, setImportResults] = useState<{ success: Array<{ prn: string; username: string; firstName: string; lastName: string }>; skipped: Array<{ prn: string; reason: string }>; errors: Array<{ prn: string; reason: string }> } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['students', { search, page }],
    queryFn: () => adminApi.getStudents({ search: search || undefined, page, limit: LIMIT }),
  });

  const createMut = useMutation({
    mutationFn: (d: SingleFormData) => adminApi.createStudent(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['students'] }); toast.success('Student created.'); setTab('list'); setForm(emptyForm); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed.'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<StudentProfile> }) => adminApi.updateStudent(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['students'] }); toast.success('Updated.'); setEditStudent(null); setToggleTarget(null); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed.'),
  });

  const resetMut = useMutation({
    mutationFn: (id: string) => adminApi.resetStudentPassword(id),
    onSuccess: () => { toast.success('Password reset to PRN.'); setResetTarget(null); },
    onError: () => toast.error('Failed to reset password.'),
  });

  const parseMut = useMutation({
    mutationFn: () => adminApi.parseBulkStudents(rawText),
    onSuccess: (data) => {
      setParsedValid(data.valid);
      setParsedInvalid(data.invalid);
      setParseSummary(data.summary);
      // Pre-select all non-duplicate rows
      const sel = new Set(data.valid.filter((r) => !r.duplicatePrn).map((r) => r.rowNumber));
      setSelectedRows(sel);
      setImportResults(null);
    },
    onError: () => toast.error('Failed to parse. Check your input.'),
  });

  const importMut = useMutation({
    mutationFn: () => {
      const toImport = parsedValid.filter((r) => selectedRows.has(r.rowNumber));
      return adminApi.importBulkStudents(toImport);
    },
    onSuccess: (data) => {
      setImportResults(data);
      qc.invalidateQueries({ queryKey: ['students'] });
      toast.success(data.message);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.details?.[0]?.message || err.response?.data?.error || err.message || 'Import failed.';
      toast.error(`Import failed: ${msg}`);
      console.error('Import error:', err.response?.data || err);
    },
  });

  function validateForm() {
    const e: Partial<Record<keyof SingleFormData, string>> = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required.';
    if (!form.lastName.trim()) e.lastName = 'Last name is required.';
    if (!form.prn.trim()) e.prn = 'PRN is required.';
    else if (!/^\d{8,12}$/.test(form.prn.trim())) e.prn = 'PRN must be 8-12 digits.';
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function toggleRow(rowNumber: number) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  function resetBulk() {
    setRawText('');
    setParsedValid([]);
    setParsedInvalid([]);
    setParseSummary(null);
    setSelectedRows(new Set());
    setImportResults(null);
  }

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;

  return (
    <div className="p-6">
      <PageHeader
        title="Students"
        subtitle="Manage student accounts. Use bulk import for multiple students."
        action={
          <div className="flex gap-2">
            <button onClick={() => setTab('bulk')} className={clsx('btn btn-sm', tab === 'bulk' ? 'btn-primary' : 'btn-secondary')}>
              <Upload size={14} className="mr-1" /> Bulk Import
            </button>
            <button onClick={() => { setTab('single'); setForm(emptyForm); setErrors({}); }} className={clsx('btn btn-sm', tab === 'single' ? 'btn-primary' : 'btn-secondary')}>
              <Plus size={14} className="mr-1" /> Add Student
            </button>
          </div>
        }
      />

      {/* Tab: Student List */}
      {tab === 'list' && (
        <>
          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-8" placeholder="Search by name, PRN, or username..." value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <span className="text-sm text-gray-500">{data?.total ?? 0} students</span>
          </div>

          {isLoading ? <LoadingPage /> : !data?.students.length ? (
            <EmptyState title="No students found" message={search ? 'Try a different search.' : 'Add students individually or use bulk import.'} />
          ) : (
            <>
              <div className="card overflow-hidden mb-4">
                <table className="w-full table-auto-base">
                  <thead>
                    <tr><th>Name</th><th>PRN</th><th>Username</th><th>Status</th><th>First Login</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {data.students.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">{s.firstName.charAt(0)}</span>
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{s.firstName} {s.lastName}</span>
                          </div>
                        </td>
                        <td><code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{s.prn}</code></td>
                        <td><code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{s.user.username}</code></td>
                        <td><StatusBadge status={s.user.status} /></td>
                        <td>{s.user.firstLogin ? <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full font-medium">Pending</span> : <span className="text-xs text-gray-400">Done</span>}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditStudent(s); }} className="btn btn-ghost btn-sm p-1.5 text-xs">Edit</button>
                            <button onClick={() => setResetTarget(s)} className="btn btn-ghost btn-sm p-1.5 text-amber-600 hover:bg-amber-50" title="Reset to PRN"><Key size={13} /></button>
                            <button onClick={() => setToggleTarget(s)} className={`btn btn-ghost btn-sm p-1.5 ${s.user.status === 'ACTIVE' ? 'text-red-500' : 'text-green-600'}`} title={s.user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}>
                              {s.user.status === 'ACTIVE' ? <UserX size={13} /> : <UserCheck size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary btn-sm">Previous</button>
                  <span className="text-sm text-gray-500 px-3 flex items-center">Page {page} of {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-secondary btn-sm">Next</button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Tab: Single Add */}
      {tab === 'single' && (
        <div className="max-w-lg">
          <div className="card card-body space-y-4">
            <div className="text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
              Username will be auto-generated from first name. Initial password = PRN (student must change on first login).
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="First Name" required error={errors.firstName}>
                <input className={`input ${errors.firstName ? 'input-error' : ''}`} value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} autoFocus />
              </FormField>
              <FormField label="Last Name" required error={errors.lastName}>
                <input className={`input ${errors.lastName ? 'input-error' : ''}`} value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
              </FormField>
            </div>
            <FormField label="PRN" required error={errors.prn} hint="8-12 digit Permanent Registration Number">
              <input className={`input ${errors.prn ? 'input-error' : ''}`} value={form.prn} onChange={(e) => setForm((f) => ({ ...f, prn: e.target.value }))} placeholder="2401202001" />
            </FormField>
            <FormField label="Email (optional)" error={errors.email}>
              <input type="email" className={`input ${errors.email ? 'input-error' : ''}`} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setTab('list')} className="btn btn-secondary btn-sm">Cancel</button>
              <button onClick={() => { if (validateForm()) createMut.mutate(form); }} className="btn btn-primary btn-sm" disabled={createMut.isPending}>
                {createMut.isPending ? 'Creating...' : 'Create Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Bulk Import */}
      {tab === 'bulk' && (
        <div className="max-w-4xl">
          {/* Step 1: Paste */}
          {!parseSummary && (
            <div className="card card-body space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Step 1: Paste Student Data</h2>
                <p className="text-xs text-gray-500">Paste rows with name and PRN separated by tabs or multiple spaces.</p>
                <p className="text-xs text-gray-400 mt-1">Example: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Atharva Ajit Mhatre    2401202010</code></p>
              </div>
              <textarea
                className="input resize-none font-mono text-sm"
                rows={12}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={"Atharva Ajit Mhatre\t2401202010\nNiharika Pandey\t2401202029\nLaxi Patel\t2401202025\nShubh Patel\t2401202051\nDhruv Patel\t2401202066"}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setTab('list')} className="btn btn-secondary btn-sm">Cancel</button>
                <button onClick={() => parseMut.mutate()} disabled={!rawText.trim() || parseMut.isPending} className="btn btn-primary btn-sm">
                  {parseMut.isPending ? 'Parsing...' : 'Parse & Preview'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {parseSummary && !importResults && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="card card-body">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Step 2: Review & Import</h2>
                <div className="flex gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5 text-sm"><span className="w-3 h-3 rounded-full bg-green-500" /><span className="text-gray-700 dark:text-gray-300">{parseSummary.validRows} valid rows</span></div>
                  <div className="flex items-center gap-1.5 text-sm"><span className="w-3 h-3 rounded-full bg-red-500" /><span className="text-gray-700 dark:text-gray-300">{parseSummary.invalidRows} invalid rows</span></div>
                  {parseSummary.duplicatePrns > 0 && (
                    <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400"><AlertCircle size={13} />{parseSummary.duplicatePrns} existing PRNs</div>
                  )}
                </div>
              </div>

              {/* Invalid rows */}
              {parsedInvalid.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                    <XCircle size={15} className="text-red-500" />
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">Invalid Rows ({parsedInvalid.length})</span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {parsedInvalid.map((r) => (
                      <div key={r.rowNumber} className="px-4 py-2.5 flex gap-3">
                        <span className="text-xs text-gray-400 w-12 flex-shrink-0">Row {r.rowNumber}</span>
                        <code className="text-xs text-gray-600 dark:text-gray-300 flex-1 truncate">{r.rawLine}</code>
                        <span className="text-xs text-red-600 dark:text-red-400 flex-shrink-0">{r.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Valid rows with checkboxes */}
              {parsedValid.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-green-500" />
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">Valid Rows ({parsedValid.length})</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedRows(new Set(parsedValid.filter((r) => !r.duplicatePrn).map((r) => r.rowNumber)))} className="text-xs text-blue-600 hover:underline">Select all non-duplicate</button>
                      <span className="text-xs text-gray-300">|</span>
                      <button onClick={() => setSelectedRows(new Set())} className="text-xs text-gray-500 hover:underline">Deselect all</button>
                    </div>
                  </div>
                  <table className="w-full table-auto-base">
                    <thead><tr><th className="w-10"></th><th>Row</th><th>Name</th><th>PRN</th><th>Status</th></tr></thead>
                    <tbody>
                      {parsedValid.map((r) => (
                        <tr key={r.rowNumber} className={clsx(r.duplicatePrn && 'bg-amber-50/50 dark:bg-amber-900/10')}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedRows.has(r.rowNumber)}
                              onChange={() => toggleRow(r.rowNumber)}
                              disabled={r.duplicatePrn}
                              className="rounded"
                            />
                          </td>
                          <td className="text-xs text-gray-400">{r.rowNumber}</td>
                          <td className="text-sm font-medium text-gray-900 dark:text-white">{r.firstName} {r.lastName}</td>
                          <td><code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{r.prn}</code></td>
                          <td>
                            {r.duplicatePrn ? (
                              <span className="text-xs text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">PRN exists — will skip</span>
                            ) : (
                              <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">Ready to import</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-between">
                <button onClick={resetBulk} className="btn btn-secondary btn-sm">← Back to Edit</button>
                <button
                  onClick={() => importMut.mutate()}
                  disabled={selectedRows.size === 0 || importMut.isPending}
                  className="btn btn-primary btn-sm"
                >
                  {importMut.isPending ? 'Importing...' : `Import ${selectedRows.size} Student${selectedRows.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {importResults && (
            <div className="space-y-4">
              <div className="card card-body">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Import Complete</h2>
                <div className="flex gap-4 flex-wrap mb-4">
                  <div className="flex items-center gap-1.5 text-sm text-green-600"><CheckCircle2 size={14} />{importResults.success.length} created</div>
                  {importResults.skipped.length > 0 && <div className="flex items-center gap-1.5 text-sm text-amber-600"><AlertCircle size={14} />{importResults.skipped.length} skipped</div>}
                  {importResults.errors.length > 0 && <div className="flex items-center gap-1.5 text-sm text-red-600"><XCircle size={14} />{importResults.errors.length} errors</div>}
                </div>

                {importResults.success.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Created Students</p>
                    <div className="space-y-1">
                      {importResults.success.map((s) => (
                        <div key={s.prn} className="flex items-center gap-3 text-sm py-1">
                          <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
                          <span className="font-medium text-gray-900 dark:text-white">{s.firstName} {s.lastName}</span>
                          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{s.prn}</code>
                          <span className="text-xs text-gray-400">Username: <code className="font-mono">{s.username}</code></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {importResults.skipped.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">Skipped</p>
                    {importResults.skipped.map((s) => (
                      <div key={s.prn} className="text-sm text-amber-600">{s.prn}: {s.reason}</div>
                    ))}
                  </div>
                )}

                {importResults.errors.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">Errors</p>
                    {importResults.errors.map((s) => (
                      <div key={s.prn} className="text-sm text-red-600">{s.prn}: {s.reason}</div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button onClick={() => { resetBulk(); }} className="btn btn-secondary btn-sm">Import More</button>
                <button onClick={() => { resetBulk(); setTab('list'); }} className="btn btn-primary btn-sm">Done → View Students</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Student Modal */}
      <Modal isOpen={!!editStudent} onClose={() => setEditStudent(null)} title="Edit Student"
        footer={<>
          <button onClick={() => setEditStudent(null)} className="btn btn-secondary btn-sm">Cancel</button>
          <button onClick={() => {
            if (!editStudent) return;
            const d = { firstName: form.firstName || editStudent.firstName, lastName: form.lastName || editStudent.lastName, email: form.email };
            updateMut.mutate({ id: editStudent.id, d });
          }} className="btn btn-primary btn-sm" disabled={updateMut.isPending}>
            {updateMut.isPending ? 'Saving...' : 'Update'}
          </button>
        </>}
      >
        {editStudent && (
          <div className="space-y-4">
            <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg">
              PRN: <code className="font-mono">{editStudent.prn}</code> · Username: <code className="font-mono">{editStudent.user.username}</code> (cannot be changed)
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="First Name" required>
                <input className="input" defaultValue={editStudent.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
              </FormField>
              <FormField label="Last Name" required>
                <input className="input" defaultValue={editStudent.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
              </FormField>
            </div>
            <FormField label="Email">
              <input type="email" className="input" defaultValue={editStudent.email ?? ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </FormField>
          </div>
        )}
      </Modal>

      {/* Reset Password Confirm */}
      <ConfirmDialog isOpen={!!resetTarget} onClose={() => setResetTarget(null)}
        onConfirm={() => resetTarget && resetMut.mutate(resetTarget.id)}
        title="Reset Password"
        message={`Reset password for ${resetTarget?.firstName} ${resetTarget?.lastName} (PRN: ${resetTarget?.prn})? Their password will be reset to their PRN and they'll be required to change it on next login.`}
        confirmLabel="Reset to PRN" isLoading={resetMut.isPending}
      />

      {/* Toggle Active/Inactive */}
      <ConfirmDialog
        isOpen={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={() => toggleTarget && updateMut.mutate({ id: toggleTarget.id, d: { status: toggleTarget.user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } as unknown as Partial<StudentProfile> })}
        title={toggleTarget?.user.status === 'ACTIVE' ? 'Deactivate Student' : 'Activate Student'}
        message={toggleTarget?.user.status === 'ACTIVE'
          ? `Deactivate ${toggleTarget?.firstName} ${toggleTarget?.lastName}? They will not be able to log in.`
          : `Activate ${toggleTarget?.firstName} ${toggleTarget?.lastName}?`}
        confirmLabel={toggleTarget?.user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        isDestructive={toggleTarget?.user.status === 'ACTIVE'}
        isLoading={updateMut.isPending}
      />
    </div>
  );
}


