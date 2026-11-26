import { useState } from 'react';
import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  LogOut,
  Menu,
  X,
  Play,
  UserCheck,
  Folder,
  BookOpen,
  FileText,
  Trophy,
  Megaphone,
  Activity,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';
import NotificationBell from '../../components/shared/NotificationBell';
import FacultyOverview from './FacultyOverview';
import FacultyTimetablePage from './FacultyTimetablePage';
import LiveSessionPage from './LiveSessionPage';
import FacultyAttendancePage from './FacultyAttendancePage';
import FacultyMaterialPage from './FacultyMaterialPage';
import FacultyQuizBankPage from './FacultyQuizBankPage';
import FacultyAssignmentsPage from './FacultyAssignmentsPage';
import NoticesPage from '../shared/NoticesPage';
import FacultyAnalyticsPage from './FacultyAnalyticsPage';

const navItems = [
  { to: '/faculty', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/faculty/timetable', label: 'Timetable', icon: CalendarDays },
  { to: '/faculty/attendance', label: 'Attendance', icon: UserCheck },
  { to: '/faculty/materials', label: 'Materials', icon: Folder },
  { to: '/faculty/assignments', label: 'Assignments', icon: FileText },
  { to: '/faculty/quizzes', label: 'Quiz Bank', icon: Trophy },
  { to: '/faculty/analytics', label: 'Analytics', icon: Activity },
  { to: '/faculty/notices', label: 'Notices', icon: Megaphone },
  { to: '/faculty/live', label: 'Live Session', icon: Play },
];

export default function FacultyLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully.');
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:relative z-30 flex flex-col w-64 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">AcademiaHub</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Faculty Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              className="lg:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                isActive ? 'sidebar-link-active' : 'sidebar-link'
              }
            >
              <item.icon size={16} className="flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="px-3 py-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <span className="text-blue-700 dark:text-blue-300 text-xs font-semibold">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user?.username}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Faculty</p>
            </div>
          </div>
          <button onClick={handleLogout} className="sidebar-link w-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-700">
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Faculty Portal</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route index element={<FacultyOverview />} />
            <Route path="timetable" element={<FacultyTimetablePage />} />
            <Route path="attendance" element={<FacultyAttendancePage />} />
            <Route path="materials" element={<FacultyMaterialPage />} />
            <Route path="quizzes" element={<FacultyQuizBankPage />} />
            <Route path="assignments" element={<FacultyAssignmentsPage />} />
            <Route path="analytics" element={<FacultyAnalyticsPage />} />
            <Route path="notices" element={<NoticesPage />} />
            <Route path="live" element={<LiveSessionPage />} />
            <Route path="*" element={<Navigate to="/faculty" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
