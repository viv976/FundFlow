export interface DatabaseProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  job_title: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseWorkspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  currency: string;
  starting_cash: number;
  alert_runway_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface DatabaseWorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  created_at: string;
}

export interface DatabaseTransactionCategory {
  id: string;
  workspace_id: string;
  name: string;
  category_type: 'revenue' | 'expense' | string;
  description: string | null;
  color: string | null;
  created_at: string;
}

export interface DatabaseTransaction {
  id: string;
  workspace_id: string;
  transaction_date: string;
  amount: number;
  transaction_type: 'income' | 'expense';
  category_id: string | null;
  category: string;
  merchant: string | null;
  description: string;
  account_name: string | null;
  currency: string;
  source: string;
  source_file_id: string | null;
  is_recurring: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseMonthlyFinancialSummary {
  id: string;
  workspace_id: string;
  month: string;
  cash_on_hand: number;
  total_revenue: number;
  total_expenses: number;
  net_cash_flow: number;
  burn_rate: number;
  runway_months: number;
  revenue_growth_pct: number | null;
  expense_growth_pct: number | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseAlert {
  id: string;
  workspace_id: string;
  alert_type: string;
  severity: 'critical' | 'warning' | 'info' | 'system';
  title: string;
  message: string;
  metric_name: string | null;
  metric_value: number | null;
  threshold_value: number | null;
  is_read: boolean;
  is_resolved: boolean;
  created_at: string;
}

export interface DatabaseKnowledgeDocument {
  id: string;
  workspace_id: string;
  title: string;
  document_type: string;
  source: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DatabaseDocumentChunk {
  id: string;
  document_id: string;
  workspace_id: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
  embedding: unknown;
  created_at: string;
}

export interface DatabaseUploadedFile {
  id: string;
  workspace_id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  storage_path: string | null;
  rows_imported: number;
  status: string;
  error_message: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface DatabaseAIConversation {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseAIMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  grounded: boolean;
  created_at: string;
}
