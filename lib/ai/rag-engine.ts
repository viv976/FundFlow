import { DatabaseKnowledgeDocument, DatabaseDocumentChunk } from '@/lib/supabase/types';
import { sanitizeUntrustedDocument } from './sanitizer';

export interface RetrievedChunkResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  score: number;
  chunkIndex?: number;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface RAGRetrievalOutput {
  query: string;
  workspaceId: string;
  matches: RetrievedChunkResult[];
  hasSufficientEvidence: boolean;
  topScore: number;
}

/**
 * Standard financial and accounting glossary knowledge chunks
 * Built-in general accounting knowledge base for FundFlow
 */
export const GLOBAL_FINANCIAL_KNOWLEDGE = [
  {
    title: 'EBITDA Definition and Calculation',
    content:
      'EBITDA stands for Earnings Before Interest, Taxes, Depreciation, and Amortization. It is a standard metric used to measure a company\'s overall financial performance and core operating profitability by stripping out financing decisions, accounting practices, and tax environments. Formula: EBITDA = Operating Profit (EBIT) + Depreciation Expense + Amortization Expense.',
    keywords: ['ebitda', 'earnings', 'depreciation', 'amortization', 'operating profit', 'interest', 'taxes'],
  },
  {
    title: 'Cash Flow Forecasting and Runway',
    content:
      'Cash flow forecasting involves estimating the amount of money expected to flow in and out of the business over a specific future timeframe. For startups, cash runway measures how many months the business can continue operating before exhausting its cash reserves. Formula: Runway (Months) = Cash on Hand / Net Monthly Burn Rate.',
    keywords: ['cash flow', 'cash-flow', 'forecasting', 'runway', 'forecast', 'burn rate', 'working capital'],
  },
  {
    title: 'Gross Margin & Unit Economics',
    content:
      'Gross Margin is the percentage of total sales revenue that the company retains after incurring the direct costs associated with producing the goods and services sold (COGS). Formula: Gross Margin % = ((Revenue - COGS) / Revenue) * 100. High gross margins indicate strong pricing power and scalable unit economics.',
    keywords: ['gross margin', 'margin', 'cogs', 'unit economics', 'cost of goods', 'pricing power'],
  },
  {
    title: 'Operating Expense (OpEx) Optimization',
    content:
      'Operating expenses (OpEx) include payroll, marketing, cloud infrastructure (AWS/GCP), and SaaS subscriptions. Strategies to reduce burn include: audit SaaS seat utilization to eliminate unassigned licenses, renegotiate vendor contracts or shift to annual upfront discounting, optimize cloud instance autoscaling, and focus paid marketing only on channels with proven payback periods under 12 months.',
    keywords: ['reduce expenses', 'reduce burn', 'operating expenses', 'opex', 'cut cost', 'cost reduction', 'optimize spend', 'saas optimization'],
  },
];

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'our', 'what', 'does', 'how', 'say', 'about',
]);

function stemWord(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
  return word;
}

/**
 * Tokenize and normalize text into meaningful terms with stemming
 */
export function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .map(stemWord);
}

/**
 * Production-sensible BM25-inspired term frequency and inverse document frequency scorer
 */
function scoreDocumentBM25(
  queryTokens: string[],
  docTokens: string[],
  avgDocLen: number,
  titleTokens: string[] = [],
  rawQuery: string = '',
  rawDoc: string = ''
): number {
  if (queryTokens.length === 0 || docTokens.length === 0) return 0;

  const k1 = 1.2;
  const b = 0.75;
  const docLen = docTokens.length;

  const docFreq: Record<string, number> = {};
  for (const t of docTokens) {
    docFreq[t] = (docFreq[t] || 0) + 1;
  }

  const titleSet = new Set(titleTokens);
  let totalScore = 0;

  for (const term of queryTokens) {
    const tf = docFreq[term] || 0;
    if (tf === 0) continue;

    // BM25 Term Frequency saturation with length normalization
    const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / Math.max(1, avgDocLen))));

    // Title match boost
    const titleMultiplier = titleSet.has(term) ? 2.5 : 1.0;

    totalScore += tfNorm * titleMultiplier;
  }

  // Exact phrase match bonus
  if (rawQuery.length > 5 && rawDoc.toLowerCase().includes(rawQuery.toLowerCase())) {
    totalScore += 3.0;
  }

  // Normalized similarity score between 0.0 and 1.0
  const maxPossible = queryTokens.length * (k1 + 1) * 2.5 + 3.0;
  return Math.min(1.0, Math.round((totalScore / maxPossible) * 100) / 100);
}

