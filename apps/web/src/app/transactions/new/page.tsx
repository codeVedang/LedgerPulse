'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Edit3, Eye, Info, LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { AnomalyBadge } from '../../../components/anomaly-badge';
import { Modal } from '../../../components/modal';
import { apiFetch, DEMO_TIMEZONE, demoLocalDateTime, demoLocalToIso, errorDescription, formatMoney } from '../../../lib/api';
import type { Category, PreviewEvaluation, Transaction, TransactionType } from '../../../lib/types';

interface FormState {
  type: TransactionType;
  amount: string;
  categoryId: string;
  description: string;
  transactionDate: string;
}

function defaultLocalDateTime(): string {
  return demoLocalDateTime();
}

export default function AddTransactionPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<FormState>({ type: 'EXPENSE', amount: '', categoryId: '', description: '', transactionDate: defaultLocalDateTime() });
  const [preview, setPreview] = useState<PreviewEvaluation | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    apiFetch<Category[]>('/categories').then(setCategories).catch(setError);
  }, []);

  const availableCategories = useMemo(
    () => categories.filter((category) => category.type === form.type),
    [categories, form.type],
  );

  const payload = () => ({
    type: form.type,
    amount: form.amount,
    currency: 'INR' as const,
    categoryId: form.categoryId,
    ...(form.description.trim() ? { description: form.description.trim() } : {}),
    transactionDate: demoLocalToIso(form.transactionDate),
  });

  const openPreview = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const evaluation = await apiFetch<PreviewEvaluation>('/transactions/preview', {
        method: 'POST', body: JSON.stringify(payload()),
      });
      setPreview(evaluation);
      setIdempotencyKey(crypto.randomUUID());
    } catch (nextError) {
      setError(nextError);
    } finally {
      setLoading(false);
    }
  };

  const confirm = async (): Promise<void> => {
    if (!idempotencyKey) return;
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch<{ data: Transaction }>('/transactions', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(payload()),
      });
      router.push(`/transactions/${response.data.id}?created=1`);
    } catch (nextError) {
      setError(nextError);
      setPreview(null);
    } finally {
      setSaving(false);
    }
  };

  const errorDetail = error ? errorDescription(error) : null;

  return (
    <div className="form-page">
      <Link href="/transactions" className="back-link"><ArrowLeft size={16} /> Back to transactions</Link>
      <section className="page-heading">
        <div><span className="eyebrow">Dry-run before commit</span><h1>Add a transaction</h1><p>Preview the cash-flow and behavioural impact before anything is written.</p></div>
      </section>

      <div className="form-layout">
        <form className="panel transaction-form" onSubmit={(event) => void openPreview(event)}>
          <div className="form-section">
            <div className="section-number">01</div><div><h2>Transaction direction</h2><p>Direction is explicit; negative amounts are never silently corrected.</p></div>
          </div>
          <fieldset className="segmented" aria-label="Transaction type">
            <label className={form.type === 'EXPENSE' ? 'selected' : ''}><input type="radio" name="type" value="EXPENSE" checked={form.type === 'EXPENSE'} onChange={() => setForm({ ...form, type: 'EXPENSE', categoryId: '' })} /><span>Expense</span><small>Money out</small></label>
            <label className={form.type === 'INCOME' ? 'selected' : ''}><input type="radio" name="type" value="INCOME" checked={form.type === 'INCOME'} onChange={() => setForm({ ...form, type: 'INCOME', categoryId: '' })} /><span>Income</span><small>Money in</small></label>
          </fieldset>

          <div className="form-section separated">
            <div className="section-number">02</div><div><h2>Transaction details</h2><p>INR amounts are stored as PostgreSQL decimal values.</p></div>
          </div>
          <div className="field-grid">
            <label className="amount-field"><span>Amount</span><div className="input-with-prefix"><i>₹</i><input type="number" min="0.01" max="999999999999.99" step="0.01" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required autoFocus /></div><small>Maximum 2 decimal places</small></label>
            <label><span>Category</span><select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">Choose a category</option>{availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><small>Must match the transaction direction</small></label>
            <label className="full"><span>Description <i>optional</i></span><input maxLength={240} placeholder="What was this for?" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /><small>{form.description.length}/240</small></label>
            <label className="full"><span>Transaction date & time</span><input type="datetime-local" required value={form.transactionDate} max={defaultLocalDateTime()} onChange={(event) => setForm({ ...form, transactionDate: event.target.value })} /><small>{DEMO_TIMEZONE} economic event time, separate from the server’s created-at audit time.</small></label>
          </div>

          {errorDetail ? <div className="inline-error" role="alert"><Info size={17} /><div><strong>{errorDetail.message}</strong>{errorDetail.requestId ? <small>Request ID: {errorDetail.requestId}</small> : null}</div></div> : null}

          <div className="form-actions">
            <Link href="/transactions" className="button secondary">Cancel</Link>
            <button type="submit" className="button primary" disabled={loading || categories.length === 0}>
              {loading ? <><LoaderCircle className="spin" size={17} /> Evaluating…</> : <><Eye size={17} /> Preview impact</>}
            </button>
          </div>
        </form>

        <aside className="form-aside">
          <div className="aside-mark"><Sparkles size={19} /></div>
          <h2>Nothing is saved during preview.</h2>
          <p>The simulator invokes the same summary, pulse and Behaviour Fingerprint services used during creation.</p>
          <ul><li><Check size={15} /> No database write</li><li><Check size={15} /> No cache invalidation</li><li><Check size={15} /> No notification event</li></ul>
          <div className="idempotency-note"><ShieldCheck size={18} /><div><strong>Duplicate-safe confirmation</strong><p>A fresh UUID idempotency key is retained for safe retry after preview.</p></div></div>
        </aside>
      </div>

      <Modal open={preview !== null} onClose={() => !saving && setPreview(null)} title="What-if impact" description="Calculated as a dry run. Confirming re-evaluates against a consistent database snapshot." wide>
        {preview ? (
          <div className="preview-stack">
            <div className="preview-header">
              <div><span className="eyebrow">Behaviour Fingerprint</span><AnomalyBadge score={preview.analysis.score} confidence={preview.analysis.confidence} /></div>
              <p>{preview.analysis.confidence === 'LOW' ? 'Baseline still forming — the score is provisional and will not raise a high-anomaly alert.' : preview.analysis.flagged ? 'This transaction differs materially from your established behaviour.' : 'No reliable material deviation was found.'}</p>
            </div>
            <div className="impact-grid">
              <Impact label="Monthly expenses" before={formatMoney(preview.before.summary.expenses)} after={formatMoney(preview.after.summary.expenses)} />
              <Impact label="Savings rate" before={preview.before.summary.savingsRate === null ? 'Not available' : `${Number(preview.before.summary.savingsRate).toFixed(1)}%`} after={preview.after.summary.savingsRate === null ? 'Not available' : `${Number(preview.after.summary.savingsRate).toFixed(1)}%`} />
              <Impact label={`${preview.categoryImpact.categoryName} spending`} before={formatMoney(preview.categoryImpact.before)} after={preview.categoryImpact.changePercent === null ? 'New behaviour' : `+${Number(preview.categoryImpact.changePercent).toFixed(1)}%`} />
              <Impact label="Projected period balance" before={formatMoney(preview.before.summary.netCashFlow)} after={formatMoney(preview.after.summary.netCashFlow)} />
              <Impact label="Financial Pulse" before={`${preview.before.pulse.score}/100`} after={`${preview.after.pulse.score}/100`} />
              <Impact label="Behaviour anomaly" before="—" after={`${preview.analysis.score}/100 ${preview.analysis.confidence}`} />
            </div>
            <div className="preview-reasons"><h3>Why this result?</h3>{preview.analysis.reasons.slice(0, 4).map((reason) => <div key={reason.code}><span>{reason.points > 0 ? `+${reason.points}` : 'i'}</span><p>{reason.text}</p></div>)}</div>
            <div className="modal-actions">
              <button type="button" className="button secondary" disabled={saving} onClick={() => setPreview(null)}><Edit3 size={16} /> Edit transaction</button>
              <button type="button" className="button primary" disabled={saving} onClick={() => void confirm()}>{saving ? <><LoaderCircle className="spin" size={17} /> Saving safely…</> : <>Confirm transaction <ArrowRight size={17} /></>}</button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Impact({ label, before, after }: { label: string; before: string; after: string }) {
  return <div className="impact-row"><span>{label}</span><div><b>{before}</b><ArrowRight size={15} /><strong>{after}</strong></div></div>;
}
