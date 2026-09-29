export type AIMode =
  | 'FINANCIAL_DATA'
  | 'KNOWLEDGE_RAG'
  | 'COMBINED_ANALYSIS'
  | 'WHAT_IF_SCENARIO'
  | 'EXPLAIN_CALCULATION'
  | 'UNKNOWN_OR_MISSING';

export interface ClassifiedIntent {
  mode: AIMode;
  subType: string;
  confidence: number;
  extractedParameters?: {
    month?: string;
    category?: string;
    headcount?: number;
    salary?: number;
    spendChange?: number;
    metric?: 'runway' | 'burn' | 'cash' | 'growth';
  };
}

/**
 * Classify user question into grounded query modes
 */
export function classifyFinancialIntent(userQuery: string): ClassifiedIntent {
  const q = userQuery.toLowerCase().trim();

  // 1. EXPLAIN FINANCIAL CALCULATIONS (Requirement 9)
  if (
    q.includes('how is runway calculated') ||
    q.includes('how is my runway calculated') ||
    q.includes('runway calculation') ||
    q.includes('explain runway formula') ||
    q.includes('how do you calculate runway')
  ) {
    return {
      mode: 'EXPLAIN_CALCULATION',
      subType: 'EXPLAIN_RUNWAY',
      confidence: 0.99,
      extractedParameters: { metric: 'runway' },
    };
  }

  if (
    q.includes('how is burn calculated') ||
    q.includes('how is net burn calculated') ||
    q.includes('burn calculation') ||
    q.includes('explain burn formula') ||
    q.includes('how do you calculate burn')
  ) {
    return {
      mode: 'EXPLAIN_CALCULATION',
      subType: 'EXPLAIN_BURN',
      confidence: 0.99,
      extractedParameters: { metric: 'burn' },
    };
  }

  if (
    q.includes('how is cash calculated') ||
    q.includes('cash on hand calculation') ||
    q.includes('explain cash formula') ||
    q.includes('how do you calculate cash')
  ) {
    return {
      mode: 'EXPLAIN_CALCULATION',
      subType: 'EXPLAIN_CASH',
      confidence: 0.99,
      extractedParameters: { metric: 'cash' },
    };
  }

  if (
    q.includes('how is growth calculated') ||
    q.includes('how is mom growth calculated') ||
    q.includes('explain growth formula')
  ) {
    return {
      mode: 'EXPLAIN_CALCULATION',
      subType: 'EXPLAIN_GROWTH',
      confidence: 0.99,
      extractedParameters: { metric: 'growth' },
    };
  }

  // 2. USEFUL CO-PILOT QUESTIONS (Requirement 8)
  // Why did burn increase this month?
  if (
    (q.includes('why') && (q.includes('burn') || q.includes('expenses') || q.includes('spend')) && (q.includes('increase') || q.includes('spike') || q.includes('went up') || q.includes('grow'))) ||
    q.includes('why did burn increase') ||
    q.includes('why did expenses increase')
  ) {
    return {
      mode: 'COMBINED_ANALYSIS',
      subType: 'BURN_INCREASE_ANALYSIS',
      confidence: 0.96,
    };
  }

  // Which expenses grew fastest?
  if (
    (q.includes('fastest') || q.includes('highest growth') || q.includes('most growth') || q.includes('grew fastest') || q.includes('growing fastest')) &&
    (q.includes('expense') || q.includes('spend') || q.includes('category') || q.includes('cost'))
  ) {
    return {
      mode: 'FINANCIAL_DATA',
      subType: 'FASTEST_GROWING_EXPENSES',
      confidence: 0.96,
    };
  }

  // What caused the biggest cash outflows?
  if (
    q.includes('biggest cash outflow') ||
    q.includes('largest cash outflow') ||
    q.includes('biggest outflows') ||
    q.includes('largest outflows') ||
    q.includes('biggest drain') ||
    q.includes('where did the money go') ||
    q.includes('where is the cash going')
  ) {
    return {
      mode: 'FINANCIAL_DATA',
      subType: 'BIGGEST_CASH_OUTFLOWS',
      confidence: 0.96,
    };
  }

  // Show unusual spending / anomalies
  if (
    q.includes('unusual spend') ||
    q.includes('unusual spending') ||
    q.includes('spending anomaly') ||
    q.includes('anomalies') ||
    q.includes('unexpected expenses') ||
    q.includes('expense spikes') ||
    q.includes('suspicious')
  ) {
    return {
      mode: 'FINANCIAL_DATA',
      subType: 'UNUSUAL_SPENDING',
      confidence: 0.95,
    };
  }

  // How long is our runway?
  if (
    q.includes('runway') ||
    q.includes('how long is our runway') ||
    q.includes('how long is my runway') ||
    q.includes('what is our runway') ||
    q.includes('what is my runway') ||
    q.includes('current runway') ||
    q.includes('runway left') ||
    q.includes('how much runway')
  ) {
    return {
      mode: 'FINANCIAL_DATA',
      subType: 'RUNWAY_QUERY',
      confidence: 0.98,
    };
  }

  // What are our largest expenses?
  if (
    q.includes('largest expense') ||
    q.includes('largest expenses') ||
    q.includes('top expense') ||
    q.includes('top expenses') ||
    q.includes('biggest expense') ||
    q.includes('highest expense') ||
    q.includes('costs me the most') ||
    q.includes('where are we spending the most')
  ) {
    return {
      mode: 'FINANCIAL_DATA',
      subType: 'LARGEST_EXPENSES',
      confidence: 0.96,
    };
  }

  // What changed compared with last month?
  if (
    q.includes('what changed compared with last month') ||
    q.includes('what changed from last month') ||
    q.includes('compare with last month') ||
    q.includes('compare to last month') ||
    q.includes('month over month') ||
    q.includes('mom comparison')
  ) {
    return {
      mode: 'FINANCIAL_DATA',
      subType: 'MOM_COMPARISON',
      confidence: 0.95,
    };
  }

  // What does our financial plan say about hiring? (Document retrieval)
  if (
    (q.includes('financial plan') || q.includes('budget') || q.includes('policy')) &&
    (q.includes('hiring') || q.includes('hire') || q.includes('headcount') || q.includes('recruiting'))
  ) {
    return {
      mode: 'KNOWLEDGE_RAG',
      subType: 'FINANCIAL_PLAN_HIRING',
      confidence: 0.95,
    };
  }

  // 3. WHAT-IF SCENARIO CHECK (Hiring / spend simulation)
  if (
    q.includes('what if') ||
    q.includes('simulate') ||
    (q.includes('hire') && (q.includes('engineer') || q.includes('salary') || q.includes('people') || q.includes('staff'))) ||
    q.includes('headcount simulation')
  ) {
    let headcount = 2;
    let salary = 80000;

    const countMatch = q.match(/(\d+)\s*(people|engineers|devs|employees|hires|person|staff)/);
    if (countMatch) headcount = parseInt(countMatch[1], 10);

    const salaryMatch = q.match(/\$(\d+)[kK]?/);
    if (salaryMatch) {
      let num = parseInt(salaryMatch[1], 10);
      if (num < 1000) num *= 1000;
      salary = num;
    }

    return {
      mode: 'WHAT_IF_SCENARIO',
      subType: 'HIRING_SIMULATION',
      confidence: 0.95,
      extractedParameters: { headcount, salary },
    };
  }

  // 4. FINANCIAL DATA QUESTIONS (Standard spend / revenue queries)
  // Cash on Hand / Current Cash Balance
  if (
    (q.includes('how much') && q.includes('cash')) ||
    q.includes('current cash') ||
    q.includes('cash on hand') ||
    q.includes('cash balance') ||
    q.includes('total cash') ||
    q.includes('available cash') ||
    q.includes('what is our cash') ||
    q.includes('what is my cash') ||
    q.includes('how much cash')
  ) {
    return {
      mode: 'FINANCIAL_DATA',
      subType: 'CASH_QUERY',
      confidence: 0.98,
      extractedParameters: { metric: 'cash' },
    };
  }

  // Spend / Expenses
  if (
    (q.includes('how much') && (q.includes('spend') || q.includes('spent') || q.includes('expense'))) ||
    q === 'what were my expenses' ||
    q === 'what were my expenses?' ||
    q.includes('total expenses') ||
    q.includes('total spend') ||
    q.includes('current burn')
  ) {
    let category: string | undefined;
    if (q.includes('marketing')) category = 'Marketing';
    if (q.includes('payroll') || q.includes('salary')) category = 'Payroll';
    if (q.includes('aws') || q.includes('cloud')) category = 'Cloud Infrastructure';
    if (q.includes('software') || q.includes('saas')) category = 'SaaS & Software';

    return {
      mode: 'FINANCIAL_DATA',
      subType: category ? 'CATEGORY_SPEND' : 'TOTAL_SPEND',
      confidence: 0.95,
      extractedParameters: { category },
    };
  }

  // Revenue
  if (
    (q.includes('how much') && (q.includes('revenue') || q.includes('income') || q.includes('sales'))) ||
    q === 'what was my revenue' ||
    q === 'what was my revenue?' ||
    q.includes('total revenue') ||
    q.includes('revenue this quarter')
  ) {
    return {
      mode: 'FINANCIAL_DATA',
      subType: 'TOTAL_REVENUE',
      confidence: 0.95,
    };
  }

  // 5. COMBINED ANALYSIS & RECOMMENDATIONS
  if (
    q.includes('what should i do') ||
    q.includes('how can i reduce') ||
    q.includes('reduce expenses') ||
    q.includes('improve cash flow') ||
    q.includes('what should i focus on') ||
    q.includes('cut cost') ||
    q.includes('extend runway')
  ) {
    return {
      mode: 'COMBINED_ANALYSIS',
      subType: 'EXPENSE_REDUCTION_RECOMMENDATIONS',
      confidence: 0.92,
    };
  }

  // 6. KNOWLEDGE / RAG QUESTIONS (Accounting definitions & corporate docs)
  if (
    q.includes('what is ebitda') ||
    q.includes('ebitda') ||
    q.includes('explain cash flow') ||
    q.includes('cash-flow forecasting') ||
    q.includes('gross margin') ||
    q.includes('unit economics') ||
    q.includes('what is') ||
    q.includes('define') ||
    q.includes('explain')
  ) {
    return {
      mode: 'KNOWLEDGE_RAG',
      subType: 'CONCEPT_EXPLANATION',
      confidence: 0.88,
    };
  }

  // 7. OUT OF DOMAIN / REFUSAL
  if (
    q.includes("isn't in my database") ||
    q.includes('not in my database') ||
    q.includes('weather') ||
    q.includes('stock market tomorrow') ||
    q.includes('crypto price') ||
    q.includes('write a poem') ||
    q.includes('who won the super bowl')
  ) {
    return {
      mode: 'UNKNOWN_OR_MISSING',
      subType: 'OUT_OF_DOMAIN_REQUEST',
      confidence: 0.99,
    };
  }

  // Default to COMBINED_ANALYSIS with general financial context
  return {
    mode: 'COMBINED_ANALYSIS',
    subType: 'GENERAL_FINANCIAL_QUERY',
    confidence: 0.7,
  };
}
