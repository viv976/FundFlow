# FundFlow — Group 6: Scenario Planning & Risk Intelligence

**Product:** FundFlow (`nuvrag`)
**Phase:** Group 6 — Scenario Planning & Risk Intelligence
**Status:** Complete, Formally Tested & Verified (147/147 Automated Tests Passing)

---

## 1. Executive Summary & Architectural Scope

Group 6 implements **decision-support functionality** based strictly on **deterministic financial models**. It introduces two core capabilities to FundFlow:

1. **Scenario Planner (`lib/finance/scenario-engine.ts`, `app/scenarios/page.tsx`)**:
   - An interactive financial simulation engine that allows founders and operators to model what-if hypotheses (hiring headcount, marketing budgets, infrastructure upgrades, revenue growth trajectories, and operational cost changes).
   - Grounded directly in the company's verified ledger baseline (Cash on Hand, Trailing Net Burn, and Runway).
   - In-memory simulation with zero persistent side-effects on real ledger transactions unless explicitly saved to workspace scenario models.

2. **Risk Intelligence Engine (`lib/finance/risk-engine.ts`, `app/alerts/page.tsx`)**:
   - A multi-vector deterministic audit engine monitoring 7 distinct risk signals evaluated directly against actual transactions.
   - Every alert delivers an authoritative data contract: Severity (`critical`, `warning`, `info`), Title, Explanation, Supporting Data, Affected Period, and Suggested Action.
   - **Honest Detection Labeling**: Clear architectural separation between `DETERMINISTIC DETECTION` (rule-based evaluation on ledger math) and `AI EXPLANATION` (narrative context provided by the Co-Pilot upon request). FundFlow never invents fake "AI anomaly confidence scores" for deterministic rule outputs.

> [!IMPORTANT]
> **RAG Architecture Preservation**: The RAG retrieval pipeline and vector stores were preserved without modification during Group 6.

---

## 2. Feature 1: Scenario Planning Engine

### 2.1 Baseline Derivation
The scenario engine anchors itself to the verified ledger data via `deriveBaselineFromTransactions(transactions, workspace)`:
- **Cash on Hand ($C_{\text{base}}$)**: Derived inception-to-date from verified transactions plus `workspace.starting_cash`.
- **Monthly Revenue ($R_{\text{base}}$)**: Evaluated as the average monthly inflow across the preceding completed months window ($\mathcal{M}_{\text{completed}}$).
- **Monthly Operating Expenses ($E_{\text{base}}$)**: Evaluated as the average monthly outflow across completed months.
- **Monthly Net Burn ($B_{\text{base}}$)**:
  $$B_{\text{base}} = \max(0, E_{\text{base}} - R_{\text{base}})$$
- **Baseline Runway ($Z_{\text{base}}$)**:
  $$Z_{\text{base}} = \begin{cases} 999 \text{ (Cash Flow Positive)}, & \text{if } B_{\text{base}} = 0 \\ \text{round}\left(\frac{C_{\text{base}}}{B_{\text{base}}}, 1\right), & \text{if } B_{\text{base}} > 0 \end{cases}$$

### 2.2 User-Adjustable Scenario Levers
Users adjust 6 explicit levers with immediate explanatory context (no arbitrary hidden assumptions):
1. **General Operating Expenses ($\Delta E_{\text{ops}}$)**: Overhead, software SaaS, office, and legal commitments.
2. **Monthly Revenue Growth Rate ($g_{\text{MoM}}$)**: Compound expansion or contraction percentage in monthly customer receipts.
3. **Incremental Direct Revenue ($\Delta R_{\text{mrr}}$)**: Specific enterprise contract wins or losses.
4. **Hiring Headcount ($N_{\text{hires}}$) & Cost Per Role ($C_{\text{hire}}$)**: Fully-burdened monthly compensation (salary, benefits, taxes). Total hiring impact:
   $$\text{Cost}_{\text{hiring}} = N_{\text{hires}} \times C_{\text{hire}}$$
5. **Marketing & Ads Budget ($\Delta M_{\text{mktg}}$)**: Performance marketing, paid acquisition, and growth campaigns.
6. **Infrastructure & Hosting ($\Delta I_{\text{infra}}$)**: GPU compute, database scaling, vector storage, and hosting tier upgrades.

### 2.3 Mathematical Model & Delta
- **Projected Expenses ($E_{\text{scen}}$)**:
  $$E_{\text{scen}} = \max(0, E_{\text{base}} + \Delta E_{\text{ops}} + \text{Cost}_{\text{hiring}} + \Delta M_{\text{mktg}} + \Delta I_{\text{infra}})$$
