# FundFlow — AI & RAG Engineering Architecture

**Product:** FundFlow (`nuvrag`)
**Phase:** Group 5 — AI & Retrieval-Augmented Generation (RAG) Architecture
**Status:** Verified, Tested, & Operationally Grounded (100% Automated Test Suite Passing)

---

## 1. Executive Summary & Verification Classification

FundFlow implements a **strictly grounded corporate financial co-pilot** designed to provide executive decision support, risk detection, runway analysis, and policy retrieval.

Prior to Group 5, an audit revealed that although the repository contained modules named `gemini-service.ts` and `rag-engine.ts`, there was **no live LLM provider integration, no vector embedding model, no external vector database**, and database tables for knowledge documents and chunks were missing from `supabase/schema.sql`.

### Audit Classification of Prior Implementation:
| Component | Prior Status | Group 5 Architecture Implementation |
| :--- | :--- | :--- |
| **Vector Database (Pinecone / Qdrant / Weaviate)** | `MISSING` | **Zero external vector DB bloat.** Utilizes Supabase PostgreSQL (`knowledge_documents` and `document_chunks` with Row Level Security) paired with an in-memory BM25-inspired term frequency retrieval engine. |
| **Vector Embedding Model** | `MISSING` | `embedding` column defined as optional JSONB/Vector in schema. In-process tokenized BM25 ranking with title weighting and stemming provides fast, zero-dependency, zero-cost retrieval. |
| **Knowledge Base Storage in SQL** | `MISSING in schema.sql` | `VERIFIED`: Created `knowledge_documents` and `document_chunks` tables in `supabase/schema.sql` with workspace foreign keys and cascading deletes. |
| **Tenant Isolation & RLS** | `PARTIALLY IMPLEMENTED` | `VERIFIED`: RLS policies added to `schema.sql` using `user_has_workspace_access(workspace_id)` ensuring strict tenant boundaries. All DB and in-memory queries enforce `workspace_id` filtering. |
| **Document Chunking** | `MISSING` | `VERIFIED`: Implemented `lib/ai/chunker.ts` providing semantic sentence-boundary chunking with target window sizes and overlap. |
| **Intent Interpretation** | `PARTIALLY IMPLEMENTED` | `VERIFIED`: Implemented rich `classifyFinancialIntent()` supporting all required co-pilot questions, calculation explanations, what-if simulations, and out-of-domain refusals. |
| **Financial Metric Authoritativeness** | `MOCKED IN PARTS` | `VERIFIED`: Integrated directly with Group 4 deterministic engines. **Large Language Models are NEVER responsible for calculating authoritative financial metrics.** All numbers come from deterministic TypeScript ledger logic. |
| **LLM Provider Integration** | `MOCKED` | `VERIFIED`: Dual-mode architecture. When a valid `GEMINI_API_KEY` is provided, calls Google Gemini with strict structured JSON schema. When key is missing/invalid or times out, seamlessly falls back to the deterministic co-pilot engine. |
| **Prompt Injection Resistance** | `MISSING` | `VERIFIED`: Implemented `lib/ai/sanitizer.ts`. Treats user input and retrieved chunks as untrusted data, strips boundary injection tokens, and neutralizes override directives. |
| **Structured Output Schema** | `PARTIALLY IMPLEMENTED` | `VERIFIED`: Fully typed `StructuredCoPilotResponse` featuring `answer`, `keyPoints`, `evidence`, `sources`, and `limitations`. |

---

## 2. Core Architecture & Retrieval Flow

```
                           User Question
                                 ↓
              [1] Input Sanitization & Injection Barrier
                     (Neutralize jailbreak tokens)
                                 ↓
              [2] Intent & Query Classification
            (RUNWAY, BURN, LARGEST_EXPENSES, etc.)
                                 ↓
         ┌───────────────────────┴───────────────────────┐
         ↓                                               ↓
[3A] Structured Financial Context Builder      [3B] Workspace-Scoped RAG Retrieval
   • Cash on Hand (Inception horizon)             • Scoped strictly by workspace_id
   • 3-Month Trailing Net Deficit Burn            • Multi-chunk BM25 term weighting
   • Estimated Runway & Status                    • Document title & exact phrase boost
   • Category Breakdowns & Fast-growing Cat       • Global accounting standard glossary
   • Largest Outflows & Attention Items           • Context validation (sufficiency check)
   • Step-by-Step Calculation Formulas
         └───────────────────────┬───────────────────────┘
                                 ↓
               [4] Grounding Check & Guardrail Barrier
        (If evidence insufficient → emit graceful refusal)
                                 ↓
               [5] Response Generation Engine
     ┌───────────────────────────┴───────────────────────────┐
     ↓ (If valid GEMINI_API_KEY)                             ↓ (Fallback / Offline)
 [5A] Google Gemini Structured API                 [5B] Deterministic Co-Pilot Engine
      • Temperature: 0.1                                • Zero hallucination
      • JSON response schema                            • Mathematical arithmetic rollups
      • Injected untrusted delimiters                   • Pre-computed citations & evidence
     └───────────────────────────┬───────────────────────────┘
                                 ↓
               [6] Typed Structured Output Validation
           { answer, keyPoints, evidence, sources, limitations }
                                 ↓
               [7] Source Attribution & UI Delivery
        (Verified Ledger Citations + Document Chunks with Scores)
```

