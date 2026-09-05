import { supabase, isSupabaseConfigured } from './client';
import {
  DatabaseProfile,
  DatabaseWorkspace,
  DatabaseTransaction,
  DatabaseTransactionCategory,
  DatabaseMonthlyFinancialSummary,
  DatabaseAlert,
  DatabaseKnowledgeDocument,
  DatabaseDocumentChunk,
  DatabaseUploadedFile,
} from './types';
import { Transaction, Alert, Workspace, UserProfile, TransactionSource } from '@/types/finance';

/**
 * Maps database transaction row to app Transaction model
 */
export function mapDatabaseTransaction(dbTx: DatabaseTransaction): Transaction {
  const src: TransactionSource = dbTx.source === 'CSV' ? 'csv_import' : 'manual';
  return {
    id: dbTx.id,
    workspace_id: dbTx.workspace_id,
    transaction_date: dbTx.transaction_date,
    description: dbTx.description || '',
    merchant: dbTx.merchant || undefined,
    category: dbTx.category || 'Other',
    amount: Number(dbTx.amount),
    currency: dbTx.currency || 'USD',
    transaction_type: dbTx.transaction_type,
    status: 'completed',
    source: src,
    external_reference: dbTx.account_name || undefined,
    created_at: dbTx.created_at,
    updated_at: dbTx.updated_at,
  };
}

/**
 * Maps app Transaction model to database transaction row
 */
export function mapAppTransactionToDb(
  tx: Omit<Transaction, 'id' | 'workspace_id'> | Transaction,
  workspaceId: string,
  id?: string
): Partial<DatabaseTransaction> {
  const row: Partial<DatabaseTransaction> = {
    workspace_id: workspaceId,
    transaction_date: tx.transaction_date,
    amount: Math.abs(Number(tx.amount)),
    transaction_type: tx.transaction_type,
    category: tx.category || 'Other',
    merchant: tx.merchant || null,
    description: tx.description || '',
    account_name: tx.external_reference || 'Operating Account',
    currency: tx.currency || 'USD',
    source: tx.source === 'csv_import' ? 'CSV' : 'Manual',
    is_recurring: false,
  };

  const rawId = id || ('id' in tx ? (tx as Transaction).id : undefined);
  if (rawId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawId)) {
    row.id = rawId;
  }

  return row;
}

/**
 * Maps database alert row to app Alert model
 */
export function mapDatabaseAlert(dbAlert: DatabaseAlert): Alert {
  return {
    id: dbAlert.id,
    workspace_id: dbAlert.workspace_id,
    alert_type: (dbAlert.alert_type === 'runway' ? 'runway_risk' : dbAlert.alert_type) as Alert['alert_type'],
    severity: dbAlert.severity,
    title: dbAlert.title,
    message: dbAlert.message,
    threshold: dbAlert.threshold_value ?? undefined,
    current_value: dbAlert.metric_value ?? undefined,
    status: dbAlert.is_resolved ? 'dismissed' : dbAlert.is_read ? 'acknowledged' : 'active',
    created_at: dbAlert.created_at,
  };
}

/**
 * Fetch Initial Workspace, all accessible Workspaces, and User Profile from Supabase
 */
