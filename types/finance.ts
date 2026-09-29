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
  cashChangeDisplay?: string;
  monthlyBurn: number;
  burnChangePercent: number; // e.g. -2.1%
  burnChangeDisplay?: string;
  runwayMonths: number;
  runwayDisplay: string; // "14 Mos" or "Infinite" or "No data"
  momGrowthPercent: number | null; // null when insufficient data or pre-revenue
  momGrowthStatus: 'active' | 'insufficient_data' | 'pre_revenue' | 'first_revenue_period';
  growthTargetPercent: number; // e.g. +1.5%
  isCashFlowPositive: boolean;
  hasSufficientData: boolean;
  completedMonthsCount: number;
  reportingAnchorMonth?: string;
}

export interface ProjectionMonth {
  month: string; // e.g. "Jan", "Feb", "Apr (Current)", "May"
  actual?: number;
  forecast?: number;
  isCurrent?: boolean;
  isForecast?: boolean;
  upperBand?: number;
  lowerBand?: number;
  netFlow?: number;
}

export interface CashFlowProjection {
  points: ProjectionMonth[];
  currentCash: number;
  projectedRunway: number;
  monthlyNetBurn: number;
  status: 'active' | 'insufficient_data';
  forecastMethodology: string;
  hasSufficientData: boolean;
}

export type HealthCategory = 'Strong' | 'Moderate' | 'Watchlist' | 'Critical' | 'Insufficient Data';

export interface HealthFactorContribution {
  name: string;
  score: number;
  maxScore: number;
  weightPercent: number;
  status: 'healthy' | 'caution' | 'critical' | 'neutral';
  description: string;
  metricValue: string;
}

export interface FinancialHealthScore {
  score: number | null; // null when insufficient data
  maxScore: number;
  category: HealthCategory;
  factors: HealthFactorContribution[];
  methodology: string;
  hasSufficientData: boolean;
  summary: string;
}

export interface AttentionItem {
  id: string;
  ruleId: string;
  severity: AlertSeverity;
  title: string;
  detectedIssue: string;
  supportingMetric: string;
  affectedCategory?: string;
  affectedTransactions?: Array<{
    id: string;
    description: string;
    amount: number;
    transaction_date: string;
  }>;
  suggestedAction: string;
  actionType?: 'review_expenses' | 'adjust_runway' | 'audit_category' | 'view_transactions';
}

export interface FinancialThresholdConfig {
  runwayCriticalMonths: number;
  runwayWarningMonths: number;
  expenseSpikePercent: number;
  minExpenseSpikeAmount: number;
  categoryConcentrationPercent: number;
  negativeNetFlowThreshold: number;
}

export interface MetricExplanation {
  key: 'cash' | 'burn' | 'runway' | 'growth';
  title: string;
  currentDisplay: string;
  formula: string;
  formulaSteps: Array<{ label: string; value: string; operation?: string }>;
  methodology: string;
  burnMethodology?: string;
  comparisonPeriod: string;
  hasSufficientData: boolean;
  statusLabel?: string;
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
  keyPoints?: string[];
  evidence?: string[];
  limitations?: string;
  answer?: string;
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

// -------------------------------------------------------------
// GROUP 6: SCENARIO PLANNING & RISK INTELLIGENCE TYPES
// -------------------------------------------------------------

export interface ScenarioAssumptions {
  monthlyExpensesDelta: number; // General operational spend adjustment (+/-)
  revenueGrowthRateMoM: number; // MoM revenue growth rate percentage (+/-)
  additionalMonthlyRevenue: number; // Direct incremental MRR/contract revenue
  hiringCount: number; // Headcount changes (+/-)
  hiringCostPerRole: number; // Monthly cost per headcount
  marketingSpendDelta: number; // Marketing budget adjustment (+/-)
  infrastructureSpendDelta: number; // Cloud / Infra budget adjustment (+/-)
}

export interface ScenarioBaselineMetrics {
  cash: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  monthlyNetBurn: number;
  runwayMonths: number;
  isCashFlowPositive: boolean;
  currency: string;
}

export interface ScenarioProjectedMetrics {
  monthlyRevenue: number;
  monthlyExpenses: number;
  monthlyNetBurn: number;
  runwayMonths: number;
  isCashFlowPositive: boolean;
  totalIncrementalCost: number;
  totalIncrementalRevenue: number;
}

export interface ScenarioDeltaMetrics {
  revenueDelta: number;
  expensesDelta: number;
  netBurnDelta: number;
  runwayDeltaMonths: number | null; // null if transitions between finite and infinite
  runwayImpactDescription: string;
}

export interface MonthlyTrajectoryPoint {
  monthIndex: number;
  monthLabel: string;
  baselineCash: number;
  scenarioCash: number;
  deltaCash: number;
}

export interface ScenarioMethodologyStep {
  step: string;
  formula: string;
  explanation: string;
}

export interface ScenarioAnalysisResult {
  baseline: ScenarioBaselineMetrics;
  scenario: ScenarioProjectedMetrics;
  delta: ScenarioDeltaMetrics;
  trajectory: MonthlyTrajectoryPoint[];
  assumptions: ScenarioAssumptions;
  methodology: {
    title: string;
    steps: ScenarioMethodologyStep[];
  };
}

export interface SavedScenarioRecord {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  delta_monthly_burn: number;
  delta_monthly_revenue: number;
  baseline_runway: number;
  projected_runway: number;
  assumptions: ScenarioAssumptions;
  created_at: string;
}

export interface SavedScenarioModel {
  id: string;
  name: string;
  assumptions: ScenarioAssumptions;
  createdAt: string;
}


export type RiskSignalType =
  | 'RAPIDLY_INCREASING_BURN'
  | 'DECREASING_CASH_TRAJECTORY'
  | 'UNUSUAL_EXPENSE_SPIKE'
  | 'EXPENSE_CONCENTRATION'
  | 'REVENUE_DECLINE'
  | 'RUNWAY_BELOW_THRESHOLD'
  | 'ABNORMAL_TRANSACTION';

export type DetectionMechanism = 'DETERMINISTIC_DETECTION';

export interface RiskAlertSupportingData {
  primaryMetric: string;
  baselineValue?: string | number;
  observedValue?: string | number;
  thresholdValue?: string | number;
  variancePercent?: number;
  affectedAmount?: number;
  currency?: string;
  relatedTransactionCount?: number;
  evidenceItems?: string[];
}

export interface RiskAlert {
  id: string;
  ruleId: RiskSignalType;
  detectionMechanism: DetectionMechanism;
  severity: AlertSeverity; // 'critical' | 'warning' | 'info'
  title: string;
  explanation: string;
  supportingData: RiskAlertSupportingData;
  affectedPeriod: string;
  suggestedAction: string;
  status: 'active' | 'acknowledged' | 'dismissed';
  createdAt: string;
  category?: string;
  actionType?: 'review_expenses' | 'adjust_runway' | 'audit_category' | 'view_transactions' | 'model_scenario';
}
