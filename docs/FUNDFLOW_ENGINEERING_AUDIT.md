# FundFlow — Engineering & Architectural Audit

**Repository:** FundFlow (Internal name: `nuvrag`)  
**Product:** Financial Co-Pilot for Startups  
**Audit Date:** September 2026 (Analyzed against codebase snapshot)  
**Status:** Reconnaissance & Architectural Analysis Complete — Read-Only Mode  

---

## Executive Summary

FundFlow is a web application designed as a financial intelligence co-pilot for startups, founders, and finance operators. Its primary functionality spans:
1. Runway and burn tracking based on transaction ledger data
2. Multi-tenant workspace management
3. CSV file upload and rule-based transaction auto-categorization
4. Deterministic scenario modeling (e.g. headcount hiring impact)
5. Rule-based financial Q&A and document retrieval

This audit was conducted entirely through static analysis, code inspection, and read-only diagnostics across all frontend routes, backend microservices, SQL schema definitions, TypeScript types, calculation engines, and mock data sources.

Every finding below is labeled with one of the following verification tags:
- `[VERIFIED FROM CODE]`: Direct observation from repository source code, scripts, or configuration files.
- `[INFERRED]`: High-probability architectural conclusion derived from multiple code references, naming patterns, or industry standards.
- `[UNKNOWN / REQUIRES VERIFICATION]`: Needs live runtime inspection, external infrastructure access (e.g. live Supabase dashboard or Gemini API project), or explicit founder decision.

---

## 1. Current Architecture

### 1.1 Dual-Stack Structure `[VERIFIED FROM CODE]`
The repository contains two distinct server environments:
1. **Next.js 16 Full-Stack Application (`app/`, `components/`, `lib/`, `types/`)**:
   - **Framework**: Next.js `16.3.3` (App Router), React `19.2.8`, React DOM `19.2.8`.
   - **Styling**: Tailwind CSS `^4.0.0` with `@tailwindcss/postcss`.
   - **Database Client**: `@supabase/supabase-js` `^2.112.4`, `@supabase/ssr` `^0.12.5`, `@supabase/server` `^1.4.1`.
   - **CSV Parsing**: PapaParse `5.7.0` with `@types/papaparse` `^5.5.2`.
   - **Icons**: Material Symbols Outlined loaded via Google Fonts CDN in `app/layout.tsx`.
   - **Fonts**: Inter and JetBrains Mono loaded via Google Fonts CDN in `app/layout.tsx`.
2. **Python FastAPI Microservice (`backend/main.py`, `requirements.txt`)**:
   - **Framework**: FastAPI `>=0.110.0`, Uvicorn `>=0.28.0`, Pydantic `>=2.6.0`.
   - **Declared (Unused) Dependencies**: `google-generativeai>=0.8.0`, `google-genai>=1.47.0`, `pandas>=2.2.0`, `numpy>=1.26.0`, `requests>=2.31.0`.
   - **Current Role**: Operates as a completely detached standalone microservice on port 8000. It queries Supabase directly via raw PostgREST HTTP calls using `requests`.

### 1.2 Frontend-to-Backend Connectivity `[VERIFIED FROM CODE]`
- **Observation**: The Next.js frontend **never makes HTTP requests to the Python FastAPI microservice** (port 8000). Grepping the entire frontend for `8000`, `api/scenario`, or `api/analyze` reveals zero client or server calls to FastAPI.
- **Reality**: All client pages invoke Next.js route handlers (`app/api/*`) or client-side TypeScript libraries (`lib/ai/*`, `lib/finance/*`, `lib/store/*`). The Python backend is currently an orphaned, redundant implementation of endpoints already running inside Next.js.

### 1.3 Storage & Persistence Tiers `[VERIFIED FROM CODE]`
FundFlow operates a 3-tier hybrid persistence model:
1. **Supabase PostgreSQL / PostgREST**: The cloud database target when credentials are provided in `.env.local`.
2. **Browser LocalStorage**: Local browser storage caching transactions (`fundflow_transactions_v1`), alerts (`fundflow_alerts_v1`), preferences (`fundflow_preferences_v1`), and active workspace (`fundflow_workspace_v1`).
3. **In-Memory Hardcoded Demo Fallback**: Defined in `lib/store/demo-data.ts`, providing default Acme Technologies workspace, Alex Rivera profile, and 18 demo transactions when Supabase is unconfigured or unreachable.

---

## 2. Current Route / Page Structure

All pages are located under `app/` and leverage the Next.js App Router.

