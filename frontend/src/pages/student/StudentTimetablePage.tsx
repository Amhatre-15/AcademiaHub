import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import { CalendarDays, Sparkles } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function StudentTimetablePage() {
  const { data: timetable, isLoading } = useQuery({
    queryKey: ['student-timetable'],
    queryFn: async () => {
      const res = await api.get('/student/timetable');
      return res.data.entries;
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <div className="flex flex-col items-center gap-4 text-indigo-500">
          <Sparkles className="animate-spin" size={32} />
          <p className="text-sm font-medium animate-pulse">Loading your schedule...</p>
        </div>
      </div>
    );
  }

  // Group by day
  const groupedByDay: Record<number, any[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  timetable?.forEach((entry: any) => {
    if (groupedByDay[entry.dayOfWeek]) {
      groupedByDay[entry.dayOfWeek].push(entry);
    }
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="text-indigo-500" /> My Schedule
          </h1>
          <p className="text-slate-500 mt-1">Your weekly classes.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        {DAYS.map((day, idx) => {
          const dayNumber = idx + 1; // 1 = Monday
          const classes = groupedByDay[dayNumber] || [];

          return (
            <div key={day} className="border-b border-slate-200 dark:border-slate-800 last:border-0">
              <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                {day}
              </div>
              <div className="p-0">
                {classes.length === 0 ? (
                  <div className="px-6 py-6 text-slate-400 text-sm italic">Free day! No classes scheduled.</div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {classes.map((cls) => (
                      <div key={cls.id} className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400 min-w-[120px]">
                          {cls.timeSlot.startTime} - {cls.timeSlot.endTime}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-900 dark:text-white text-lg">{cls.subject.name}</p>
                          <p className="text-sm font-medium text-slate-500">
                            {cls.faculty.user.username}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold uppercase tracking-wide">
                             {cls.lectureType.name}
                           </span>
                           {cls.room && (
                             <span className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-lg text-xs font-bold border border-indigo-100 dark:border-indigo-500/20">
                               Room {cls.room}
                             </span>
                           )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
