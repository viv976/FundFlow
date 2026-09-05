'use client';

import React from 'react';
import { TransactionTable } from '@/components/transactions/TransactionTable';
import { useFinance } from '@/lib/store/finance-context';
import { formatCurrency } from '@/lib/finance/calculator';

export default function TransactionsPage() {
  const { workspace, transactions, kpis } = useFinance();

  const totalExpense = transactions
    .filter((t) => t.transaction_type === 'expense')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const totalIncome = transactions
    .filter((t) => t.transaction_type === 'income')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6 animate-fadeIn pb-12 w-full">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/60 shadow-sm w-full">
        <div>
          <div className="flex items-center gap-2 text-xs font-label-md text-on-surface-variant uppercase tracking-wider mb-1 font-semibold">
            <span className="bg-primary text-secondary-fixed px-2 py-0.5 rounded text-[10px] font-mono-data font-bold">
              {workspace.currency}
            </span>
            <span>•</span>
            <span className="font-mono-data text-primary font-semibold">{transactions.length} Records</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight font-headline-lg">
            Transaction Ledger
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Complete transaction ledger for <strong className="text-on-surface">{workspace.name}</strong>
          </p>
        </div>

        {/* Ledger Quick Stats */}
        <div className="flex items-center gap-4 bg-surface-bright border border-outline-variant rounded-xl p-3 px-5 text-xs font-mono-data shrink-0">
          <div>
            <span className="text-on-surface-variant block text-[10px] uppercase font-label-md">
              Total Inflow
            </span>
            <span className="text-secondary font-bold font-mono-data text-sm">
              +{formatCurrency(totalIncome, workspace.currency)}
            </span>
          </div>
          <div className="h-7 w-px bg-outline-variant"></div>
          <div>
            <span className="text-on-surface-variant block text-[10px] uppercase font-label-md">
              Total Outflow
            </span>
            <span className="text-error font-bold font-mono-data text-sm">
              -{formatCurrency(totalExpense, workspace.currency)}
            </span>
          </div>
          <div className="h-7 w-px bg-outline-variant"></div>
          <div>
            <span className="text-on-surface-variant block text-[10px] uppercase font-label-md">
              Net Burn Rate
            </span>
            <span className="text-primary font-bold font-mono-data text-sm">
              {formatCurrency(kpis.monthlyBurn, workspace.currency)}/mo
            </span>
          </div>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="w-full">
        <TransactionTable />
      </div>
    </div>
  );
}