| Route | File Path | Rendering Mode | Purpose & Interactions `[VERIFIED FROM CODE]` |
| :--- | :--- | :--- | :--- |
| `/` | `app/page.tsx` | Client (`'use client'`) | Executive Dashboard: KPI cards (Cash on Hand, Burn, Runway, MoM Growth), Cash Flow SVG chart, AI Insights feed, Expense Breakdown, Recent Ledger table, and New Entry modal. |
| `/transactions` | `app/transactions/page.tsx` | Client (`'use client'`) | Full Transaction Ledger: Search filter, category dropdown, date range filter, sort by date/amount/description, inline edit modal, delete, and CSV export. |
| `/reports` | `app/reports/page.tsx` | Client (`'use client'`) | Financial Reports: Summary cards, expense category allocation bars, monthly financial summaries table from Supabase, JSON & CSV export. |
| `/ask-ai` | `app/ask-ai/page.tsx` | Client (`'use client'`) | Grounded AI Co-Pilot chat interface: Interactive chat with citations, quick prompt chips, and an interactive "What-If" Headcount Simulator slider sidebar. |
| `/documents` | `app/documents/page.tsx` | Client (`'use client'`) | Knowledge Base: List of uploaded corporate knowledge docs and chunks, modal to manually input financial context documents. |
| `/upload` | `app/upload/page.tsx` | Client (`'use client'`) | CSV Ingestion Zone: Drag-and-drop CSV upload, column mapping selector, parse preview, deduplication against existing ledger, and bulk database commit. |
| `/alerts` | `app/alerts/page.tsx` | Client (`'use client'`) | Risk Alerts: Active vs Acknowledged alert feed, filter by severity (critical, warning, info), single-click acknowledge, and "Mark All Read". |
| `/settings` | `app/settings/page.tsx` | Client (`'use client'`) | Settings & Guardrails: Configure runway threshold months, burn spike %, minimum cash floor, toggle email alerts, reset workspace to demo data, and export data. |
| `/login` | `app/login/page.tsx` | Client (`'use client'`) | Authentication: Email/password sign-in via Supabase Auth, and one-click "Demo Login" button. |
| `/signup` | `app/signup/page.tsx` | Client (`'use client'`) | Founder Registration: Creates user via Supabase Auth `signUp()`, redirects to `/onboarding`. |
| `/onboarding` | `app/onboarding/page.tsx` | Client (`'use client'`) | Founder & Workspace Onboarding: Sets up founder credentials via `/api/auth/setup-account`, creates workspace with currency, starting cash, and industry via `/api/workspaces`. |

---

## 3. Current Component Structure

Located under `components/`:

### 3.1 Layout (`components/layout/`) `[VERIFIED FROM CODE]`
- `AppShell.tsx`: Root wrapper containing `<FinanceProvider>`. Conditionally bypasses shell for `/login` and `/signup`. Renders `Sidebar` (desktop), `TopHeader` (mobile), `<main>` content container, and `MobileNav` (mobile bottom bar).
- `Sidebar.tsx`: Desktop fixed sidebar (280px wide). Includes branding, `WorkspaceSwitcher`, navigation links (`NAV_ITEMS`), active alert counter badge, user avatar, and Sign Out button.
- `TopHeader.tsx`: Mobile header (`md:hidden`). Shows compact workspace switcher, notifications icon with unread indicator dot, and user avatar dropdown with Sign Out.
- `MobileNav.tsx`: Mobile bottom navigation bar (`md:hidden`). Fixed bottom bar with 6 quick navigation tabs: Dashboard, Transactions, Upload, Ask AI, Alerts, Settings.
- `WorkspaceSwitcher.tsx`: Interactive dropdown component allowing users to switch between accessible workspaces loaded in `FinanceContext`, or route to `/onboarding` to create a new workspace.

### 3.2 Dashboard (`components/dashboard/`) `[VERIFIED FROM CODE]`
- `KPICards.tsx`: Four metric cards showing Cash on Hand, Monthly Burn, Runway, and MoM Growth with Material Symbols icons.
- `CashFlowChart.tsx`: Custom responsive SVG line chart rendering historical actual cash points and projected forecast runway points, with hover tooltip tooltips and SVG gradient defs.
- `ExpenseBreakdown.tsx`: Horizontal bar chart displaying categorized monthly expense proportions, percentages, and JetBrains Mono formatted currency.
- `AIInsightsFeed.tsx`: Scrollable list of simulated AI insights (Revenue Anomaly, Burn Rate Alert, OpEx Optimization) linking directly to `/ask-ai`.

### 3.3 Transactions (`components/transactions/`) `[VERIFIED FROM CODE]`
- `TransactionTable.tsx`: Full data table with client-side searching, category filtering, date filtering (All Time vs Last 30 Days), multi-column sorting, pagination info, view toggles, edit modal trigger, and CSV download trigger.
- `TransactionModal.tsx`: Slide-over modal for creating or editing transactions with description, merchant, amount, category, type (income/expense), status, date, and external reference.

### 3.4 Upload (`components/upload/`) `[VERIFIED FROM CODE]`
- `CSVUploadZone.tsx`: 761-line component managing the complete CSV import lifecycle: drag & drop, client-side PapaParse, automatic column mapping with confidence score badges, manual override dropdowns, preview table, deduplication against existing workspace signatures, and progress states.

---

## 4. Current Backend / API Structure

### 4.1 Next.js App Router API Handlers (`app/api/`) `[VERIFIED FROM CODE]`

All route handlers leverage Next.js 16 App Router server conventions (`NextRequest`, `NextResponse`):

1. **`POST /api/chat` (`app/api/chat/route.ts`)**:
   - Resolves active workspace from database.
   - Loads workspace documents, chunks, and monthly summaries from Supabase.
   - Generates grounded response via `generateGroundedResponse()` in `lib/ai/gemini-service.ts`.
   - Records user query and assistant answer into `ai_conversations` and `ai_messages` tables in Supabase.
2. **`GET /api/health` (`app/api/health/route.ts`)**:
   - Executes `head: true` count queries across `profiles`, `workspaces`, `transactions`, `transaction_categories`, `monthly_financial_summary`, `alerts`, `knowledge_documents`.
   - Returns `{ status: 'healthy' | 'degraded', supabase_connected, database: { ... } }`.
