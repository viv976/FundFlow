/**
 * Deterministic Grounded Financial Co-Pilot Engine
 * Generates typed, authoritative responses with strict grounding, source attribution,
 * step-by-step calculation formulas, and zero hallucination.
 */

import { AICitation } from '@/types/finance';
import { ClassifiedIntent } from './intent-router';
import { StructuredFinancialContext } from './financial-context';
import { RAGRetrievalOutput } from './rag-engine';
import { calculateWhatIfScenario, formatCurrency } from '@/lib/finance/calculator';

export interface StructuredCoPilotResponse {
  answer: string;
  keyPoints: string[];
  evidence: string[];
  sources: AICitation[];
  limitations?: string;
  grounded: boolean;
  groundingConfidence: number;
  detectedIntent: string;
  scenario?: {
    name: string;
    beforeRunway: number;
    afterRunway: number;
    monthlyImpact: number;
    assumptions: string[];
  };
}

/**
 * Deterministic response generator grounded strictly in verified ledger and knowledge context
 */
export function generateDeterministicCopilotResponse(
  intent: ClassifiedIntent,
  financialContext: StructuredFinancialContext,
  ragOutput: RAGRetrievalOutput
): StructuredCoPilotResponse {
  const currency = financialContext.workspace.currency;
  const wsName = financialContext.workspace.name;

  // =========================================================================
  // 1. EXPLAIN FINANCIAL CALCULATIONS (Requirement 9)
  // =========================================================================
  if (intent.mode === 'EXPLAIN_CALCULATION') {
    const metric = intent.extractedParameters?.metric || 'runway';
    let explanation = financialContext.metricExplanations.runwayExplanation;

    if (metric === 'burn') explanation = financialContext.metricExplanations.burnExplanation;
    else if (metric === 'cash') explanation = financialContext.metricExplanations.cashExplanation;
    else if (metric === 'growth') explanation = financialContext.metricExplanations.growthExplanation;

    const answer = `### How ${explanation.title} is Calculated for ${wsName}\n\n**Deterministic Formula:**\n\`${explanation.formula}\`\n\n**Methodology & Logic:**\n${explanation.methodology}\n\n**Active Values:**\n${explanation.formulaSteps.map((s) => `* **${s.label}:** \`${s.value}\`${s.operation ? ` (${s.operation})` : ''}`).join('\n')}\n\n* **Final Result:** \`${explanation.currentDisplay}\``;

    return {
      answer,
      keyPoints: [
        `Formula: ${explanation.formula}`,
        `Current Result: ${explanation.currentDisplay}`,
        explanation.methodology,
      ],
      evidence: explanation.formulaSteps.map((s) => `${s.label} = ${s.value}`),
      sources: [
        {
          id: `cite-explain-${metric}`,
          type: 'calculation',
          label: `${explanation.title}: ${explanation.currentDisplay}`,
          details: explanation.formula,
        },
      ],
      limitations: !explanation.hasSufficientData
        ? 'Calculations require at least 1 completed historical calendar month for trailing averages.'
        : undefined,
      grounded: true,
      groundingConfidence: 1.0,
      detectedIntent: `EXPLAIN_CALCULATION:${metric.toUpperCase()}`,
    };
  }

  // =========================================================================
  // 2. WHY DID BURN INCREASE THIS MONTH? (Requirement 8)
  // =========================================================================
  if (intent.subType === 'BURN_INCREASE_ANALYSIS') {
    const burnChange = financialContext.trends.burnChange;
    const sources: AICitation[] = [
      {
        id: 'cite-burn',
        type: 'financial_snapshot',
        label: `Trailing Net Burn: ${financialContext.burn.formatted}`,
        amount: financialContext.burn.monthlyNetBurn,
      },
    ];

    if (!financialContext.trends.anchorMonth) {
      return {
        answer: `There are no recorded transactions in **${wsName}** yet to analyze monthly burn changes. Please import or record transactions to establish a baseline.`,
        keyPoints: ['No ledger transactions found'],
        evidence: ['0 recorded transactions'],
        sources: [],
        limitations: 'Insufficient data: Ledger is empty.',
        grounded: true,
        groundingConfidence: 0.1,
        detectedIntent: 'COMBINED_ANALYSIS:BURN_INCREASE_ANALYSIS',
      };
    }

    if (!burnChange.didIncrease) {
      const answer = `### Monthly Burn Analysis for ${wsName}\n\nBased on verified ledger records for **${financialContext.trends.anchorMonth}**, your net cash deficit did **not** increase compared to your trailing completed baseline.\n\n* **Current Trailing Net Burn:** \`${financialContext.burn.formatted}\`\n* **Current Month Deficit:** \`${currency} ${Math.max(0, financialContext.trends.burnChange.burnDelta + financialContext.burn.monthlyNetBurn).toLocaleString()}/mo\`\n* **Status:** Burn remains steady or contracted relative to historical completed months.`;

      return {
        answer,
        keyPoints: [
          'Net burn did not increase relative to trailing baseline',
          `Trailing net burn: ${financialContext.burn.formatted}`,
        ],
        evidence: [
          `Trailing baseline: ${financialContext.burn.formatted}`,
          `Calculated across completed months: ${financialContext.trends.completedMonths.join(', ') || 'N/A'}`,
        ],
        sources,
        grounded: true,
        groundingConfidence: 0.95,
        detectedIntent: 'COMBINED_ANALYSIS:BURN_INCREASE_ANALYSIS',
      };
    }

    const driverLines = burnChange.primaryCategoryDrivers.slice(0, 3).map((d) => {
      sources.push({
        id: `cite-driver-${d.category.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'category_breakdown',
        label: `${d.category}: +${formatCurrency(d.delta, currency)} increase`,
        amount: d.current,
      });
      return `* **${d.category}:** Spent \`${formatCurrency(d.current, currency)}\` (Up \`+${formatCurrency(d.delta, currency)}\` vs trailing average of \`${formatCurrency(d.prior, currency)}\`)`;
    });

    const answer = `### Burn Increase Root Cause for ${wsName}\n\nIn **${financialContext.trends.anchorMonth}**, monthly net burn increased by **\`+${formatCurrency(burnChange.burnDelta, currency)}/mo\`** (${burnChange.burnDeltaPercent ? `+${burnChange.burnDeltaPercent}%` : 'first period'}) relative to your trailing average of \`${financialContext.burn.formatted}\`.\n\n**Primary Category Drivers:**\n${driverLines.length > 0 ? driverLines.join('\n') : '* Outflows were distributed across multiple operational categories.'}\n\n> [!NOTE]\n> Calculated deterministically by comparing active month expenses against trailing completed month averages.`;

    return {
      answer,
      keyPoints: [
        `Net burn increased by +${formatCurrency(burnChange.burnDelta, currency)}/mo`,
        `Top driver: ${burnChange.primaryCategoryDrivers[0]?.category || 'Multiple operational expenses'}`,
      ],
      evidence: burnChange.primaryCategoryDrivers.map(
        (d) => `${d.category} grew from ${formatCurrency(d.prior, currency)} to ${formatCurrency(d.current, currency)} (+${formatCurrency(d.delta, currency)})`
      ),
      sources,
      grounded: true,
      groundingConfidence: 0.97,
      detectedIntent: 'COMBINED_ANALYSIS:BURN_INCREASE_ANALYSIS',
    };
  }

  // =========================================================================
  // 3. WHAT ARE OUR LARGEST EXPENSES? (Requirement 8)
  // =========================================================================
  if (intent.subType === 'LARGEST_EXPENSES') {
    const cats = financialContext.categories.breakdown;
    const outflows = financialContext.transactions.largestOutflows;

    if (cats.length === 0) {
      return {
        answer: `No expense records have been recorded for **${wsName}** yet.`,
        keyPoints: ['No expenses in ledger'],
        evidence: [],
        sources: [],
        limitations: 'Ledger has no expense transactions.',
        grounded: true,
        groundingConfidence: 0.2,
        detectedIntent: 'FINANCIAL_DATA:LARGEST_EXPENSES',
      };
    }

    const sources: AICitation[] = cats.slice(0, 3).map((c) => ({
      id: `cite-cat-${c.category.toLowerCase().replace(/\s+/g, '-')}`,
      type: 'category_breakdown',
      label: `${c.category}: ${formatCurrency(c.amount, currency)} (${c.percentage}%)`,
      amount: c.amount,
    }));

    const catLines = cats.slice(0, 4).map(
      (c) => `* **${c.category}:** \`${formatCurrency(c.amount, currency)}\` (\`${c.percentage}%\` of total spend across ${c.transactionCount} entries)`
    );

    const txLines = outflows.slice(0, 3).map(
      (t) => `* **${t.merchant || t.description}** (\`${t.category}\`): \`${formatCurrency(t.amount, currency)}\` on ${t.date}`
    );

    const answer = `### Largest Expenses Summary for ${wsName}\n\n**Top Operating Expense Categories:**\n${catLines.join('\n')}\n\n**Largest Individual Outflow Transactions:**\n${txLines.join('\n')}`;

    return {
      answer,
      keyPoints: [
        `Highest expense category: ${cats[0]?.category} (${formatCurrency(cats[0]?.amount || 0, currency)})`,
        `Top 3 categories represent ${cats.slice(0, 3).reduce((sum, c) => sum + c.percentage, 0).toFixed(1)}% of total burn`,
      ],
      evidence: cats.slice(0, 3).map((c) => `${c.category}: ${formatCurrency(c.amount, currency)} (${c.percentage}%)`),
      sources,
      grounded: true,
      groundingConfidence: 0.98,
      detectedIntent: 'FINANCIAL_DATA:LARGEST_EXPENSES',
    };
  }

  // =========================================================================
  // 4. WHAT CAUSED THE BIGGEST CASH OUTFLOWS? (Requirement 8)
  // =========================================================================
  if (intent.subType === 'BIGGEST_CASH_OUTFLOWS') {
    const outflows = financialContext.transactions.largestOutflows;

    if (outflows.length === 0) {
      return {
        answer: `No cash outflow transactions were found in **${wsName}**.`,
        keyPoints: ['No expense transactions found'],
        evidence: [],
        sources: [],
        limitations: 'Ledger has no expense records.',
        grounded: true,
        groundingConfidence: 0.1,
        detectedIntent: 'FINANCIAL_DATA:BIGGEST_CASH_OUTFLOWS',
      };
    }

    const sources: AICitation[] = outflows.map((t) => ({
      id: `cite-tx-${t.id}`,
      type: 'transaction',
      label: `${t.merchant || t.description}: ${formatCurrency(t.amount, currency)}`,
      amount: t.amount,
      date_range: t.date,
      details: `Category: ${t.category}`,
    }));

    const rows = outflows.map(
      (t, idx) => `| ${idx + 1} | **${t.merchant || t.description}** | \`${t.category}\` | **\`${formatCurrency(t.amount, currency)}\`** | ${t.date} |`
    );

    const answer = `### Largest Cash Outflows for ${wsName}\n\nThe following verified transactions caused the largest reductions in cash balance:\n\n| # | Merchant / Description | Category | Amount | Date |\n| :--- | :--- | :--- | :--- | :--- |\n${rows.join('\n')}\n\n> [!NOTE]\n> Filtered deterministically from ${financialContext.transactions.totalCount} ledger entries.`;

    return {
      answer,
      keyPoints: outflows.map((t) => `${t.merchant || t.description} (${t.category}): ${formatCurrency(t.amount, currency)} on ${t.date}`),
      evidence: outflows.map((t) => `${t.description}: ${currency} ${t.amount} on ${t.date}`),
      sources,
      grounded: true,
      groundingConfidence: 0.99,
      detectedIntent: 'FINANCIAL_DATA:BIGGEST_CASH_OUTFLOWS',
    };
  }

  // =========================================================================
  // 5. WHICH EXPENSES GREW FASTEST? (Requirement 8)
  // =========================================================================
  if (intent.subType === 'FASTEST_GROWING_EXPENSES') {
    const fastest = financialContext.categories.fastestGrowingCategory;
    const comparisons = financialContext.categories.categoryComparisons;

    if (financialContext.trends.completedMonths.length < 2) {
      return {
        answer: `Determining which expenses grew fastest requires at least **2 completed historical calendar months** of transaction records. Currently, ${wsName} has ${financialContext.trends.completedMonths.length} completed month(s). Once two months of transactions are recorded, FundFlow will automatically calculate category-by-category growth rates.`,
        keyPoints: ['Insufficient historical months for MoM category growth'],
        evidence: [`Completed months count: ${financialContext.trends.completedMonths.length}`],
        sources: [],
        limitations: 'Requires at least 2 distinct completed calendar months.',
        grounded: true,
        groundingConfidence: 0.3,
        detectedIntent: 'FINANCIAL_DATA:FASTEST_GROWING_EXPENSES',
      };
    }

    if (!fastest) {
      return {
        answer: `Comparing categories between **${financialContext.trends.completedMonths[0]}** and **${financialContext.trends.completedMonths[1]}** did not identify any category with significant expansion. Spending across categories remained flat or contracted.`,
        keyPoints: ['No significant category growth observed between completed periods'],
        evidence: comparisons.map((c) => `${c.category}: ${c.growthPercent ?? 0}% growth`),
        sources: [],
        grounded: true,
        groundingConfidence: 0.92,
        detectedIntent: 'FINANCIAL_DATA:FASTEST_GROWING_EXPENSES',
      };
    }

    const sources: AICitation[] = [
      {
        id: `cite-fastest-${fastest.category.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'category_breakdown',
        label: `${fastest.category}: +${fastest.growthPercent}% growth`,
        amount: fastest.currentAmount,
      },
    ];

    const lines = comparisons
      .filter((c) => (c.growthPercent ?? 0) > 0)
      .slice(0, 4)
      .map(
        (c) => `* **${c.category}:** grew **\`+${c.growthPercent}%\`** (from \`${formatCurrency(c.priorAmount, currency)}\` to \`${formatCurrency(c.currentAmount, currency)}\`, delta: \`+${formatCurrency(c.delta, currency)}\`)`
      );

    const answer = `### Fastest Growing Expense Categories for ${wsName}\n\nComparing **${financialContext.trends.completedMonths[0]}** vs **${financialContext.trends.completedMonths[1]}**:\n\n* **Fastest Growing Category:** **${fastest.category}** (+${fastest.growthPercent}%)\n\n**Category Growth Breakdown:**\n${lines.join('\n')}\n\n> [!NOTE]\n> Calculated strictly between trailing completed calendar months.`;

    return {
      answer,
      keyPoints: [
        `Fastest growing category: ${fastest.category} (+${fastest.growthPercent}%)`,
        `Increased by +${formatCurrency(fastest.delta, currency)} month-over-month`,
      ],
      evidence: comparisons.map((c) => `${c.category}: ${formatCurrency(c.priorAmount, currency)} -> ${formatCurrency(c.currentAmount, currency)} (+${c.growthPercent ?? 0}%)`),
      sources,
      grounded: true,
      groundingConfidence: 0.96,
      detectedIntent: 'FINANCIAL_DATA:FASTEST_GROWING_EXPENSES',
    };
  }

  // =========================================================================
  // 6. HOW LONG IS OUR RUNWAY? (Requirement 8)
  // =========================================================================
  if (intent.subType === 'RUNWAY_QUERY') {
    const runway = financialContext.runway;
    const cash = financialContext.cash;
    const burn = financialContext.burn;

    const sources: AICitation[] = [
      {
        id: 'cite-cash',
        type: 'financial_snapshot',
        label: `Cash: ${cash.formatted}`,
        amount: cash.current,
      },
      {
        id: 'cite-burn',
        type: 'financial_snapshot',
        label: `Net Burn: ${burn.formatted}`,
        amount: burn.monthlyNetBurn,
      },
      {
        id: 'cite-runway',
        type: 'financial_snapshot',
        label: `Runway: ${runway.display}`,
      },
    ];

    let statusAlert = '> [!NOTE]\n> Runway is nominal and within standard operational parameters.';
    if (runway.status === 'profitable') {
      statusAlert = '> [!TIP]\n> **Operating Profitability:** Your business is currently cash-flow positive. Inflows cover or exceed operational outflows.';
    } else if (runway.status === 'critical') {
      statusAlert = '> [!CAUTION]\n> **Critical Runway Alert:** Runway is under 3 months. Immediate expenditure controls or capital injection required.';
    } else if (runway.status === 'warning') {
      statusAlert = '> [!WARNING]\n> **Runway Warning:** Runway is below 6 months. Review 90-day discretionary spend.';
    }

    const answer = `### Estimated Runway for ${wsName}\n\n* **Estimated Runway:** **\`${runway.display}\`**\n* **Cash on Hand:** \`${cash.formatted}\`\n* **Average Monthly Net Burn:** \`${burn.formatted}\`\n* **Calculation Methodology:** ${burn.methodology}\n\n${statusAlert}`;

    return {
      answer,
      keyPoints: [
        `Estimated Runway: ${runway.display}`,
        `Cash on hand: ${cash.formatted}`,
        `Monthly net burn: ${burn.formatted}`,
      ],
      evidence: [
        `Cash balance: ${cash.formatted}`,
        `Net burn: ${burn.formatted}`,
        `Formula: Cash / Net Burn = ${runway.display}`,
      ],
      sources,
      grounded: true,
      groundingConfidence: 0.99,
      detectedIntent: 'FINANCIAL_DATA:RUNWAY_QUERY',
    };
  }

  // =========================================================================
  // 7. WHAT CHANGED COMPARED WITH LAST MONTH? (Requirement 8)
  // =========================================================================
  if (intent.subType === 'MOM_COMPARISON') {
    const mom = financialContext.growth;
    const completed = financialContext.trends.completedMonths;

    if (completed.length < 2) {
      return {
        answer: `Month-over-month comparison requires at least **2 completed calendar months** of ledger data. Currently, ${wsName} has ${completed.length} completed month(s). Once two months of transactions are recorded, FundFlow will automatically calculate revenue and burn shifts.`,
        keyPoints: ['Insufficient historical completed months for MoM comparison'],
        evidence: [`Completed months count: ${completed.length}`],
        sources: [],
        limitations: 'Requires at least 2 completed calendar months.',
        grounded: true,
        groundingConfidence: 0.3,
        detectedIntent: 'FINANCIAL_DATA:MOM_COMPARISON',
      };
    }

    const mLatest = completed[0];
    const mPrior = completed[1];

    const sources: AICitation[] = [
      {
        id: 'cite-growth',
        type: 'financial_snapshot',
        label: `MoM Revenue Growth: ${mom.formatted}`,
      },
    ];

    const answer = `### Month-over-Month Comparison (${mLatest} vs ${mPrior}) for ${wsName}\n\n* **Comparison Period:** ${mLatest} (latest completed) vs ${mPrior} (prior completed)\n* **Revenue Trend:** ${mom.formatted}\n* **Active Trailing Net Burn:** \`${financialContext.burn.formatted}\`\n* **Cash on Hand:** \`${financialContext.cash.formatted}\``;

    return {
      answer,
      keyPoints: [
        `Comparison between ${mLatest} and ${mPrior}`,
        `Revenue growth: ${mom.formatted}`,
        `Net burn: ${financialContext.burn.formatted}`,
      ],
      evidence: [
        `Reporting completed window: ${completed.join(', ')}`,
        `Revenue status: ${mom.status}`,
      ],
      sources,
      grounded: true,
      groundingConfidence: 0.95,
      detectedIntent: 'FINANCIAL_DATA:MOM_COMPARISON',
    };
  }

  // =========================================================================
  // 8. SHOW UNUSUAL SPENDING (Requirement 8)
  // =========================================================================
  if (intent.subType === 'UNUSUAL_SPENDING') {
    const items = financialContext.trends.unusualSpending;

    if (items.length === 0) {
      return {
        answer: `### Unusual Spending Analysis for ${wsName}\n\nNo unusual spending anomalies, abnormal expense spikes (>30%), or severe runway contractions were detected in your ledger. All categorized expenditures fall within nominal operational thresholds.`,
        keyPoints: ['No unusual spending detected', 'All expenditures within normal operational variance'],
        evidence: ['Attention detector evaluated 5 risk rules with 0 active alerts'],
        sources: [],
        grounded: true,
        groundingConfidence: 0.98,
        detectedIntent: 'FINANCIAL_DATA:UNUSUAL_SPENDING',
      };
    }

    const sources: AICitation[] = items.map((item) => ({
      id: `cite-attn-${item.id}`,
      type: 'alert',
      label: `${item.title}: ${item.supportingMetric}`,
      details: item.detectedIssue,
    }));

    const lines = items.map((item) => {
      const icon = item.severity === 'critical' ? '🔴' : item.severity === 'warning' ? '🟡' : 'ℹ️';
      return `${icon} **${item.title}** (${item.supportingMetric})\n  * *Issue:* ${item.detectedIssue}\n  * *Action:* ${item.suggestedAction}`;
    });

    const answer = `### Unusual Spending & Risk Items for ${wsName}\n\nThe following financial risk items and expenditure anomalies were detected by FundFlow's deterministic risk engine:\n\n${lines.join('\n\n')}`;

    return {
      answer,
      keyPoints: items.map((i) => `${i.title}: ${i.supportingMetric}`),
      evidence: items.map((i) => i.detectedIssue),
      sources,
      grounded: true,
      groundingConfidence: 0.98,
      detectedIntent: 'FINANCIAL_DATA:UNUSUAL_SPENDING',
    };
  }

  // =========================================================================
  // 9. KNOWLEDGE BASE & FINANCIAL PLAN HIRING (Requirement 8, 2, 4, 5)
  // =========================================================================
  if (intent.mode === 'KNOWLEDGE_RAG' || intent.subType === 'FINANCIAL_PLAN_HIRING') {
    if (!ragOutput.hasSufficientEvidence || ragOutput.matches.length === 0) {
      const isHiring = intent.subType === 'FINANCIAL_PLAN_HIRING';
      const missingDetail = isHiring
        ? `FundFlow's knowledge base does not contain a financial plan, hiring roadmap, or budget policy for **${wsName}**.`
        : `I don't have enough reliable data in FundFlow's knowledge base to answer that.`;

      return {
        answer: `${missingDetail}\n\nTo answer this question accurately without hallucinating, please upload your relevant business plan, hiring policy, or corporate context document under [Knowledge Base](/documents).`,
        keyPoints: ['Insufficient knowledge base documentation'],
        evidence: ['No semantic document chunks matched query above similarity threshold'],
        sources: [],
        limitations: 'Grounding prerequisite not satisfied: Workspace knowledge base lacks matching source documents.',
        grounded: false,
        groundingConfidence: 0.05,
        detectedIntent: 'KNOWLEDGE_RAG:INSUFFICIENT_EVIDENCE',
      };
    }

    const topMatch = ragOutput.matches[0];
    const citations: AICitation[] = ragOutput.matches.map((m) => ({
      id: `cite-${m.chunkId}`,
      type: 'knowledge_document',
      label: `${m.documentTitle} (Relevance: ${(m.score * 100).toFixed(0)}%)`,
      details: `Source: ${m.source || 'Knowledge Base'} • Score: ${(m.score * 100).toFixed(0)}%`,
    }));

    const answer = `### Grounded Knowledge Retrieval for ${wsName}\n\n**${topMatch.documentTitle}**:\n${topMatch.content}\n\n**Supporting Sources & Citations:**\n${ragOutput.matches.map((m) => `* **${m.documentTitle}** — *"${m.content.substring(0, 110)}..."* (Relevance: \`${(m.score * 100).toFixed(0)}%\`)`).join('\n')}`;

    return {
      answer,
      keyPoints: [
        `Grounded in document: ${topMatch.documentTitle}`,
        `Relevance score: ${(topMatch.score * 100).toFixed(0)}%`,
      ],
      evidence: ragOutput.matches.map((m) => `${m.documentTitle}: ${m.content.substring(0, 100)}...`),
      sources: citations,
      grounded: true,
      groundingConfidence: topMatch.score,
      detectedIntent: `KNOWLEDGE_RAG:${intent.subType}`,
    };
  }

  // =========================================================================
  // 10. WHAT-IF SCENARIOS (Deterministic Hiring Simulation)
  // =========================================================================
  if (intent.mode === 'WHAT_IF_SCENARIO') {
    const headcount = intent.extractedParameters?.headcount || 2;
    const salary = intent.extractedParameters?.salary || 80000;
    const monthlyCostPerHire = Math.round(salary / 12);
    const totalMonthlyNewBurn = monthlyCostPerHire * headcount;

    const currentCash = financialContext.cash.current;
    const currentBurn = Math.max(1, financialContext.burn.monthlyNetBurn);

    const sim = calculateWhatIfScenario(
      currentCash,
      currentBurn,
      totalMonthlyNewBurn,
      0,
      `Hiring ${headcount} person(s)`,
      currency
    );

    const sources: AICitation[] = [
      {
        id: 'cite-sim-cash',
        type: 'financial_snapshot',
        label: `Current Cash: ${formatCurrency(currentCash, currency)}`,
        amount: currentCash,
      },
      {
        id: 'cite-sim-burn',
        type: 'financial_snapshot',
        label: `Simulated Burn: ${formatCurrency(sim.newMonthlyBurn, currency)}/mo`,
        amount: sim.newMonthlyBurn,
      },
      {
        id: 'cite-sim-runway',
        type: 'financial_snapshot',
        label: `Simulated Runway: ${sim.projectedRunway} Months`,
      },
    ];

    const answer = `### Deterministic Hiring Scenario Simulation for ${wsName}\n\n| Financial Metric | Baseline | Simulated Scenario | Delta Impact |\n| :--- | :--- | :--- | :--- |\n| **New Headcount** | 0 | **+${headcount} Engineers/Staff** | +${headcount} |\n| **Annual Salary / Hire** | — | **${currency} ${salary.toLocaleString()}** | — |\n| **Monthly Burn Rate** | \`${formatCurrency(sim.currentMonthlyBurn, currency)}/mo\` | **\`${formatCurrency(sim.newMonthlyBurn, currency)}/mo\`** | \`+${formatCurrency(sim.monthlyCostImpact, currency)}/mo\` |\n| **Cash Runway** | \`${sim.currentRunway} Months\` | **\`${sim.projectedRunway} Months\`** | **\`${sim.differenceMonths} Months\`** |\n\n> [!WARNING]\n> Adding **${headcount} hire(s)** at **${currency} ${salary.toLocaleString()}/yr** increases monthly burn by **\`${formatCurrency(sim.monthlyCostImpact, currency)}/mo\`**, compressing cash runway by **\`${Math.abs(sim.differenceMonths)} months\`**.`;

    return {
      answer,
      keyPoints: [
        `Simulated Burn: ${formatCurrency(sim.newMonthlyBurn, currency)}/mo (+${formatCurrency(sim.monthlyCostImpact, currency)}/mo)`,
        `Projected Runway: ${sim.projectedRunway} Months (${sim.differenceMonths} months delta)`,
      ],
      evidence: [
        `Baseline Cash: ${formatCurrency(currentCash, currency)}`,
        `Baseline Net Burn: ${formatCurrency(currentBurn, currency)}/mo`,
        `New monthly cost: +${formatCurrency(sim.monthlyCostImpact, currency)}/mo`,
      ],
      sources,
      grounded: true,
      groundingConfidence: 0.99,
      detectedIntent: 'WHAT_IF_SCENARIO:HIRING_SIMULATION',
      scenario: {
        name: `Hiring ${headcount} person(s)`,
        beforeRunway: sim.currentRunway,
        afterRunway: sim.projectedRunway,
        monthlyImpact: sim.monthlyCostImpact,
        assumptions: sim.assumptions,
      },
    };
  }

  // =========================================================================
  // 11. STANDARD FINANCIAL DATA: SPEND OR REVENUE
  // =========================================================================
  if (intent.subType === 'TOTAL_SPEND') {
    const cats = financialContext.categories.breakdown;
    const totalExp = cats.reduce((sum, c) => sum + c.amount, 0);

    const sources: AICitation[] = [
      {
        id: 'cite-spend',
        type: 'financial_snapshot',
        label: `Total Spend: ${formatCurrency(totalExp, currency)}`,
        amount: totalExp,
      },
    ];

    const answer = `### Verified Spend Summary for ${wsName}\n\n* **Total Operating Expenses:** \`${formatCurrency(totalExp, currency)}\`\n* **Recorded Outflows:** ${financialContext.transactions.activeCount} verified ledger entries\n* **Average Net Monthly Burn:** \`${financialContext.burn.formatted}\`\n\n> [!NOTE]\n> Calculated deterministically across all verified expense entries.`;

    return {
      answer,
      keyPoints: [
        `Total Operating Expenses: ${formatCurrency(totalExp, currency)}`,
        `Net Monthly Burn: ${financialContext.burn.formatted}`,
      ],
      evidence: [`${financialContext.transactions.activeCount} active ledger entries evaluated`],
      sources,
      grounded: true,
      groundingConfidence: 0.99,
      detectedIntent: 'FINANCIAL_DATA:TOTAL_SPEND',
    };
  }

  if (intent.subType === 'TOTAL_REVENUE') {
    const rev = financialContext.revenue;
    const sources: AICitation[] = [
      {
        id: 'cite-revenue',
        type: 'financial_snapshot',
        label: `Total Revenue: ${rev.formatted}`,
        amount: rev.totalRecorded,
      },
    ];

    const answer = `### Verified Revenue Summary for ${wsName}\n\n* **Total Inflow / Revenue:** \`${rev.formatted}\`\n* **MoM Revenue Velocity:** ${financialContext.growth.formatted}\n* **Cash Balance Impact:** Supports current cash reserve of \`${financialContext.cash.formatted}\``;

    return {
      answer,
      keyPoints: [
        `Total Revenue: ${rev.formatted}`,
        `MoM Velocity: ${financialContext.growth.formatted}`,
      ],
      evidence: [`Total recorded revenue: ${rev.formatted}`],
      sources,
      grounded: true,
      groundingConfidence: 0.99,
      detectedIntent: 'FINANCIAL_DATA:TOTAL_REVENUE',
    };
  }

  // =========================================================================
  // 12. OUT OF DOMAIN / REFUSAL (Strict Grounding Barrier)
  // =========================================================================
  return {
    answer: `I don't have enough reliable data in FundFlow to answer that.\n\nAs a **strictly grounded corporate financial co-pilot**, I only provide answers verified by your **transactions ledger**, **monthly financial summaries**, and **knowledge documents** for **${wsName}**.\n\nTo help me assist you, please ask a question regarding:\n* Your current spend, revenue, or runway\n* Why burn increased or what caused largest cash outflows\n* Which expenses grew fastest or unusual spending\n* What-if hiring simulations\n* How specific financial metrics (runway, burn, cash) are calculated\n* Accounting principles (EBITDA, gross margin, cash-flow forecasting)`,
    keyPoints: [
      'Question is outside verified financial ledger or knowledge base domain',
      'Refusal issued in compliance with zero-hallucination governance',
    ],
    evidence: [],
    sources: [],
    limitations: 'Question is outside domain of corporate ledger and stored documents.',
    grounded: false,
    groundingConfidence: 0.0,
    detectedIntent: 'UNKNOWN_OR_MISSING:REFUSAL',
  };
}