export async function fetchWorkspaceAndProfile(targetWorkspaceId?: string): Promise<{
  workspace: Workspace | null;
  workspaces: Workspace[];
  user: UserProfile | null;
}> {
  if (!isSupabaseConfigured) return { workspace: null, workspaces: [], user: null };

  const validTargetWsId =
    typeof targetWorkspaceId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetWorkspaceId)
      ? targetWorkspaceId
      : undefined;

  try {
    // 1. Get current auth user if available
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const authUserId = session?.user?.id;

    // 2. Fetch accessible workspaces for the user
    let dbWorkspaces: DatabaseWorkspace[] = [];
    if (authUserId) {
      const { data: members } = await supabase
        .from('workspace_members')
        .select('*, workspaces(*)')
        .eq('user_id', authUserId);

      if (members && members.length > 0) {
        dbWorkspaces = (members as unknown as Array<{ workspaces: DatabaseWorkspace | null }>)
          .map((m) => m.workspaces)
          .filter((w): w is DatabaseWorkspace => Boolean(w));
      }

      // Also fetch workspaces owned directly by user
      const { data: ownedWs } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', authUserId);

      if (ownedWs && ownedWs.length > 0) {
        const existingIds = new Set(dbWorkspaces.map((w) => w.id));
        for (const ow of ownedWs as DatabaseWorkspace[]) {
          if (!existingIds.has(ow.id)) {
            dbWorkspaces.unshift(ow);
            existingIds.add(ow.id);
          }
        }
      }
    }

    // If still no workspaces (e.g. initial demo load), fetch available workspaces
    if (dbWorkspaces.length === 0) {
      const { data: wsList } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false });

      if (wsList && wsList.length > 0) {
        dbWorkspaces = wsList as DatabaseWorkspace[];
      }
    }

    // If targetWorkspaceId is specified but not in list, fetch it directly
    if (validTargetWsId && !dbWorkspaces.some((w) => w.id === validTargetWsId)) {
      const { data: targetWs } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', validTargetWsId)
        .limit(1)
        .single();
      if (targetWs) {
        dbWorkspaces.unshift(targetWs as DatabaseWorkspace);
      }
    }

    if (dbWorkspaces.length === 0) {
      return { workspace: null, workspaces: [], user: null };
    }

    // Selected workspace: match target, or prioritize owned workspace, or first in list
    const selectedDbWs = validTargetWsId
      ? dbWorkspaces.find((w) => w.id === validTargetWsId) || dbWorkspaces[0]
      : (authUserId ? dbWorkspaces.find((w) => w.owner_id === authUserId) || dbWorkspaces[0] : dbWorkspaces[0]);

    // Fetch user profile
    const profileId = authUserId || selectedDbWs.owner_id;
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .limit(1);

    const dbProfile: DatabaseProfile | null = profiles && profiles.length > 0 ? profiles[0] : null;

    const allWorkspaces: Workspace[] = dbWorkspaces.map((w) => ({
      id: w.id,
      name: w.name,
      owner_id: w.owner_id,
      currency: w.currency || 'USD',
      starting_cash: w.starting_cash,
      alert_runway_threshold: w.alert_runway_threshold,
      created_at: w.created_at,
    }));

    const workspace: Workspace = {
      id: selectedDbWs.id,
      name: selectedDbWs.name,
      owner_id: selectedDbWs.owner_id,
      currency: selectedDbWs.currency || 'USD',
      starting_cash: selectedDbWs.starting_cash,
      alert_runway_threshold: selectedDbWs.alert_runway_threshold,
      created_at: selectedDbWs.created_at,
    };

    const user: UserProfile = {
      id: profileId,
      full_name: dbProfile?.full_name || session?.user?.user_metadata?.full_name || 'Alex Rivera',
      email: dbProfile?.email || session?.user?.email || 'alex.rivera@demo.fundflow.app',
      avatar_url: dbProfile?.avatar_url || undefined,
      role: 'owner',
    };

    return { workspace, workspaces: allWorkspaces, user };
  } catch (e) {
    console.error('Error fetching workspace and profile:', e);
    return { workspace: null, workspaces: [], user: null };
  }
}

/**
 * Fetch all transactions for a workspace
 */
export async function fetchTransactionsFromDb(workspaceId: string): Promise<Transaction[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('transaction_date', { ascending: false });

    if (error) {
      console.error('Error loading transactions from Supabase:', error);
      return [];
    }

    return (data as DatabaseTransaction[]).map(mapDatabaseTransaction);
  } catch (e) {
    console.error('Exception loading transactions:', e);
    return [];
  }
}

/**
 * Fetch all alerts for a workspace
 */
export async function fetchAlertsFromDb(workspaceId: string): Promise<Alert[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading alerts from Supabase:', error);
      return [];
    }

    return (data as DatabaseAlert[]).map(mapDatabaseAlert);
  } catch (e) {
    console.error('Exception loading alerts:', e);
    return [];
  }
}

/**
 * Fetch categories for a workspace
 */
export async function fetchCategoriesFromDb(workspaceId: string): Promise<DatabaseTransactionCategory[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('transaction_categories')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('Error loading categories:', error);
      return [];
    }

    return data as DatabaseTransactionCategory[];
  } catch (e) {
    console.error('Exception loading categories:', e);
    return [];
  }
}

/**
 * Fetch monthly financial summary records
 */
export async function fetchMonthlySummariesFromDb(
  workspaceId: string
): Promise<DatabaseMonthlyFinancialSummary[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('monthly_financial_summary')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('month', { ascending: true });

    if (error) {
      console.error('Error loading monthly summaries:', error);
      return [];
    }

    return data as DatabaseMonthlyFinancialSummary[];
  } catch (e) {
    console.error('Exception loading monthly summaries:', e);
    return [];
  }
}

