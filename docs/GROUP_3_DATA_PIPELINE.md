# FundFlow — Group 3: Financial Data Ingestion and Transaction Integrity

**Product:** FundFlow (`nuvrag`)
**Phase:** Group 3 — Financial Data Ingestion, Normalization, Persistence & Transaction Integrity
**Status:** Complete & Fully Verified

---

## 1. Executive Summary

Group 3 establishes an enterprise-grade financial data ingestion pipeline and transaction integrity layer for FundFlow. Prior to Group 3, CSV parsing mixed parsing heuristics, validation, and optimistic persistence in an ad-hoc manner, lacked date ambiguity protection, could silently resolve direction signals, and did not guarantee idempotency under concurrent bulk imports.

Group 3 introduces a strictly decoupled data ingestion architecture with crystal-clear boundaries:

```
CSV Input
   │
   ▼
[Step 1 & 2] Parser (PapaParse, file constraints, header extraction, column heuristics)
   │
   ▼
[Step 3 & 4] Validator (Required fields, 5-stage direction resolution, date ambiguity, fingerprint deduplication)
   │
   ▼
[Step 5 & 6] Normalizer & Server Persistence (Sign normalization, UUID v4, authoritative server boundary, concurrency safety)
   │
   ▼
[Step 7] Completion Report & Transaction Detail View
   │
   ▼
Financial Engine (lib/finance/calculator.ts — untouched, consumes canonical normalized transactions)
```

---

## 2. Core Architectural Principles

### 2.1 Deterministic Direction Resolution

Financial CSV exports represent amounts inconsistently across banks. Some use negative signs for expenses, some use separate debit and credit columns, and many represent all amounts as positive numbers while relying on an explicit `Type` column.

FundFlow enforces an explicit, deterministic 5-stage precedence rule. Conflicting signals produce a `DIRECTION_CONFLICT` error rather than being silently resolved:

1. **Rule 1 — Simultaneous Debit and Credit Positive**:
   - If both `Debit` and `Credit` columns contain numeric positive values ($> 0$), immediately reject the row with `DIRECTION_CONFLICT`.
2. **Rule 2 — Unambiguous Debit / Credit Signal**:
   - `debit > 0` $\rightarrow$ resolved to `expense`.
   - `credit > 0` $\rightarrow$ resolved to `income`.
   - Conflict check: If an explicit transaction type is also mapped and conflicts (e.g. Debit populated + Type = 'income', or Credit populated + Type = 'expense'), immediately reject with `DIRECTION_CONFLICT`.
3. **Rule 3 — Explicit Transaction Type Resolution**:
   - If an explicit transaction type is mapped and valid (`'income'` or `'expense'`), use the explicit type.
   - **Critical rule**: A raw positive amount alone does NOT imply income when an explicit type exists. Positive amount + `type="expense"` and negative amount + `type="income"` are completely valid.
4. **Rule 4 — Signed Amount Fallback**:
   - If neither Debit/Credit nor explicit Type is mapped, derive direction from the signed amount:
     - Negative amount or accounting parentheses (e.g. `-150.00` or `(150.00)`) $\rightarrow$ `expense`.
     - Positive amount (e.g. `+150.00` or `150.00`) $\rightarrow$ `income`.
5. **Rule 5 — Unknown Direction**:
   - If no reliable signal exists (amount is 0, NaN, or unparseable), reject with `UNKNOWN_DIRECTION` or `MALFORMED_AMOUNT`.

**Post-Normalization Invariants**:
- `amount` is guaranteed to be a strictly positive finite float (`Math.abs(amount) > 0`).
- `transaction_type` is guaranteed to be strictly `'income' | 'expense'`.

---

### 2.2 Date Ambiguity Protection

Dates such as `01/02/2026` cannot be reliably disambiguated by automated code without domain context (is it February 1st under `DD/MM/YYYY` or January 2nd under `MM/DD/YYYY`?).

