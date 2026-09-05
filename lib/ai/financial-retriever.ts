import { Transaction, AICitation } from '@/types/finance';
import {
  calculateCashOnHand,
  calculateMonthlyBurn,
  calculateRunway,
  calculateCategoryBreakdown,
} from '@/lib/finance/calculator';
import { ParsedIntent } from './intent-parser';

export interface RetrievedFinancialContext {
  cashOnHand: number;
  monthlyBurn: number;
  runwayMonths: number;
  runwayDisplay: string;
  categoryBreakdown: { category: string; amount: number; percentage: number }[];
  relevantTransactions: Transaction[];
  recentAnomalies: { description: string; amount: number; category: string }[];
  citations: AICitation[];
}

export function retrieveFinancialContext(
  transactions: Transaction[],
  intent: ParsedIntent
): RetrievedFinancialContext {
  const cashOnHand = calculateCashOnHand(transactions);
  const monthlyBurn = calculateMonthlyBurn(transactions);
  const { runwayMonths, display } = calculateRunway(cashOnHand, monthlyBurn);
  const categoryBreakdown = calculateCategoryBreakdown(transactions);

  const citations: AICitation[] = [
    {
      id: 'cite-cash',
      type: 'calculation',
      label: `Cash on Hand: $${(cashOnHand / 1000000).toFixed(2)}M`,
      amount: cashOnHand,
      details: 'Computed across verified bank ledger entries',
    },
    {
      id: 'cite-burn',
      type: 'calculation',
      label: `Monthly Burn: $${(monthlyBurn / 1000).toFixed(0)}K/mo`,
      amount: monthlyBurn,
      details: 'Average 30-90 day net operating outflow',
    },
    {
      id: 'cite-runway',
      type: 'calculation',
      label: `Runway: ${display}`,
      details: `Cash ($${(cashOnHand / 1000000).toFixed(2)}M) / Monthly Burn ($${(monthlyBurn / 1000).toFixed(0)}K)`,
    },
  ];

  // Specific transaction filtering based on intent
  let relevantTransactions = [...transactions].slice(0, 10);
  const recentAnomalies: { description: string; amount: number; category: string }[] = [];

  if (intent.intent === 'EXPENSE_ANALYSIS' && intent.extractedParameters?.category) {
    const targetCat = intent.extractedParameters.category;
    if (targetCat !== 'All') {
      relevantTransactions = transactions.filter(
        (t) => t.category.toLowerCase().includes(targetCat.toLowerCase())
      );
      const catTotal = relevantTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
      citations.push({
        id: `cite-cat-${targetCat}`,
        type: 'category_aggregation',
        label: `${targetCat} Total: $${catTotal.toLocaleString()}`,
        amount: catTotal,
        details: `${relevantTransactions.length} recorded line items`,
      });
    }
  }

  // Find high expense items for evidence
  const largeExpenses = transactions
    .filter((t) => t.transaction_type === 'expense')
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 3);

  for (const exp of largeExpenses) {
    recentAnomalies.push({
      description: exp.description,
      amount: Number(exp.amount),
      category: exp.category,
    });
    citations.push({
      id: `cite-tx-${exp.id}`,
      type: 'transaction',
      label: `${exp.description}: $${Number(exp.amount).toLocaleString()}`,
      amount: Number(exp.amount),
      date_range: exp.transaction_date,
      details: `Category: ${exp.category}`,
    });
  }

  return {
    cashOnHand,
    monthlyBurn,
    runwayMonths,
    runwayDisplay: display,
    categoryBreakdown,
    relevantTransactions,
    recentAnomalies,
    citations,
  };
}
