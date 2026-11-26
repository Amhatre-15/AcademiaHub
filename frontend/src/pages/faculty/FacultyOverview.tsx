import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import { CalendarDays, BookOpen, Clock } from 'lucide-react';
import { StatCard } from '../../components/ui/AdminComponents';

export default function FacultyOverview() {
  const { data: timetable, isLoading } = useQuery({
    queryKey: ['faculty-timetable'],
    queryFn: async () => {
      const res = await api.get('/faculty/timetable');
      return res.data.entries;
    },
  });

  const today = new Date().getDay();
  // If today is Sunday (0), we might just show Monday or no classes
  const todaysClasses = timetable?.filter((entry: any) => entry.dayOfWeek === today) || [];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Faculty Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back. Here is your overview for today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label="Today's Classes"
          value={isLoading ? '...' : todaysClasses.length.toString()}
          icon={<CalendarDays size={20} />}
        />
        <StatCard
          label="Total Assigned Classes"
          value={isLoading ? '...' : (timetable?.length || 0).toString()}
          icon={<BookOpen size={20} />}
        />
        <StatCard
          label="Next Class"
          value={todaysClasses.length > 0 ? todaysClasses[0].timeSlot.startTime : 'None'}
          icon={<Clock size={20} />}
        />
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">Today's Schedule</h2>
        </div>
        <div className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-gray-500">Loading schedule...</div>
          ) : todaysClasses.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CalendarDays className="mx-auto h-8 w-8 text-gray-400 mb-3" />
              <p>You have no classes scheduled for today.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {todaysClasses.map((cls: any) => (
                <div key={cls.id} className="p-6 flex items-start gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-semibold px-3 py-2 rounded-lg text-center min-w-[100px]">
                    <div className="text-sm">{cls.timeSlot.startTime}</div>
                    <div className="text-xs text-blue-500">to {cls.timeSlot.endTime}</div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{cls.subject.name}</h3>
                    <p className="text-gray-500 text-sm mt-1">
                      {cls.class.name} {cls.division ? ` - Div ${cls.division.name}` : ''} {cls.batch ? ` (Batch ${cls.batch.name})` : ''}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                        {cls.lectureType.name}
                      </span>
                      {cls.room && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          Room {cls.room}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ml-auto">
                    <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                      Manage Session
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