/**
/**
 * Helper to log structured diagnostic Supabase errors without exposing credentials or tokens
 */
function logDiagnosticDbError(context: string, error: unknown, extraContext?: Record<string, unknown>) {
  const errObj = (typeof error === 'object' && error !== null ? error : {}) as Record<string, unknown>;
  const message = (errObj.message as string) || (error instanceof Error ? error.message : String(error));
  const code = (errObj.code as string) || 'N/A';
  const details = (errObj.details as string) || 'none';
  const hint = (errObj.hint as string) || 'none';
  const status = (errObj.status as string | number) || 'none';

  console.error(
    `[Supabase DB Diagnostic] Operation: ${context}\n` +
    `  • Error Message: ${message}\n` +
    `  • Error Code: ${code}\n` +
    `  • Details: ${details}\n` +
    `  • Hint: ${hint}\n` +
    `  • Status: ${status}` +
    (extraContext ? `\n  • Extra Context: ${JSON.stringify(extraContext)}` : '')
  );
}

/**
 * Insert a new transaction
 */
export async function insertTransactionDb(
  tx: Omit<Transaction, 'id' | 'workspace_id'>,
  workspaceId: string
): Promise<Transaction | null> {
  if (!isSupabaseConfigured) return null;

  try {
    // 1. Attempt via server-side API route with authentication & multi-tenant check
    if (typeof window !== 'undefined') {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const userId = sessionData?.session?.user?.id;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workspaceId,
          transaction: tx,
          userId,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success && result.transaction) {
          return mapDatabaseTransaction(result.transaction as DatabaseTransaction);
        }
      }
    }

    // 2. Direct Supabase client fallback
    const dbPayload = mapAppTransactionToDb(tx, workspaceId);
    const { data, error } = await supabase
      .from('transactions')
      .insert(dbPayload)
      .select()
      .single();

    if (error) {
      logDiagnosticDbError('insertTransactionDb', error);
      return null;
    }

    return mapDatabaseTransaction(data as DatabaseTransaction);
  } catch (e) {
    logDiagnosticDbError('insertTransactionDb (exception)', e);
    return null;
  }
}

/**
 * Update an existing transaction
 */
export async function updateTransactionDb(
  id: string,
  updates: Partial<Transaction>,
  workspaceId?: string
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    if (typeof window !== 'undefined') {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const userId = sessionData?.session?.user?.id;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/transactions/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          workspaceId,
          updates,
          userId,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) return true;
      }
    }

    const dbPayload: Record<string, unknown> = {};
    if (updates.transaction_date) dbPayload.transaction_date = updates.transaction_date;
    if (updates.description !== undefined) dbPayload.description = updates.description;
    if (updates.merchant !== undefined) dbPayload.merchant = updates.merchant;
    if (updates.category !== undefined) dbPayload.category = updates.category;
    if (updates.amount !== undefined) dbPayload.amount = Math.abs(Number(updates.amount));
    if (updates.transaction_type) dbPayload.transaction_type = updates.transaction_type;
    if (updates.currency) dbPayload.currency = updates.currency;
    dbPayload.updated_at = new Date().toISOString();

    const { error } = await supabase.from('transactions').update(dbPayload).eq('id', id);

    if (error) {
      logDiagnosticDbError('updateTransactionDb', error);
      return false;
    }

    return true;
  } catch (e) {
    logDiagnosticDbError('updateTransactionDb (exception)', e);
    return false;
  }
}

/**
 * Delete a transaction
 */
export async function deleteTransactionDb(id: string, workspaceId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    if (typeof window !== 'undefined') {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const userId = sessionData?.session?.user?.id;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ workspaceId, userId }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) return true;
      }
    }

    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) {
      logDiagnosticDbError('deleteTransactionDb', error);
      return false;
    }
    return true;
  } catch (e) {
    logDiagnosticDbError('deleteTransactionDb (exception)', e);
    return false;
  }
}

/**
 * Bulk insert transactions
 */
