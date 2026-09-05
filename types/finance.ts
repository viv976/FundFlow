export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'reconciled';
export type TransactionSource = 'manual' | 'csv_import' | 'plaid_sync';

export interface Transaction {
  id: string;
  workspace_id: string;
  transaction_date: string; // YYYY-MM-DD
  description: string;
  merchant?: string;
  category: string;
  subcategory?: string;
  amount: number; // positive number; sign determined by transaction_type
  currency: string;
  transaction_type: TransactionType;
  status: TransactionStatus;
  source: TransactionSource;
  external_reference?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug?: string;
  owner_id: string;
  currency: string;
  starting_cash?: number;
  alert_runway_threshold?: number;
  created_at: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
}

export type AlertSeverity = 'critical' | 'warning' | 'info' | 'system';
export type AlertStatus = 'active' | 'acknowledged' | 'dismissed';

export interface Alert {
  id: string;
  workspace_id: string;
  alert_type: 'runway_risk' | 'expense_spike' | 'large_deposit' | 'cash_low' | 'system_sync';
  severity: AlertSeverity;
  title: string;
  message: string;
  threshold?: number;
  current_value?: number;
  status: AlertStatus;
  acknowledged_at?: string;
  created_at: string;
}

export interface AlertPreferences {
  workspace_id: string;
  runway_threshold_months: number;
  expense_spike_percentage: number;
  cash_minimum_threshold: number;
  large_transaction_threshold: number;
  email_notifications_enabled: boolean;
  slack_notifications_enabled: boolean;
  slack_webhook_url?: string;
}

export interface FinancialKPIs {
  cashOnHand: number;
  cashChangePercent: number; // e.g. +5.2%
  monthlyBurn: number;
  burnChangePercent: number; // e.g. -2.1%
  runwayMonths: number;
  runwayDisplay: string; // "14 Mos" or "Infinite" or "No data"
  momGrowthPercent: number; // e.g. +12.4%
  growthTargetPercent: number; // e.g. +1.5%
  isCashFlowPositive: boolean;
  hasSufficientData: boolean;
}

export interface ProjectionMonth {
  month: string; // e.g. "Jan", "Feb", "Apr (Now)", "May"
  actual?: number;
  forecast?: number;
  isCurrent?: boolean;
}

export interface CashFlowProjection {
  points: ProjectionMonth[];
  currentCash: number;
  projectedRunway: number;
  monthlyNetBurn: number;
}

export interface ExpenseBreakdownItem {
  category: string;
  amount: number;
  percentage: number;
  colorClass: string;
  transactionCount: number;
}

export interface AIInsightItem {
  id: string;
  type: 'revenue_anomaly' | 'burn_rate_alert' | 'optimization' | 'milestone';
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info' | 'positive';
  supportingData?: Record<string, unknown>;
}

export interface AICitation {
  id: string;
  type:
    | 'transaction'
    | 'category_aggregation'
    | 'category_breakdown'
    | 'financial_snapshot'
    | 'calculation'
    | 'alert'
    | 'knowledge_document'
    | 'rule';
  label: string;
  amount?: number;
  date_range?: string;
  details?: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  grounded?: boolean;
  financialImpact?: {
    currentRunway: number;
    projectedRunway?: number;
    deltaMonths?: number;
    monthlyCost?: number;
  };
  scenario?: {
    name: string;
    beforeRunway: number;
    afterRunway: number;
    monthlyImpact: number;
    assumptions: string[];
  };
  citations?: AICitation[];
  insights?: string[];
  chartAction?: {
    type: 'cash_flow' | 'category_spend' | 'burn_trend';
    label: string;
  };
}

export interface ScenarioCalculationResult {
  currentCash: number;
  currentMonthlyBurn: number;
  currentRunway: number;
  newMonthlyBurn: number;
  projectedRunway: number;
  differenceMonths: number;
  monthlyCostImpact: number;
  assumptions: string[];
}

export interface CSVImportResult {
  totalRows: number;
  importedRows: number;
  categorizedRows?: number;
  uncategorizedRows?: number;
  skippedRows?: number;
  failedRows: number;
  errors: { row: number; reason: string }[];
  transactions: Transaction[];
}
