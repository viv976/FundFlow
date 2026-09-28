/**
 * Prompt Injection Resistance and Input Sanitization for FundFlow AI
 * Treats user queries, document chunks, and external text as untrusted data.
 */

// Common injection, jailbreak, and system override patterns
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above|system)\s+(instructions|directives|prompts|rules)/i,
  /disregard\s+(all\s+)?(previous|prior|above|system)\s+(instructions|directives|prompts|rules)/i,
  /you\s+are\s+now\s+(in\s+)?(unrestricted|developer|dan|jailbreak|god)\s+mode/i,
  /system\s*:\s*you\s+are\s+now/i,
  /new\s+(system\s+)?instruction\s*:/i,
  /override\s+(all\s+)?(safety|system|guardrails|instructions)/i,
  /repeat\s+(your\s+)?(system\s+prompt|instructions|rules)\s+(verbatim|word\s+for\s+word)/i,
  /print\s+(your\s+)?(system\s+prompt|initial\s+prompt)/i,
  /reveal\s+(your\s+)?(system\s+prompt|secret\s+key|api\s+key)/i,
  /do\s+anything\s+now/i,
];

// Special tokens or boundary delimiters to neutralize
const DANGEROUS_TOKENS = [
  '<system>',
  '</system>',
  '<instruction>',
  '</instruction>',
  '[INST]',
  '[/INST]',
  '<<SYS>>',
  '<</SYS>>',
  '<|im_start|>',
  '<|im_end|>',
  '<|endoftext|>',
];

export interface InjectionCheckResult {
  isSuspicious: boolean;
  detectedPatterns: string[];
}

/**
 * Check if a text contains potential prompt injection or jailbreak attempts
 */
export function detectPromptInjection(text: string): InjectionCheckResult {
  if (!text) return { isSuspicious: false, detectedPatterns: [] };

  const detected: string[] = [];

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      detected.push(pattern.source);
    }
  }

  for (const token of DANGEROUS_TOKENS) {
    if (text.includes(token)) {
      detected.push(`boundary_token:${token}`);
    }
  }

  return {
    isSuspicious: detected.length > 0,
    detectedPatterns: detected,
  };
}

/**
 * Sanitize a user prompt: neutralize dangerous tokens and control characters
 */
export function sanitizeUserPrompt(rawInput: string): string {
  if (!rawInput) return '';

  let sanitized = rawInput.trim();

  // Strip control characters (except normal newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Neutralize delimiter tags
  for (const token of DANGEROUS_TOKENS) {
    sanitized = sanitized.replaceAll(token, `[token:${token.replace(/[<>|[\]]/g, '')}]`);
  }

  // Prevent delimiter escalation
  sanitized = sanitized
    .replace(/<untrusted_content>/gi, '[untrusted_content]')
    .replace(/<\/untrusted_content>/gi, '[/untrusted_content]');

  return sanitized;
}

/**
 * Sanitize an uploaded document or chunk: strip dangerous tokens and neutralize prompt directives
 */
export function sanitizeUntrustedDocument(content: string): string {
  if (!content) return '';

  let sanitized = content.trim();

  // Neutralize known boundary tags
  for (const token of DANGEROUS_TOKENS) {
    sanitized = sanitized.replaceAll(token, `[escaped_token]`);
  }

  // Neutralize explicit override attempts embedded in documents
  sanitized = sanitized.replace(
    /(?:ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions)/gi,
    '[instruction override neutralized]'
  );

  return sanitized;
}

/**
 * Safely encapsulate untrusted text inside clear non-executable XML delimiters
 */
export function wrapUntrustedContext(content: string, contextId: string): string {
  const safeContent = sanitizeUntrustedDocument(content);
  return `<untrusted_retrieved_context id="${contextId}">\n${safeContent}\n</untrusted_retrieved_context>`;
}
