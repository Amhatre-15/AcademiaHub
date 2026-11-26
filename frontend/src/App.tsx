import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ProtectedRoute, PublicRoute } from './components/layout/ProtectedRoute';

// Lazy-loaded code-split route layouts
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const ChangePasswordPage = lazy(() => import('./pages/auth/ChangePasswordPage'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const FacultyLayout = lazy(() => import('./pages/faculty/FacultyLayout'));
const StudentLayout = lazy(() => import('./pages/student/StudentLayout'));
const ParentDashboardPage = lazy(() => import('./pages/parent/ParentDashboardPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
      <span className="text-xs font-semibold text-slate-400">Loading AcademiaHub...</span>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />

            {/* First-login password change (requires auth but not first_login=false) */}
            <Route
              path="/change-password"
              element={
                <ProtectedRoute>
                  <ChangePasswordPage />
                </ProtectedRoute>
              }
            />

            {/* Admin routes */}
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute allowedRoles={['IT_ADMIN']}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            />

            {/* Faculty routes */}
            <Route
              path="/faculty/*"
              element={
                <ProtectedRoute allowedRoles={['FACULTY']}>
                  <FacultyLayout />
                </ProtectedRoute>
              }
            />

            {/* Student routes */}
            <Route
              path="/student/*"
              element={
                <ProtectedRoute allowedRoles={['STUDENT']}>
                  <StudentLayout />
                </ProtectedRoute>
              }
            />

            {/* Parent & Guardian routes (Phase 18) */}
            <Route
              path="/parent"
              element={
                <ProtectedRoute allowedRoles={['PARENT', 'IT_ADMIN']}>
                  <ParentDashboardPage />
                </ProtectedRoute>
              }
            />

            {/* Default redirect */}
            <Route path="/" element={<LandingPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '8px',
            fontSize: '14px',
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;