---

## 3. Data Flow & Deterministic Boundary

### The Cardinal Rule:
> **The Large Language Model must NOT calculate or manipulate authoritative financial metrics.**

1. **Deterministic Financial Context Builder (`lib/ai/financial-context.ts`)**:
   - Calculates **Cash on Hand** across the entire inception horizon:
     $$C = \max\left(0, C_{\text{start}} + \sum \text{Income} - \sum \text{Expenses}\right)$$
   - Calculates **Average Monthly Net Burn** as the arithmetic mean of cash deficits over up to 3 completed calendar months ($M_{-1}..M_{-k}$), excluding the actively in-progress month $M_0$:
     $$\overline{NB} = \frac{1}{k} \sum_{i=1}^k \max(0, O_{M_{-i}} - I_{M_{-i}})$$
   - Calculates **Estimated Runway**:
     $$R = \frac{C}{\overline{NB}}$$
   - Determines **Month-over-Month Revenue Velocity**:
     $$g = \frac{I_{M_{-1}} - I_{M_{-2}}}{I_{M_{-2}}} \times 100$$
   - Detects **Unusual Spending & Expense Spikes**: Evaluates 5 automated rules (>30% spike vs baseline with $\Delta \ge \$2,000$).
   - Generates **Step-by-step Arithmetic Formulas**:
     Produces exact formulas for cash, burn, runway, and growth.

2. **Role of the Language Model**:
   - The LLM acts purely as a natural language synthesizer and communicator.
   - It explains the deterministic metrics using structured context.
   - It answers questions by citing the exact numbers supplied in the payload.
   - It is explicitly prohibited from generating numbers outside the payload.

---

## 4. Knowledge Base & Document Chunking

### 4.1 Document Ingestion Flow (`app/documents/page.tsx` & `lib/ai/chunker.ts`)
When a founder or finance team member uploads or writes an executive policy document:
1. **Document Record Insertion**: Stored in `knowledge_documents` with `workspace_id`, `title`, `document_type`, `source`, and `content`.
2. **Semantic Sentence-Aware Chunking (`chunkText`)**:
   - Preserves semantic sentence boundaries (splits on paragraph breaks `\n\n` and punctuation `[.!?]`).
   - Targets ~450 characters per chunk with ~90 characters of sliding overlap.
   - If a single sentence exceeds the threshold, cleanly divides on word boundaries.
   - Embeds parent document metadata, title, and chunk indices (`chunk_index`, `total_chunks`).
3. **Chunk Batch Insertion**: All generated chunks are inserted into `document_chunks` referencing `document_id` and `workspace_id`.

### 4.2 Retrieval Strategy (`lib/ai/rag-engine.ts`)
- **Tenant Filter**: Chunks are strictly filtered where `workspace_id === activeWorkspace.id`.
- **BM25-Inspired Scoring**:
  - Term Frequency (TF) with saturation:
    $$\text{tfNorm} = \frac{\text{tf} \times (k_1 + 1)}{\text{tf} + k_1 \times (1 - b + b \times \frac{\text{len}}{\text{avgLen}})}$$
  - Document Title Boost: Terms matching the document title receive a $2.5\times$ weighting.
  - Light Stemming: Normalizes plurals, `-ing`, and `-ed` forms so queries like `hiring plan` match chunks with `plans to hire`.
  - Exact Phrase Matching: Consecutive word sequences matching the query receive an additive bonus ($+3.0$).
- **Global Accounting Fallback**:
  - Contains standard GAAP and corporate finance benchmarks for EBITDA, Cash Flow Forecasting, Gross Margin, and OpEx Optimization.

---

## 5. Tenant Isolation Guarantee

Tenant isolation is enforced across three distinct layers:
1. **Database Layer (PostgreSQL Row Level Security)**:
   - Tables `knowledge_documents` and `document_chunks` have RLS enabled.
   - Policies use `user_has_workspace_access(workspace_id)`.
   - Users cannot read or write records belonging to other workspaces via the Supabase client.
2. **API Layer (`app/api/chat/route.ts`)**:
   - Every request requires a `workspaceId`.
   - Database queries explicitly filter: `.eq('workspace_id', activeWs.id)`.