export async function bulkInsertTransactionsDb(
  txList: Transaction[],
  workspaceId: string,
  fileName: string = 'import.csv',
  fileSizeBytes: number = 0
): Promise<boolean> {
  if (!isSupabaseConfigured || txList.length === 0) return false;

  try {
    if (typeof window !== 'undefined') {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const userId = sessionData?.session?.user?.id;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/transactions/bulk', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workspaceId,
          transactions: txList,
          fileName,
          fileSizeBytes,
          userId,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          return true;
        }
      }
    }

    const dbPayloads = txList.map((t) => mapAppTransactionToDb(t, workspaceId, t.id));
    const { error } = await supabase.from('transactions').insert(dbPayloads);

    if (error) {
      logDiagnosticDbError('bulkInsertTransactionsDb', error);
      return false;
    }

    return true;
  } catch (e) {
    logDiagnosticDbError('bulkInsertTransactionsDb (exception)', e);
    return false;
  }
}

/**
 * Mark alert as acknowledged / read
 */
export async function acknowledgeAlertDb(alertId: string, workspaceId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    if (typeof window !== 'undefined') {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const userId = sessionData?.session?.user?.id;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/alerts/acknowledge', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          alertId,
          workspaceId,
          userId,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) return true;
      }
    }

    const isUuid =
      typeof alertId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(alertId);

    if (!isUuid) {
      // Local/demo alert without Supabase record, acknowledge safely in UI
      return true;
    }

    let query = supabase.from('alerts').update({ is_read: true }).eq('id', alertId);
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }
    const { error } = await query;

    if (error) {
      logDiagnosticDbError('acknowledgeAlertDb', error, { alertId, workspaceId });
      return false;
    }

    return true;
  } catch (e) {
    logDiagnosticDbError('acknowledgeAlertDb (exception)', e, { alertId, workspaceId });
    return false;
  }
}

/**
 * Mark all alerts as read for a workspace
 */
export async function markAllAlertsReadDb(workspaceId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    if (typeof window !== 'undefined') {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const userId = sessionData?.session?.user?.id;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/alerts/acknowledge', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workspaceId,
          all: true,
          userId,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) return true;
      }
    }

    const isUuid =
      typeof workspaceId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId);

    if (!isUuid) {
      return true;
    }

    const { error } = await supabase
      .from('alerts')
      .update({ is_read: true })
      .eq('workspace_id', workspaceId);

    if (error) {
      logDiagnosticDbError('markAllAlertsReadDb', error, { workspaceId });
      return false;
    }

    return true;
  } catch (e) {
    logDiagnosticDbError('markAllAlertsReadDb (exception)', e, { workspaceId });
    return false;
  }
}

/**
 * Track an uploaded file record
 */
export async function recordUploadedFileDb(
  workspaceId: string,
  fileName: string,
  fileSizeBytes: number,
  rowsImported: number
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  try {
    if (typeof window !== 'undefined') {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const userId = sessionData?.session?.user?.id;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/files/record', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workspaceId,
          fileName,
          fileSizeBytes,
          rowsImported,
          userId,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success && result.id) return result.id;
      }
    }

    const { data, error } = await supabase
      .from('uploaded_files')
      .insert({
        workspace_id: workspaceId,
        file_name: fileName,
        file_type: 'text/csv',
        file_size_bytes: fileSizeBytes,
        rows_imported: rowsImported,
        status: 'completed',
      })
      .select('id')
      .single();

    if (error) {
      logDiagnosticDbError('recordUploadedFileDb', error);
      return null;
    }

    return data?.id || null;
  } catch (e) {
    logDiagnosticDbError('recordUploadedFileDb (exception)', e);
    return null;
  }
}

/**
 * Fetch knowledge documents for workspace
 */
export async function fetchKnowledgeDocsFromDb(
  workspaceId: string
): Promise<DatabaseKnowledgeDocument[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('knowledge_documents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching knowledge documents:', error);
      return [];
    }

    return (data as DatabaseKnowledgeDocument[]) || [];
  } catch (e) {
    console.error('Exception fetching knowledge documents:', e);
    return [];
  }
}

/**
 * Fetch document chunks for workspace
 */
export async function fetchDocumentChunksFromDb(
  workspaceId: string
): Promise<DatabaseDocumentChunk[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('document_chunks')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('Error fetching document chunks:', error);
      return [];
    }

    return (data as DatabaseDocumentChunk[]) || [];
  } catch (e) {
    console.error('Exception fetching document chunks:', e);
    return [];
  }
}

/**
 * Fetch uploaded file records for workspace
 */
export async function fetchUploadedFilesFromDb(
  workspaceId: string
): Promise<DatabaseUploadedFile[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching uploaded files:', error);
      return [];
    }

    return (data as DatabaseUploadedFile[]) || [];
  } catch (e) {
    console.error('Exception fetching uploaded files:', e);
    return [];
  }
}

