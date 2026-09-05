import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    // Perform non-destructive read operations to verify live database tables
    const [
      profilesRes,
      workspacesRes,
      transactionsRes,
      categoriesRes,
      summaryRes,
      alertsRes,
      knowledgeRes,
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('workspaces').select('id', { count: 'exact', head: true }),
      supabase.from('transactions').select('id', { count: 'exact', head: true }),
      supabase.from('transaction_categories').select('id', { count: 'exact', head: true }),
      supabase.from('monthly_financial_summary').select('id', { count: 'exact', head: true }),
      supabase.from('alerts').select('id', { count: 'exact', head: true }),
      supabase.from('knowledge_documents').select('id', { count: 'exact', head: true }),
    ]);

    const isHealthy =
      !profilesRes.error &&
      !workspacesRes.error &&
      !transactionsRes.error &&
      !categoriesRes.error &&
      !summaryRes.error &&
      !alertsRes.error;

    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'degraded',
      supabase_connected: isHealthy,
      database: {
        profiles: { count: profilesRes.count ?? 0, ok: !profilesRes.error },
        workspaces: { count: workspacesRes.count ?? 0, ok: !workspacesRes.error },
        transactions: { count: transactionsRes.count ?? 0, ok: !transactionsRes.error },
        transaction_categories: { count: categoriesRes.count ?? 0, ok: !categoriesRes.error },
        monthly_financial_summary: { count: summaryRes.count ?? 0, ok: !summaryRes.error },
        alerts: { count: alertsRes.count ?? 0, ok: !alertsRes.error },
        knowledge_documents: { count: knowledgeRes.count ?? 0, ok: !knowledgeRes.error },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Health check error';
    return NextResponse.json(
      {
        status: 'error',
        supabase_connected: false,
        message: msg,
      },
      { status: 500 }
    );
  }
}
