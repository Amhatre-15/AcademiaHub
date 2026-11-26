import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Zap,
  Trophy,
  Flame,
  CalendarDays,
  Clock,
  ArrowRight,
  Activity,
  QrCode,
  BookOpen,
  GraduationCap,
  ShieldCheck,
  Radio,
  FileText,
  ChevronRight,
  FolderSync,
  CheckCircle2,
  AlertTriangle,
  Sun,
  Moon,
  Sunset,
  ExternalLink,
} from 'lucide-react';
import api from '../../api/client';
import { studentApi } from '../../api/student';
import { googleClassroomApi } from '../../api/googleClassroom';
import { useAuthStore } from '../../stores/authStore';

// ─── Priority 1 Components: Header & Quick Actions (0ms Instant Paint) ───

function getGreetingTime(): { text: string; icon: React.ReactNode } {
  const hour = new Date().getHours();
  if (hour < 12) {
    return { text: 'Good morning', icon: <Sun className="w-5 h-5 text-amber-400 animate-spin-slow" /> };
  } else if (hour < 17) {
    return { text: 'Good afternoon', icon: <Sunset className="w-5 h-5 text-orange-400" /> };
  }
  return { text: 'Good evening', icon: <Moon className="w-5 h-5 text-indigo-400" /> };
}

