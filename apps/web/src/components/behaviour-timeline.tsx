'use client';

import { useMemo, useState } from 'react';
import { formatDate, formatMoney } from '../lib/api';
import type { Transaction } from '../lib/types';

function pointColor(transaction: Transaction): string {
  if (transaction.type === 'INCOME') return '#4b7f6f';
  if (transaction.anomaly.confidence === 'LOW') return '#9ca3a0';
  if (transaction.anomaly.score >= 80) return '#bc4457';
  if (transaction.anomaly.score >= 60) return '#d97757';
  if (transaction.anomaly.score >= 30) return '#b4873d';
  return '#60706b';
}

export function BehaviourTimeline({ transactions }: { transactions: Transaction[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const ordered = useMemo(
    () => [...transactions].sort((a, b) => Date.parse(a.transactionDate) - Date.parse(b.transactionDate)),
    [transactions],
  );
  const selected = ordered.find((item) => item.id === selectedId) ?? ordered.at(-1) ?? null;
  const times = ordered.map((item) => Date.parse(item.transactionDate));
  const minimum = Math.min(...times);
  const maximum = Math.max(...times);
  const x = (time: number, index: number): number => maximum === minimum
    ? 80 + index * (840 / Math.max(1, ordered.length - 1))
    : 45 + ((time - minimum) / (maximum - minimum)) * 910;

  return (
    <div className="timeline-wrap">
      <div className="timeline-legend" aria-hidden="true">
        <span><i className="normal" /> Normal</span><span><i className="watch" /> Watch</span><span><i className="high" /> Unusual</span>
      </div>
      <svg className="timeline" viewBox="0 0 1000 190" preserveAspectRatio="none" aria-label="Behaviour Pulse Timeline">
        <line x1="45" y1="94" x2="955" y2="94" className="timeline-axis" />
        <text x="46" y="32" className="timeline-label">INCOME</text>
        <text x="46" y="174" className="timeline-label">EXPENSE</text>
        {ordered.map((transaction, index) => {
          const cx = x(Date.parse(transaction.transactionDate), index);
          const targetY = transaction.type === 'INCOME' ? 61 : 131;
          const score = transaction.type === 'INCOME' ? 0 : transaction.anomaly.score;
          const radius = transaction.type === 'INCOME' ? 5 : 4 + score / 16;
          const color = pointColor(transaction);
          return (
            <g key={transaction.id} className="timeline-point">
              <line x1={cx} y1="94" x2={cx} y2={targetY} style={{ stroke: color, opacity: 0.32 }} />
              <circle
                cx={cx}
                cy={targetY}
                r={radius}
                style={{ fill: color }}
                className={selected?.id === transaction.id ? 'selected' : ''}
                tabIndex={0}
                role="button"
                aria-label={`${transaction.category.name}, ${formatMoney(transaction.amount)}, anomaly ${score} out of 100`}
                onMouseEnter={() => setSelectedId(transaction.id)}
                onFocus={() => setSelectedId(transaction.id)}
                onClick={() => setSelectedId(transaction.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') setSelectedId(transaction.id);
                }}
              />
            </g>
          );
        })}
      </svg>
      {selected ? (
        <div className="timeline-detail" aria-live="polite">
          <span className="category-swatch" style={{ background: selected.category.color }} />
          <div><strong>{selected.category.name}</strong><span>{formatDate(selected.transactionDate)}</span></div>
          <div className="timeline-amount"><strong>{formatMoney(selected.amount)}</strong><span>{selected.type.toLowerCase()}</span></div>
          <div className="timeline-score"><strong>{selected.type === 'EXPENSE' ? selected.anomaly.score : '—'}</strong><span>anomaly score</span></div>
          <p>{selected.primaryReason ?? (selected.type === 'INCOME' ? 'Income establishes the cash-flow context.' : 'No material deviation detected.')}</p>
        </div>
      ) : null}
    </div>
  );
}
