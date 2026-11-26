import { useState } from 'react';
import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  Trophy,
  Activity,
  LogOut,
  Menu,
  X,
  Bell,
  Sparkles,
  Play,
  UserCheck,
  Folder,
  BookOpen,
  FileText,
  Megaphone,
} from 'lucide-react';
import NotificationBell from '../../components/shared/NotificationBell';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';
import StudentAiAssistant from '../../components/shared/StudentAiAssistant';
import StudentOverview from './StudentOverview';
import StudentTimetablePage from './StudentTimetablePage';
import StudentLiveSessionPage from './StudentLiveSessionPage';
import StudentAttendancePage from './StudentAttendancePage';
import StudentMaterialPage from './StudentMaterialPage';
import StudentQuizHistoryPage from './StudentQuizHistoryPage';
import StudentNotebookPage from './StudentNotebookPage';
import StudentAssignmentsPage from './StudentAssignmentsPage';
import StudentAnalyticsPage from './StudentAnalyticsPage';
import StudentAchievementsPage from './StudentAchievementsPage';
import NoticesPage from '../shared/NoticesPage';

const navItems = [
  { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/student/timetable', label: 'My Schedule', icon: CalendarDays },
  { to: '/student/attendance', label: 'Attendance', icon: UserCheck },
  { to: '/student/notebook', label: 'Notebook', icon: BookOpen },
  { to: '/student/materials', label: 'Classroom & Notes', icon: Folder },
  { to: '/student/assignments', label: 'Assignments', icon: FileText },
  { to: '/student/quizzes', label: 'Quiz History', icon: Trophy },
  { to: '/student/notices', label: 'Notices', icon: Megaphone },
  { to: '/student/achievements', label: 'Achievements', icon: Trophy },
  { to: '/student/analytics', label: 'My Progress', icon: Activity },
  { to: '/student/live', label: 'Live Session (1s QR)', icon: Play },
];

export default function StudentLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('See you later!');
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] dark:bg-[#020817] overflow-hidden selection:bg-indigo-500/30">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:relative z-50 flex flex-col w-64 h-full bg-white dark:bg-[#0f172a] border-r border-indigo-100 dark:border-slate-800 transition-transform duration-300 ease-in-out shadow-xl lg:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
      >
        {/* Logo Area */}
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 tracking-tight">
              AcademiaHub
            </h1>
          </div>
          <button
            className="ml-auto lg:hidden text-slate-400 hover:text-slate-600"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${isActive
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                }`
              }
            >
              <item.icon size={20} className="flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Profile / Logout Section */}
        <div className="p-4 border-t border-indigo-50 dark:border-slate-800/50">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 flex flex-col gap-4 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold shadow-md ring-2 ring-white dark:ring-slate-900">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {user?.username}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  <p className="text-xs text-slate-500 font-medium tracking-wide">Student</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 transition-colors"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Mobile Header */}
        <header className="flex items-center justify-between px-4 py-4 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 lg:hidden sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
            <Sparkles size={18} className="text-indigo-500" />
            AcademiaHub
          </div>
          <NotificationBell />
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto bg-[#f8fafc] dark:bg-[#020817]">
          <Routes>
            <Route index element={<StudentOverview />} />
            <Route path="timetable" element={<StudentTimetablePage />} />
            <Route path="attendance" element={<StudentAttendancePage />} />
            <Route path="notebook" element={<StudentNotebookPage />} />
            <Route path="materials" element={<StudentMaterialPage />} />
            <Route path="assignments" element={<StudentAssignmentsPage />} />
            <Route path="quizzes" element={<StudentQuizHistoryPage />} />
            <Route path="analytics" element={<StudentAnalyticsPage />} />
            <Route path="achievements" element={<StudentAchievementsPage />} />
            <Route path="notices" element={<NoticesPage />} />
            <Route path="live" element={<StudentLiveSessionPage />} />
            <Route path="*" element={<Navigate to="/student" replace />} />
          </Routes>
        </main>
        
        {/* Global Student AI Assistant (disabled during active quizzes) */}
        <StudentAiAssistant />
      </div>
    </div>
  );
}