- When `DateFormatPreference` is `AUTO`, if both day and month tokens are $\le 12$ and non-identical, the pipeline flags the date as `AMBIGUOUS_DATE` (severity: warning).
- Ambiguous dates are surfaced in Step 4 (Validation Preview) with quick-action format selectors.
- Once the user explicitly selects `DD/MM/YYYY` or `MM/DD/YYYY`, the batch is unambiguously normalized before persistence.
- Dates where day = month (e.g. `05/05/2026`) or where day $> 12$ are resolved cleanly without ambiguity.

---

### 2.3 Transaction Identity & Concurrency-Safe Deduplication

1. **Runtime Persistence ID**:
   - Each persisted transaction receives a randomly generated RFC 4122 UUID v4 (`crypto.randomUUID()`).
   - UUID v4 is strictly non-deterministic and unique per entity record.
2. **Deterministic Workspace-Scoped Fingerprint**:
   - For duplicate detection, a canonical deterministic fingerprint string is constructed:
     ```
     ${workspace_id}|${transaction_date}|${normalized_description}|${amount.toFixed(2)}|${transaction_type}
     ```
   - Scoped strictly to the target `workspace_id`. Identical transactions in different workspaces produce distinct fingerprints and do not conflict.
3. **Database-Enforced Unique Constraint**:
   - Defined in `supabase/schema.sql`:
     ```sql
     CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_workspace_canonical_dedup
     ON transactions (
         workspace_id,
         transaction_date,
         LOWER(TRIM(description)),
         amount,
         transaction_type
     );
     ```
4. **Server Persistence Boundary Safety**:
   - Client-side normalization is not treated as a security boundary.
   - `POST /api/transactions/bulk` independently validates:
     - Multi-tenant workspace authorization and UUID format.
     - Positive finite amount (`> 0` and `isFinite`).
     - Strictly `'income' | 'expense'`.
     - Required non-empty description and valid ISO date.
     - Intra-batch and existing ledger fingerprint checks.
     - Gracefully traps PostgreSQL unique constraint violation error code `23505` during concurrent inserts, identifying the race-condition duplicate and reporting it under `duplicateCount` / `duplicates` rather than failing the entire batch or creating duplicates.
   - Never silently drops duplicates.

---

### 2.4 Mutually Exclusive Ingestion Outcomes

The pipeline strictly partitions every input record into one of three mutually exclusive outcomes:
1. **Imported (`valid`)**: Structurally valid records that are not duplicates and are ready for persistence.
2. **Rejected (`invalid`)**: Records that fail structural validation (malformed date, malformed amount, missing required description, or direction conflict).
3. **Duplicate / Skipped (`duplicate`)**: Structurally valid records whose canonical fingerprint matches another record in the same CSV or an existing record in the target workspace ledger.

**Strict Counting Invariant**:
$$\text{Total Records} = \text{Valid Records} + \text{Invalid Records} + \text{Duplicate Candidates}$$

Duplicate records are **never** counted as invalid/rejected records.
- For 2 duplicate records: `Total: 2, Valid: 0, Invalid: 0, Duplicates: 2`.
- For 1 existing-ledger duplicate: `Total: 1, Valid: 0, Invalid: 0, Duplicates: 1`.
- Completion summary reports: `Records Imported: 0, Duplicates Skipped: N, Records Rejected: 0`.

---

### 2.5 Strict Boundary to Financial Engine

`lib/finance/calculator.ts` and its public contracts were completely untouched. The financial engine acts purely as a downstream consumer of canonical normalized `Transaction[]` objects.

---

## 3. Modular 7-Step Ingestion Workflow UI

The UI architecture was decomposed from a monolithic file into modular step components orchestrated by `components/upload/CSVUploadZone.tsx`:

