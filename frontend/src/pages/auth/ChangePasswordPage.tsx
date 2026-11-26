import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Shield } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8, label: 'At least 8 characters' },
  { test: (p: string) => /[A-Z]/.test(p), label: 'One uppercase letter' },
  { test: (p: string) => /[0-9]/.test(p), label: 'One number' },
];

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { changePassword, isLoading, error, clearError, user } = useAuthStore();
  const navigate = useNavigate();

  const passwordStrength = PASSWORD_RULES.filter((r) => r.test(newPassword)).length;
  const allRulesPassed = passwordStrength === PASSWORD_RULES.length;
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    if (!allRulesPassed) {
      toast.error('Password does not meet requirements.');
      return;
    }
    if (!passwordsMatch) {
      toast.error('Passwords do not match.');
      return;
    }
    try {
      await changePassword(currentPassword, newPassword, confirmPassword);
      toast.success('Password changed successfully!');
      // Navigate to appropriate dashboard
      const dashboard =
        user?.role === 'IT_ADMIN' ? '/admin' :
          user?.role === 'FACULTY' ? '/faculty' :
            '/student';
      navigate(dashboard, { replace: true });
    } catch {
      // Error shown via store
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 rounded-2xl mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Change Password</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            You must set a new password before continuing.
          </p>
        </div>

        <div className="card card-body shadow-md">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Your account uses a temporary password. Please set a secure new password to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="label">Temporary / Current Password</label>
              <input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                className="input"
                placeholder="Enter your current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="label">New Password</label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                className="input"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
              />

              {/* Password strength indicator */}
              {newPassword.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${i < passwordStrength
                          ? passwordStrength === 3 ? 'bg-green-500' : passwordStrength === 2 ? 'bg-yellow-500' : 'bg-red-500'
                          : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                      />
                    ))}
                  </div>
                  <ul className="space-y-0.5">
                    {PASSWORD_RULES.map((rule) => (
                      <li key={rule.label} className={`text-xs flex items-center gap-1 ${rule.test(newPassword) ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
                        }`}>
                        <span>{rule.test(newPassword) ? '✓' : '○'}</span>
                        {rule.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label">Confirm New Password</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className={`input ${confirmPassword.length > 0 && !passwordsMatch ? 'input-error' : ''}`}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="error-text">Passwords do not match.</p>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary w-full btn-lg"
              disabled={isLoading || !allRulesPassed || !passwordsMatch || !currentPassword}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Changing password…
                </>
              ) : (
                'Set New Password'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}


