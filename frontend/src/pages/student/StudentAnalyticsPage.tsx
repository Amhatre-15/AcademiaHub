import { useState, useEffect } from 'react';
import { studentApi } from '../../api/student';
import { Activity, BookOpen, CheckCircle, Trophy, Target } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await studentApi.analytics.getOverview();
        setData(result);
      } catch (err) {
        toast.error('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading your progress...</div>;
  if (!data) return <div className="p-8 text-center text-slate-500">No data available.</div>;

  const { engagement, metrics, recentEvents } = data;
  
  // Calculate level progress (simple formula for display)
  const currentLevelXp = (engagement.level - 1) * 500; // Mock calculation based on some base
  const nextLevelXp = engagement.level * 500;
  const progressPercent = Math.min(100, Math.max(0, ((engagement.totalXp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 h-[calc(100vh-64px)] overflow-y-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
          <Activity size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Progress</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Track your academic performance and engagement</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Level & XP Overview */}
        <div className="md:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          
          <div className="flex flex-col items-center justify-center w-32 h-32 rounded-full border-4 border-indigo-100 dark:border-indigo-900 relative shrink-0">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="58" fill="none" className="stroke-indigo-100 dark:stroke-indigo-900/50" strokeWidth="4" />
              <circle 
                cx="60" cy="60" r="58" fill="none" 
                className="stroke-indigo-500" 
                strokeWidth="4" 
                strokeDasharray={`${progressPercent * 3.64} 364`} 
                strokeLinecap="round" 
              />
            </svg>
            <span className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Level</span>
            <span className="text-4xl font-bold text-slate-900 dark:text-white leading-none">{engagement.level}</span>
          </div>
          
          <div className="flex-1 w-full text-center md:text-left z-10">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">You're doing great!</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 max-w-sm">
              Keep attending classes and participating in quizzes to level up and earn badges.
            </p>
            
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-6">
              <div>
                <p className="text-xs text-slate-500 font-medium mb-1">Total XP</p>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{engagement.totalXp} XP</p>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-800 hidden md:block"></div>
              <div>
                <p className="text-xs text-slate-500 font-medium mb-1">Current Streak</p>
                <p className="text-lg font-bold text-orange-500 flex items-center justify-center md:justify-start gap-1">
                  🔥 {engagement.streak} Days
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="md:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4">Recent Activity</h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
            {recentEvents.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No recent activity</p>
            ) : (
              recentEvents.map((event: any) => (
                <div key={event.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    {event.eventType.includes('QUIZ') ? <Trophy size={14} className="text-indigo-500" /> : <CheckCircle size={14} className="text-emerald-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white capitalize">
                      {event.eventType.replace('_', ' ').toLowerCase()}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">+{event.points} XP</span>
                      <span className="text-xs text-slate-500">• {new Date(event.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Academic Metrics */}
        <div className="md:col-span-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 relative overflow-hidden">
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle size={20} />
              </div>
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.attendancePercentage}%</span>
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white relative z-10">Attendance</h3>
            <p className="text-sm text-slate-500 mt-1 relative z-10">Attended {metrics.totalClassesAttended} classes</p>
            
            {/* Background progress bar visualization */}
            <div className="absolute bottom-0 left-0 h-1 bg-emerald-500" style={{ width: `${metrics.attendancePercentage}%` }}></div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 relative overflow-hidden">
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Target size={20} />
              </div>
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.quizAverage}%</span>
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white relative z-10">Quiz Accuracy</h3>
            <p className="text-sm text-slate-500 mt-1 relative z-10">Average score across all quizzes</p>
            <div className="absolute bottom-0 left-0 h-1 bg-indigo-500" style={{ width: `${metrics.quizAverage}%` }}></div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 relative overflow-hidden">
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-600 dark:text-orange-400">
                <BookOpen size={20} />
              </div>
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.assignmentCompletion}%</span>
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white relative z-10">Assignments</h3>
            <p className="text-sm text-slate-500 mt-1 relative z-10">Completion rate</p>
            <div className="absolute bottom-0 left-0 h-1 bg-orange-500" style={{ width: `${metrics.assignmentCompletion}%` }}></div>
          </div>
        </div>

      </div>
    </div>
  );
}
