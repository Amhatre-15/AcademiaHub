import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  TrendingUp,
  BookOpen,
  CalendarDays,
  AlertCircle,
} from 'lucide-react';
import { studentApi } from '../../api/student';

type AttendanceStatus = 'PRESENT' | 'PARTIAL' | 'LATE' | 'ABSENT' | 'EXCUSED';

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  PRESENT: {
    label: 'Present',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    icon: <CheckCircle2 size={14} />,
  },
  PARTIAL: {
    label: 'Partial',
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    icon: <Clock size={14} />,
  },
  LATE: {
    label: 'Late',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: <Clock size={14} />,
  },
  ABSENT: {
    label: 'Absent',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: <XCircle size={14} />,
  },
  EXCUSED: {
    label: 'Excused',
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    icon: <Shield size={14} />,
  },
};

function StatusChip({ status, wasOverridden }: { status: AttendanceStatus; wasOverridden?: boolean }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bgColor} ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
      {wasOverridden && (
        <span title="Manually adjusted by faculty">
          <Shield size={10} className="opacity-60" />
        </span>
      )}
    </span>
  );
}

function AttendanceRingChart({ percentage }: { percentage: number }) {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const color =
    percentage >= 75 ? '#10b981' :
    percentage >= 60 ? '#f59e0b' :
    '#ef4444';

  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="currentColor"
          strokeWidth="12" className="text-slate-100 dark:text-slate-800" />
        <circle
          cx="70" cy="70" r={radius} fill="none"
          stroke={color} strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-slate-900 dark:text-white">{percentage}%</span>
        <span className="text-xs text-slate-500 font-medium">Attendance</span>
      </div>
    </div>
  );
}

export default function StudentAttendancePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['student-attendance'],
    queryFn: () => studentApi.attendance.getSummary(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm">Loading attendance…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400">
        <AlertCircle size={48} className="text-red-400" />
        <p className="text-sm">Failed to load attendance data.</p>
      </div>
    );
  }

  const { overall, bySubject, recentSessions } = data!;

  if (!overall || overall.total === 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">My Attendance</h1>
        <p className="text-slate-500 text-sm mb-8">Track your presence across all classes.</p>
        <div className="flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-16 gap-4 text-center">
          <CalendarDays size={56} className="text-slate-300 dark:text-slate-700" />
          <div>
            <p className="font-semibold text-slate-700 dark:text-slate-300 text-lg">No attendance records yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Attendance will appear here after your faculty conducts live sessions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const pct = overall.attendancePercentage;
  const statusColor =
    pct >= 75 ? 'text-emerald-600 dark:text-emerald-400' :
    pct >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
    'text-red-600 dark:text-red-400';
  const statusLabel =
    pct >= 75 ? 'Great' :
    pct >= 60 ? 'At Risk' :
    'Critical';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Attendance</h1>
        <p className="text-slate-500 text-sm mt-1">Track your presence across all enrolled subjects.</p>
      </div>

      {/* Overall Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ring chart */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 flex flex-col items-center justify-center gap-4">
          <AttendanceRingChart percentage={pct} />
          <div className="text-center">
            <p className={`text-lg font-bold ${statusColor}`}>{statusLabel}</p>
            <p className="text-xs text-slate-500 mt-1">
              {overall.total} total sessions
            </p>
          </div>
        </div>

        {/* Stat grid */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4 content-start">
          {[
            { value: overall.present, ...STATUS_CONFIG.PRESENT },
            { value: overall.partial, ...STATUS_CONFIG.PARTIAL },
            { value: overall.late,    ...STATUS_CONFIG.LATE },
            { value: overall.absent,  ...STATUS_CONFIG.ABSENT },
            { value: overall.excused, ...STATUS_CONFIG.EXCUSED },
            {
              label: 'Total',
              value: overall.total,
              color: 'text-slate-700 dark:text-slate-300',
              bgColor: 'bg-slate-100 dark:bg-slate-800',
              icon: <TrendingUp size={14} />,
            },
          ].map(item => (
            <div
              key={item.label}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5"
            >
              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium mb-3 ${item.bgColor} ${item.color}`}>
                {item.icon}
                {item.label}
              </div>
              <p className={`text-3xl font-black ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Per-Subject Breakdown */}
      {bySubject.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <BookOpen size={18} className="text-indigo-500" />
            <h2 className="font-bold text-slate-900 dark:text-white">By Subject</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {bySubject.map(subject => {
              const spct = subject.attendancePercentage;
              const sColor =
                spct >= 75 ? 'text-emerald-600' :
                spct >= 60 ? 'text-yellow-600' :
                'text-red-600';
              const barColor =
                spct >= 75 ? 'bg-emerald-500' :
                spct >= 60 ? 'bg-yellow-500' :
                'bg-red-500';

              return (
                <div key={subject.subjectId} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">
                      {subject.subjectName}
                    </p>
                    <span className={`text-sm font-bold ${sColor}`}>{spct}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full ${barColor} rounded-full transition-all duration-700`}
                      style={{ width: `${spct}%` }}
                    />
                  </div>
                  <div className="flex gap-4 text-xs text-slate-500">
                    <span>{subject.present} present</span>
                    {subject.partial > 0 && <span>{subject.partial} partial</span>}
                    {subject.late > 0 && <span>{subject.late} late</span>}
                    {subject.absent > 0 && <span>{subject.absent} absent</span>}
                    <span className="ml-auto">{subject.total} total</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Session History */}
      {recentSessions.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <CalendarDays size={18} className="text-indigo-500" />
            <h2 className="font-bold text-slate-900 dark:text-white">Recent Sessions</h2>
            <span className="text-xs text-slate-400 ml-1">(last {recentSessions.length})</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentSessions.map(session => {
              const date = new Date(session.date);
              return (
                <div key={session.sessionId} className="flex items-center gap-4 px-6 py-4">
                  {/* Date */}
                  <div className="w-12 text-center flex-shrink-0">
                    <p className="text-lg font-black text-slate-900 dark:text-white leading-none">
                      {date.getDate()}
                    </p>
                    <p className="text-xs text-slate-400 font-medium">
                      {date.toLocaleString('en', { month: 'short' })}
                    </p>
                  </div>

                  {/* Subject + class */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                      {session.subject.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {session.class.name}
                      {session.division && ` · Div ${session.division.name}`}
                      {session.batch && ` · ${session.batch.name}`}
                    </p>
                  </div>

                  {/* Checkpoint indicators */}
                  <div className="hidden sm:flex items-center gap-1.5 text-xs">
                    <span className={`w-2 h-2 rounded-full ${session.startSubmittedAt ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} title="Start checkpoint" />
                    <span className={`w-2 h-2 rounded-full ${session.endSubmittedAt ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} title="End checkpoint" />
                  </div>

                  {/* Status */}
                  <StatusChip status={session.status} wasOverridden={session.wasOverridden} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
