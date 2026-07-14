'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bell, Check, CheckCircle2, Info, Radar } from 'lucide-react';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/states';
import { apiFetch, errorDescription, formatDate } from '../../lib/api';
import type { Notification } from '../../lib/types';

function SeverityIcon({ severity }: { severity: Notification['severity'] }) {
  if (severity === 'CRITICAL') return <Radar size={19} />;
  if (severity === 'WARNING') return <AlertTriangle size={19} />;
  return <Info size={19} />;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const response = await apiFetch<{ data: Notification[]; unreadCount: number }>(`/notifications?unreadOnly=${unreadOnly}`);
      setItems(response.data);
      setUnreadCount(response.unreadCount);
    } catch (nextError) {
      setError(nextError);
    }
  }, [unreadOnly]);

  useEffect(() => { void load(); }, [load]);

  const markRead = async (id: string): Promise<void> => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH', body: '{}' });
      setItems((current) => current?.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item) ?? null);
      setUnreadCount((count) => Math.max(0, count - 1));
      if (unreadOnly) setItems((current) => current?.filter((item) => item.id !== id) ?? null);
    } catch (nextError) {
      setError(nextError);
    }
  };

  if (!items && !error) return <PageSkeleton />;
  if (error) {
    const detail = errorDescription(error);
    return <ErrorState {...detail} onRetry={() => void load()} />;
  }
  if (!items) return null;

  return (
    <div className="page-stack notifications-page">
      <section className="page-heading inline-heading">
        <div><span className="eyebrow">Internal event channel</span><h1>Notifications</h1><p>Messages created by domain-event policy, independent of transaction controllers.</p></div>
        <div className="unread-count"><Bell size={17} /><span><b>{unreadCount}</b> unread</span></div>
      </section>

      <section className="panel notification-panel">
        <div className="notification-toolbar"><div><button type="button" className={!unreadOnly ? 'tab active' : 'tab'} onClick={() => setUnreadOnly(false)}>All</button><button type="button" className={unreadOnly ? 'tab active' : 'tab'} onClick={() => setUnreadOnly(true)}>Unread</button></div><span>Newest first · up to 100</span></div>
        {items.length > 0 ? <div className="notification-list">{items.map((item) => (
          <article className={item.readAt ? 'notification-row read' : 'notification-row'} key={item.id}>
            <span className={`notification-icon ${item.severity.toLowerCase()}`}><SeverityIcon severity={item.severity} /></span>
            <div className="notification-copy"><div><strong>{item.title}</strong>{!item.readAt ? <i>New</i> : null}</div><p>{item.body}</p><time>{formatDate(item.createdAt)}</time></div>
            <div className="notification-actions">{item.transactionId ? <Link href={`/transactions/${item.transactionId}`} className="text-link">Review</Link> : null}{!item.readAt ? <button type="button" className="icon-button" onClick={() => void markRead(item.id)} aria-label={`Mark ${item.title} as read`}><Check size={17} /></button> : <CheckCircle2 size={17} className="read-check" />}</div>
          </article>
        ))}</div> : <EmptyState title={unreadOnly ? 'You’re all caught up' : 'No notifications yet'} description={unreadOnly ? 'New ledger events will appear here when policy creates a message.' : 'Recording transactions will exercise the in-app notification adapter.'} />}
      </section>

      <section className="architecture-note"><span><Radar size={19} /></span><div><strong>Why this is not controller logic</strong><p>Transaction services publish typed facts. Notification policy decides the message; channels decide delivery. An email or webhook adapter can be added without changing transaction endpoints.</p></div></section>
    </div>
  );
}
