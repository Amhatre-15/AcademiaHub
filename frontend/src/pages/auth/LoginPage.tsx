import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GraduationCap, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: Location })?.from?.pathname;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    try {
      await login({ username, password });

      const user = useAuthStore.getState().user;
      const dashboardPath =
        user?.firstLogin ? '/change-password' :
        user?.role === 'IT_ADMIN' ? '/admin' :
        user?.role === 'FACULTY' ? '/faculty' :
        user?.role === 'STUDENT' ? '/student' :
        user?.role === 'PARENT' ? '/parent' :
        '/admin';

      const destination = (from && from !== '/') ? from : dashboardPath;
      navigate(destination, { replace: true });
    } catch {
      // Error already set in store
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AcademiaHub</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            College Management Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="card card-body shadow-md">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Sign in</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="label">Username</label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                required
                className="input"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="input pr-10"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full btn-lg"
              disabled={isLoading || !username || !password}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="mt-6 text-xs text-center text-gray-400 dark:text-gray-500">
            Contact your IT administrator if you cannot access your account.
          </p>
        </div>
      </div>
    </div>
  );
}