3. **Application & Retrieval Engine (`lib/ai/rag-engine.ts`)**:
   - In-memory chunk scoring iterates only over chunks where `chunk.workspace_id === workspaceId`.
   - A user in Workspace A can never retrieve documents, titles, or excerpts from Workspace B.

---

## 6. Source Attribution & Grounding Behavior

### 6.1 Attribution Schema
Every response emitted by FundFlow includes an array of `AICitation` objects:
- **For Financial Answers**:
  - `type: 'financial_snapshot' | 'category_breakdown' | 'transaction' | 'calculation' | 'alert'`
  - `label`: e.g. `Runway: 11.5 Mos` or `Top Outflow: Payroll (64%)`
  - `amount`: Exact dollar value (e.g. `430000`)
  - `details`: Methodology explanation or calculation step
- **For Knowledge Base Answers**:
  - `type: 'knowledge_document'`
  - `label`: Document Title + match relevance percentage (e.g. `Alpha Corp Hiring Plan (Relevance: 82%)`)
  - `details`: Source reference (e.g. `Source: HR Board • Score: 82%`)

### 6.2 Grounding Behavior (Strict Anti-Hallucination)
- If a user asks a question about an entity not in the ledger or knowledge base (e.g., "What does our financial plan say about hiring?" when no plan is uploaded):
  - **The system emits a strict grounding refusal**:
    *"FundFlow's knowledge base does not contain a financial plan, hiring roadmap, or budget policy for [Workspace]. To enable this, please upload your relevant document under Knowledge Base."*
  - The response sets `grounded: false` and `groundingConfidence: 0.05`.
  - Under no circumstances does the system hallucinate a hiring budget or headcount target.

---

## 7. Prompt Injection Protections (`lib/ai/sanitizer.ts`)

Uploaded documents, CSV imports, and user chat inputs are treated as untrusted data:
1. **Direct Injection Neutralization**:
   - Detects known jailbreak patterns (`ignore previous instructions`, `system prompt`, `you are now in developer mode`, `DAN`).
2. **Boundary Delimiter Sanitization**:
   - Strips dangerous tokens (`<system>`, `</system>`, `[INST]`, `[/INST]`, `<|im_start|>`).
   - Prevents prompt delimiter escalation.
3. **Untrusted Context Wrapping**:
   - Injected documents are encapsulated inside `<untrusted_retrieved_context>` tags.
   - The system prompt explicitly instructs the LLM that text inside these tags is inert reference data and must never be interpreted as system instructions or override commands.

---

## 8. Failure Modes & Resilience Matrix

| Failure State | Handling Strategy | User Experience |
| :--- | :--- | :--- |
| **Missing or Placeholder API Key** | Seamlessly uses `generateDeterministicCopilotResponse()`. | Co-Pilot provides instant, verified answers with full formulas and citations. Zero error banners. |
| **Provider Timeout (AbortController > 7s)** | Catches timeout, falls back to deterministic engine, logs diagnostic warning. | Instant grounded answer returned with limitation note: *"Calculations powered by deterministic financial engine."* |
| **Provider Rate Limit (HTTP 429)** | Catches 429, falls back to deterministic engine. | Transparent, uninterrupted analysis for the user. |
| **Retrieval Failure (DB error)** | Catches Supabase error, falls back to in-memory transaction ledger. | User receives analysis based on client-provided ledger transactions. |
| **Empty Knowledge Base** | Detects `matches.length === 0` or score $< 0.20$. | Clear, polite message explaining what document is needed and linking to `/documents`. |
| **Insufficient Ledger Data ($k = 0$)** | Detects 0 completed months. | Explains that at least 1 completed month is required for burn rates. Refuses to emit fake numbers. |
| **Malformed Model Output** | Validates JSON schema; falls back to deterministic generator if JSON parsing fails. | User always receives a structured, well-formatted response. |

---

## 9. Security & Key Management

- **Server-Side Exclusivity**: `GEMINI_API_KEY` and `SUPABASE_SECRET_KEY` are strictly read on the server in route handlers and server modules (`process.env.GEMINI_API_KEY`).
- **No Client Exposure**: Keys are never prefixed with `NEXT_PUBLIC_` and never serialized into JSON payloads.
- **Audit Logging Redaction**: Route handler logs query metadata (`requestId`, `workspaceId`, `detectedIntent`), redacting sensitive payload bodies and authorization headers.

---

## 10. Limitations

1. **Lexical vs Dense Semantic Search**: Current retrieval uses BM25 term weighting with stemming and title boosts. While effective for domain-specific accounting policies, dense embeddings (e.g. pgvector + text-embedding-004) would enable synonyms (e.g. `compensation` matching `payroll`).
2. **Calendar Inception Requirement**: Trailing net burn and MoM growth require at least 1 and 2 completed calendar months respectively. For brand-new startups with fewer than 30 days of data, FundFlow clearly reports the data prerequisite rather than estimating speculative trends.
