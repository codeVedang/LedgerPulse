'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Filter, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { AnomalyBadge } from '../../components/anomaly-badge';
import { EmptyState, ErrorState, PageSkeleton } from '../../components/states';
import { apiFetch, demoLocalToIso, errorDescription, formatDate, formatMoney } from '../../lib/api';
import type { Category, Transaction, TransactionType } from '../../lib/types';

interface PageResponse {
  data: Transaction[];
  page: { number: number; limit: number; total: number; pages: number };
}

interface FilterState {
  type: '' | TransactionType;
  categoryId: string;
  from: string;
  to: string;
  minAmount: string;
  maxAmount: string;
  sort: string;
}

const initialFilters: FilterState = {
  type: '', categoryId: '', from: '', to: '', minAmount: '', maxAmount: '', sort: 'newest',
};

export default function TransactionsPage() {
  const [response, setResponse] = useState<PageResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [applied, setApplied] = useState<FilterState>(initialFilters);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<unknown>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20', sort: applied.sort });
    if (applied.type) params.set('type', applied.type);
    if (applied.categoryId) params.set('categoryId', applied.categoryId);
    if (applied.from) params.set('from', demoLocalToIso(`${applied.from}T00:00:00`));
    if (applied.to) params.set('to', demoLocalToIso(`${applied.to}T23:59:59.999`));
    if (applied.minAmount) params.set('minAmount', applied.minAmount);
    if (applied.maxAmount) params.set('maxAmount', applied.maxAmount);
    return params.toString();
  }, [applied, page]);

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const [items, categoryItems] = await Promise.all([
        apiFetch<PageResponse>(`/transactions?${query}`),
        categories.length === 0 ? apiFetch<Category[]>('/categories') : Promise.resolve(categories),
      ]);
      setResponse(items);
      setCategories(categoryItems);
    } catch (nextError) {
      setError(nextError);
    }
  }, [categories, query]);

  useEffect(() => { void load(); }, [load]);

  const submitFilters = (event: FormEvent): void => {
    event.preventDefault();
    setPage(1);
    setApplied(filters);
    setFiltersOpen(false);
  };
  const reset = (): void => {
    setFilters(initialFilters);
    setApplied(initialFilters);
    setPage(1);
  };
  const activeFilterCount = Object.entries(applied).filter(([key, value]) => key !== 'sort' && value).length;

  if (!response && !error) return <PageSkeleton />;
  if (error) {
    const detail = errorDescription(error);
    return <ErrorState {...detail} onRetry={() => void load()} />;
  }
  if (!response) return null;

  return (
    <div className="page-stack">
      <section className="page-heading inline-heading">
        <div><span className="eyebrow">Recorded evidence</span><h1>Transactions</h1><p>Search the ledger and inspect the behaviour fingerprint behind each expense.</p></div>
        <Link href="/transactions/new" className="button primary"><Plus size={17} /> Add transaction</Link>
      </section>

      <section className="panel filter-panel">
        <div className="filter-summary">
          <div><Search size={18} /><span><b>{response.page.total}</b> transaction{response.page.total === 1 ? '' : 's'}</span></div>
          <button type="button" className="button secondary compact" onClick={() => setFiltersOpen((value) => !value)} aria-expanded={filtersOpen}>
            <SlidersHorizontal size={16} /> Filters {activeFilterCount > 0 ? <i>{activeFilterCount}</i> : null}
          </button>
        </div>
        <form className={filtersOpen ? 'filters open' : 'filters'} onSubmit={submitFilters}>
          <label><span>Type</span><select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value as FilterState['type'] })}><option value="">All types</option><option value="INCOME">Income</option><option value="EXPENSE">Expense</option></select></label>
          <label><span>Category</span><select value={filters.categoryId} onChange={(event) => setFilters({ ...filters, categoryId: event.target.value })}><option value="">All categories</option>{categories.filter((category) => !filters.type || category.type === filters.type).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
          <label><span>From</span><input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
          <label><span>To</span><input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
          <label><span>Minimum amount</span><input inputMode="decimal" placeholder="0.00" value={filters.minAmount} onChange={(event) => setFilters({ ...filters, minAmount: event.target.value })} /></label>
          <label><span>Maximum amount</span><input inputMode="decimal" placeholder="No limit" value={filters.maxAmount} onChange={(event) => setFilters({ ...filters, maxAmount: event.target.value })} /></label>
          <label><span>Sort by</span><select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="amount-high">Highest amount</option><option value="amount-low">Lowest amount</option></select></label>
          <div className="filter-actions"><button type="button" className="text-button" onClick={reset}>Reset</button><button type="submit" className="button primary compact"><Filter size={16} /> Apply</button></div>
        </form>
      </section>

      <section className="panel transaction-table-panel">
        {response.data.length > 0 ? (
          <>
            <div className="transaction-table-header"><span>Transaction</span><span>Date</span><span>Behaviour</span><span>Amount</span></div>
            <div className="transaction-list">{response.data.map((item) => (
              <Link href={`/transactions/${item.id}`} className="transaction-row table-row" key={item.id}>
                <span className="category-swatch" style={{ background: item.category.color }} />
                <div className="transaction-main"><strong>{item.description ?? item.category.name}</strong><span>{item.category.name} · {item.type.toLowerCase()}</span></div>
                <time>{formatDate(item.transactionDate)}</time>
                <div>{item.type === 'EXPENSE' ? <AnomalyBadge score={item.anomaly.score} confidence={item.anomaly.confidence} /> : <span className="income-context">Cash-flow context</span>}</div>
                <strong className={item.type === 'INCOME' ? 'amount income' : 'amount'}>{item.type === 'INCOME' ? '+' : '−'}{formatMoney(item.amount)}</strong>
              </Link>
            ))}</div>
          </>
        ) : (
          <EmptyState title={activeFilterCount ? 'No matching transactions' : 'Your ledger is empty'} description={activeFilterCount ? 'Try widening the date or amount filters.' : 'Add the first transaction to start the behaviour baseline.'} action={activeFilterCount ? <button type="button" className="button secondary" onClick={reset}>Clear filters</button> : <Link href="/transactions/new" className="button primary">Add transaction</Link>} />
        )}
        {response.page.pages > 1 ? (
          <div className="pagination"><button type="button" className="icon-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page"><ChevronLeft size={18} /></button><span>Page <b>{page}</b> of {response.page.pages}</span><button type="button" className="icon-button" disabled={page >= response.page.pages} onClick={() => setPage((value) => value + 1)} aria-label="Next page"><ChevronRight size={18} /></button></div>
        ) : null}
      </section>
    </div>
  );
}
