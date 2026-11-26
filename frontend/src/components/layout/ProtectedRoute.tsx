import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated } from '../../stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('IT_ADMIN' | 'FACULTY' | 'STUDENT' | 'PARENT' | 'EXAM_OFFICER' | 'DEAN')[];
}

/**
 * Route guard that:
 * 1. Redirects unauthenticated users to /login
 * 2. Redirects first-login users to /change-password
 * 3. Optionally enforces role-based access
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const isAuthenticated = useIsAuthenticated();
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Force password change if first login
  if (user.firstLogin && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  // Role authorization
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to the user's appropriate dashboard
    const dashboardPath =
      user.role === 'IT_ADMIN' ? '/admin' :
      user.role === 'FACULTY' ? '/faculty' :
      user.role === 'PARENT' ? '/parent' :
      '/student';
    return <Navigate to={dashboardPath} replace />;
  }

  return <>{children}</>;
}

/**
 * Redirects authenticated users away from the login page
 */
export function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  const user = useAuthStore((s) => s.user);

  if (isAuthenticated && user) {
    if (user.firstLogin) return <Navigate to="/change-password" replace />;
    const dashboardPath =
      user.role === 'IT_ADMIN' ? '/admin' :
      user.role === 'FACULTY' ? '/faculty' :
      '/student';
    return <Navigate to={dashboardPath} replace />;
  }

  return <>{children}</>;
}
