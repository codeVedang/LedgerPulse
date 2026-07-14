export type TransactionType = 'INCOME' | 'EXPENSE';
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';
export type AnomalySeverity = 'NORMAL' | 'WATCH' | 'UNUSUAL' | 'HIGH';

export interface LedgerObservation {
  id?: string;
  type: TransactionType;
  amount: string;
  currency: 'INR';
  categoryId: string;
  categoryName: string;
  transactionDate: string;
  anomalyScore?: number;
  anomalyConfidence?: Confidence;
}

export type AnomalyReasonCode =
  | 'INSUFFICIENT_BASELINE'
  | 'CATEGORY_AMOUNT_DEVIATION'
  | 'ROBUST_MAD_DEVIATION'
  | 'CATEGORY_VELOCITY'
  | 'UNUSUAL_LOCAL_TIME'
  | 'CATEGORY_SPENDING_SPIKE'
  | 'NEW_CATEGORY_BEHAVIOUR'
  | 'NO_MATERIAL_DEVIATION'
  | 'INCOME_NOT_SCORED';

export interface AnomalyReason {
  code: AnomalyReasonCode;
  text: string;
  points: number;
  evidence: Record<string, string | number | boolean>;
}

export interface ExpectedBehaviour {
  amountRange?: { low: string; high: string; sampleSize: number };
  dailyFrequencyRange?: { low: number; high: number; activeDays: number };
}

export interface BehaviourAnalysis {
  engineVersion: 'behaviour-v1';
  score: number;
  confidence: Confidence;
  severity: AnomalySeverity;
  flagged: boolean;
  reasons: AnomalyReason[];
  expectedBehaviour: ExpectedBehaviour;
  baseline: {
    overallExpenseCount: number;
    categoryExpenseCount: number;
    historySpanDays: number;
  };
}

export interface CategoryTotal {
  categoryId: string;
  categoryName: string;
  amount: string;
  share: string;
}

export interface LedgerSummary {
  income: string;
  expenses: string;
  netCashFlow: string;
  savingsRate: string | null;
  transactionCount: number;
  reliableAnomalyCount: number;
  categoryBreakdown: CategoryTotal[];
}

export type PulseComponentStatus = 'MEASURED' | 'INSUFFICIENT_BASELINE' | 'NO_EXPENSE_DATA';

export interface PulseComponent {
  key: 'savingsHealth' | 'cashFlow' | 'spendingVelocity' | 'anomalyLoad' | 'concentration';
  label: string;
  contribution: number;
  maximum: number;
  explanation: string;
  status: PulseComponentStatus;
  raw: Record<string, string | number | null>;
}

export interface FinancialPulse {
  score: number;
  label: 'Building baseline' | 'Under pressure' | 'Needs attention' | 'Steady' | 'Strong';
  components: PulseComponent[];
  recentVelocity: {
    ratio: string | null;
    recentDailyAverage: string;
    baselineDailyAverage: string;
    status: PulseComponentStatus;
  };
  reliableAnomalyCount: number;
  categoryConcentration: string | null;
}
