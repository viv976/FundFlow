/**
 * Deterministic Transaction Fingerprint Module
 * Generates a stable, canonical fingerprint for duplicate detection scoped to the workspace.
 * Note: UUID v4 is used for runtime persistence ID; this fingerprint is solely for deduplication.
 */

import { TransactionType } from '@/types/finance';

export function generateTransactionFingerprint(
  workspaceId: string,
  transactionDate: string,
  description: string,
  amount: number,
  transactionType: TransactionType
): string {
  const normWs = (workspaceId || '').trim().toLowerCase();
  const normDate = (transactionDate || '').trim();
  const normDesc = (description || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normAmount = Math.abs(amount).toFixed(2);
  const normType = transactionType.trim().toLowerCase();

  return `${normWs}|${normDate}|${normDesc}|${normAmount}|${normType}`;
}