/**
 * Retrieve semantic knowledge chunks strictly scoped by workspace ID (Tenant Isolation)
 */
export function retrieveWorkspaceRAGChunks(
  query: string,
  workspaceId: string,
  workspaceDocs: DatabaseKnowledgeDocument[] = [],
  workspaceChunks: DatabaseDocumentChunk[] = [],
  similarityThreshold: number = 0.20
): RAGRetrievalOutput {
  const queryTokens = tokenizeText(query);
  const scoredChunks: RetrievedChunkResult[] = [];

  // Strictly filter to current tenant workspace
  const tenantDocs = workspaceDocs.filter((d) => d.workspace_id === workspaceId);
  const tenantChunks = workspaceChunks.filter((c) => c.workspace_id === workspaceId);

  // Compute average length across tenant chunks
  const avgChunkLen = tenantChunks.length > 0
    ? tenantChunks.reduce((acc, c) => acc + tokenizeText(c.content).length, 0) / tenantChunks.length
    : 30;

  // 1. Score workspace document chunks (Fine-grained retrieval)
  for (const chunk of tenantChunks) {
    const parentDoc = tenantDocs.find((d) => d.id === chunk.document_id);
    const docTitle = parentDoc?.title || (chunk.metadata?.title as string) || 'Workspace Knowledge Document';
    const titleTokens = tokenizeText(docTitle);
    const chunkTokens = tokenizeText(`${docTitle} ${chunk.content}`);

    const score = scoreDocumentBM25(queryTokens, chunkTokens, avgChunkLen, titleTokens, query, `${docTitle} ${chunk.content}`);

    if (score >= similarityThreshold) {
      scoredChunks.push({
        chunkId: chunk.id,
        documentId: chunk.document_id,
        documentTitle: docTitle,
        content: sanitizeUntrustedDocument(chunk.content),
        score,
        chunkIndex: chunk.chunk_index,
        source: parentDoc?.source || (chunk.metadata?.source as string) || 'Knowledge Base',
        metadata: (chunk.metadata as Record<string, unknown>) || undefined,
      });
    }
  }

  // 2. Score whole workspace documents if chunks didn't yield matches
  if (scoredChunks.length === 0) {
    const avgDocLen = tenantDocs.length > 0
      ? tenantDocs.reduce((acc, d) => acc + tokenizeText(d.content).length, 0) / tenantDocs.length
      : 50;

    for (const doc of tenantDocs) {
      const docTitle = doc.title || 'Workspace Knowledge Document';
      const titleTokens = tokenizeText(docTitle);
      const docTokens = tokenizeText(doc.content);

      const score = scoreDocumentBM25(queryTokens, docTokens, avgDocLen, titleTokens, query, doc.content);

      if (score >= similarityThreshold) {
        scoredChunks.push({
          chunkId: `doc-${doc.id}`,
          documentId: doc.id,
          documentTitle: docTitle,
          content: sanitizeUntrustedDocument(doc.content),
          score,
          chunkIndex: 0,
          source: doc.source || 'Knowledge Base',
          metadata: (doc.metadata as Record<string, unknown>) || undefined,
        });
      }
    }
  }

  // 3. Fallback: Search global accounting glossary for standard domain definitions
  for (const item of GLOBAL_FINANCIAL_KNOWLEDGE) {
    const titleTokens = tokenizeText(item.title);
    const itemTokens = tokenizeText(`${item.content} ${item.keywords.join(' ')}`);

    const score = scoreDocumentBM25(queryTokens, itemTokens, 35, titleTokens, query, item.content);

    if (score >= similarityThreshold) {
      scoredChunks.push({
        chunkId: `global-${item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        documentId: 'global-accounting-reference',
        documentTitle: item.title,
        content: item.content,
        score,
        source: 'Corporate Accounting Standard Reference',
      });
    }
  }

  // Sort by highest score descending
  scoredChunks.sort((a, b) => b.score - a.score);
  const topMatches = scoredChunks.slice(0, 3);
  const topScore = topMatches.length > 0 ? topMatches[0].score : 0;

  return {
    query,
    workspaceId,
    matches: topMatches,
    hasSufficientEvidence: topMatches.length > 0 && topScore >= similarityThreshold,
    topScore,
  };
}
