'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, Database, Info, LoaderCircle, ReceiptText, Trash2 } from 'lucide-react';
import { AnomalyBadge } from '../../../components/anomaly-badge';
import { Modal } from '../../../components/modal';
import { ErrorState, PageSkeleton } from '../../../components/states';
import { apiFetch, errorDescription, formatDate, formatMoney } from '../../../lib/api';
import type { Transaction } from '../../../lib/types';

export default function TransactionDetailPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const response = await apiFetch<{ data: Transaction }>(`/transactions/${params.id}`);
      setTransaction(response.data);
    } catch (nextError) {
      setError(nextError);
    }
  }, [params.id]);

  useEffect(() => { void load(); }, [load]);

  const remove = async (): Promise<void> => {
    setDeleting(true);
    try {
      await apiFetch<void>(`/transactions/${params.id}`, { method: 'DELETE' });
      router.push('/transactions?deleted=1');
    } catch (nextError) {
      setError(nextError);
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  if (!transaction && !error) return <PageSkeleton />;
  if (error) {
    const detail = errorDescription(error);
    return <ErrorState {...detail} onRetry={() => void load()} />;
  }
  if (!transaction) return null;
  const analysis = transaction.anomaly.analysis;
  const isExpense = transaction.type === 'EXPENSE';

  return (
    <div className="page-stack detail-page">
      <Link href="/transactions" className="back-link"><ArrowLeft size={16} /> Back to transactions</Link>
      {search.get('created') === '1' ? <div className="success-toast" role="status"><CheckCircle2 size={18} /><span><b>Transaction saved.</b> The behaviour snapshot and notification events were evaluated.</span></div> : null}
      <section className="detail-hero panel">
        <div className="detail-title">
          <span className="category-swatch large" style={{ background: transaction.category.color }} />
          <div><span className="eyebrow">{transaction.type.toLowerCase()} · {transaction.category.name}</span><h1>{transaction.description ?? transaction.category.name}</h1><p>{formatDate(transaction.transactionDate)}</p></div>
        </div>
        <div className="detail-amount"><span>{transaction.type === 'INCOME' ? 'Money in' : 'Money out'}</span><strong className={transaction.type === 'INCOME' ? 'income' : ''}>{transaction.type === 'INCOME' ? '+' : '−'}{formatMoney(transaction.amount)}</strong></div>
        <button type="button" className="icon-button danger" onClick={() => setDeleteOpen(true)} aria-label="Delete transaction"><Trash2 size={18} /></button>
      </section>

      {isExpense ? (
        <>
          <section className="analysis-grid">
            <article className="panel score-panel">
              <div className="panel-title"><div><span className="eyebrow">Behaviour Fingerprint</span><h2>Anomaly score</h2></div><AnomalyBadge score={analysis.score} confidence={analysis.confidence} /></div>
              <div className="score-visual"><div className="score-scale"><i style={{ width: `${analysis.score}%` }} /><span style={{ left: `${analysis.score}%` }} /></div><div><span>Normal</span><span>Watch</span><span>Unusual</span><span>High</span></div></div>
              <p className="score-summary">{analysis.confidence === 'LOW' ? 'This score is provisional. A reliable category baseline has not yet been established.' : analysis.flagged ? 'This event differs materially from the transaction patterns supported by your history.' : 'This event remains within the material-deviation threshold for your established history.'}</p>
              <div className="confidence-evidence"><Database size={17} /><div><strong>{analysis.confidence} confidence</strong><span>{analysis.baseline.categoryExpenseCount} category · {analysis.baseline.overallExpenseCount} overall observations · {analysis.baseline.historySpanDays} days</span></div></div>
            </article>

            <article className="panel reasons-panel">
              <div className="panel-title"><div><span className="eyebrow">Deterministic rules</span><h2>Why this result?</h2></div></div>
              <div className="reason-list">{analysis.reasons.map((reason) => (
                <div className={reason.code === 'INSUFFICIENT_BASELINE' ? 'reason-row baseline' : 'reason-row'} key={reason.code}>
                  <span>{reason.code === 'INSUFFICIENT_BASELINE' ? <Info size={17} /> : reason.points > 0 ? `+${reason.points}` : <CheckCircle2 size={17} />}</span>
                  <div><strong>{reason.code.replaceAll('_', ' ').toLowerCase()}</strong><p>{reason.text}</p></div>
                </div>
              ))}</div>
            </article>
          </section>

          <section className="panel expected-panel">
            <div className="panel-title"><div><span className="eyebrow">Observed history, not a prediction</span><h2>Expected behaviour</h2><p>Interquartile ranges are shown only when enough category evidence exists.</p></div></div>
            {analysis.expectedBehaviour.amountRange ? (
              <div className="expected-grid">
                <div><ReceiptText size={19} /><span>Typical {transaction.category.name} amount</span><strong>{formatMoney(analysis.expectedBehaviour.amountRange.low)} – {formatMoney(analysis.expectedBehaviour.amountRange.high)}</strong><small>{analysis.expectedBehaviour.amountRange.sampleSize} prior transactions</small></div>
                {analysis.expectedBehaviour.dailyFrequencyRange ? <div><CalendarClock size={19} /><span>Typical active-day frequency</span><strong>{analysis.expectedBehaviour.dailyFrequencyRange.low}–{analysis.expectedBehaviour.dailyFrequencyRange.high} transactions</strong><small>{analysis.expectedBehaviour.dailyFrequencyRange.activeDays} active days observed</small></div> : null}
              </div>
            ) : <div className="baseline-callout"><AlertTriangle size={20} /><div><strong>Expected ranges withheld</strong><p>At least three prior transactions in this category are required before LedgerPulse shows an amount range.</p></div></div>}
          </section>
        </>
      ) : (
        <section className="panel income-analysis">
          <div className="aside-mark"><Info size={19} /></div><div><span className="eyebrow">Intentional scope</span><h2>Income provides cash-flow context</h2><p>Behaviour Fingerprint v1 scores expenses only. LedgerPulse does not imply that unusual income timing or size is risky.</p></div>
        </section>
      )}

      <section className="audit-strip"><span><b>Transaction date</b>{formatDate(transaction.transactionDate)}</span><span><b>Recorded at</b>{formatDate(transaction.createdAt)}</span><span><b>Engine version</b>{transaction.anomaly.engineVersion ?? 'Not scored'}</span><span><b>Currency</b>{transaction.currency}</span></section>

      <Modal open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} title="Delete this transaction?" description="This removes the ledger record and invalidates current aggregate caches. This action cannot be undone.">
        <div className="delete-summary"><AlertTriangle size={20} /><div><strong>{transaction.description ?? transaction.category.name}</strong><p>{formatMoney(transaction.amount)} · {formatDate(transaction.transactionDate)}</p></div></div>
        <div className="modal-actions"><button type="button" className="button secondary" disabled={deleting} onClick={() => setDeleteOpen(false)}>Keep transaction</button><button type="button" className="button danger-button" disabled={deleting} onClick={() => void remove()}>{deleting ? <><LoaderCircle className="spin" size={17} /> Deleting…</> : <><Trash2 size={16} /> Delete permanently</>}</button></div>
      </Modal>
    </div>
  );
}