export default function StudentOverview() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState(getGreetingTime());
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setGreeting(getGreetingTime());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // ─── Priority 1 Data: Live Active Class Radar (Fast Poll) ───
  const { data: activeSession, isLoading: activeSessionLoading } = useQuery({
    queryKey: ['student-active-session'],
    queryFn: () => studentApi.sessions.getActive(),
    refetchInterval: 12000,
  });

  // ─── Priority 2 Data: Today's Academic Schedule ───
  const { data: timetable, isLoading: timetableLoading } = useQuery({
    queryKey: ['student-timetable'],
    queryFn: async () => {
      const res = await api.get('/student/timetable');
      return res.data.entries || [];
    },
    staleTime: 60 * 1000,
  });

  // ─── Priority 3 Data: Gamification & Engagement ───
  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ['student-overview'],
    queryFn: async () => {
      const res = await api.get('/student/overview');
      return res.data;
    },
    staleTime: 60 * 1000,
  });

  // ─── Priority 3 Data: Attendance Summary & Compliance ───
  const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
    queryKey: ['student-attendance-summary'],
    queryFn: () => studentApi.attendance.getSummary(),
    staleTime: 60 * 1000,
  });

  // ─── Priority 4 Data: Google Classroom Status ───
  const { data: googleStatus } = useQuery({
    queryKey: ['google-auth-status'],
    queryFn: googleClassroomApi.getStatus,
    staleTime: 120 * 1000,
  });

  const today = new Date().getDay();
  const todaysClasses = timetable?.filter((entry: any) => entry.dayOfWeek === today) || [];

  const studentName = overviewData?.student?.firstName || user?.username || 'Student';
  const engagement = overviewData?.engagement || { totalXp: 120, level: 1, streak: 1 };
  const xpProgress = Math.min(100, Math.max(5, (engagement.totalXp % 1000) / 10));

  // Compute attendance percentage
  const attendancePct = attendanceData?.overall?.percentage ?? null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* ─── PRIORITY 1: Dynamic Hero Banner & Quick Actions Dock ─── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/20 shadow-2xl p-6 sm:p-8 text-white">
        {/* Ambient atmospheric lighting */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-indigo-200 border border-white/10">
                {greeting.icon}
                <span>{greeting.text}</span>
              </span>
              <span className="text-xs font-mono text-slate-400 bg-black/30 px-2.5 py-1 rounded-full border border-white/5">
                {currentTime}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Welcome back,{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300">
                {studentName}
              </span>
              ! 🎓
            </h1>

            <p className="text-slate-300 text-sm sm:text-base max-w-xl">
              {todaysClasses.length > 0 ? (
                <>You have <strong className="text-indigo-300 font-semibold">{todaysClasses.length} {todaysClasses.length === 1 ? 'lecture' : 'lectures'}</strong> scheduled for today. Ready to crush your goals?</>
              ) : (
                <>No scheduled lectures today! Great time to review Google Classroom notes or study.</>
              )}
            </p>
          </div>

          {/* Quick Action Navigation Dock */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 self-start md:self-auto">
            <button
              onClick={() => navigate('/student/live')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <QrCode size={16} className="text-indigo-200 animate-pulse" />
              Scan 1s Dynamic QR
            </button>

            <button
              onClick={() => navigate('/student/materials?tab=google')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600/90 hover:bg-emerald-600 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-emerald-600/25 border border-emerald-500/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <BookOpen size={16} className="text-emerald-200" />
              Google Classroom
            </button>

            <button
              onClick={() => navigate('/student/notebook')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-slate-200 font-medium text-xs sm:text-sm backdrop-blur-md border border-white/10 transition-all duration-200 hover:scale-[1.02]"
            >
              <FileText size={16} className="text-slate-300" />
              Notebook
            </button>
          </div>
        </div>
      </div>

      {/* ─── PRIORITY 1: Active Live Session Radar Card (Conditional Highlight) ─── */}
      {activeSessionLoading ? (
        <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900/60 animate-pulse border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-slate-400" />
            <div className="h-4 w-48 bg-slate-300 dark:bg-slate-700 rounded" />
          </div>
          <div className="h-8 w-24 bg-slate-300 dark:bg-slate-700 rounded-xl" />
        </div>
      ) : activeSession ? (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 p-1 shadow-xl shadow-emerald-500/20">
          <div className="rounded-[22px] bg-slate-950/90 backdrop-blur-xl p-5 sm:p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Radio size={24} className="animate-pulse" />
                </div>
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500" />
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-wider border border-emerald-500/30">
                    Live Session Active Now
                  </span>
                  <span className="text-xs text-slate-400">
                    {activeSession.class?.name || 'Class Session'}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mt-1">
                  {activeSession.subject?.name}
                </h3>
                <p className="text-slate-300 text-xs sm:text-sm mt-0.5">
                  Faculty: <strong className="text-white font-medium">{activeSession.faculty?.user?.username || 'Professor'}</strong> • Dynamic 1-Second QR Checkpoint is active!
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/student/live')}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/30 transition-all duration-200 hover:scale-[1.02] flex-shrink-0"
            >
              <QrCode size={18} />
              <span>Scan Dynamic QR & Attend</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : null}

      {/* ─── PRIORITY 2: Gamification & Academic Health Metrics (Rich 3D Icons & Gradients) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Metric 1: Scholar Level & Mastery XP */}
        <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xl p-6 transition-all duration-300 hover:shadow-2xl hover:border-amber-500/30 group">
            {/* Ambient gold glow */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-amber-400/15 via-yellow-400/5 to-transparent rounded-bl-full transition-transform group-hover:scale-110 pointer-events-none" />

            <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
              <div className="flex items-center justify-between">
                {/* 3D-styled Vibrant Icon Badge */}
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 p-3 text-slate-950 shadow-lg shadow-amber-500/30 flex items-center justify-center transform transition-transform group-hover:rotate-6">
                  <Trophy size={24} className="stroke-[2.5]" />
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/20">
                    Scholar Rank
                  </span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
                    Level {engagement.level}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-baseline text-xs font-semibold mb-1.5">
                  <span className="text-slate-500 dark:text-slate-400">XP Progress</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">{engagement.totalXp} XP</span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-700/50">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 rounded-full transition-all duration-1000 ease-out shadow-sm shadow-amber-500/50"
                    style={{ width: `${xpProgress}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 text-right font-medium">
                  {1000 - (engagement.totalXp % 1000)} XP to next milestone
                </p>
              </div>
            </div>
          </div>

        {/* Metric 2: Flame Learning Streak */}
        <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xl p-6 transition-all duration-300 hover:shadow-2xl hover:border-orange-500/30 group">
            {/* Ambient orange glow */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-orange-500/15 via-rose-500/5 to-transparent rounded-bl-full transition-transform group-hover:scale-110 pointer-events-none" />

            <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
              <div className="flex items-center justify-between">
                {/* 3D-styled Vibrant Flame Icon Badge */}
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-rose-500 via-orange-500 to-amber-400 p-3 text-white shadow-lg shadow-orange-500/30 flex items-center justify-center transform transition-transform group-hover:scale-105">
                  <Flame size={24} className="stroke-[2.5] animate-pulse" />
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold border border-orange-500/20">
                    Consistency
                  </span>
                  <div className="flex items-baseline justify-end gap-1.5 mt-1">
                    <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                      {engagement.streak}
                    </span>
                    <span className="text-sm font-bold text-orange-500">Days</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                  <Zap size={14} className="text-amber-500 flex-shrink-0" />
                  <span>{engagement.streak > 3 ? 'You are on an active roll! Keep attendance high.' : 'Scan attendance daily to build your multiplier!'}</span>
                </p>
                <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                  <span>+15 XP for every on-time class check-in</span>
                </div>
              </div>
            </div>
          </div>

        {/* Metric 3: Real Attendance Health Gauge */}
        <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xl p-6 transition-all duration-300 hover:shadow-2xl hover:border-emerald-500/30 group sm:col-span-2 lg:col-span-1">
            {/* Ambient emerald glow */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-emerald-500/15 via-teal-500/5 to-transparent rounded-bl-full transition-transform group-hover:scale-110 pointer-events-none" />

            <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
              <div className="flex items-center justify-between">
                {/* 3D-styled Vibrant Shield Badge */}
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 p-3 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center transform transition-transform group-hover:rotate-[-6deg]">
                  <ShieldCheck size={24} className="stroke-[2.5]" />
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
                      attendancePct === null || attendancePct >= 75
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                    }`}
                  >
                    {attendancePct === null ? 'All Clear' : attendancePct >= 75 ? 'Healthy • >75%' : 'Warning • <75%'}
                  </span>
                  <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter mt-1">
                    {attendancePct !== null ? `${Math.round(attendancePct)}%` : '100%'}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                  <span>Classroom Presence</span>
                  <Link
                    to="/student/attendance"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-0.5"
                  >
                    Details <ChevronRight size={13} />
                  </Link>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {attendancePct !== null && attendancePct < 75
                    ? 'Attendance is below 75% requirement. Attend upcoming lectures!'
                    : 'Good standing. Eligible for all semester examinations.'}
                </p>
              </div>
            </div>
          </div>
      </div>

      {/* ─── PRIORITY 3: Main Body Split (Schedule Timeline & Google Classroom Hub) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Today's Schedule Timeline (2 Cols) */}
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <CalendarDays size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Today's Schedule
                </h2>
                <p className="text-xs text-slate-500">Live lecture timetable for today</p>
              </div>
            </div>

            <Link
              to="/student/timetable"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 transition-colors"
            >
              Full Timetable <ArrowRight size={14} />
            </Link>
          </div>

          {/* Schedule Content Progressive Loading */}
          {timetableLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse p-5"
                />
              ))}
            </div>
          ) : todaysClasses.length === 0 ? (
            <div className="bg-white dark:bg-slate-900/80 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl p-10 text-center shadow-sm">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100 dark:border-indigo-800">
                <Sparkles size={28} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                You're all clear today!
              </h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto mb-5">
                No classes scheduled for today. Review uploaded notes or explore synced Google Classroom assignments.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => navigate('/student/materials?tab=google')}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition-all shadow-sm"
                >
                  Open Google Classroom
                </button>
                <button
                  onClick={() => navigate('/student/notebook')}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-200 transition-all"
                >
                  Open Notebook
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {todaysClasses.map((cls: any, idx: number) => {
                const isFirst = idx === 0;

                return (
                  <div
                    key={cls.id || idx}
                    className={`relative p-5 rounded-3xl border transition-all duration-200 ${
                      isFirst
                        ? 'bg-gradient-to-r from-indigo-900/90 via-slate-900 to-indigo-950/90 border-indigo-500/40 text-white shadow-lg shadow-indigo-900/20'
                        : 'bg-white dark:bg-slate-900/90 border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700/60 shadow-sm'
                    }`}
                  >
                    {isFirst && (
                      <div className="absolute top-4 right-5 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 backdrop-blur-md rounded-full text-[11px] font-bold flex items-center gap-1.5 text-indigo-300">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                        UP NEXT
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start sm:items-center gap-4">
                        {/* Time capsule */}
                        <div
                          className={`flex flex-col items-center justify-center px-4 py-2.5 rounded-2xl border text-xs font-mono font-bold min-w-[110px] ${
                            isFirst
                              ? 'bg-white/10 text-white border-white/10'
                              : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <Clock size={13} className={isFirst ? 'text-indigo-300' : 'text-indigo-500'} />
                            <span>{cls.timeSlot?.startTime}</span>
                          </div>
                          <span className="text-[10px] opacity-75 font-normal">to {cls.timeSlot?.endTime}</span>
                        </div>

                        <div>
                          <h3
                            className={`text-base sm:text-lg font-bold tracking-tight ${
                              isFirst ? 'text-white' : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {cls.subject?.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                            <span className={isFirst ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}>
                              Faculty: <strong className="font-medium">{cls.faculty?.user?.username || 'Professor'}</strong>
                            </span>
                            {cls.room && (
                              <span
                                className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold ${
                                  isFirst
                                    ? 'bg-white/15 text-indigo-100'
                                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                Room {cls.room}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <span
                          className={`px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider ${
                            isFirst
                              ? 'bg-white/15 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {cls.lectureType?.name || 'Lecture'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: In-App Google Classroom & Quick Missions (1 Col) */}
        <div className="space-y-6">
          {/* Google Classroom Hub Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900/90 via-slate-900 to-teal-950 border border-emerald-500/25 p-6 text-white shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-md">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Google Classroom</h3>
                    <p className="text-xs text-emerald-300">In-App Document Hub</p>
                  </div>
                </div>

                {googleStatus?.connected ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold">
                    Connected
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold">
                    Setup
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {googleStatus?.connected ? (
                  <>Synced with <strong className="text-white">{googleStatus.googleEmail}</strong>. View lecture notes, drive attachments, and stream assignments directly inside AcademiaHub.</>
                ) : (
                  <>Connect your university Google account to view classroom materials, syllabus slides, and coursework without leaving the app.</>
                )}
              </p>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => navigate('/student/materials?tab=google')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20"
                >
                  <FolderSync size={14} />
                  <span>Browse Classroom Materials</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Daily Academic Missions Card */}
          <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <GraduationCap className="text-indigo-500" size={18} />
                Daily Academic Missions
              </h3>
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full">
                +50 XP
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 text-xs">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={13} />
                </div>
                <div className="flex-1">
                  <span className="font-medium text-slate-800 dark:text-slate-200">Scan Attendance Checkpoint</span>
                  <p className="text-[10px] text-slate-400">Scan 1s Dynamic QR code in lecture</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 text-xs">
                <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                  <Activity size={13} />
                </div>
                <div className="flex-1">
                  <span className="font-medium text-slate-800 dark:text-slate-200">Review Classroom Materials</span>
                  <p className="text-[10px] text-slate-400">Check updated slides & documents</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 text-xs">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                  <Flame size={13} />
                </div>
                <div className="flex-1">
                  <span className="font-medium text-slate-800 dark:text-slate-200">Maintain Study Streak</span>
                  <p className="text-[10px] text-slate-400">Log in daily to stack streak XP</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
