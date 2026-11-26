import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import { facultyApi } from '../../api/faculty';
import { Play } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';


const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function FacultyTimetablePage() {
  const navigate = useNavigate();
  const { data: timetable, isLoading } = useQuery({
    queryKey: ['faculty-timetable'],
    queryFn: async () => {
      const res = await api.get('/faculty/timetable');
      return res.data.entries;
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading timetable...</div>;
  }

  // Group by day
  const groupedByDay: Record<number, any[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  timetable?.forEach((entry: any) => {
    if (groupedByDay[entry.dayOfWeek]) {
      groupedByDay[entry.dayOfWeek].push(entry);
    }
  });

  const handleStartSession = async (entryId: string) => {
    try {
      await facultyApi.sessions.start(entryId);
      toast.success('Session started successfully!');
      navigate('/faculty/live');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to start session');
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Timetable</h1>
          <p className="text-gray-500 mt-1">Your weekly scheduled classes.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
        {DAYS.map((day, idx) => {
          const dayNumber = idx + 1; // 1 = Monday
          const classes = groupedByDay[dayNumber] || [];

          return (
            <div key={day} className="border-b border-gray-200 dark:border-gray-800 last:border-0">
              <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-3 font-semibold text-gray-700 dark:text-gray-300">
                {day}
              </div>
              <div className="p-0">
                {classes.length === 0 ? (
                  <div className="px-6 py-4 text-gray-400 text-sm italic">No classes scheduled</div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
                    {classes.map((cls) => (
                      <div key={cls.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400 min-w-[120px]">
                          {cls.timeSlot.startTime} - {cls.timeSlot.endTime}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 dark:text-white">{cls.subject.name}</p>
                          <p className="text-sm text-gray-500">
                            {cls.class.name} {cls.division ? ` - Div ${cls.division.name}` : ''} {cls.batch ? ` (Batch ${cls.batch.name})` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs">
                             {cls.lectureType.name}
                           </span>
                           {cls.room && (
                             <span className="px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded text-xs border border-green-200 dark:border-green-800">
                               Room {cls.room}
                             </span>
                           )}
                           <button
                             onClick={() => handleStartSession(cls.id)}
                             className="ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                           >
                             <Play size={14} />
                             Start Class
                           </button>
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


