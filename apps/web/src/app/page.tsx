'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, CircleHelp, Gauge, Radar, WalletCards } from 'lucide-react';
import { BehaviourTimeline } from '../components/behaviour-timeline';
import { Modal } from '../components/modal';
import { PulseRing } from '../components/pulse-ring';
import { EmptyState, ErrorState, PageSkeleton } from '../components/states';
import { apiFetch, errorDescription, formatDate, formatMoney } from '../lib/api';
import type { FinancialPulse, LedgerSummary, Period, Transaction } from '../lib/types';

interface DashboardData {
  period: Period;
  summary: LedgerSummary;
  pulse: FinancialPulse;
  transactions: Transaction[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const [pulseResponse, timelineResponse] = await Promise.all([
        apiFetch<{ period: Period; summary: LedgerSummary; pulse: FinancialPulse }>('/ledger/pulse'),
        apiFetch<{ period: Period; data: Transaction[] }>('/ledger/timeline'),
      ]);
      setData({ ...pulseResponse, transactions: timelineResponse.data });
    } catch (nextError) {
      setError(nextError);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const recent = useMemo(
    () => data ? [...data.transactions].sort((a, b) => Date.parse(b.transactionDate) - Date.parse(a.transactionDate)).slice(0, 5) : [],
    [data],
  );
  const alerts = useMemo(
    () => data?.transactions.filter((item) => item.type === 'EXPENSE' && item.anomaly.confidence !== 'LOW' && item.anomaly.score >= 60).slice(-3).reverse() ?? [],
    [data],
  );

  if (!data && !error) return <PageSkeleton />;
  if (error) {
    const detail = errorDescription(error);
    return <ErrorState {...detail} onRetry={() => void load()} />;
  }
  if (!data) return null;

  const largestCategory = data.summary.categoryBreakdown[0];
  return (
    <div className="page-stack">
      <section className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">Financial Pulse · {formatDate(data.period.start, false)} — now</span>
          <h1>Your money, with context.</h1>
          <p>Current cash flow and the behavioural changes behind it.</p>
        </div>
        <div className="baseline-chip"><Radar size={16} /><span><b>{data.summary.transactionCount}</b> observations this month</span></div>
      </section>

      <section className="dashboard-lead">
        <article className="panel pulse-panel">
          <div className="panel-title">
            <div><span className="eyebrow">Financial Pulse</span><h2>{data.pulse.label}</h2></div>
            <button type="button" className="text-button" onClick={() => setBreakdownOpen(true)}><CircleHelp size={16} /> How is this calculated?</button>
          </div>
          <div className="pulse-body">
            <PulseRing score={data.pulse.score} label={data.pulse.label} />
            <div className="pulse-copy">
              <p>{data.pulse.label === 'Building baseline'
                ? 'Add a few weeks of transactions to replace neutral components with evidence-backed signals.'
                : data.pulse.score >= 60
                  ? 'Your current period is broadly stable. Review the components below for the trade-offs inside the score.'
                  : 'Cash-flow pressure or recent behaviour changes are reducing this period’s pulse.'}</p>
              <div className="micro-metrics">
                <div><span>Velocity</span><b>{data.pulse.recentVelocity.ratio ? `${Number(data.pulse.recentVelocity.ratio).toFixed(1)}×` : 'Baseline forming'}</b></div>
                <div><span>Reliable anomalies</span><b>{data.pulse.reliableAnomalyCount}</b></div>
              </div>
            </div>
          </div>
        </article>

        <div className="metrics-grid">
          <article className="metric-card income"><span className="metric-icon"><ArrowUpRight size={18} /></span><span>Income</span><strong>{formatMoney(data.summary.income)}</strong><small>Recorded this period</small></article>
          <article className="metric-card expense"><span className="metric-icon"><ArrowDownRight size={18} /></span><span>Expenses</span><strong>{formatMoney(data.summary.expenses)}</strong><small>{largestCategory ? `${largestCategory.categoryName} leads at ${Number(largestCategory.share).toFixed(0)}%` : 'No expenses recorded'}</small></article>
          <article className="metric-card"><span className="metric-icon"><WalletCards size={18} /></span><span>Net cash flow</span><strong className={Number(data.summary.netCashFlow) < 0 ? 'negative' : ''}>{formatMoney(data.summary.netCashFlow, true)}</strong><small>Income minus expenses</small></article>
          <article className="metric-card"><span className="metric-icon"><Gauge size={18} /></span><span>Savings rate</span><strong>{data.summary.savingsRate === null ? '—' : `${Number(data.summary.savingsRate).toFixed(1)}%`}</strong><small>{data.summary.savingsRate === null ? 'Needs recorded income' : 'Net flow ÷ income'}</small></article>
        </div>
      </section>

      <section className="panel timeline-panel">
        <div className="panel-title">
          <div><span className="eyebrow">Distinctive view</span><h2>Behaviour Pulse Timeline</h2><p>Point size and colour reveal behavioural intensity; income stays understated as context.</p></div>
        </div>
        {data.transactions.length > 0 ? <BehaviourTimeline transactions={data.transactions} /> : (
          <EmptyState title="Your timeline is ready" description="Record a transaction to start building a behaviour fingerprint." action={<Link href="/transactions/new" className="button primary">Add first transaction</Link>} />
        )}
      </section>

      <section className="dashboard-columns">
        <article className="panel">
          <div className="panel-title"><div><span className="eyebrow">Expense mix</span><h2>Category concentration</h2></div></div>
          {data.summary.categoryBreakdown.length > 0 ? (
            <div className="category-bars">
              {data.summary.categoryBreakdown.slice(0, 6).map((category) => (
                <div className="category-row" key={category.categoryId}>
                  <div><span>{category.categoryName}</span><b>{formatMoney(category.amount)}</b></div>
                  <div className="bar-track"><i style={{ width: `${Math.max(2, Number(category.share))}%` }} /></div>
                  <small>{Number(category.share).toFixed(1)}%</small>
                </div>
              ))}
            </div>
          ) : <p className="muted-copy">No expense mix yet. Income does not count toward concentration.</p>}
        </article>

        <article className="panel">
          <div className="panel-title"><div><span className="eyebrow">Behaviour watch</span><h2>Recent alerts</h2></div></div>
          {alerts.length > 0 ? <div className="alert-list">{alerts.map((item) => (
            <Link key={item.id} href={`/transactions/${item.id}`} className="alert-row">
              <span className={item.anomaly.score >= 80 ? 'alert-score high' : 'alert-score'}>{item.anomaly.score}</span>
              <div><strong>{item.category.name}</strong><p>{item.primaryReason ?? 'Behaviour changed from the established baseline.'}</p></div>
              <ArrowRight size={17} />
            </Link>
          ))}</div> : <div className="quiet-state"><span>✓</span><div><strong>No reliable anomalies this period</strong><p>Low-confidence signals remain visible on transaction details but do not create alerts.</p></div></div>}
        </article>
      </section>

      <section className="panel recent-panel">
        <div className="panel-title"><div><span className="eyebrow">Ledger</span><h2>Recent transactions</h2></div><Link href="/transactions" className="text-link">View all <ArrowRight size={15} /></Link></div>
        {recent.length > 0 ? <div className="transaction-list compact-list">{recent.map((item) => (
          <Link href={`/transactions/${item.id}`} key={item.id} className="transaction-row">
            <span className="category-swatch" style={{ background: item.category.color }} />
            <div className="transaction-main"><strong>{item.description ?? item.category.name}</strong><span>{item.category.name} · {formatDate(item.transactionDate)}</span></div>
            {item.type === 'EXPENSE' ? <span className={`score-dot ${item.anomaly.score >= 60 && item.anomaly.confidence !== 'LOW' ? 'hot' : ''}`}>{item.anomaly.score}</span> : null}
            <strong className={item.type === 'INCOME' ? 'amount income' : 'amount'}>{item.type === 'INCOME' ? '+' : '−'}{formatMoney(item.amount)}</strong>
          </Link>
        ))}</div> : <p className="muted-copy">No transactions in this period.</p>}
      </section>

      <Modal open={breakdownOpen} onClose={() => setBreakdownOpen(false)} title="Financial Pulse calculation" description="A transparent 100-point sum. Neutral components are labelled when evidence is missing." wide>
        <div className="component-list">
          {data.pulse.components.map((component) => (
            <div className="component-row" key={component.key}>
              <div className="component-heading"><strong>{component.label}</strong><span>{component.contribution} / {component.maximum}</span></div>
              <div className="component-track"><i style={{ width: `${(component.contribution / component.maximum) * 100}%` }} /></div>
              <p>{component.explanation}</p>
              {component.status !== 'MEASURED' ? <small>{component.status.replaceAll('_', ' ')}</small> : null}
            </div>
          ))}
        </div>
        <div className="formula-total"><span>Component total</span><strong>{data.pulse.score} / 100</strong></div>
      </Modal>
    </div>
  );
}