3. **`POST /api/workspaces` (`app/api/workspaces/route.ts`)**:
   - Validates business name, starting cash, currency code sanitization.
   - Resolves user ID from bearer token or fallback.
   - Generates slug, inserts into `workspaces`.
   - Inserts creator into `workspace_members` with role `'owner'`.
   - Seeds 10 default transaction categories.
   - Seeds initial opening cash transaction if starting cash > 0.
4. **`POST /api/auth/setup-account` (`app/api/auth/setup-account/route.ts`)**:
   - Uses `supabase.auth.admin.listUsers()`, `createUser()`, or `updateUserById()` with auto-confirmed email.
   - Upserts record in `profiles`.
5. **`POST /api/transactions` (`app/api/transactions/route.ts`)**:
   - Authenticates request and checks multi-tenant membership in `workspace_members`.
   - Sanitizes and inserts single transaction into `transactions`.
6. **`PATCH /api/transactions/[id]` (`app/api/transactions/[id]/route.ts`)**:
   - Verifies tenant access and updates transaction fields by UUID.
   - Follows Next.js 15/16 asynchronous param resolution: `const { id } = await params;`.
7. **`DELETE /api/transactions/[id]` (`app/api/transactions/[id]/route.ts`)**:
   - Follows Next.js 15/16 asynchronous param resolution: `const { id } = await params;`.
   - Deletes transaction record by UUID.
8. **`POST /api/transactions/bulk` (`app/api/transactions/bulk/route.ts`)**:
   - Multi-tenant permission check.
   - Batches rows in chunks of 100 into `transactions`.
   - Logs upload metadata into `uploaded_files`.
9. **`POST /api/alerts/acknowledge` (`app/api/alerts/acknowledge/route.ts`)**:
   - Updates `alerts` table, setting `is_read = true` for single alert or all alerts for workspace.
10. **`POST /api/files/record` (`app/api/files/record/route.ts`)**:
    - Inserts file tracking record into `uploaded_files`.

### 4.2 Python FastAPI Service (`backend/main.py`) `[VERIFIED FROM CODE]`
Exposes:
- `GET /` and `GET /api/health`: Health checks testing PostgREST connectivity.
- `GET /api/transactions`: Fetches transactions from Supabase via PostgREST.
- `GET /api/monthly-summary`: Queries `monthly_financial_summary`.
- `GET /api/knowledge`: Queries `knowledge_documents`.
- `POST /api/scenario`: Headcount scenario runway calculation.
- `POST /api/analyze`: Aggregates transactions into income, expense, and top categories.

---

## 5. Current Database Schema

### 5.1 Tables Defined in `supabase/schema.sql` `[VERIFIED FROM CODE]`
1. `profiles`: `id` (UUID PK refs `auth.users`), `full_name`, `avatar_url`, `created_at`, `updated_at`.
2. `workspaces`: `id` (UUID PK), `name`, `owner_id` (refs `profiles.id`), `currency`, `created_at`, `updated_at`.
3. `workspace_members`: `id`, `workspace_id`, `user_id`, `role` (`'owner' | 'admin' | 'member' | 'viewer'`), `created_at`.
4. `transaction_categories`: `id`, `workspace_id`, `name`, `category_type` (`'revenue' | 'expense'`), `description`, `color`, `created_at`.
5. `transactions`: `id`, `workspace_id`, `transaction_date`, `description`, `merchant`, `category`, `subcategory`, `amount`, `currency`, `transaction_type` (`'income' | 'expense'`), `status` (`'completed' | 'pending' | 'failed' | 'reconciled'`), `source` (`'manual' | 'csv_import' | 'plaid_sync'`), `external_reference`, `metadata` (JSONB), `created_at`, `updated_at`.
6. `imports`: `id`, `workspace_id`, `filename`, `status`, `rows_processed`, `rows_imported`, `rows_failed`, `error_details`, `created_at`, `completed_at`.
7. `alerts`: `id`, `workspace_id`, `alert_type`, `severity` (`'critical' | 'warning' | 'info' | 'system'`), `title`, `message`, `threshold`, `current_value`, `status` (`'active' | 'acknowledged' | 'dismissed'`), `acknowledged_at`, `created_at`.
8. `alert_preferences`: `id`, `workspace_id` (UNIQUE), `runway_threshold_months`, `expense_spike_percentage`, `cash_minimum_threshold`, `large_transaction_threshold`, `email_notifications_enabled`, `slack_notifications_enabled`, `slack_webhook_url`, `updated_at`.
9. `financial_snapshots`: `id`, `workspace_id`, `snapshot_date`, `cash`, `monthly_burn`, `runway_months`, `revenue`, `expenses`, `created_at`.
10. `ai_conversations`: `id`, `workspace_id`, `user_id`, `title`, `created_at`, `updated_at`.
11. `ai_messages`: `id`, `conversation_id`, `role` (`'user' | 'assistant' | 'system'`), `content`, `metadata`, `created_at`.
12. `ai_citations`: `id`, `message_id`, `citation_type`, `reference_id`, `label`, `amount`, `date_range`, `source_context`, `created_at`.
13. `scenarios`: `id`, `workspace_id`, `name`, `description`, `delta_monthly_burn`, `delta_monthly_revenue`, `baseline_runway`, `projected_runway`, `assumptions`, `created_at`.

### 5.2 Critical Schema Inconsistencies (Code vs `schema.sql`) `[VERIFIED FROM CODE]`
There are severe, high-risk discrepancies between what `supabase/schema.sql` creates and what the application code queries:

