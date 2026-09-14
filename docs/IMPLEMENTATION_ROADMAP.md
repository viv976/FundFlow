# FundFlow — Implementation Roadmap

**Document:** Implementation Roadmap  
**Target Application:** FundFlow — Financial Co-Pilot for Startups (`nuvrag`)  
**Status:** Planning Document — No Code Modifications Executed  
**Guiding Principle:** Divide future work into small, independently testable phases with zero regression on working features.

---

## Roadmap Overview

```
+-------------------------------------------------------------------------------+
| PHASE 0: Baseline Code Hygiene & Test Harness Setup                           |
| -> Fix linting errors in csv-importer.ts, configure Vitest test runner        |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| PHASE 1: Database Schema & TypeScript Types Reconciliation                    |
| -> Align schema.sql, lib/supabase/types.ts, and db.ts to single source        |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| PHASE 2: Core Financial Engine Accuracy & Historical Cash Flow Rollups        |
| -> Replace synthetic projection multipliers with genuine monthly ledger math   |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| PHASE 3: Multi-Tenant Authorization & Row Level Security (RLS) Hardening      |
| -> Complete missing RLS policies, harden user_has_workspace_access            |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| PHASE 4: Live Grounded AI Integration (Google Gemini Flash 2.0)               |
| -> Two-stage pipeline: deterministic facts -> generative synthesis with audit |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| PHASE 5: Knowledge Base & Vector Search (pgvector / Semantic Retrieval)       |
| -> Enable real vector embeddings for document_chunks in Supabase              |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| PHASE 6: Backend Microservice Strategy & Production Polish                    |
| -> Consolidate into Next.js App Router or formalize FastAPI worker; perf audit |
+-------------------------------------------------------------------------------+
```

---

## Phase 0: Baseline Code Hygiene & Test Harness Setup

### Objective
Ensure clean linting passes and introduce automated unit testing for existing mathematical functions before touching core code.

### Scope of Changes
1. **Fix 3 ESLint Errors in `lib/finance/csv-importer.ts`**:
   - Lines 315–317: Change `let p0`, `let p1`, `let p2` to `const` (resolves `prefer-const`).
2. **Configure Vitest Test Script in `package.json`**:
   - Add `"test": "vitest run"` and `"test:watch": "vitest"`.
3. **Create Baseline Unit Tests**:
   - `tests/unit/calculator.test.ts`: Test `calculateCashOnHand`, `calculateMonthlyBurn`, `calculateRunway`, `calculateWhatIfScenario`.
   - `tests/unit/csv-importer.test.ts`: Test `parseAmount`, `parseDate`, `categorizeTransaction`, `sanitizeCSVValue`.

### Verification Criteria
- `npm run lint` exits with code 0 (zero errors).
- `npm test` executes and passes all baseline unit tests.

### Risk
Very Low. No architectural or database changes.

---

## Phase 1: Database Schema & TypeScript Types Reconciliation

### Objective
Eliminate the mismatch between `supabase/schema.sql`, `lib/supabase/types.ts`, and database access methods in `lib/supabase/db.ts`.

### Scope of Changes
1. **Reconcile Table Names**:
   - Choose canonical naming: `financial_snapshots` vs `monthly_financial_summary`, and `imports` vs `uploaded_files`.
   - Update `schema.sql` and TypeScript interfaces to match.
2. **Add Missing Columns to `supabase/schema.sql`**:
   - `workspaces`: add `slug TEXT`, `starting_cash NUMERIC(15,2)`, `alert_runway_threshold NUMERIC(4,1)`.
   - `profiles`: add `email TEXT`, `job_title TEXT`.
   - `transactions`: reconcile `account_name` vs `external_reference`, add `is_recurring BOOLEAN DEFAULT FALSE`, add `created_by UUID REFERENCES profiles(id)`.
3. **Create Missing Knowledge Tables in `supabase/schema.sql`**:
   - Add `knowledge_documents` and `document_chunks` tables with workspace foreign keys.
4. **Align Alert Status Fields**:
   - Reconcile `alerts.is_read` vs `alerts.status` (`'active'`, `'acknowledged'`, `'dismissed'`). Update queries in `api/alerts/acknowledge/route.ts` and `lib/supabase/db.ts` to use canonical status.

### Verification Criteria
- A fresh Supabase project executing `supabase/schema.sql` successfully runs `POST /api/workspaces`, `POST /api/transactions`, `POST /api/alerts/acknowledge`, and `POST /api/files/record` without Postgres column or table errors.
- `npx tsc --noEmit` exits with code 0.

### Risk
Medium. Requires careful coordination between SQL definitions and TypeScript types.

---

## Phase 2: Core Financial Engine Accuracy & Historical Cash Flow Rollups

### Objective
Replace synthetic multipliers in cash flow projections with true historical calculations based on recorded transactions.

### Scope of Changes
1. **Refactor `generateCashFlowProjection` in `lib/finance/calculator.ts`**:
   - Compute true historical net cash flows grouped by calendar month (`YYYY-MM`).
   - Ground historical points in verifiable sums (`startingBalance + cumulative_net_flow_at_month_end`).
   - Project future forecast points using actual 30/60/90-day moving average burn rate.
2. **Refactor Month-over-Month Growth Calculation**:
   - Eliminate hardcoded fallback `{ momGrowthPercent: 12.4, burnChangePercent: -2.1, cashChangePercent: 5.2 }` when 0 or 1 month is present. Return clear "Insufficient data" state instead.
