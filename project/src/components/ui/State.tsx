import { ReactNode } from 'react';
import { Loader2, Inbox, AlertCircle } from 'lucide-react';

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <Loader2 className="h-8 w-8 animate-spin mb-3" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  message,
  action,
}: {
  icon?: typeof Inbox;
  title?: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <Icon className="h-12 w-12 mb-3 opacity-50" />
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {message && <p className="text-xs mt-1 text-slate-400">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-red-500">
      <AlertCircle className="h-10 w-10 mb-3" />
      <p className="text-sm font-medium">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function Badge({
  children,
  color = 'slate',
}: {
  children: ReactNode;
  color?: 'slate' | 'green' | 'yellow' | 'red' | 'blue';
}) {
  const colors = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}
