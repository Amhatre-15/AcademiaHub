import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  Shield,
} from 'lucide-react';
import { facultyApi, type AttendanceRosterEntry, type AttendanceStatus } from '../../api/faculty';
import toast from 'react-hot-toast';

// ─── Status Helpers ────────────────────────────────────────────────
const STATUS_STYLES: Record<AttendanceStatus, string> = {
  PRESENT:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PARTIAL:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  LATE:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ABSENT:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  EXCUSED:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const STATUS_ICONS: Record<AttendanceStatus, React.ReactNode> = {
  PRESENT: <CheckCircle2 size={12} />,
  PARTIAL: <Clock size={12} />,
  LATE:    <Clock size={12} />,
  ABSENT:  <XCircle size={12} />,
  EXCUSED: <Shield size={12} />,
};

function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_ICONS[status]}
      {status}
    </span>
  );
}

// ─── Override Modal ────────────────────────────────────────────────
interface OverrideModalProps {
  student: AttendanceRosterEntry;
  sessionId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function OverrideModal({ student, sessionId, onClose, onSuccess }: OverrideModalProps) {
  const [status, setStatus] = useState<AttendanceStatus>(
    student.attendanceRecord?.finalStatus ?? 'PRESENT'
  );
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Please provide a reason for the override.');
      return;
    }
    setLoading(true);
    try {
      await facultyApi.attendance.override(sessionId, student.studentId, status, reason.trim());
      toast.success(`Attendance updated for ${student.firstName} ${student.lastName}`);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update attendance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Override Attendance</h3>
          <p className="text-sm text-slate-500 mt-1">
            {student.firstName} {student.lastName}
            <span className="ml-2 font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              {student.prn}
            </span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Current status */}
          {student.attendanceRecord && (
            <div className="flex items-center justify-between text-sm p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <span className="text-slate-500">Current status</span>
              <StatusBadge status={student.attendanceRecord.finalStatus} />
            </div>
          )}

