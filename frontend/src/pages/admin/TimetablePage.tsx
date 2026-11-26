import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { adminApi } from '../../api/admin';
import toast from 'react-hot-toast';
import { Calendar, Plus, Trash2, Upload } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';

export default function TimetablePage() {
  const queryClient = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
  
  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  // Bulk Import State
  const [bulkText, setBulkText] = useState('');
  const [parsedValid, setParsedValid] = useState<any[]>([]);
  const [parsedInvalid, setParsedInvalid] = useState<any[]>([]);
  const [parseSummary, setParseSummary] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    subjectId: '',
    facultyId: '',
    lectureTypeId: '',
    dayOfWeek: 1,
    timeSlotId: '',
    room: '',
    academicYearId: '',
    divisionId: '',
    batchId: '',
  });

  // Queries
  const { data: classes } = useQuery({
    queryKey: ['admin-classes'],
    queryFn: () => api.get('/admin/classes').then(res => res.data.classes)
  });



  const { data: subjects } = useQuery({
    queryKey: ['admin-subjects'],
    queryFn: () => api.get('/admin/subjects').then(res => res.data.subjects)
  });

  const { data: facultyList } = useQuery({
    queryKey: ['admin-faculty'],
    queryFn: () => api.get('/admin/faculty').then(res => res.data.faculty)
  });

  const { data: lectureTypes } = useQuery({
    queryKey: ['admin-lecture-types'],
    queryFn: () => api.get('/admin/timetable/lecture-types').then(res => res.data.types)
  });

  const { data: timeSlots } = useQuery({
    queryKey: ['admin-time-slots'],
    queryFn: () => api.get('/admin/timetable/slots').then(res => res.data.slots)
  });

  const { data: timetable, isLoading } = useQuery({
    queryKey: ['admin-timetable', selectedClassId, selectedSemesterId],
    queryFn: () => api.get('/admin/timetable', { params: { classId: selectedClassId, semesterId: selectedSemesterId } }).then(res => res.data.entries),
    enabled: !!selectedClassId,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/admin/timetable', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-timetable'] });
      toast.success('Timetable entry created successfully');
      setIsAddOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create entry');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/timetable/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-timetable'] });
      toast.success('Timetable entry deleted');
    }
  });

  const parseBulkMut = useMutation({
    mutationFn: (rawText: string) => adminApi.parseBulkTimetable({ rawText, classId: selectedClassId, semesterId: selectedSemesterId }),
    onSuccess: (data: any) => {
      setParsedValid(data.valid);
      setParsedInvalid(data.invalid);
      setParseSummary(data.summary);
      if (data.invalid.length > 0) {
        toast.error(`Found ${data.invalid.length} invalid rows.`);
      } else {
        toast.success(`Parsed ${data.valid.length} valid rows.`);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to parse CSV');
    }
  });

  const importBulkMut = useMutation({
    mutationFn: () => adminApi.importBulkTimetable({ entries: parsedValid, classId: selectedClassId, semesterId: selectedSemesterId }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-timetable'] });
      toast.success(data.message);
      setIsBulkOpen(false);
      resetBulk();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to import CSV');
    }
  });

  function resetBulk() {
    setBulkText('');
    setParsedValid([]);
    setParsedInvalid([]);
    setParseSummary(null);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      classId: selectedClassId,
      semesterId: selectedSemesterId,
      divisionId: formData.divisionId || undefined,
      batchId: formData.batchId || undefined,
    });
  };

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Timetable Builder</h1>
          <p className="text-sm text-gray-500 mt-1">Manage weekly class schedules</p>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-900 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
          <select 
            className="input py-1.5 text-sm w-48"
            value={selectedClassId}
            onChange={(e) => {
              setSelectedClassId(e.target.value);
              const cls = classes?.find((c: any) => c.id === e.target.value);
              if (cls) {
                setSelectedSemesterId(cls.semesterId);
                setFormData(prev => ({ ...prev, academicYearId: cls.academicYearId }));
              }
            }}
          >
            <option value="">-- Select Class --</option>
            {classes?.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/20">
           <h2 className="font-semibold text-gray-800 dark:text-gray-200">
             {selectedClassId ? 'Class Timetable' : 'Select a class to view its timetable'}
           </h2>
           {selectedClassId && (
             <div className="flex items-center gap-2">
               <button className="btn-secondary py-1.5 text-sm" onClick={() => setIsBulkOpen(true)}>
                 <Upload size={16} /> Import CSV
               </button>
               <button className="btn-primary py-1.5 text-sm" onClick={() => setIsAddOpen(true)}>
                 <Plus size={16} /> Add Entry
               </button>
             </div>
           )}
        </div>

        <div className="p-0">
          {!selectedClassId ? (
            <div className="p-12 text-center text-gray-500 flex flex-col items-center">
              <Calendar size={48} className="text-gray-300 dark:text-gray-700 mb-4" />
              <p>Please select a class from the dropdown above to view or build its timetable.</p>
            </div>
          ) : isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading timetable...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="p-4 border-b border-gray-200 dark:border-gray-800 font-semibold text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 w-32">
                      Time / Day
                    </th>
                    {DAYS.map(day => (
                      <th key={day} className="p-4 border-b border-gray-200 dark:border-gray-800 font-semibold text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 text-center min-w-[160px]">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                  {timeSlots?.map((slot: any) => (
                    <tr key={slot.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                      <td className="p-4 border-r border-gray-100 dark:border-gray-800/50 font-medium text-sm text-gray-900 dark:text-gray-300 align-top">
                        <div className="flex flex-col">
                          <span>{slot.startTime}</span>
                          <span className="text-xs text-gray-400">to {slot.endTime}</span>
                        </div>
                      </td>
                      {DAYS.map((day, idx) => {
                        const dayNumber = idx + 1;
                        const entries = timetable?.filter((e: any) => e.timeSlotId === slot.id && e.dayOfWeek === dayNumber) || [];
                        
                        return (
                          <td key={day} className="p-2 border-r border-gray-100 dark:border-gray-800/50 align-top h-full">
                            {entries.length === 0 ? (
                              <div className="h-full w-full min-h-[80px] rounded border border-dashed border-gray-200 dark:border-gray-800 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => {
                                    setFormData(p => ({ ...p, dayOfWeek: dayNumber, timeSlotId: slot.id }));
                                    setIsAddOpen(true);
                                  }}
                                  className="text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded"
                                >
                                  + Add
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {entries.map((entry: any) => (
                                  <div key={entry.id} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded p-2 text-xs relative group">
                                    <div className="font-semibold text-blue-900 dark:text-blue-100 mb-1">{entry.subject.name}</div>
                                    <div className="text-blue-700 dark:text-blue-300">{entry.faculty.user.username}</div>
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded">{entry.lectureType.code}</span>
                                      {entry.room && <span className="px-1.5 py-0.5 bg-white/60 dark:bg-black/20 text-blue-800 dark:text-blue-200 rounded">Rm {entry.room}</span>}
                                    </div>
                                    <button 
                                      onClick={() => {
                                        if (confirm('Delete this entry?')) {
                                          deleteMutation.mutate(entry.id);
                                        }
                                      }}
                                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded transition-opacity"
                                      title="Delete entry"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal 
        isOpen={isAddOpen} 
        onClose={() => setIsAddOpen(false)}
        title="Add Timetable Entry"
        size="md"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setIsAddOpen(false)}>Cancel</button>
            <button type="submit" form="add-timetable-form" className="btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Save Entry'}
            </button>
          </>
        }
      >
          <form id="add-timetable-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Day of Week *</label>
                <select className="input" value={formData.dayOfWeek} onChange={e => setFormData(p => ({ ...p, dayOfWeek: Number(e.target.value) }))} required>
                  {DAYS.map((d, i) => <option key={i+1} value={i+1}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Time Slot *</label>
                <select className="input" value={formData.timeSlotId} onChange={e => setFormData(p => ({ ...p, timeSlotId: e.target.value }))} required>
                  <option value="">-- Select Slot --</option>
                  {timeSlots?.map((t: any) => (
                     <option key={t.id} value={t.id}>{t.startTime} - {t.endTime}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Subject *</label>
              <select className="input" value={formData.subjectId} onChange={e => setFormData(p => ({ ...p, subjectId: e.target.value }))} required>
                <option value="">-- Select Subject --</option>
                {subjects?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Faculty *</label>
              <select className="input" value={formData.facultyId} onChange={e => setFormData(p => ({ ...p, facultyId: e.target.value }))} required>
                <option value="">-- Select Faculty --</option>
                {facultyList?.map((f: any) => (
                  <option key={f.id} value={f.id}>{f.firstName} {f.lastName}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                 <label className="text-sm font-medium">Lecture Type *</label>
                 <select className="input" value={formData.lectureTypeId} onChange={e => setFormData(p => ({ ...p, lectureTypeId: e.target.value }))} required>
                   <option value="">-- Select Type --</option>
                   {lectureTypes?.map((lt: any) => (
                     <option key={lt.id} value={lt.id}>{lt.name}</option>
                   ))}
                 </select>
               </div>
               <div className="space-y-1">
                 <label className="text-sm font-medium">Room (Optional)</label>
                 <input type="text" className="input" placeholder="e.g. 101, Lab A" value={formData.room} onChange={e => setFormData(p => ({ ...p, room: e.target.value }))} />
               </div>
            </div>
          </form>
      </Modal>

      <Modal
        isOpen={isBulkOpen}
        onClose={() => { setIsBulkOpen(false); resetBulk(); }}
        title="Bulk Import Timetable Entries"
        size="lg"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => { setIsBulkOpen(false); resetBulk(); }}>Cancel</button>
            {!parseSummary ? (
              <button type="button" className="btn-primary" disabled={parseBulkMut.isPending || !bulkText.trim()} onClick={() => parseBulkMut.mutate(bulkText)}>
                {parseBulkMut.isPending ? 'Parsing...' : 'Parse Data'}
              </button>
            ) : (
              <button type="button" className="btn-primary" disabled={importBulkMut.isPending || parsedValid.length === 0} onClick={() => importBulkMut.mutate()}>
                {importBulkMut.isPending ? 'Importing...' : `Import ${parsedValid.length} Entries`}
              </button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {!parseSummary ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Paste your CSV data below. Ensure headers are NOT included or the first row has "Subject" in it.<br />
                <strong>Format:</strong> <code>Division, Batch, Subject Code, Faculty Username, Lecture Type, Day, Start Time, End Time, Room</code>
              </p>
              <textarea
                className="input w-full h-64 font-mono text-sm"
                placeholder="A, B1, CS101, jdoe, L, Monday, 09:30, 10:30, Room 101"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
              />
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{parseSummary.totalRows}</div>
                  <div className="text-sm text-gray-500">Total Rows</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{parseSummary.validRows}</div>
                  <div className="text-sm text-green-600 dark:text-green-400">Ready to Import</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{parseSummary.invalidRows}</div>
                  <div className="text-sm text-red-600 dark:text-red-400">Invalid Rows</div>
                </div>
              </div>

              {parsedInvalid.length > 0 && (
                <div>
                  <h4 className="font-semibold text-red-600 mb-2 flex items-center justify-between">
                    <span>Errors ({parsedInvalid.length})</span>
                    <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setParseSummary(null)}>Fix Data</button>
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {parsedInvalid.map((err: any, i) => (
                      <div key={i} className="text-sm p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded">
                        <span className="font-bold text-red-700 dark:text-red-400">Row {err.rowNumber}:</span> {err.reason}
                        <div className="text-xs text-gray-500 mt-1 font-mono truncate">{err.rawLine}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
}


