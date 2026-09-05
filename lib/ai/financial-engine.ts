import { Transaction } from '@/types/finance';
import { DatabaseMonthlyFinancialSummary } from '@/lib/supabase/types';

export interface FinancialMetricResult {
  metric: string;
  value: number;
  formatted: string;
  timePeriod: string;
  category?: string;
  details?: Record<string, unknown>;
  evidence: string[];
}

/**
 * Deterministic Financial Calculations directly from ledger data
 */
export class FinancialEngine {
  /**
   * Calculate total spend (expenses) for a specific time window or all-time
   */
  static calculateTotalSpend(
    transactions: Transaction[],
    currency: string = 'USD',
    monthFilter?: string
  ): FinancialMetricResult {
    let filtered = transactions.filter((t) => t.transaction_type === 'expense');
    let timePeriod = 'All historical transactions';

    if (monthFilter) {
      filtered = filtered.filter((t) => t.transaction_date.startsWith(monthFilter));
      timePeriod = `Month: ${monthFilter}`;
    }

    const total = filtered.reduce((sum, t) => sum + t.amount, 0);

    return {
      metric: 'Total Expenses',
      value: total,
      formatted: `${currency} ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      timePeriod,
      details: {
        transactionCount: filtered.length,
        averageExpense: filtered.length > 0 ? total / filtered.length : 0,
      },
      evidence: [
        `Calculated from ${filtered.length} verified expense transactions in ${timePeriod}.`,
        `Sum total: ${currency} ${total.toFixed(2)}.`,
      ],
    };
  }

  /**
   * Calculate total revenue for a specific time window or all-time
   */
  static calculateTotalRevenue(
    transactions: Transaction[],
    currency: string = 'USD',
    monthFilter?: string
  ): FinancialMetricResult {
    let filtered = transactions.filter((t) => t.transaction_type === 'income');
    let timePeriod = 'All historical transactions';

    if (monthFilter) {
      filtered = filtered.filter((t) => t.transaction_date.startsWith(monthFilter));
      timePeriod = `Month: ${monthFilter}`;
    }

    const total = filtered.reduce((sum, t) => sum + t.amount, 0);

    return {
      metric: 'Total Revenue',
      value: total,
      formatted: `${currency} ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      timePeriod,
      details: {
        transactionCount: filtered.length,
      },
      evidence: [
        `Calculated from ${filtered.length} verified revenue transactions in ${timePeriod}.`,
        `Total incoming revenue: ${currency} ${total.toFixed(2)}.`,
      ],
    };
  }

  /**
   * Find highest expense category
   */
  static getHighestExpenseCategory(
    transactions: Transaction[],
    currency: string = 'USD'
  ): FinancialMetricResult {
    const expenses = transactions.filter((t) => t.transaction_type === 'expense');
    const categoryTotals: Record<string, number> = {};

    for (const t of expenses) {
      const cat = t.category || 'Uncategorized';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
    }

    let topCategory = 'None';
    let topAmount = 0;

    for (const [cat, amt] of Object.entries(categoryTotals)) {
      if (amt > topAmount) {
        topAmount = amt;
        topCategory = cat;
      }
    }

    const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
    const pct = totalExpense > 0 ? ((topAmount / totalExpense) * 100).toFixed(1) : '0';

    return {
      metric: 'Highest Expense Category',
      value: topAmount,
      formatted: `${topCategory}: ${currency} ${topAmount.toLocaleString()} (${pct}% of total burn)`,
      timePeriod: 'All recorded periods',
      category: topCategory,
      details: {
        categoryTotals,
        percentageOfTotal: parseFloat(pct),
      },
      evidence: [
        `Highest expense category identified as "${topCategory}" with total outflow of ${currency} ${topAmount.toFixed(2)}.`,
        `Represents ${pct}% of total cumulative expenses.`,
      ],
    };
  }

  /**
   * Calculate category-specific spend (e.g., Marketing, Payroll, Cloud)
   */
  static getCategorySpend(
    transactions: Transaction[],
    categoryKeyword: string,
    currency: string = 'USD'
  ): FinancialMetricResult {
    const normalized = categoryKeyword.toLowerCase();
    const matching = transactions.filter(
      (t) =>
        t.transaction_type === 'expense' &&
        ((t.category && t.category.toLowerCase().includes(normalized)) ||
          (t.description && t.description.toLowerCase().includes(normalized)) ||
          (t.merchant && t.merchant.toLowerCase().includes(normalized)))
    );

    const total = matching.reduce((sum, t) => sum + t.amount, 0);

    return {
      metric: `Spend on ${categoryKeyword}`,
      value: total,
      formatted: `${currency} ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      timePeriod: 'All recorded transactions',
      category: categoryKeyword,
      details: {
        matchingTransactionsCount: matching.length,
      },
      evidence: [
        `Found ${matching.length} transactions matching category/keyword "${categoryKeyword}".`,
        `Cumulative total spend: ${currency} ${total.toFixed(2)}.`,
      ],
    };
  }

  /**
   * Compare Month-over-Month expenses
   */
  static compareMoM(
    summaries: DatabaseMonthlyFinancialSummary[],
    currency: string = 'USD'
  ): FinancialMetricResult {
    if (summaries.length < 2) {
      return {
        metric: 'MoM Comparison',
        value: 0,
        formatted: 'Insufficient monthly snapshots to perform comparison',
        timePeriod: 'N/A',
        evidence: ['At least two monthly summary snapshots are required for MoM comparison.'],
      };
    }

    const sorted = [...summaries].sort((a, b) => b.month.localeCompare(a.month));
    const latest = sorted[0];
    const previous = sorted[1];

    const expenseDelta = latest.total_expenses - previous.total_expenses;
    const expensePct =
      previous.total_expenses > 0
        ? ((expenseDelta / previous.total_expenses) * 100).toFixed(1)
        : '0';

    const revenueDelta = latest.total_revenue - previous.total_revenue;
    const revenuePct =
      previous.total_revenue > 0
        ? ((revenueDelta / previous.total_revenue) * 100).toFixed(1)
        : '0';

    return {
      metric: 'Month-over-Month Comparison',
      value: expenseDelta,
      formatted: `Expenses: ${expenseDelta >= 0 ? '+' : ''}${expensePct}% (${currency} ${latest.total_expenses.toLocaleString()} vs ${currency} ${previous.total_expenses.toLocaleString()}) | Revenue: ${revenueDelta >= 0 ? '+' : ''}${revenuePct}%`,
      timePeriod: `${previous.month} to ${latest.month}`,
      details: {
        latestMonth: latest.month,
        previousMonth: previous.month,
        latestExpenses: latest.total_expenses,
        previousExpenses: previous.total_expenses,
        expenseDelta,
        expenseGrowthPct: parseFloat(expensePct),
        revenueGrowthPct: parseFloat(revenuePct),
      },
      evidence: [
        `Comparing ${previous.month} with ${latest.month}.`,
        `Operating expenses shifted by ${expenseDelta >= 0 ? '+' : ''}${currency} ${expenseDelta.toFixed(2)} (${expensePct}%).`,
        `Revenue shifted by ${revenueDelta >= 0 ? '+' : ''}${currency} ${revenueDelta.toFixed(2)} (${revenuePct}%).`,
      ],
    };
  }
}
