import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { googleClassroomApi, type GoogleStatus } from '../../api/googleClassroom';
import { getApiError } from '../../api/client';
import toast from 'react-hot-toast';
import { CheckCircle2, AlertCircle, LogOut, Loader2 } from 'lucide-react';

interface GoogleConnectButtonProps {
  onStatusChange?: (status: GoogleStatus) => void;
  className?: string;
  compact?: boolean;
}

export function GoogleConnectButton({ className = '', compact = false }: GoogleConnectButtonProps) {
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: status, isLoading } = useQuery({
    queryKey: ['google-auth-status'],
    queryFn: googleClassroomApi.getStatus,
    staleTime: 60 * 1000,
  });

  const disconnectMutation = useMutation({
    mutationFn: googleClassroomApi.disconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-auth-status'] });
      queryClient.invalidateQueries({ queryKey: ['google-classroom-courses'] });
      toast.success('Google account disconnected');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });

  const handleConnect = async () => {
    if (!status?.isConfigured) {
      toast.error(
        'Google OAuth credentials (Client ID & Secret) are not yet set in backend/.env. Please configure them to connect Google Classroom.',
        { duration: 6000 }
      );
      return;
    }

    try {
      setIsConnecting(true);
      const { url } = await googleClassroomApi.getAuthUrl(window.location.pathname);
      window.location.href = url;
    } catch (err) {
      setIsConnecting(false);
      toast.error(getApiError(err));
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 ${className}`}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Checking Google sync...</span>
      </div>
    );
  }

  if (status?.connected) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="truncate max-w-[140px] sm:max-w-[200px]">
            {status.googleEmail || 'Google Connected'}
          </span>
        </div>
        <button
          onClick={() => disconnectMutation.mutate()}
          disabled={disconnectMutation.isPending}
          title="Disconnect Google account"
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
        >
          {disconnectMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <LogOut className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {!status?.isConfigured && !compact && (
        <span
          className="hidden md:inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800/50"
          title="Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to backend/.env"
        >
          <AlertCircle className="w-3 h-3" />
          Setup required in .env
        </span>
      )}

      <button
        type="button"
        onClick={handleConnect}
        disabled={isConnecting}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:shadow-sm transition-all"
      >
        {isConnecting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
        ) : (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span>Connect Google</span>
      </button>
    </div>
  );
}
