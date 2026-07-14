'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, LayoutDashboard, ListChecks, Plus, Radio } from 'lucide-react';
import type { ReactNode } from 'react';

const navigation = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ListChecks },
  { href: '/notifications', label: 'Notifications', icon: Bell },
];

function Brand(): ReactNode {
  return (
    <Link href="/" className="brand" aria-label="LedgerPulse dashboard">
      <span className="brand-mark" aria-hidden="true"><Radio size={19} strokeWidth={2.4} /></span>
      <span>Ledger<span>Pulse</span></span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }): ReactNode {
  const pathname = usePathname();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav className="side-nav" aria-label="Primary navigation">
          {navigation.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={active ? 'nav-link active' : 'nav-link'}>
                <item.icon size={18} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <span className="eyebrow">Demo architecture</span>
          <p>Single seeded user · INR ledger</p>
          <span className="status-dot"><i /> API-backed</span>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="mobile-brand"><Brand /></div>
          <div className="context-label"><span /> Explainable behaviour engine</div>
          <Link href="/transactions/new" className="button primary compact"><Plus size={17} /> Add transaction</Link>
        </header>
        <main className="content">{children}</main>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navigation.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={active ? 'active' : ''}>
                <item.icon size={20} /><span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
