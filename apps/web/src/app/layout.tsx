import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppShell } from '../components/app-shell';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'LedgerPulse', template: '%s · LedgerPulse' },
  description: 'An explainable financial behaviour and anomaly-aware mini ledger.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