- **Projected Revenue ($R_{\text{scen}}$)**:
  $$R_{\text{scen}} = \max\left(0, R_{\text{base}} \times \left(1 + \frac{g_{\text{MoM}}}{100}\right) + \Delta R_{\text{mrr}}\right)$$
- **Projected Net Burn ($B_{\text{scen}}$)**:
  $$B_{\text{scen}} = \max(0, E_{\text{scen}} - R_{\text{scen}})$$
- **Projected Runway ($Z_{\text{scen}}$)**:
  $$Z_{\text{scen}} = \begin{cases} 999, & \text{if } B_{\text{scen}} = 0 \\ \text{round}\left(\frac{C_{\text{base}}}{B_{\text{scen}}}, 1\right), & \text{if } B_{\text{scen}} > 0 \end{cases}$$
- **Variance Deltas**:
  $$\Delta B = B_{\text{scen}} - B_{\text{base}}$$
  $$\Delta Z = Z_{\text{scen}} - Z_{\text{base}}$$

### 2.4 12-Month Deterministic Trajectory
Calculates month-by-month cash balances $m \in \{1 \dots 12\}$:
$$C_{\text{base}, m} = \max\left(0, C_{\text{base}, m-1} + R_{\text{base}} - E_{\text{base}}\right)$$
$$C_{\text{scen}, m} = \max\left(0, C_{\text{scen}, m-1} + R_{\text{scen}} - E_{\text{scen}}\right)$$
Highlights the exact future month where cash will be depleted under each regime.

---

## 3. Feature 2: Risk Intelligence & Anomaly Guardrails

### 3.1 The 7 Deterministic Risk Signals

| Signal Rule ID | Condition | Severity | Affected Period | Suggested Action |
| :--- | :--- | :--- | :--- | :--- |
| `RUNWAY_BELOW_THRESHOLD` | Runway $< 3.0$ mos (critical) or $< 6.0$ mos (warning) | Critical / Warning | Forward Projection | Freeze discretionary hiring; model runway extensions in Scenario Planner. |
| `RAPIDLY_INCREASING_BURN` | Net burn surged $\ge +25\%$ MoM ($\ge \$2,500$ delta) | Critical / Warning | Reporting Anchor $M_0$ | Audit variable departmental spend; run scenario sensitivity tests. |
| `DECREASING_CASH_TRAJECTORY` | Net cash dropped $\ge 15\%$ in period or trailing net deficit | Critical / Warning | Reporting Anchor $M_0$ | Accelerate A/R collections; align vendor payment terms to arrest liquid drain. |
| `REVENUE_DECLINE` | Revenue fell $\ge 15\%$ period-over-period ($\ge \$1,000$ drop) | Critical / Warning | $M_{-2} \rightarrow M_{-1}$ | Investigate churn and pipeline delays; renegotiate renewals. |
| `EXPENSE_CONCENTRATION` | Single category exceeds $50\%$ of monthly spend | Warning / Info | Reporting Anchor $M_0$ | Diversify supplier dependency; secure 3-month category reserves. |
| `UNUSUAL_EXPENSE_SPIKE` | Category spend surged $\ge +30\%$ over trailing average ($\ge \$2,000$ delta) | Warning | Reporting Anchor $M_0$ | Audit recent transactions to establish one-time vs recurring increase. |
| `ABNORMAL_TRANSACTION` | Single debit exceeds $25\%$ of monthly spend ($\ge \$5,000$) | Critical / Warning | Transaction Date | Verify invoice, receipt reconciliation, and executive approval documentation. |

### 3.2 Honest Architectural Distinction
Every generated alert includes:
```ts
{
  id: string,
  ruleId: RiskSignalType,
  detectionMechanism: 'DETERMINISTIC_DETECTION',
  severity: 'critical' | 'warning' | 'info',
  title: string,
  explanation: string,
  supportingData: {
    primaryMetric: string,
    baselineValue?: string | number,
    observedValue?: string | number,
    thresholdValue?: string | number,
    variancePercent?: number,
    affectedAmount?: number,
    evidenceItems?: string[]
  },
  affectedPeriod: string,
  suggestedAction: string,
  status: 'active' | 'acknowledged' | 'dismissed',
  createdAt: string
}
```
- **Detection**: 100% Deterministic Rule-Based Logic. Zero hallucinated probabilities.
- **AI Role**: Narrative explanation and mitigation planning via Ask AI (`/ask-ai?q=Explain deterministic alert...`).

---

## 4. User Interface Implementation

