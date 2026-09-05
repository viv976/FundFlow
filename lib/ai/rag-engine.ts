import { DatabaseKnowledgeDocument, DatabaseDocumentChunk } from '@/lib/supabase/types';

export interface RetrievedChunkResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  score: number;
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
const GLOBAL_FINANCIAL_KNOWLEDGE = [
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

/**
 * Tokenize and vectorize text for cosine similarity calculation
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function calculateCosineSimilarity(query: string, documentText: string): number {
  const queryTokens = tokenize(query);
  const docTokens = tokenize(documentText);

  if (queryTokens.length === 0 || docTokens.length === 0) return 0;

  const allWords = Array.from(new Set([...queryTokens, ...docTokens]));
  const queryFreq: Record<string, number> = {};
  const docFreq: Record<string, number> = {};

  for (const w of queryTokens) queryFreq[w] = (queryFreq[w] || 0) + 1;
  for (const w of docTokens) docFreq[w] = (docFreq[w] || 0) + 1;

  let dotProduct = 0;
  let queryMag = 0;
  let docMag = 0;

  for (const w of allWords) {
    const qVal = queryFreq[w] || 0;
    const dVal = docFreq[w] || 0;
    dotProduct += qVal * dVal;
    queryMag += qVal * qVal;
    docMag += dVal * dVal;
  }

  if (queryMag === 0 || docMag === 0) return 0;

  return dotProduct / (Math.sqrt(queryMag) * Math.sqrt(docMag));
}

/**
 * Retrieve semantic chunks for user query scoped by workspace
 */
export function retrieveWorkspaceRAGChunks(
  query: string,
  workspaceId: string,
  workspaceDocs: DatabaseKnowledgeDocument[],
  workspaceChunks: DatabaseDocumentChunk[],
  similarityThreshold: number = 0.20
): RAGRetrievalOutput {
  const scoredChunks: RetrievedChunkResult[] = [];

  // 1. Score workspace document chunks
  for (const chunk of workspaceChunks) {
    if (chunk.workspace_id !== workspaceId) continue;

    const parentDoc = workspaceDocs.find((d) => d.id === chunk.document_id);
    const docTitle = parentDoc?.title || 'Workspace Knowledge Document';

    const score = calculateCosineSimilarity(query, `${docTitle} ${chunk.content}`);
    if (score >= similarityThreshold) {
      scoredChunks.push({
        chunkId: chunk.id,
        documentId: chunk.document_id,
        documentTitle: docTitle,
        content: chunk.content,
        score: Math.round(score * 100) / 100,
        metadata: (chunk.metadata as Record<string, unknown>) || undefined,
      });
    }
  }

  // 2. Score whole workspace documents if chunks didn't yield matches
  if (scoredChunks.length === 0) {
    for (const doc of workspaceDocs) {
      if (doc.workspace_id !== workspaceId) continue;
      const score = calculateCosineSimilarity(query, `${doc.title} ${doc.content}`);
      if (score >= similarityThreshold) {
        scoredChunks.push({
          chunkId: `doc-${doc.id}`,
          documentId: doc.id,
          documentTitle: doc.title,
          content: doc.content,
          score: Math.round(score * 100) / 100,
          metadata: (doc.metadata as Record<string, unknown>) || undefined,
        });
      }
    }
  }

  // 3. Fallback: Search global accounting knowledge base for accounting definitions
  for (const item of GLOBAL_FINANCIAL_KNOWLEDGE) {
    const score = calculateCosineSimilarity(query, `${item.title} ${item.content} ${item.keywords.join(' ')}`);
    if (score >= similarityThreshold) {
      scoredChunks.push({
        chunkId: `global-${item.title.toLowerCase().replace(/\s+/g, '-')}`,
        documentId: 'global-accounting-docs',
        documentTitle: item.title,
        content: item.content,
        score: Math.round(score * 100) / 100,
      });
    }
  }

  // Sort by highest similarity score
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
