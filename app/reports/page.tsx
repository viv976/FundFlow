'use client';

import React, { useState, useEffect } from 'react';
import { useFinance } from '@/lib/store/finance-context';
import { formatCurrency } from '@/lib/finance/calculator';
import { supabase } from '@/lib/supabase/client';
import { DatabaseMonthlyFinancialSummary } from '@/lib/supabase/types';
import Link from 'next/link';

export default function ReportsPage() {
  const { workspace, kpis, expenseBreakdown, transactions, exportTransactionsCSV, exportReportJSON } = useFinance();
  const [summaries, setSummaries] = useState<DatabaseMonthlyFinancialSummary[]>([]);

  const totalExpense = expenseBreakdown.reduce((sum, item) => sum + item.amount, 0);

  useEffect(() => {
    let ignore = false;
    async function loadMonthlySummaries() {
      try {
        const { data } = await supabase
          .from('monthly_financial_summary')
          .select('*')
          .eq('workspace_id', workspace.id)
          .order('month', { ascending: false });

        if (data && !ignore) {
          setSummaries(data as DatabaseMonthlyFinancialSummary[]);
        }
      } catch (err) {
        console.warn('Error loading summaries:', err);
      }
    }
    loadMonthlySummaries();
    return () => {
      ignore = true;
    };
  }, [workspace.id]);

  const handleDownloadJSON = () => {
    const jsonString = exportReportJSON();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fundflow-executive-report-${workspace.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn pb-12 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/60 shadow-sm w-full">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono-data uppercase tracking-wider text-secondary-fixed bg-primary px-2.5 py-0.5 rounded font-bold">
              {workspace.currency} Executive Reporting
            </span>
            <span className="text-xs text-on-surface-variant font-medium">• Verified Audit Trail</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight font-headline-lg">
            Financial Reports & Analytics
          </h1>
          <p className="text-xs text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
            Comprehensive burn analysis, category allocation, and runway projections for <strong className="text-on-surface">{workspace.name}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={exportTransactionsCSV}
            className="px-4 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-all flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleDownloadJSON}
            className="px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container transition-all flex items-center gap-2 cursor-pointer shadow-md"
          >
            <span className="material-symbols-outlined text-[18px]">summarize</span>
            <span>Executive JSON</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/60 space-y-2 shadow-xs">
          <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider font-label-md">
            Cash On Hand
          </span>
          <div className="text-2xl font-bold font-mono-data text-primary">
            {formatCurrency(kpis.cashOnHand, workspace.currency)}
          </div>
          <span className="text-[11px] text-outline block">Liquid treasury reserves</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/60 space-y-2 shadow-xs">
          <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider font-label-md">
            Monthly Net Burn
          </span>
          <div className="text-2xl font-bold font-mono-data text-error">
            {formatCurrency(kpis.monthlyBurn, workspace.currency)}
          </div>
          <span className="text-[11px] text-outline block">30-day operating deficit</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/60 space-y-2 shadow-xs">
          <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider font-label-md">
            Runway
          </span>
          <div className="text-2xl font-bold font-mono-data text-secondary">
            {kpis.runwayDisplay}
          </div>
          <span className="text-[11px] text-outline block">Until zero cash date</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/60 space-y-2 shadow-xs">
          <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider font-label-md">
            Recorded Transactions
          </span>
          <div className="text-2xl font-bold font-mono-data text-on-surface">
            {transactions.length}
          </div>
          <span className="text-[11px] text-outline block">In current workspace ledger</span>
        </div>
      </div>

      {/* Historical Monthly Summaries Table */}
      {summaries.length > 0 && (
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/60 shadow-sm space-y-4 w-full">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-on-surface font-headline-md">
                Historical Monthly Financial Summaries
              </h2>
              <p className="text-xs text-on-surface-variant">
                Monthly snapshot performance and growth trajectory
              </p>
            </div>
            <span className="text-[11px] font-mono-data text-outline font-semibold">
              {summaries.length} Monthly Snapshots
            </span>
          </div>

          <div className="overflow-x-auto border border-outline-variant rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-surface-container-low text-on-surface border-b border-outline-variant font-semibold">
                <tr>
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4">Cash on Hand</th>
                  <th className="py-3 px-4">Total Revenue</th>
                  <th className="py-3 px-4">Total Expenses</th>
                  <th className="py-3 px-4">Net Cash Flow</th>
                  <th className="py-3 px-4">Burn Rate</th>
                  <th className="py-3 px-4">Runway</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60 font-mono-data">
                {summaries.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-on-surface">{s.month}</td>
                    <td className="py-3 px-4 text-primary font-bold">
                      {formatCurrency(s.cash_on_hand, workspace.currency)}
                    </td>
                    <td className="py-3 px-4 text-secondary font-semibold">
                      +{formatCurrency(s.total_revenue, workspace.currency)}
                    </td>
                    <td className="py-3 px-4 text-error font-semibold">
                      -{formatCurrency(s.total_expenses, workspace.currency)}
                    </td>
                    <td className={`py-3 px-4 font-semibold ${s.net_cash_flow >= 0 ? 'text-secondary' : 'text-error'}`}>
                      {s.net_cash_flow >= 0 ? '+' : ''}{formatCurrency(s.net_cash_flow, workspace.currency)}
                    </td>
                    <td className="py-3 px-4 text-on-surface">
                      {formatCurrency(s.burn_rate, workspace.currency)}/mo
                    </td>
                    <td className="py-3 px-4 text-primary font-bold">
                      {s.runway_months} Mo
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Category Expense Breakdown */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/60 shadow-sm space-y-4 w-full">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-on-surface font-headline-md">
              Operating Expense Distribution
            </h2>
            <p className="text-xs text-on-surface-variant">
              Breakdown of all recorded expenses by category.
            </p>
          </div>
          <span className="text-xs font-mono-data font-bold text-primary">
            Total: {formatCurrency(totalExpense, workspace.currency)}
          </span>
        </div>

        <div className="space-y-3 pt-2">
          {expenseBreakdown.length === 0 ? (
            <div className="text-center py-8 text-xs text-on-surface-variant">
              No expense records found for {workspace.name}. Import transactions via{' '}
              <Link href="/upload" className="text-primary font-semibold hover:underline">
                Upload CSV
              </Link>
              .
            </div>
          ) : (
            expenseBreakdown.map((item) => (
              <div key={item.category} className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-on-surface font-semibold">{item.category}</span>
                  <span className="font-mono-data text-on-surface-variant">
                    {formatCurrency(item.amount, workspace.currency)} ({item.percentage}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, item.percentage)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
