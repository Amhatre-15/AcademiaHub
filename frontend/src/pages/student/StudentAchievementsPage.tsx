import { useState, useEffect } from 'react';
import { studentApi } from '../../api/student';
import { Trophy, Medal, Star, Flame, Shield, ArrowUp } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentAchievementsPage() {
  const [data, setData] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overview, lb] = await Promise.all([
          studentApi.analytics.getOverview(),
          studentApi.analytics.getLeaderboard(),
        ]);
        setData(overview);
        setLeaderboard(lb);
      } catch (err) {
        toast.error('Failed to load achievements');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading achievements...</div>;
  if (!data) return <div className="p-8 text-center text-slate-500">No data available.</div>;

  const { badges } = data;

  // Static list of possible badges just to show locked vs unlocked visually if needed
  // But we'll just show unlocked badges for simplicity
  
  const getBadgeIcon = (type: string) => {
    switch (type) {
      case 'ATTENDANCE': return <Shield size={24} />;
      case 'STREAK': return <Flame size={24} />;
      case 'QUIZ_SCORE': return <Star size={24} />;
      default: return <Medal size={24} />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-64px)] flex flex-col md:flex-row gap-6">
      
      {/* Achievements / Badges Section */}
      <div className="w-full md:w-7/12 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-6 shrink-0">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
            <Medal size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Achievements</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Badges you've earned</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          {badges.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Medal className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-4" />
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">No badges yet</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                Keep attending classes and participating in quizzes to earn special badges.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {badges.map((badge: any) => (
                <div key={badge.id} className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/30 bg-gradient-to-b from-amber-50 to-white dark:from-amber-500/10 dark:to-slate-900 flex flex-col items-center text-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-white/40 dark:bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-500 dark:text-amber-400 mb-3 shadow-inner relative z-10">
                    {getBadgeIcon(badge.criteriaType)}
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-1 relative z-10">{badge.name}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 relative z-10">{badge.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard Section */}
      <div className="w-full md:w-5/12 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-6 shrink-0">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <Trophy size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Leaderboard</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Top 10 students by XP</p>
          </div>
        </div>

        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
          {leaderboard.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
              No data available on leaderboard
            </div>
          ) : (
            <div className="overflow-y-auto custom-scrollbar">
              {leaderboard.map((student, index) => (
                <div 
                  key={index} 
                  className={`flex items-center gap-4 p-4 border-b border-slate-100 dark:border-slate-800/50 ${
                    student.isMe ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                    index === 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' :
                    index === 1 ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300' :
                    index === 2 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                    'bg-slate-50 text-slate-400 dark:bg-slate-800'
                  }`}>
                    {index + 1}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${student.isMe ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>
                      {student.studentName} {student.isMe && '(You)'}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <ArrowUp size={10} className="text-emerald-500" />
                      Lvl {student.level}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className={`font-bold text-sm ${student.isMe ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      {student.xp} XP
                    </p>
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
