/**
 * Production-sensible document chunker for FundFlow Knowledge Base
 * Splits text into overlapping, sentence-aware semantic windows.
 */

export interface ChunkOptions {
  maxChunkSize?: number; // target character count (default: 450)
  overlap?: number;      // target character overlap (default: 90)
  title?: string;
  source?: string;
  documentType?: string;
}

export interface GeneratedChunk {
  chunkIndex: number;
  content: string;
  charCount: number;
  metadata: {
    chunk_index: number;
    total_chunks: number;
    title: string;
    source: string;
    document_type?: string;
  };
}

/**
 * Split text into semantic sentences while preserving punctuation
 */
function splitIntoSentences(text: string): string[] {
  // Normalize whitespace
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  // Split on double newlines (paragraphs) first
  const paragraphs = normalized.split(/\n\s*\n/);
  const sentences: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Split paragraph into sentences by punctuation (.!?) followed by space or newline
    const rawSentences = trimmed.split(/(?<=[.!?])\s+/);
    for (const s of rawSentences) {
      const sTrim = s.trim();
      if (sTrim) {
        sentences.push(sTrim);
      }
    }
  }

  return sentences;
}

/**
 * Generate overlapping chunks from raw text
 */
export function chunkText(text: string, options: ChunkOptions = {}): GeneratedChunk[] {
  const maxChunkSize = options.maxChunkSize || 450;
  const overlap = options.overlap || 90;
  const title = options.title || 'Knowledge Document';
  const source = options.source || 'Manual Input';
  const documentType = options.documentType;

  const cleanText = text.trim();
  if (!cleanText) return [];

  // Short document fast-path: if text is small, a single chunk is optimal
  if (cleanText.length <= maxChunkSize) {
    return [
      {
        chunkIndex: 0,
        content: cleanText,
        charCount: cleanText.length,
        metadata: {
          chunk_index: 0,
          total_chunks: 1,
          title,
          source,
          document_type: documentType,
        },
      },
    ];
  }

  const sentences = splitIntoSentences(cleanText);
  if (sentences.length === 0) return [];

  const rawChunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLen = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sLen = sentence.length;

    // If single sentence exceeds maxChunkSize, split it by words
    if (sLen > maxChunkSize) {
      if (currentChunk.length > 0) {
        rawChunks.push(currentChunk.join(' '));
        currentChunk = [];
        currentLen = 0;
      }

      const words = sentence.split(/\s+/);
      let wordChunk: string[] = [];
      let wordLen = 0;

      for (const w of words) {
        if (wordLen + w.length + 1 > maxChunkSize && wordChunk.length > 0) {
          rawChunks.push(wordChunk.join(' '));
          // keep some words for overlap
          const overlapWords = wordChunk.slice(-Math.max(1, Math.floor(wordChunk.length * 0.2)));
          wordChunk = [...overlapWords, w];
          wordLen = wordChunk.join(' ').length;
        } else {
          wordChunk.push(w);
          wordLen += (wordLen > 0 ? 1 : 0) + w.length;
        }
      }
      if (wordChunk.length > 0) {
        rawChunks.push(wordChunk.join(' '));
      }
      continue;
    }

    if (currentLen + (currentLen > 0 ? 1 : 0) + sLen > maxChunkSize && currentChunk.length > 0) {
      rawChunks.push(currentChunk.join(' '));

      // Calculate overlap: keep trailing sentences up to `overlap` characters
      const overlapSentences: string[] = [];
      let overlapLen = 0;
      for (let j = currentChunk.length - 1; j >= 0; j--) {
        const candidate = currentChunk[j];
        if (overlapLen + candidate.length <= overlap) {
          overlapSentences.unshift(candidate);
          overlapLen += candidate.length + 1;
        } else {
          break;
        }
      }

      currentChunk = [...overlapSentences, sentence];
      currentLen = currentChunk.join(' ').length;
    } else {
      currentChunk.push(sentence);
      currentLen += (currentLen > 0 ? 1 : 0) + sLen;
    }
  }

  if (currentChunk.length > 0) {
    rawChunks.push(currentChunk.join(' '));
  }

  const totalChunks = rawChunks.length;
  return rawChunks.map((content, idx) => ({
    chunkIndex: idx,
    content,
    charCount: content.length,
    metadata: {
      chunk_index: idx,
      total_chunks: totalChunks,
      title,
      source,
      document_type: documentType,
    },
  }));
}
