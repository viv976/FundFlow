# FundFlow Production Refinement — Group 1: Engineering Foundation

This document outlines the architectural and engineering foundation improvements implemented during Group 1 of the FundFlow production refinement.

---

## 1. Architectural Decisions

1. **Clear Layer Separation:**
   - **Presentation/UI:** Dashboard pages and components (`app/transactions/page.tsx`, `app/reports/page.tsx`, `components/`) now focus exclusively on rendering and interaction. They no longer execute raw transaction arithmetic or array reductions inline.
   - **Financial Domain Logic:** All financial calculations (cash on hand, monthly burn, runway, MoM growth, cash-flow projections, category breakdown, inflow/outflow, and scenario modeling) are centralized in `lib/finance/calculator.ts`.
   - **Data Access:** Database interactions in `lib/supabase/db.ts` and route handlers standardize on UUID validation and sanitized diagnostic logging.
   - **AI/RAG Services:** Retains structured retrieval in `lib/ai/financial-retriever.ts` and typed intent routing in `lib/ai/intent-router.ts` and `lib/ai/intent-parser.ts`.
   - **Validation Boundary:** Inbound payloads, route parameters, AI prompts, and CSV records are verified via a zero-dependency domain validation layer (`lib/validation/index.ts`).
   - **Error Handling & Diagnostics:** Centralized typed error hierarchy and user-safe message masking in `lib/errors/index.ts`. Sensitive credentials (tokens, passwords, keys, connection strings) are automatically redacted before logging.

2. **Zero External Validation Dependencies:**
   - Instead of adding heavy runtime libraries, a robust, zero-dependency validation module (`lib/validation/index.ts`) was created using native TypeScript types, ISO date validators, UUID v4 regex checking, and numeric sanitizers.

3. **User-Safe Error Masking:**
   - Internal Postgres constraint names, connection errors, and table structures are intercepted and translated into user-safe messages via `getUserSafeErrorMessage()`.
   - Detailed operational data is logged safely via `sanitizeContext()`.

---

## 2. Files Changed & Created

### Created Files
- `lib/errors/index.ts`: Standardized error classes (`AppError`, `ValidationError`, `AuthorizationError`, `NotFoundError`, `DatabaseError`), user-safe message formatter `getUserSafeErrorMessage`, and sensitive credential redaction `sanitizeContext`.
- `lib/validation/index.ts`: Centralized validation boundaries (`isValidUUID`, `isValidISODate`, `sanitizeCurrency`, `validateTransactionInput`, `validateWorkspaceInput`, `validateChatInput`, `validateFinancialMetrics`, `validateCsvRow`).
- `vitest.config.mts`: Configured path alias resolution (`@/*`) and native ESM support for Vitest.
- `tests/unit/calculator.test.ts`: Automated test suite for cash balance, monthly burn, runway, inflow/outflow, net cash flow, and what-if calculations.
- `tests/unit/validation.test.ts`: Automated test suite for UUIDs, dates, currency, transaction input, workspace input, and chat prompt validation.
- `tests/unit/errors.test.ts`: Automated test suite for custom error classes, user-safe error masking, and recursive credential redaction.
- `docs/FOUNDATION_CHANGES.md`: This summary document.

### Modified Files
- `lib/finance/calculator.ts`:
  - Added centralized helpers: `calculateTotalInflow`, `calculateTotalOutflow`, `calculateNetCashFlow`, `calculateTotalFromBreakdown`.
  - Cleaned up unused variables and strengthened parameter typing.
- `lib/finance/csv-importer.ts`:
  - Fixed lint issues (`prefer-const` across date extraction tokens, removed unused variable).
- `lib/supabase/db.ts`:
  - Replaced 4 duplicate inline UUID regex patterns with `isValidUUID`.
  - Integrated `sanitizeContext` into `logDiagnosticDbError` to prevent credential leakage in logs.
- `app/transactions/page.tsx`:
  - Replaced inline transaction array reductions with centralized `calculateTotalInflow` and `calculateTotalOutflow`.
- `app/reports/page.tsx`:
  - Replaced inline expense breakdown reduction with `calculateTotalFromBreakdown`.
- `components/layout/TopHeader.tsx`:
  - Removed unused `title` prop to ensure clean TypeScript/ESLint checks.
- `components/upload/CSVUploadZone.tsx`:
  - Removed unused `DetectedMapping` import.
- `app/api/transactions/route.ts`:
  - Added UUID validation for `workspaceId` query param.
  - Added `validateTransactionInput` payload validation.
  - Replaced silent `console.error` and raw error responses with `getUserSafeErrorMessage`.
- `app/api/transactions/bulk/route.ts`:
  - Added UUID validation for workspace.
  - Applied user-safe error messaging.
- `app/api/workspaces/route.ts`:
  - Added `validateWorkspaceInput` validation.
  - Applied user-safe error messaging.
- `app/api/chat/route.ts`:
  - Added `validateChatInput` boundary (checking for empty prompts and 4,000 character limits).
  - Validated workspace UUID.
  - Applied user-safe error messaging.

