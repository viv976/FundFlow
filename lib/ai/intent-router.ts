export type AIMode =
  | 'FINANCIAL_DATA'
  | 'KNOWLEDGE_RAG'
  | 'COMBINED_ANALYSIS'
  | 'WHAT_IF_SCENARIO'
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
  };
}

/**
 * Classify user question into grounded query modes
 */
export function classifyFinancialIntent(userQuery: string): ClassifiedIntent {
  const q = userQuery.toLowerCase().trim();

  // 1. WHAT-IF SCENARIO CHECK
  if (
    q.includes('what if') ||
    q.includes('simulate') ||
    q.includes('hire') ||
    q.includes('hiring') ||
    q.includes('salary') ||
    q.includes('headcount')
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

  // 2. FINANCIAL DATA QUESTIONS (MODE 1)
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

  // Highest / Top Category
  if (
    q.includes('highest') ||
    q.includes('top category') ||
    q.includes('largest expense') ||
    q.includes('most expensive') ||
    q.includes('costs me the most')
  ) {
    return {
      mode: 'FINANCIAL_DATA',
      subType: 'TOP_EXPENSE_CATEGORY',
      confidence: 0.95,
    };
  }

  // MoM / Period Comparison
  if (
    q.includes('compare') ||
    q.includes('month over month') ||
    q.includes('mom') ||
    (q.includes('last month') && q.includes('this month'))
  ) {
    return {
      mode: 'FINANCIAL_DATA',
      subType: 'MOM_COMPARISON',
      confidence: 0.9,
    };
  }

  // 3. COMBINED ANALYSIS QUESTIONS (MODE 3)
  if (
    q.includes('why did') ||
    q.includes('what is causing') ||
    q.includes('why are') ||
    q.includes('what should i do') ||
    q.includes('how can i reduce') ||
    q.includes('reduce expenses') ||
    q.includes('improve cash flow') ||
    q.includes('what should i focus on')
  ) {
    return {
      mode: 'COMBINED_ANALYSIS',
      subType: q.includes('reduce') || q.includes('focus') ? 'EXPENSE_REDUCTION_RECOMMENDATIONS' : 'ROOT_CAUSE_ANALYSIS',
      confidence: 0.9,
    };
  }

  // 4. KNOWLEDGE / RAG QUESTIONS (MODE 2)
  if (
    q.includes('what is ebitda') ||
    q.includes('ebitda') ||
    q.includes('explain cash flow') ||
    q.includes('cash-flow forecasting') ||
    q.includes('gross margin') ||
    q.includes('unit economics') ||
    q.includes('what is') ||
    q.includes('explain') ||
    q.includes('define')
  ) {
    return {
      mode: 'KNOWLEDGE_RAG',
      subType: 'CONCEPT_EXPLANATION',
      confidence: 0.9,
    };
  }

  // 5. UNKNOWN / MISSING / OUT OF DOMAIN
  if (
    q.includes("isn't in my database") ||
    q.includes('not in my database') ||
    q.includes('invent') ||
    q.includes('weather') ||
    q.includes('stock market tomorrow')
  ) {
    return {
      mode: 'UNKNOWN_OR_MISSING',
      subType: 'OUT_OF_DOMAIN_REQUEST',
      confidence: 0.99,
    };
  }

  // Default to COMBINED_ANALYSIS with general search
  return {
    mode: 'COMBINED_ANALYSIS',
    subType: 'GENERAL_FINANCIAL_QUERY',
    confidence: 0.7,
  };
}