          {/* New status */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              New Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['PRESENT', 'PARTIAL', 'LATE', 'ABSENT', 'EXCUSED'] as AttendanceStatus[]).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all border-2 ${
                    status === s
                      ? `${STATUS_STYLES[s]} border-current`
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Student submitted medical certificate..."
              className="w-full text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !reason.trim()}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-900 text-white text-sm font-semibold transition-colors"
            >
              {loading ? 'Saving…' : 'Save Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Session Roster View ───────────────────────────────────────────
function SessionRosterView({
  sessionId,
  onBack,
}: {
  sessionId: string;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [overrideTarget, setOverrideTarget] = useState<AttendanceRosterEntry | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['faculty-session-attendance', sessionId],
    queryFn: () => facultyApi.attendance.getSessionRoster(sessionId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm">Loading roster…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-500">
        <AlertCircle size={48} className="text-red-400" />
        <p>Failed to load attendance roster.</p>
        <button onClick={onBack} className="text-indigo-600 hover:underline text-sm font-medium">
          Go back
        </button>
      </div>
    );
  }

  const { session, roster, summary } = data;

  const summaryItems = [
    { label: 'Present', count: summary.present, color: 'text-emerald-600' },
    { label: 'Partial', count: summary.partial, color: 'text-yellow-600' },
    { label: 'Late', count: summary.late, color: 'text-blue-600' },
    { label: 'Absent', count: summary.absent, color: 'text-red-600' },
    { label: 'Excused', count: summary.excused, color: 'text-purple-600' },
    { label: 'No Record', count: summary.noRecord, color: 'text-slate-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to sessions
        </button>
        <div className="sm:ml-auto text-right">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {session.subject?.name ?? 'Session'}
          </h2>
          <p className="text-sm text-slate-500">
            {new Date(session.date).toLocaleDateString('en-IN', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
            &nbsp;·&nbsp;
            <span className={`font-semibold ${session.status === 'ACTIVE' ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-400'}`}>
              {session.status}
            </span>
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {summaryItems.map(item => (
          <div key={item.label} className="bg-white dark:bg-slate-900 rounded-xl p-4 text-center border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className={`text-2xl font-black ${item.color}`}>{item.count}</p>
            <p className="text-xs text-slate-500 mt-1 font-medium">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Roster Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users size={18} />
            Student Roster
            <span className="text-slate-400 font-normal text-sm">({summary.total} students)</span>
          </h3>
          <p className="text-xs text-slate-400">Click a student to override attendance</p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {roster.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">
              No enrolled students found for this session.
            </div>
          ) : (
            roster.map(entry => (
              <div
                key={entry.studentId}
                className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                onClick={() => setOverrideTarget(entry)}
              >
                <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-sm font-bold text-indigo-700 dark:text-indigo-400 flex-shrink-0">
                  {entry.firstName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">
                    {entry.firstName} {entry.lastName}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">{entry.prn}</p>
                </div>
                <div className="flex items-center gap-3">
                  {entry.attendanceRecord ? (
                    <>
                      <StatusBadge status={entry.attendanceRecord.finalStatus} />
                      {entry.attendanceRecord.finalStatus !== entry.attendanceRecord.automatedStatus && (
                        <span title="Manually overridden">
                          <Shield size={14} className="text-purple-500" />
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">No record</span>
                  )}
                  <ChevronRight
                    size={16}
                    className="text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Override Modal */}
      {overrideTarget && (
        <OverrideModal
          student={overrideTarget}
          sessionId={sessionId}
          onClose={() => setOverrideTarget(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['faculty-session-attendance', sessionId] });
            queryClient.invalidateQueries({ queryKey: ['faculty-attendance-sessions'] });
          }}
        />
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────
export default function FacultyAttendancePage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['faculty-attendance-sessions'],
    queryFn: () => facultyApi.attendance.getSessions(),
  });

  if (selectedSessionId) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <SessionRosterView
          sessionId={selectedSessionId}
          onBack={() => setSelectedSessionId(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Attendance Management</h1>
        <p className="text-slate-500 mt-1 text-sm">
          View session rosters and override individual attendance records.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-slate-400">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm">Loading sessions…</p>
          </div>
        </div>
      ) : !data?.sessions?.length ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400">
          <CalendarDays size={48} className="text-slate-300" />
          <div className="text-center">
            <p className="font-medium text-slate-600 dark:text-slate-400">No sessions yet</p>
            <p className="text-sm">Start a live class from your timetable to track attendance.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {data.sessions.map((session: any) => {
            const present = session.attendanceSummary?.PRESENT ?? 0;
            const total = session.totalRecords;
            const pct = total > 0 ? Math.round((present / total) * 100) : null;
            const sessionDate = new Date(session.date);

            return (
              <button
                key={session.id}
                onClick={() => setSelectedSessionId(session.id)}
                className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all p-5 text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex flex-col items-center justify-center text-indigo-700 dark:text-indigo-400 flex-shrink-0">
                    <span className="text-xl font-black leading-none">
                      {sessionDate.getDate()}
                    </span>
                    <span className="text-xs font-medium opacity-70">
                      {sessionDate.toLocaleString('en', { month: 'short' })}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-slate-900 dark:text-white text-sm truncate">
                        {session.subject?.name ?? 'Unknown Subject'}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        session.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : session.status === 'CLOSED'
                          ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {session.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {session.class?.name}
                      {session.division && ` · ${session.division.name}`}
                      {session.batch && ` · ${session.batch.name}`}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0 hidden sm:block">
                    {total > 0 ? (
                      <>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {present}/{total}
                        </p>
                        <p className="text-xs text-slate-500">{pct}% present</p>
                      </>
                    ) : (
                      <p className="text-xs text-slate-400">No records</p>
                    )}
                  </div>

                  <ChevronRight
                    size={18}
                    className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition-colors flex-shrink-0"
                  />
                </div>

                {/* Mini attendance bar */}
                {total > 0 && (
                  <div className="mt-4 flex gap-1 h-2 rounded-full overflow-hidden">
                    {present > 0 && (
                      <div className="bg-emerald-500 rounded-full" style={{ flex: present }} />
                    )}
                    {(session.attendanceSummary?.PARTIAL ?? 0) > 0 && (
                      <div className="bg-yellow-400 rounded-full" style={{ flex: session.attendanceSummary.PARTIAL }} />
                    )}
                    {(session.attendanceSummary?.LATE ?? 0) > 0 && (
                      <div className="bg-blue-400 rounded-full" style={{ flex: session.attendanceSummary.LATE }} />
                    )}
                    {(session.attendanceSummary?.ABSENT ?? 0) > 0 && (
                      <div className="bg-red-400 rounded-full" style={{ flex: session.attendanceSummary.ABSENT }} />
                    )}
                    {(session.attendanceSummary?.EXCUSED ?? 0) > 0 && (
                      <div className="bg-purple-400 rounded-full" style={{ flex: session.attendanceSummary.EXCUSED }} />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
