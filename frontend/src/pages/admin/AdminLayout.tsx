import { useState } from 'react';
import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  GitBranch,
  Calendar,
  Layers,
  Users,
  BookOpen,
  GraduationCap,
  ClipboardList,
  CalendarDays,
  UserCheck,
  LogOut,
  Menu,
  X,
  School,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

// Sub-pages
import AdminOverview from './AdminOverview';
import BranchesPage from './BranchesPage';
import AcademicYearsPage from './AcademicYearsPage';
import AcademicLevelsPage from './AcademicLevelsPage';
import ClassesPage from './ClassesPage';
import SubjectsPage from './SubjectsPage';
import FacultyManagementPage from './FacultyManagementPage';
import FacultyAssignmentsPage from './FacultyAssignmentsPage';
import StudentsPage from './StudentsPage';
import EnrollmentsPage from './EnrollmentsPage';
import TimetablePage from './TimetablePage';

const navItems = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/branches', label: 'Branches', icon: GitBranch },
  { to: '/admin/academic-years', label: 'Academic Years', icon: Calendar },
  { to: '/admin/academic-levels', label: 'Academic Levels', icon: Layers },
  { to: '/admin/classes', label: 'Classes', icon: School },
  { to: '/admin/subjects', label: 'Subjects', icon: BookOpen },
  { to: '/admin/faculty', label: 'Faculty', icon: Users },
  { to: '/admin/faculty-assignments', label: 'Assignments', icon: ClipboardList },
  { to: '/admin/timetable', label: 'Timetable', icon: CalendarDays },
  { to: '/admin/students', label: 'Students', icon: GraduationCap },
  { to: '/admin/enrollments', label: 'Enrollments', icon: UserCheck },
];

export default function AdminLayout() {
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
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-200 dark:border-gray-800">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">AcademiaHub</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">IT Admin Panel</p>
          </div>
          <button
            className="ml-auto lg:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
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
              <p className="text-xs text-gray-500 dark:text-gray-400">IT Admin</p>
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
          <span className="text-sm font-semibold text-gray-900 dark:text-white">AcademiaHub Admin</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route index element={<AdminOverview />} />
            <Route path="branches" element={<BranchesPage />} />
            <Route path="academic-years" element={<AcademicYearsPage />} />
            <Route path="academic-levels" element={<AcademicLevelsPage />} />
            <Route path="classes" element={<ClassesPage />} />
            <Route path="subjects" element={<SubjectsPage />} />
            <Route path="faculty" element={<FacultyManagementPage />} />
            <Route path="faculty-assignments" element={<FacultyAssignmentsPage />} />
            <Route path="timetable" element={<TimetablePage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="enrollments" element={<EnrollmentsPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}