| Table / Field in Application Code | Actual Status in `supabase/schema.sql` | Discrepancy Impact |
| :--- | :--- | :--- |
| `workspaces.slug` | **Missing in `schema.sql`** | `POST /api/workspaces` inserts `slug`. Fails if executed against clean `schema.sql`. |
| `workspaces.starting_cash` | **Missing in `schema.sql`** | In `schema.sql`, starting cash is not on workspaces. Code inserts it. |
| `workspaces.alert_runway_threshold` | **Missing in `schema.sql`** | In `schema.sql`, this is inside `alert_preferences`. Code inserts it on `workspaces`. |
| `profiles.email` | **Missing in `schema.sql`** | `signUp()` in `auth.ts` and `setup-account/route.ts` upserts `email` into `profiles`. |
| `profiles.job_title` | **Missing in `schema.sql`** | Code upserts `job_title`. Column missing in `schema.sql`. |
| `transactions.account_name` | **Missing in `schema.sql`** | In `schema.sql`, field is `external_reference`. Code queries `account_name`. |
| `transactions.is_recurring` | **Missing in `schema.sql`** | Code inserts `is_recurring: false`. Column missing in `schema.sql`. |
| `transactions.source_file_id` | **Missing in `schema.sql`** | Declared in `lib/supabase/types.ts`. Missing in `schema.sql`. |
| `transactions.created_by` | **Missing in `schema.sql`** | Inserted in `api/transactions/route.ts`. Missing in `schema.sql`. |
| `monthly_financial_summary` | **Table missing in `schema.sql`** | `schema.sql` defines `financial_snapshots`. Code queries `monthly_financial_summary`. |
| `uploaded_files` | **Table missing in `schema.sql`** | `schema.sql` defines `imports`. Code queries `uploaded_files`. |
| `knowledge_documents` | **Table missing in `schema.sql`** | Queried in `app/documents/page.tsx`, `api/chat/route.ts`, `backend/main.py`. Missing in `schema.sql`. |
| `document_chunks` | **Table missing in `schema.sql`** | Queried in `app/documents/page.tsx`, `api/chat/route.ts`. Missing in `schema.sql`. |
| `alerts.is_read` | **Missing in `schema.sql`** | In `schema.sql`, status is `status: 'active' \| 'acknowledged'`. Code runs `update({ is_read: true })`. |
| `alerts.is_resolved` | **Missing in `schema.sql`** | Code references `is_resolved`. Missing in `schema.sql`. |

---

## 6. Current Authentication Model

### 6.1 Architecture `[VERIFIED FROM CODE]`
- **Provider**: Supabase Auth (Email + Password).
- **Client Implementation**: `lib/supabase/auth.ts`:
  - `signIn(email, password)`: Calls `supabase.auth.signInWithPassword`.
  - `signUp(email, password, fullName, jobTitle)`: Calls `supabase.auth.signUp`, followed by client-side upsert to `profiles`.
  - `signOut()`: Calls `supabase.auth.signOut()`, redirects to `/login`.
  - `getCurrentAuthUser()`: Reads session via `supabase.auth.getSession()`, loads `profiles`, and loads memberships via `workspace_members`.
- **Server Implementation**: `app/api/auth/setup-account/route.ts`:
  - Uses `supabase.auth.admin.createUser` and `updateUserById` with `email_confirm: true`. Requires Supabase Service Role Key (`SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`).
- **Demo Bypass Mode**:
  - In `app/login/page.tsx`, a "Demo Login" button attempts to sign in with `alex.rivera@demo.fundflow.app`, and on failure immediately routes to `/` with in-memory state.

---

## 7. Current Tenant / Workspace Model

### 7.1 Architecture `[VERIFIED FROM CODE]`
- **Tenancy Boundary**: Every financial entity (`transactions`, `alerts`, `transaction_categories`, `imports`, `financial_snapshots`, `ai_conversations`) possesses a `workspace_id UUID REFERENCES workspaces(id)`.
- **Membership & Roles**:
  - `workspace_members` links `workspace_id` to `user_id` (`profiles.id`) with role check constraint: `'owner'`, `'admin'`, `'member'`, `'viewer'`.
- **API Authorization Pattern**:
  - In `api/transactions/route.ts`, `api/transactions/bulk/route.ts`, `api/transactions/[id]/route.ts`, and `api/alerts/acknowledge/route.ts`, the handler explicitly verifies that `userId` matches the workspace owner in `workspaces` OR has an entry in `workspace_members`.
  - If unauthorized, returns HTTP 403 Forbidden.
- **Client Switching**:
  - `FinanceContext` (`lib/store/finance-context.tsx`) holds `workspace` and `workspaces`.
  - `switchWorkspace(workspaceId)` re-fetches transactions and alerts for the selected workspace, updating `localStorage`.

---

## 8. Current Financial Calculation Logic

Located in `lib/finance/calculator.ts` and `lib/ai/financial-engine.ts`.

### 8.1 Cash on Hand (`calculateCashOnHand`) `[VERIFIED FROM CODE]`
- **Formula**: `Cash On Hand = startingBalance + Net Cash Flow`.
- **Logic**: Iterates over all non-failed transactions. Inflows add to balance; outflows subtract.
- **Default Fallback**: If `startingBalance` is undefined, defaults to hardcoded `BASELINE_STARTING_CASH = 1,240,000` ($1.24M).
- **Safety Clamp**: Clamped with `Math.max(0, ...)`.