---

## 3. Financial Calculations Centralized

All presentation components now import calculations from `lib/finance/calculator.ts`.

| Calculation | Location | Purpose |
|---|---|---|
| **Cash Balance / Cash on Hand** | `calculateCashOnHand` | Baseline starting balance + verified income - verified expenses |
| **Monthly Burn** | `calculateMonthlyBurn` | Rolling multi-month average of operational outflows |
| **Net Monthly Burn** | `calculateNetMonthlyBurn` | Current month expenses minus current month income |
| **Runway** | `calculateRunway` | Cash on hand divided by burn; handles zero/negative burn safely |
| **Total Inflow** | `calculateTotalInflow` | Centralized income calculation excluding failed status |
| **Total Outflow** | `calculateTotalOutflow` | Centralized expense calculation excluding failed status |
| **Net Cash Flow** | `calculateNetCashFlow` | Total Inflow minus Total Outflow |
| **Category Breakdown Total** | `calculateTotalFromBreakdown` | Derived total from categorized expense items |
| **MoM Growth** | `calculateMoMGrowth` | Month-over-month income, burn, and cash trajectory percentages |
| **Cash-Flow Projection** | `generateCashFlowProjection` | 6-month projected forward curve |
| **What-If Scenario Modeling** | `calculateWhatIfScenario` | Headcount and spending impact on burn and runway |

---

## 4. Validation Boundaries Added

- **Transaction Payloads (`validateTransactionInput`):**
  - Requires valid description (non-empty, <= 500 chars).
  - Enforces positive, finite numeric amounts.
  - Validates `transaction_type` ('income' | 'expense').
  - Validates `transaction_date` as valid YYYY-MM-DD ISO format.
  - Validates status and source types.
- **CSV Records (`validateCsvRow`):**
  - Enforces mandatory date, description, and numeric amount fields per row before ingestion.
- **Financial Metrics (`validateFinancialMetrics`):**
  - Verifies non-negative, finite numbers for cash on hand, monthly burn, and runway months.
- **AI Prompts (`validateChatInput`):**
  - Validates non-empty input strings with an upper limit of 4,000 characters.
- **Entity Identifiers (`isValidUUID`):**
  - Enforces standard UUID v4 format across route params (`workspaceId`, `userId`, `transactionId`).

---

## 5. Errors and Edge Cases Fixed

1. **Raw Database Error Leakage:**
   - Previously, database error messages were passed directly to API responses (e.g. leaking Postgres constraint names). These are now intercepted and replaced with user-safe descriptions.
2. **Logging of Sensitive Context:**
   - Diagnostic logging in `db.ts` now uses `sanitizeContext()` to ensure service keys, auth headers, and tokens are redacted as `[REDACTED]`.
3. **Silent Failures in Routes:**
   - API endpoints (`/api/transactions`, `/api/workspaces`, `/api/chat`) previously responded with raw objects or generic 500s on bad inputs. They now return structured `{ error: string }` with appropriate HTTP status codes (400 for validation failures, 404 for missing entities, 500 for internal errors).
4. **Zero/Negative Burn Runway Safety:**
   - `calculateRunway` handles profitable (zero/negative burn) conditions gracefully (`runwayMonths: 999`, `display: 'Profitable / Infinite'`) and non-positive cash (`runwayMonths: 0`).
5. **Lint and Typo Fixes:**
   - Resolved `prefer-const` and unused parameter warnings in `csv-importer.ts`, `TopHeader.tsx`, and `CSVUploadZone.tsx`.

---

## 6. Verification & Automated Checks Run

All checks executed and passed:

1. **Linting:**
   ```bash
   npm run lint
   # Output: 0 errors, 4 non-fatal warnings (pre-existing Next.js font/image tags)
   ```
2. **Type Checking:**
   ```bash
   npx tsc --noEmit
   # Output: 0 errors (Exit code 0)
   ```
3. **Unit Tests (Vitest):**
   ```bash
   npx vitest run
   # Output:
   # Test Files: 3 passed (3)
   # Tests: 31 passed (31)
   # Duration: 99ms
   ```
4. **Production Build:**
   ```bash
   npm run build
   # Output: Compiled successfully in 470ms
   # 22/22 routes statically generated or dynamically rendered without errors
   ```

---

## 7. Remaining Risks & Considerations for Future Groups

- **Authentication & Real User Workspaces:**
  - Route handlers currently fallback to demo workspace IDs if headers/auth cookies are not yet populated. Group 2/3 should integrate verified Supabase auth session checks across all API handlers.
- **Plaid Sync Integration:**
  - Mock integration exists for bank syncing; production token exchange and webhook verification remain to be hardened in subsequent phases.
- **Client-Side Navigation Warning:**
  - `lib/store/finance-context.tsx` contains a pre-existing `window.location.href = '/login'` which triggers an ESLint warning recommending `useRouter().push()`. This was preserved to avoid altering runtime session reset behavior in Group 1.
