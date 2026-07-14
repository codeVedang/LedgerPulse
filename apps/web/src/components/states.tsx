import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

export function PageSkeleton(): ReactNode {
  return (
    <div className="skeleton-page" aria-label="Loading ledger data" role="status">
      <div className="skeleton h-title" />
      <div className="skeleton-grid">
        <div className="skeleton h-panel" />
        <div className="skeleton h-panel" />
        <div className="skeleton h-panel" />
      </div>
      <div className="skeleton h-chart" />
    </div>
  );
}

export function ErrorState({
  message,
  requestId,
  onRetry,
}: {
  message: string;
  requestId?: string;
  onRetry?: () => void;
}): ReactNode {
  return (
    <div className="state-card error-state" role="alert">
      <AlertCircle size={25} />
      <div>
        <h2>We couldn’t load this view</h2>
        <p>{message}</p>
        {requestId ? <small>Request ID: {requestId}</small> : null}
      </div>
      {onRetry ? <button type="button" className="button secondary" onClick={onRetry}><RefreshCw size={16} /> Retry</button> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}): ReactNode {
  return (
    <div className="state-card empty-state">
      <span className="empty-icon"><Inbox size={25} /></span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