### 8.2 Monthly Burn (`calculateMonthlyBurn`) `[VERIFIED FROM CODE]`
- **Formula**: Average monthly expense over a rolling window (default `monthsWindow = 3`).
- **Logic**: Filters completed/pending expenses, groups by `YYYY-MM`, takes the most recent 3 months, and returns the arithmetic mean.
- **Default Fallback**: If no transactions exist, returns hardcoded `$85,000`.

### 8.3 Net Monthly Burn (`calculateNetMonthlyBurn`) `[VERIFIED FROM CODE]`
- **Formula**: `Net Monthly Burn = Math.max(0, currentMonthExpenses - currentMonthIncome)`.
- **Default Fallback**: If current month has 0 transactions, falls back to `calculateMonthlyBurn(transactions, 1)`.

### 8.4 Runway (`calculateRunway`) `[VERIFIED FROM CODE]`
- **Formula**: `Runway (Months) = Math.round((cashOnHand / monthlyBurn) * 10) / 10`.
- **Edge Cases**:
  - `cashOnHand <= 0` $\rightarrow$ `runwayMonths = 0`, display `'0 Mos'`.
  - `monthlyBurn <= 0` $\rightarrow$ `runwayMonths = 999`, display `'Profitable / Infinite'`, `isCashFlowPositive: true`.

### 8.5 Month-over-Month (MoM) Growth (`calculateMoMGrowth`) `[VERIFIED FROM CODE]`
- **Formula**: Percentage change in revenue and burn between the two most recent recorded calendar months.
- **Formula**: `((current - prior) / prior) * 100`.
- **Default Fallback**: If fewer than 2 distinct calendar months exist in the ledger, returns hardcoded mock growth metrics:
  `{ momGrowthPercent: 12.4, burnChangePercent: -2.1, cashChangePercent: 5.2 }`.

### 8.6 Cash Flow Projection (`generateCashFlowProjection`) `[VERIFIED FROM CODE]`
- **Observation**: This function **does not calculate historical cash balances from actual monthly ledger sums**.
- **Reality**: It simulates a synthetic curve anchored to current cash:
  - Month -3: `cash + burn * 2.8`
  - Month -2: `cash + burn * 1.9`
  - Month -1: `cash + burn * 0.95`
  - Current Month: `cash`
  - Month +1 Forecast: `cash - burn * 0.9`
  - Month +2 Forecast: `cash - burn * 1.8`
- **Impact**: The chart displays synthetic smoothed numbers rather than true historical balances.

### 8.7 Deterministic What-If Scenario Calculation (`calculateWhatIfScenario`) `[VERIFIED FROM CODE]`
- **Formula**:
  - `netMonthlyCostImpact = deltaMonthlyBurn - deltaMonthlyRevenue`
  - `newMonthlyBurn = Math.max(1, currentMonthlyBurn + netMonthlyCostImpact)`
  - `projectedRunway = Math.round((currentCash / newMonthlyBurn) * 10) / 10`
  - `differenceMonths = Math.round((projectedRunway - currentRunway) * 10) / 10`
- **Evaluation**: Fully deterministic, mathematically sound, zero-hallucination.

---

## 9. Current CSV Ingestion Flow

Located in `lib/finance/csv-importer.ts` and `components/upload/CSVUploadZone.tsx`.

### 9.1 Architecture `[VERIFIED FROM CODE]`
1. **File Selection**: User drops or selects a file (max 50MB, `.csv` only).
2. **Client-Side Parsing**: Read via `FileReader` and parsed using `Papa.parse(..., { header: true, skipEmptyLines: 'greedy' })`.
3. **Automated Header Mapping Detection (`detectColumnMapping`)**:
   - Strips non-alphanumeric characters, normalizes to lowercase.
   - Evaluates against regex/keyword dictionaries for Date, Debit, Credit, Amount, Description, Category, Balance, Account, Transaction Type.
   - Computes confidence scores (75%–98%).
4. **Debit / Credit vs Single Amount Normalization (`parseAmount`)**:
   - Handles currency symbols (`$`, `€`, `£`, `₹`, `CA$`, `AU$`, `SG$`, `¥`).
   - Handles comma thousands separators and parentheses accounting format (e.g. `(1,245.00)` $\rightarrow$ `-1245.00`).
   - If separate Debit and Credit columns exist, assigns `expense` to Debit and `income` to Credit.
5. **Multi-Format Date Normalization (`parseDate`)**:
   - Detects `YYYY-MM-DD`, `YYYY/MM/DD`, `DD/MM/YYYY`, `MM/DD/YYYY`.
   - Uses auto-disambiguation if day > 12. Normalizes to ISO `YYYY-MM-DD`.
6. **Rule-Based Keyword Categorization (`categorizeTransaction`)**:
   - Matches against `CATEGORY_RULES` for 9 standard categories (Cloud Infrastructure, Customer Revenue, Payroll, SaaS & Software, Marketing, Rent & Office, Contractors, Legal & Professional, Travel).
   - If unmatched, tags as `'Uncategorized'`.
7. **Deduplication Engine**:
   - Creates a signature: `${transaction_date}_${description.toLowerCase()}_${amount}_${transaction_type}`.
   - Compares against existing transactions in active workspace. Duplicate rows are skipped and counted as `skippedRows`.
8. **Formula Injection & XSS Sanitization (`sanitizeCSVValue`)**:
   - Escapes values starting with `=`, `+`, `-`, `@`, `\t`, `\r` by prefixing `'`. Strips `<` and `>`.