3. **Update Visual Indicator**:
   - Ensure `CashFlowChart.tsx` distinguishes when fewer than 3 historical months exist.

### Verification Criteria
- Unit tests verify that for any list of transactions, historical projection points match the exact sum of ledger amounts.
- Dashboard chart accurately reflects ledger data without synthetic smoothing.

### Risk
Low to Medium. Modifies calculation output on the dashboard; requires unit test coverage.

---

## Phase 3: Multi-Tenant Authorization & Row Level Security (RLS) Hardening

### Objective
Ensure airtight data isolation between workspaces in both client-side Supabase queries and Next.js server route handlers.

### Scope of Changes
1. **Define Missing RLS Policies in `supabase/schema.sql`**:
   - Add policies for `imports`, `alert_preferences`, `financial_snapshots`, `scenarios`, `ai_citations`, `knowledge_documents`, `document_chunks`.
2. **Audit Server Route Handlers**:
   - Verify that all mutations (`POST /api/transactions`, `PATCH /api/transactions/[id]`, `DELETE /api/transactions/[id]`, `POST /api/transactions/bulk`) enforce workspace ownership or membership.
3. **Token Verification**:
   - Ensure Supabase JWT bearer token passed in `Authorization` header is verified on all authenticated API requests.

### Verification Criteria
- Multi-tenant test: User A in Workspace A cannot read, insert, or modify transactions belonging to Workspace B.
- Direct Supabase PostgREST queries using anon key return only rows permitted by RLS.

### Risk
High. Any mistake in RLS rules can lock out legitimate users or expose tenant data.

---

## Phase 4: Live Grounded AI Integration (Google Gemini Flash 2.0)

### Objective
Integrate the live Google Gemini API into `lib/ai/gemini-service.ts` while maintaining 100% mathematical grounding and zero hallucination.

### Scope of Changes
1. **Install and Configure Google GenAI SDK**:
   - Ensure `@google/genai` or `@google/generative-ai` is properly configured with `GEMINI_API_KEY`.
2. **Implement Two-Stage Pipeline in `generateGroundedResponse`**:
   - **Stage 1 (Deterministic Facts)**: Execute `FinancialEngine` calculations to produce verified figures (exact cash, burn rate, top categories, runway).
   - **Stage 2 (LLM Synthesis)**: Pass user prompt and deterministic facts into Gemini Flash with strict system instructions:
     - "You are FundFlow Co-Pilot. You must rely ONLY on the verified financial facts provided in context. Never invent financial figures. If information is missing, state what is required."
3. **Attach Citations & Audit Logging**:
   - Map LLM response back to `AICitation[]` citing specific transaction IDs and ledger aggregates.
   - Record conversation in `ai_conversations` and `ai_messages`.

### Verification Criteria
- Questions about spend, burn, and runway return responses matching the exact numbers in `FinancialEngine`.
- Out-of-domain questions (e.g. weather, general knowledge) trigger grounded refusal.
- Citations point to verified transactions in the active workspace.

### Risk
Medium. Requires proper prompt engineering, system instructions, and token budget management.

---

## Phase 5: Knowledge Base & Vector Search (pgvector / Semantic Retrieval)

### Objective
Enable true semantic search across uploaded financial policies, vendor contracts, and accounting documents.

### Scope of Changes
1. **Enable pgvector in Supabase**:
   - `CREATE EXTENSION IF NOT EXISTS vector;`
2. **Add Vector Column to `document_chunks`**:
   - `ALTER TABLE document_chunks ADD COLUMN embedding vector(768);` (or 1536 depending on embedding model).
3. **Implement Embedding Generation**:
   - On document upload in `app/documents/page.tsx`, generate embeddings via Gemini text-embedding model (`text-embedding-004`).
4. **Implement Cosine Similarity Match RPC**:
   - Create Supabase Postgres function `match_document_chunks(workspace_id, query_embedding, match_threshold, match_count)`.
5. **Update `retrieveWorkspaceRAGChunks`**:
   - Query Postgres vector match function instead of in-memory term frequency.

### Verification Criteria
- Uploading a policy document allows `/ask-ai` to retrieve and cite relevant excerpts based on semantic similarity.
- Queries across different workspaces only return documents from the active workspace.

### Risk
Medium. Requires pgvector support in the Supabase project.

---

## Phase 6: Backend Microservice Strategy & Production Polish

### Objective
Resolve the role of `backend/main.py` and optimize application performance.

### Scope of Changes
1. **Decision on Python Backend**:
   - **Option A (Recommended)**: Deprecate `backend/main.py`. The Next.js 16 App Router handles all API routes, calculations, and AI interactions in TypeScript, eliminating dual-stack operational overhead.
   - **Option B**: If heavy scientific computing (NumPy/Pandas) or custom fine-tuned models are required in Python, formalize an internal API gateway from Next.js server actions to FastAPI with shared authentication.
2. **Typography & Font Optimization**:
   - Migrate Google Fonts in `app/layout.tsx` from CDN `<link>` tags to `next/font/google` (`Inter`, `JetBrains_Mono`), eliminating the Next.js lint warning and improving LCP.
3. **Image Optimization**:
   - Replace standard `<img>` tags in `app/settings/page.tsx` with Next.js `<Image />` component.

### Verification Criteria
- Single unified stack running smoothly on `npm run dev` and `npm run build`.
- Zero ESLint warnings or errors across the entire codebase.
- Lighthouse / Core Web Vitals audit shows optimal performance scores.

### Risk
Low. Cleanup and optimization phase.