1. **Scenario Planner (`app/scenarios/page.tsx`)**:
   - Primary 3-card comparison: **Authoritative Baseline**, **Simulated Scenario**, and **Deterministic Delta**.
   - Interactive sliders and numeric inputs for all 6 assumption levers.
   - Interactive step-by-step arithmetic **Methodology Accordion**.
   - 12-Month month-by-month trajectory table with status badges (`Funded` vs `Cash Depleted`).
   - "Reset Scenario" button restoring baseline values.
   - "Save Model" modal saving models in-memory / workspace models without touching ledger transactions.

2. **Risk Alerts Feed (`app/alerts/page.tsx`)**:
   - Architecture disclosure banner explaining `DETERMINISTIC DETECTION` vs `AI EXPLANATION`.
   - Filters bar: Status (`all`, `active`, `acknowledged`), Severity (`critical`, `warning`, `info`), and Signal type (7 rules).
   - Alert cards displaying severity badge, rule identifier, period tag, detailed explanation, supporting ledger evidence bullets, and direct actions:
     - `AI Explanation` $\rightarrow$ links to Ask AI with pre-filled prompt.
     - `Model in Scenarios` $\rightarrow$ links directly to Scenario Planner.
     - `Audit Ledger` $\rightarrow$ links directly to Transactions ledger.

3. **Navigation Integration**:
   - `components/layout/Sidebar.tsx`: Added `Scenario Planner` (`/scenarios`) with `query_stats` icon.
   - `lib/store/finance-context.tsx`: Integrated `riskAlerts` and `scenarioBaseline` hooks into global application context.

---

## 5. Verification Matrix & Test Coverage

Automated test suite (`tests/unit/scenario-risk.test.ts` + complete suite):

| Test Suite | Tests | Status | Verification Focus |
| :--- | :--- | :--- | :--- |
| `tests/unit/scenario-risk.test.ts` | 12 | PASS | Baseline calculation, hiring/marketing/infra additions, revenue drops, cash trajectory, 0-tx data, and all 7 risk rules |
| `tests/unit/financial-intelligence.test.ts` | 24 | PASS | Financial health, KPIs, attention items, metric explanation |
| `tests/unit/calculator.test.ts` | 10 | PASS | Cash on hand, net burn, runway |
| `tests/unit/data-pipeline.test.ts` | 30 | PASS | CSV parser, schema validation, normalization |
| `tests/unit/validation.test.ts` | 17 | PASS | Input validation schemas |
| `tests/unit/errors.test.ts` | 7 | PASS | Safe error boundary handling |
| `tests/ai/ai-rag.test.ts` | 36 | PASS | RAG embeddings, intent routing, chunk retrieval |
| `tests/ai/chat-api-auth.test.ts` | 7 | PASS | Security authorization, HydRo baseline consistency |
| `tests/ai/client-chat-auth.test.ts` | 4 | PASS | Bearer token forwarding |
| **Total** | **147** | **100% PASS** | Zero regressions across all 6 groups |

### Verification Commands Run:
1. `npm test` $\rightarrow$ **147 passed (147)**
2. `npx tsc --noEmit` $\rightarrow$ **Exit code 0 (0 errors)**
3. `npm run lint` $\rightarrow$ **Exit code 0 (0 errors)**
4. `npm run build` $\rightarrow$ **Compiled successfully in 749ms (Turbopack, 25/25 routes)**

---

## 6. Summary of Created & Modified Files

- `types/finance.ts`: Added Group 6 Scenario (`ScenarioAssumptions`, `ScenarioBaselineMetrics`, `ScenarioProjectedMetrics`, `ScenarioDeltaMetrics`, `MonthlyTrajectoryPoint`, `ScenarioAnalysisResult`) and Risk Intelligence types (`RiskSignalType`, `RiskAlert`, `RiskAlertSupportingData`).
- `lib/finance/scenario-engine.ts`: Created deterministic scenario calculation engine and baseline derivation.
- `lib/finance/risk-engine.ts`: Created deterministic risk detection engine evaluating all 7 financial signals.
- `lib/finance/index.ts`: Re-exported scenario and risk engines.
- `lib/store/finance-context.tsx`: Added `riskAlerts` and `scenarioBaseline` to global state context.
- `app/scenarios/page.tsx`: Built interactive Scenario Planner interface with live comparisons, sliders, methodology accordion, and trajectory table.
- `app/alerts/page.tsx`: Upgraded alerts feed with deterministic detection badging, supporting data cards, and scenario modeling actions.
- `components/layout/Sidebar.tsx`: Added Scenario Planner navigation link.
- `tests/unit/scenario-risk.test.ts`: Created 12 comprehensive unit tests covering all Group 6 requirements.
- `docs/GROUP_6_SCENARIO_RISK.md`: Created complete phase architectural and operational documentation.