9. **Persistence**:
   - Pushes transactions to local React state via `importTransactions()`.
   - Sends batch to `POST /api/transactions/bulk`.
   - Logs file upload record via `POST /api/files/record`.

---

## 10. Current AI / RAG Flow

Located in `lib/ai/gemini-service.ts`, `lib/ai/intent-router.ts`, `lib/ai/rag-engine.ts`, `lib/ai/financial-engine.ts`, and `lib/ai/intent-parser.ts`.

### 10.1 Intent Routing (`classifyFinancialIntent`) `[VERIFIED FROM CODE]`
User prompts are classified into 5 distinct modes via regex and keyword pattern matching:
1. `WHAT_IF_SCENARIO`: Detects keywords (`hire`, `salary`, `headcount`, `what if`). Extracts headcount and salary.
2. `FINANCIAL_DATA`: Detects spend (`TOTAL_SPEND`, `CATEGORY_SPEND`), revenue (`TOTAL_REVENUE`), largest category (`TOP_EXPENSE_CATEGORY`), and MoM trends (`MOM_COMPARISON`).
3. `KNOWLEDGE_RAG`: Detects accounting concepts (`ebitda`, `cash flow`, `gross margin`, `unit economics`, `opex`).
4. `COMBINED_ANALYSIS`: Detects root cause and recommendation questions (`why did`, `reduce expenses`, `improve cash flow`).
5. `UNKNOWN_OR_MISSING`: Strict refusal for out-of-domain queries (e.g. weather, stock market forecasting).

### 10.2 Response Generation (`generateGroundedResponse`) `[VERIFIED FROM CODE]`
- **Critical Finding**: **No external LLM (Gemini API, OpenAI, Anthropic) is called during chat.**
- Despite being named `gemini-service.ts` and having references to Gemini in `.env.example` and `HOW_TO_RUN.md`, `generateGroundedResponse()` is **100% deterministic TypeScript template logic**.
- It runs financial calculations via `FinancialEngine`, builds structured Markdown tables, formats currency, attaches `AICitation[]` objects, and returns `{ grounded: true, groundingConfidence: 0.98 }`.
- **Verdict**: The current implementation is zero-hallucination and mathematically grounded, but does not use a generative LLM.

### 10.3 RAG Retrieval Engine (`retrieveWorkspaceRAGChunks`) `[VERIFIED FROM CODE]`
- **Cosine Similarity Vectorization**: Uses an in-memory tokenization and term frequency vector dot-product calculation (`calculateCosineSimilarity`).
- **Knowledge Sources**:
  1. Workspace document chunks from Supabase `document_chunks` table (if present).
  2. Four hardcoded global accounting definitions: EBITDA, Cash Flow Forecasting, Gross Margin, OpEx Optimization.
- **Vector Database**: There is **no pgvector, Pinecone, Chroma, or vector embedding model** currently configured or running.

---

## 11. Current Demo / Mock Data Sources

Located in `lib/store/demo-data.ts`.

### 11.1 Demo Entities `[VERIFIED FROM CODE]`
- **Workspace**: Acme Technologies (`id: 'e1ab89bf-153d-467b-a530-a6e7063efba1'`, `currency: 'USD'`, `starting_cash: 1,200,000`).
- **User**: Alex Rivera (`id: '2750de4a-7e18-4345-9d29-72385783cf2c'`, `email: 'alex.rivera@demo.fundflow.app'`).
- **Transactions**: 18 hardcoded historical transactions across August, September, and October 2023. Includes AWS, Stripe payouts, Gusto payroll ($27.5k / $54k), Google Ads ($8.5k), Meta Ads ($8.5k), WeWork ($4.5k), and Figma ($6.7k).
- **Alerts**: 3 seeded alerts:
  1. Runway below 6 months (Critical, Runway 5.8 mos)
  2. Unusual Expense Spike (Warning, Marketing spend +45%)
  3. Large Deposit Cleared (Info, Series A wire $2.5M)

---

## 12. Current State Management Approach

Located in `lib/store/finance-context.tsx`.

### 12.1 React Context (`FinanceContext`) `[VERIFIED FROM CODE]`
- **State Properties**: `workspace`, `workspaces`, `user`, `transactions`, `alerts`, `alertPreferences`, `kpis`, `cashFlowProjection`, `expenseBreakdown`, `isLoading`.
- **Dynamic Derivations (`useMemo`)**:
  - `kpis`: Derived from transactions and starting cash via `calculateAllKPIs`.
  - `cashFlowProjection`: Derived from cash on hand and monthly burn via `generateCashFlowProjection`.
  - `expenseBreakdown`: Derived from transactions via `calculateCategoryBreakdown`.
- **Dual-Write / Optimistic Pattern**:
  - CRUD operations (`addTransaction`, `updateTransaction`, `deleteTransaction`, `acknowledgeAlert`, `importTransactions`) update React state and `localStorage` synchronously.
  - If `isSupabaseConfigured` is true, an asynchronous network request is dispatched to Supabase or `/api/*`.
- **Automated Guardrail Evaluator**:
  - A `useEffect` in `FinanceContext` monitors `kpis.runwayMonths`. If runway drops below `alertPreferences.runway_threshold_months`, it generates an active `runway_risk` alert and inserts it into state.

---

## 13. Current Error Handling

### 13.1 Frontend `[VERIFIED FROM CODE]`
- Forms (`app/login/page.tsx`, `app/signup/page.tsx`, `app/onboarding/page.tsx`) capture errors in local `error` state and render warning banners.
- API errors in `finance-context.tsx` and `db.ts` use `try/catch` blocks with `console.warn` or `logDiagnosticDbError`, falling back to local memory without crashing the UI.

