'use client';

import React from 'react';
import Link from 'next/link';
import { useFinance } from '@/lib/store/finance-context';
import { formatCurrency } from '@/lib/finance/calculator';

export const ExpenseBreakdown: React.FC = () => {
  const { expenseBreakdown } = useFinance();

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
            Expense Breakdown
          </h2>
          <p className="text-body-sm text-on-surface-variant font-body-sm">
            Categorized monthly operating expenses
          </p>
        </div>
        <Link
          href="/transactions"
          className="text-primary font-label-md text-xs hover:underline flex items-center gap-1"
        >
          View Ledger
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>

      <div className="space-y-4">
        {expenseBreakdown.map((item, idx) => (
          <div key={idx} className="flex items-center gap-4 group">
            {/* Category Name */}
            <div className="w-36 font-label-md text-label-md text-on-surface truncate font-medium">
              {item.category}
            </div>

            {/* Horizontal Bar */}
            <div className="flex-1 h-3 bg-surface-container-low rounded-full overflow-hidden relative">
              <div
                className={`h-full ${item.colorClass} transition-all duration-500 rounded-full`}
                style={{ width: `${Math.min(100, Math.max(3, item.percentage))}%` }}
              ></div>
            </div>

            {/* Percentage Badge */}
            <div className="w-12 text-right text-xs font-mono-data text-on-surface-variant">
              {item.percentage}%
            </div>

            {/* JetBrains Mono Amount */}
            <div className="w-24 text-right font-mono-data text-mono-data text-on-surface font-semibold">
              {formatCurrency(item.amount)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
