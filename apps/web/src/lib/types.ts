export type TransactionType = 'INCOME' | 'EXPENSE';
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Category {
  id: string;
  name: string;
  slug: string;
  type: TransactionType;
  color: string;
}

export interface AnomalyReason {
  code: string;
  text: string;
  points: number;
  evidence: Record<string, string | number | boolean>;
}

export interface BehaviourAnalysis {
  engineVersion: string;
  score: number;
  confidence: Confidence;
  severity: 'NORMAL' | 'WATCH' | 'UNUSUAL' | 'HIGH';
  flagged: boolean;
  reasons: AnomalyReason[];
  expectedBehaviour: {
    amountRange?: { low: string; high: string; sampleSize: number };
    dailyFrequencyRange?: { low: number; high: number; activeDays: number };
  };
  baseline: { overallExpenseCount: number; categoryExpenseCount: number; historySpanDays: number };
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: string;
  currency: string;
  description: string | null;
  transactionDate: string;
  createdAt: string;
  updatedAt: string;
  category: Category & { isActive: boolean };
  anomaly: {
    score: number;
    confidence: Confidence;
    engineVersion: string | null;
    analysis: BehaviourAnalysis;
  };
  primaryReason?: string | null;
}

export interface LedgerSummary {
  income: string;
  expenses: string;
  netCashFlow: string;
  savingsRate: string | null;
  transactionCount: number;
  reliableAnomalyCount: number;
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    amount: string;
    share: string;
  }>;
}

export interface PulseComponent {
  key: string;
  label: string;
  contribution: number;
  maximum: number;
  explanation: string;
  status: string;
  raw: Record<string, string | number | null>;
}

export interface FinancialPulse {
  score: number;
  label: string;
  components: PulseComponent[];
  recentVelocity: {
    ratio: string | null;
    recentDailyAverage: string;
    baselineDailyAverage: string;
    status: string;
  };
  reliableAnomalyCount: number;
  categoryConcentration: string | null;
}

export interface Period {
  start: string;
  end: string;
  timezone: string;
}

export interface PreviewEvaluation {
  analysis: BehaviourAnalysis;
  period: { start: string; end: string };
  before: { summary: LedgerSummary; pulse: FinancialPulse };
  after: { summary: LedgerSummary; pulse: FinancialPulse };
  categoryImpact: {
    categoryId: string;
    categoryName: string;
    before: string;
    after: string;
    changePercent: string | null;
  };
}

export interface Notification {
  id: string;
  eventType: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  body: string;
  transactionId: string | null;
  readAt: string | null;
  createdAt: string;
}