### 13.2 Backend Route Handlers `[VERIFIED FROM CODE]`
- Route handlers return structured JSON errors: `{ success: false, error: '...' }` or `{ error: msg, requestId }` with HTTP 400, 403, or 500 status codes.
- Diagnostic logger `logDiagnosticDbError` in `lib/supabase/db.ts` captures Supabase Postgres code, details, and hint while redacting secrets.

---

## 14. Current Validation

### 14.1 Input Validation Points `[VERIFIED FROM CODE]`
- **CSV Ingestion**: Validates file extension, size <= 50MB, requires valid date and numeric amount/debit/credit, sanitizes formula prefixes.
- **Onboarding / Workspace Creation**: Requires business name, valid email with `@`, password length >= 6, initial cash >= 0, sanitizes 3-letter currency code.
- **Transaction Creation**: Requires description and positive amount. Validates UUID format before forwarding ID to Supabase.

---

## 15. Current Testing

### 15.1 Existing Tests `[VERIFIED FROM CODE]`
- **Observation**: `vitest` `^4.1.11` is listed in `package.json` under `devDependencies`.
- **Reality**: **There are zero test files in the entire repository.** Grepping for `*.test.*` or `*.spec.*` returns no test files.
- **Package Scripts**: `package.json` contains only `"dev"`, `"build"`, `"start"`, and `"lint"`. There is no `"test"` script defined.

---

## 16. Current Security Posture

### 16.1 Strengths `[VERIFIED FROM CODE]`
1. **Row Level Security (RLS)**: Enabled in `supabase/schema.sql` on all 13 tables. RLS helper function `user_has_workspace_access()` enforces multi-tenant boundaries.
2. **Server-Side Authorization**: API routes (`/api/transactions`, `/api/transactions/[id]`, `/api/transactions/bulk`, `/api/alerts/acknowledge`) check workspace membership before mutation.
3. **CSV Formula Injection Mitigation**: `sanitizeCSVValue` prefixes dangerous characters (`=`, `+`, `-`, `@`) with a single quote.
4. **UUID Validation**: Regex `/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i` prevents invalid IDs from reaching database queries.

### 16.2 Vulnerabilities & Risks `[VERIFIED FROM CODE]`
1. **Hardcoded Fallback Credentials in Source**:
   - `lib/supabase/client.ts` (line 6) and `lib/supabase/server.ts` (line 6) contain a hardcoded Supabase URL fallback: `'https://kdfntfwstouvabavpcjd.supabase.co'`.
2. **Secret Keys in `.env.local`**:
   - `.env.local` contains live Supabase credentials (`SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`). Must ensure `.env.local` remains in `.gitignore` (verified: `.env*.local` is in `.gitignore`).
3. **Missing RLS Policies**:
   - While RLS is enabled on all tables in `schema.sql`, policies are defined only for `profiles`, `workspaces`, `workspace_members`, `transaction_categories`, `transactions`, `alerts`, `ai_conversations`, `ai_messages`.
   - Tables `imports`, `alert_preferences`, `financial_snapshots`, `scenarios`, `ai_citations` **lack explicit RLS policies**, defaulting to denying all client queries when accessed via client anon key.

---

## 17. Current Deployment Assumptions

### 17.1 Platform `[VERIFIED FROM CODE]`
- Standard Vercel deployment setup (`README.md`, `next.config.ts`).
- Node.js version assumed: `>=18.18.0` (Recommended: Node 20 LTS).
- Standalone Python service assumes Python 3.10+ and a persistent host with Uvicorn.

---

## 18. Technical Debt

1. **Linter Failures**: Running `npm run lint` generates 3 errors and 8 warnings:
   - `lib/finance/csv-importer.ts:315-317`: `prefer-const` errors (`p0`, `p1`, `p2` never reassigned).
   - `app/layout.tsx`: `@next/next/no-page-custom-font` warnings (Google Fonts loaded via `<link>` instead of `next/font/google`).
   - `app/settings/page.tsx`: `@next/next/no-img-element` warning.
   - `lib/store/finance-context.tsx`: `@next/next/no-location-assign-relative-destination` warning.
2. **Orphaned Python Backend**: Python microservice duplicates calculation logic already implemented in TypeScript.
3. **Database vs TypeScript Type Mismatch**: Discrepancies between `lib/supabase/types.ts` and `supabase/schema.sql` (e.g. `uploaded_files` vs `imports`, `monthly_financial_summary` vs `financial_snapshots`).

---

## 19. Duplicate or Suspicious Code

1. **Duplicate Intent Parsing**:
   - `lib/ai/intent-parser.ts` (`parseFinancialIntent`) and `lib/ai/intent-router.ts` (`classifyFinancialIntent`) implement duplicate logic. `intent-parser.ts` is only called by `financial-retriever.ts`, whereas `intent-router.ts` is called by `gemini-service.ts`.
2. **Hardcoded Fallback Supabase Project**:
   - `https://kdfntfwstouvabavpcjd.supabase.co` hardcoded in `lib/supabase/client.ts` and `lib/supabase/server.ts`.
3. **Synthetic Cash Flow Curve**:
   - `generateCashFlowProjection` in `lib/finance/calculator.ts` uses arbitrary multipliers (`2.8`, `1.9`, `0.95`, `0.9`, `1.8`) rather than summing transactions by month.

