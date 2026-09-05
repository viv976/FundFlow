export type FinancialIntent =
  | 'RUNWAY_QUERY'
  | 'BURN_QUERY'
  | 'SCENARIO_MODELING'
  | 'EXPENSE_ANALYSIS'
  | 'FORECAST'
  | 'TRANSACTION_LOOKUP'
  | 'ANOMALY_EXPLANATION'
  | 'GENERAL_SUMMARY';

export interface ParsedIntent {
  intent: FinancialIntent;
  confidence: number;
  extractedParameters?: {
    entity?: string;
    category?: string;
    amount?: number;
    headcount?: number;
    salary?: number;
    period?: string;
  };
}

export function parseFinancialIntent(prompt: string): ParsedIntent {
  const text = prompt.toLowerCase();

  // 1. Scenario Modeling (Hiring, spending adjustments, what-if)
  if (
    text.includes('what if') ||
    text.includes('hire') ||
    text.includes('engineer') ||
    text.includes('headcount') ||
    text.includes('afford') ||
    text.includes('salary') ||
    text.includes('increase spend') ||
    text.includes('cut spend') ||
    text.includes('add revenue')
  ) {
    let headcount = 1;
    let salary = 80000;

    // Detect headcount e.g. "2 engineers", "two engineers"
    const countMatch = text.match(/(\d+)\s*(more\s*)?(engineer|developer|designer|rep|person|people|employee|hire)/);
    if (countMatch) {
      headcount = parseInt(countMatch[1], 10);
    } else if (text.includes('two') || text.includes('2')) {
      headcount = 2;
    } else if (text.includes('three') || text.includes('3')) {
      headcount = 3;
    }

    // Detect salary/cost e.g. "$80k", "80,000", "$120k/yr", "10k/month"
    const salaryMatch = text.match(/\$?(\d+)(k|\,000)?/);
    if (salaryMatch) {
      const num = parseInt(salaryMatch[1], 10);
      if (num < 500) {
        // e.g. 80 -> 80k
        salary = num * 1000;
      } else {
        salary = num;
      }
    }

    return {
      intent: 'SCENARIO_MODELING',
      confidence: 0.95,
      extractedParameters: { headcount, salary },
    };
  }

  // 2. Runway Queries
  if (text.includes('runway') || text.includes('months left') || text.includes('out of money') || text.includes('cash out')) {
    return { intent: 'RUNWAY_QUERY', confidence: 0.92 };
  }

  // 3. Burn Rate Queries
  if (text.includes('burn') || text.includes('burn rate') || text.includes('burning') || text.includes('spending rate')) {
    return { intent: 'BURN_QUERY', confidence: 0.9 };
  }

  // 4. Anomaly / Spikes
  if (text.includes('why did') || text.includes('spike') || text.includes('anomaly') || text.includes('jump') || text.includes('drop')) {
    return { intent: 'ANOMALY_EXPLANATION', confidence: 0.88 };
  }

  // 5. Expense Analysis & Category Spend
  if (text.includes('saas') || text.includes('spend') || text.includes('expense') || text.includes('payroll') || text.includes('marketing') || text.includes('breakdown')) {
    let category = 'All';
    if (text.includes('saas') || text.includes('software')) category = 'Software / IT';
    else if (text.includes('payroll') || text.includes('salary')) category = 'Payroll';
    else if (text.includes('marketing') || text.includes('ads')) category = 'Marketing';
    else if (text.includes('aws') || text.includes('cloud') || text.includes('infra')) category = 'Infrastructure';

    return {
      intent: 'EXPENSE_ANALYSIS',
      confidence: 0.85,
      extractedParameters: { category },
    };
  }

  // 6. Forecast / Projections
  if (text.includes('forecast') || text.includes('project') || text.includes('end of year') || text.includes('q4') || text.includes('future cash')) {
    return { intent: 'FORECAST', confidence: 0.85 };
  }

  // 7. Transaction Lookup
  if (text.includes('aws') || text.includes('stripe') || text.includes('gusto') || text.includes('invoice') || text.includes('receipt')) {
    return { intent: 'TRANSACTION_LOOKUP', confidence: 0.8 };
  }

  return { intent: 'GENERAL_SUMMARY', confidence: 0.7 };
}