| Step | Component | Responsibilities |
| :--- | :--- | :--- |
| **Step 1: Upload** | `steps/Step1Upload.tsx` | Drag-and-drop file acceptance, `.csv` validation, 50MB file size boundary, empty/corrupted file error banners. |
| **Step 2: Parse** | `steps/Step2Parse.tsx` | Row count, column count, detected column chips, raw 5-row table preview, navigation controls. |
| **Step 3: Column Mapping** | `steps/Step3ColumnMapping.tsx` | Interactive selectors for Date, Description, Amount (or Debit/Credit), Category, Type, Merchant, External Ref. Date format resolution (`AUTO`, `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`). Confidence score badges. |
| **Step 4: Validation Preview** | `steps/Step4ValidationPreview.tsx` | Diagnostic metric cards (Total, Valid, Invalid, Missing Categories, Malformed Dates, Malformed Amounts, Duplicate Candidates, Ambiguous Dates, Direction Conflicts). Diagnostic issue table with severity filters. Ambiguous date format resolution banner. |
| **Step 5: Confirmation** | `steps/Step5Confirmation.tsx` | Displays exactly what will be persisted (with financial volume impact) vs excluded rows with reasons. |
| **Step 6: Persistence** | `steps/Step6Persistence.tsx` | Visual progress indicator communicating server-side validation and database write. |
| **Step 7: Completion** | `steps/Step7Completion.tsx` | Ingestion summary (records imported, duplicates skipped, records rejected with reasons), direct navigation to `/transactions` and reset action. |

---

## 4. Authentic Transaction Detail View

Implemented in `components/transactions/TransactionDetailModal.tsx` and integrated into `components/transactions/TransactionTable.tsx`:

- Displays authentic properties supported by the `Transaction` model:
  - Date (`transaction_date`)
  - Description (`description`)
  - Normalized Amount (positive formatted with sign and currency)
  - Flow Type (`transaction_type` badge)
  - Category (`category`)
  - Status (`status`)
  - Source (`source`)
  - Currency (`currency`)
  - Workspace Ownership (`workspace_id`)
  - Optional authentic fields: `merchant`, `subcategory`, `external_reference`, `metadata` (rendered as key-value pairs if present), timestamps (`created_at`).
- **Zero fabricated data**: If a field is not present in the record, it is cleanly omitted or displayed as "—", never inventing placeholder data.

---

## 5. Automated Test Coverage

61 automated unit tests across 4 test suites pass in 133ms via Vitest:

| Test Suite | File | Tests | Coverage |
| :--- | :--- | :--- | :--- |
| **Data Pipeline** | `tests/unit/data-pipeline.test.ts` | 30 tests | 5-stage direction resolution, debit/credit conflicts, date ambiguity (AUTO vs DD/MM vs MM/DD), deterministic fingerprinting, multi-workspace isolation, intra-batch and cross-ledger duplicates, mutually exclusive result counts, mixed batches, missing fields, malformed amounts, deterministic categorization. |
| **Financial Calculator** | `tests/unit/calculator.test.ts` | 10 tests | Cash on hand, monthly burn, runway, inflows/outflows, net cash flow, what-if scenarios. |
| **Validation Layer** | `tests/unit/validation.test.ts` | 14 tests | UUID v4 validation, ISO dates, currency sanitizer, transaction payloads, workspace inputs, chat prompts. |
| **Error Handling** | `tests/unit/errors.test.ts` | 7 tests | Typed error hierarchy, user-safe error masking, credential sanitization. |

---

## 6. Verification Results

All automated gates executed and passed:

1. **Unit Tests (`npm test`)**:
   ```bash
   Test Files: 4 passed (4)
   Tests:      61 passed (61)
   Duration:   133ms
   Exit code:  0
   ```
2. **TypeScript Typecheck (`npx tsc --noEmit`)**:
   ```bash
   Exit code: 0 (Zero type errors)
   ```
3. **Linter (`npm run lint`)**:
   ```bash
   Exit code: 0 (0 errors, 4 non-fatal pre-existing warnings)
   ```
4. **Production Build (`npm run build`)**:
   ```bash
   ▲ Next.js 16.3.3 (Turbopack)
   ✓ Compiled successfully in 706ms
   ✓ Finished TypeScript in 1240ms
   ✓ Generating static pages (24/24) in 228ms
   Exit code: 0
   ```