---

## 20. Broken or Incomplete Functionality

1. **Knowledge Base Document Upload (`app/documents/page.tsx`)**:
   - Attempts to insert into `knowledge_documents` and `document_chunks`. These tables do not exist in `supabase/schema.sql`.
2. **Workspace Creation Column Mismatch**:
   - `app/api/workspaces/route.ts` inserts `slug`, `starting_cash`, `alert_runway_threshold` into `workspaces`. In `supabase/schema.sql`, those columns do not exist on `workspaces`.
3. **Alert Status Updates**:
   - `app/api/alerts/acknowledge/route.ts` and `lib/supabase/db.ts` execute `.update({ is_read: true })`. `supabase/schema.sql` has no `is_read` column on `alerts`; its status column uses values `'active'`, `'acknowledged'`, `'dismissed'`.
4. **Live Gemini AI Integration**:
   - Described in `HOW_TO_RUN.md` and `.env.example`, but no live API call is executed in `lib/ai/gemini-service.ts` or `backend/main.py`.

---

## 21. High-Risk Areas That Must NOT Be Casually Modified

1. **Multi-Tenant RLS & Helper Functions** (`supabase/schema.sql` lines 175–287): Any breaking change to `user_has_workspace_access()` will expose or lock out multi-tenant data.
2. **Deterministic Financial Math** (`lib/finance/calculator.ts` and `lib/ai/financial-engine.ts`): Dashboard KPIs and runway projections depend directly on the exact math of these pure functions.
3. **CSV Parsing & Sanitization Rules** (`lib/finance/csv-importer.ts`): Modifying sanitization or delimiter logic can break user CSV imports or introduce formula injection vulnerabilities.
4. **Next.js 16 Asynchronous Dynamic Route Params**: In `app/api/transactions/[id]/route.ts`, `params` must remain `Promise<{ id: string }>` per Next.js 16 breaking changes.

---

## 22. Recommended Target Architecture

```
                                  +---------------------------------------+
                                  |            Next.js 16 Web UI          |
                                  | (React 19, Tailwind v4, App Router)   |
                                  +---------------------------------------+
                                                      |
                                           Internal API Routes
                                                      |
                                  +---------------------------------------+
                                  |         Next.js Route Handlers        |
                                  |    (/api/chat, /api/workspaces, etc.) |
                                  +---------------------------------------+
                                        /                           \
                        Deterministic Engine                 Supabase SSR Server Client
                                |                                    |
                    +-----------------------+              +-----------------------+
                    |  Financial Calculator |              |  PostgreSQL Database  |
                    |  & CSV Import Engine  |              |     (with RLS)        |
                    +-----------------------+              +-----------------------+
```

1. **Single Unified Stack**: Consolidate all functionality into Next.js App Router handlers and deprecate the orphaned Python backend, or convert FastAPI into an external worker if intensive ML processing is needed.
2. **Schema & Types Reconciliation**: Align `supabase/schema.sql` and `lib/supabase/types.ts` into a single source of truth.
3. **True Historical Projections**: Replace synthetic Cash Flow Projection multipliers with genuine historical monthly ledger aggregations.
4. **Two-Stage Grounded AI Pipeline**:
   - Stage 1: Deterministic ledger calculation (exact cash, burn, category numbers).
   - Stage 2: Generative LLM synthesis (passing deterministic facts as verified context to Gemini Flash 2.0 with strict grounding).

---

## 23. Recommended Migration Sequence

1. **Phase 1**: Fix ESLint errors (`csv-importer.ts`) and add a `npm test` script with Vitest.
2. **Phase 2**: Reconcile `supabase/schema.sql` with application code (add missing columns/tables or update code to match canonical schema).
3. **Phase 3**: Fix alert update logic (`status = 'acknowledged'` instead of `is_read = true`).
4. **Phase 4**: Replace synthetic cash flow projections with true historical monthly rollups.
5. **Phase 5**: Connect live Gemini API with strict system instructions and verified ledger context.
6. **Phase 6**: Deprecate or integrate the detached Python backend.

---

## DO NOT CHANGE WITHOUT EXPLICIT VERIFICATION

Future coding agents must inspect and verify the following components before making any modifications:

1. **`supabase/schema.sql`**:
   - Do NOT run migrations or alter table definitions without cross-referencing `lib/supabase/types.ts` and `lib/supabase/db.ts`.
   - Modifying `user_has_workspace_access` can disrupt tenant isolation.
2. **`lib/finance/calculator.ts`**:
   - `calculateCashOnHand`, `calculateMonthlyBurn`, and `calculateRunway` are the mathematical foundation of all UI cards and scenario simulations. Do not alter formulas without accompanying unit tests.
3. **`lib/finance/csv-importer.ts`**:
   - `sanitizeCSVValue` protects against CSV formula injection. Do not bypass this sanitization.
   - `parseAmount` and `parseDate` handle critical international currency and date format edge cases.
4. **`app/api/transactions/[id]/route.ts`**:
   - In Next.js 16, `params` is a `Promise`. Do not revert to synchronous parameter access (`{ params: { id } }`).
5. **`lib/store/finance-context.tsx`**:
   - The dual-write pattern (optimistic UI + async Supabase sync) ensures the app functions offline or without Supabase configured. Do not remove local storage fallbacks without verification.
6. **`AGENTS.md`**:
   - Follow Next.js App Router conventions documented in `node_modules/next/dist/docs/`.
