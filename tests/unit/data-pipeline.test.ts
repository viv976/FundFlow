import { describe, it, expect } from 'vitest';
import {
  parseCsvText,
  resolveTransactionDirection,
  parseDateWithAmbiguity,
  generateTransactionFingerprint,
  validateCsvBatch,
  normalizeCandidateToTransaction,
  ColumnMapping,
} from '@/lib/finance/data-pipeline';

describe('Data Pipeline — Direction Resolution Rules', () => {
  it('RULE 1: fails with DIRECTION_CONFLICT when both debit and credit contain numeric positive values', () => {
    const result = resolveTransactionDirection({
      rawDebit: '150.00',
      rawCredit: '200.00',
    });
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.error.code).toBe('DIRECTION_CONFLICT');
      expect(result.error.message).toContain('both Debit and Credit');
    }
  });

  it('RULE 2: resolves debit as expense and credit as income', () => {
    const debitRes = resolveTransactionDirection({ rawDebit: '450.00' });
    expect(debitRes.isValid).toBe(true);
    if (debitRes.isValid) {
      expect(debitRes.transactionType).toBe('expense');
      expect(debitRes.amount).toBe(450);
    }

    const creditRes = resolveTransactionDirection({ rawCredit: '$1,200.50' });
    expect(creditRes.isValid).toBe(true);
    if (creditRes.isValid) {
      expect(creditRes.transactionType).toBe('income');
      expect(creditRes.amount).toBe(1200.5);
    }
  });

  it('RULE 2 Conflict: fails with DIRECTION_CONFLICT when debit is present but explicit type is income', () => {
    const result = resolveTransactionDirection({
      rawDebit: '500.00',
      rawType: 'income',
    });
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.error.code).toBe('DIRECTION_CONFLICT');
      expect(result.error.message).toContain('Debit column indicates expense but Transaction Type indicates income');
    }
  });

  it('RULE 2 Conflict: fails with DIRECTION_CONFLICT when credit is present but explicit type is expense', () => {
    const result = resolveTransactionDirection({
      rawCredit: '800.00',
      rawType: 'expense',
    });
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.error.code).toBe('DIRECTION_CONFLICT');
      expect(result.error.message).toContain('Credit column indicates income but Transaction Type indicates expense');
    }
  });

  it('RULE 3 Valid: positive raw amount + explicit type="expense" is valid and normalized to expense', () => {
    const result = resolveTransactionDirection({
      rawAmount: '3500.00',
      rawType: 'expense',
    });
    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.amount).toBe(3500);
      expect(result.transactionType).toBe('expense');
    }
  });

  it('RULE 3 Valid: positive raw amount + explicit type="income" is valid and normalized to income', () => {
    const result = resolveTransactionDirection({
      rawAmount: '45000.00',
      rawType: 'income',
    });
    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.amount).toBe(45000);
      expect(result.transactionType).toBe('income');
    }
  });

  it('RULE 3 Valid: negative raw amount + explicit type="expense" is valid and normalized to expense', () => {
    const result = resolveTransactionDirection({
      rawAmount: '-120.00',
      rawType: 'expense',
    });
    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.amount).toBe(120);
      expect(result.transactionType).toBe('expense');
    }
  });

  it('RULE 3 Valid: negative raw amount + explicit type="income" is valid and normalized to income', () => {
    const result = resolveTransactionDirection({
      rawAmount: '-500.00',
      rawType: 'income',
    });
    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.amount).toBe(500);
      expect(result.transactionType).toBe('income');
    }
  });

  it('RULE 4: derives direction from signed amount when neither debit/credit nor explicit type is present', () => {
    const negativeRes = resolveTransactionDirection({ rawAmount: '-95.50' });
    expect(negativeRes.isValid).toBe(true);
    if (negativeRes.isValid) {
      expect(negativeRes.amount).toBe(95.5);
      expect(negativeRes.transactionType).toBe('expense');
    }

    const parenRes = resolveTransactionDirection({ rawAmount: '(1,250.00)' });
    expect(parenRes.isValid).toBe(true);
    if (parenRes.isValid) {
      expect(parenRes.amount).toBe(1250);
      expect(parenRes.transactionType).toBe('expense');
    }

    const positiveRes = resolveTransactionDirection({ rawAmount: '$2,400.00' });
    expect(positiveRes.isValid).toBe(true);
    if (positiveRes.isValid) {
      expect(positiveRes.amount).toBe(2400);
      expect(positiveRes.transactionType).toBe('income');
    }
  });

  it('RULE 5: fails with UNKNOWN_DIRECTION or MALFORMED_AMOUNT if no reliable direction signal exists', () => {
    const zeroRes = resolveTransactionDirection({ rawAmount: '0.00' });
    expect(zeroRes.isValid).toBe(false);

    const emptyRes = resolveTransactionDirection({});
    expect(emptyRes.isValid).toBe(false);
    if (!emptyRes.isValid) {
      expect(emptyRes.error.code).toBe('UNKNOWN_DIRECTION');
    }
  });
});

describe('Data Pipeline — Date Parsing & Ambiguity Detection', () => {
  it('parses valid ISO YYYY-MM-DD dates unambiguously', () => {
    const res = parseDateWithAmbiguity('2026-08-15', 'AUTO');
    expect(res.isValid).toBe(true);
    expect(res.isAmbiguous).toBe(false);
    expect(res.isoDate).toBe('2026-08-15');
  });

  it('detects ambiguous date when both tokens <= 12 under AUTO mode (e.g. 01/02/2026)', () => {
    const res = parseDateWithAmbiguity('01/02/2026', 'AUTO');
    expect(res.isValid).toBe(false);
    expect(res.isAmbiguous).toBe(true);
    expect(res.errorReason).toContain('Ambiguous date');
  });

  it('does NOT treat date as ambiguous if day and month are identical (e.g. 05/05/2026)', () => {
    const res = parseDateWithAmbiguity('05/05/2026', 'AUTO');
    expect(res.isValid).toBe(true);
    expect(res.isAmbiguous).toBe(false);
    expect(res.isoDate).toBe('2026-05-05');
  });

  it('unambiguously parses when day > 12 under AUTO mode (e.g. 25/08/2026)', () => {
    const res = parseDateWithAmbiguity('25/08/2026', 'AUTO');
    expect(res.isValid).toBe(true);
    expect(res.isAmbiguous).toBe(false);
    expect(res.isoDate).toBe('2026-08-25');
  });

  it('resolves ambiguous date cleanly when explicit DD/MM/YYYY is specified', () => {
    const res = parseDateWithAmbiguity('01/02/2026', 'DD/MM/YYYY');
    expect(res.isValid).toBe(true);
    expect(res.isAmbiguous).toBe(false);
    expect(res.isoDate).toBe('2026-02-01'); // 1st of February
  });

  it('resolves ambiguous date cleanly when explicit MM/DD/YYYY is specified', () => {
    const res = parseDateWithAmbiguity('01/02/2026', 'MM/DD/YYYY');
    expect(res.isValid).toBe(true);
    expect(res.isAmbiguous).toBe(false);
    expect(res.isoDate).toBe('2026-01-02'); // January 2nd
  });

  it('flags malformed dates with invalid calendar days (e.g. Feb 30)', () => {
    const res = parseDateWithAmbiguity('2026-02-30', 'YYYY-MM-DD');
    expect(res.isValid).toBe(false);
    expect(res.isAmbiguous).toBe(false);
  });
});

describe('Data Pipeline — Deterministic Fingerprint & Workspace Isolation', () => {
  const ws1 = 'e1ab89bf-153d-467b-a530-a6e7063efba1';
  const ws2 = '99999999-9999-4999-8999-999999999999';

  it('generates deterministic fingerprint for identical transaction fields', () => {
    const fp1 = generateTransactionFingerprint(ws1, '2026-08-15', 'AWS Infrastructure', 1450.5, 'expense');
    const fp2 = generateTransactionFingerprint(ws1, '2026-08-15', 'aws infrastructure  ', 1450.5, 'expense');
    expect(fp1).toBe(fp2);
    expect(fp1).toBe(`${ws1}|2026-08-15|aws infrastructure|1450.50|expense`);
  });

  it('generates different fingerprints across different workspaces for identical transaction data', () => {
    const fpWs1 = generateTransactionFingerprint(ws1, '2026-08-15', 'AWS Infrastructure', 1450.5, 'expense');
    const fpWs2 = generateTransactionFingerprint(ws2, '2026-08-15', 'AWS Infrastructure', 1450.5, 'expense');
    expect(fpWs1).not.toBe(fpWs2);
  });

  it('generates different fingerprints for different transaction types', () => {
    const fpExpense = generateTransactionFingerprint(ws1, '2026-08-15', 'Stripe Payout', 500, 'expense');
    const fpIncome = generateTransactionFingerprint(ws1, '2026-08-15', 'Stripe Payout', 500, 'income');
    expect(fpExpense).not.toBe(fpIncome);
  });
});

describe('Data Pipeline — Batch Validation & Ingestion Boundary', () => {
  const wsId = 'e1ab89bf-153d-467b-a530-a6e7063efba1';
  const mapping: ColumnMapping = {
    date: 'Date',
    description: 'Description',
    amount: 'Amount',
    type: 'Type',
    category: 'Category',
  };

  it('validates a clean, valid CSV batch with positive amounts and explicit types', () => {
    const rows = [
      { Date: '2026-08-01', Description: 'AWS Cloud Services', Amount: '1240.00', Type: 'expense', Category: 'Cloud Infrastructure' },
      { Date: '2026-08-02', Description: 'Stripe Customer Payment', Amount: '8500.00', Type: 'income', Category: 'Customer Revenue' },
    ];

    const summary = validateCsvBatch(rows, {
      mapping,
      dateFormatPreference: 'YYYY-MM-DD',
      workspaceId: wsId,
    });

    expect(summary.totalRecords).toBe(2);
    expect(summary.validRecords).toBe(2);
    expect(summary.invalidRecords).toBe(0);
    expect(summary.duplicateCandidates).toBe(0);

    // Verify normalized candidates
    const tx1 = normalizeCandidateToTransaction(summary.rowResults[0].candidate!, wsId);
    expect(tx1.amount).toBe(1240);
    expect(tx1.transaction_type).toBe('expense');
    expect(tx1.category).toBe('Cloud Infrastructure');
    expect(tx1.workspace_id).toBe(wsId);
  });

  it('flags missing required fields (empty description or date)', () => {
    const rows = [
      { Date: '', Description: 'Missing Date Record', Amount: '100.00', Type: 'expense' },
      { Date: '2026-08-05', Description: '', Amount: '200.00', Type: 'expense' },
    ];

    const summary = validateCsvBatch(rows, {
      mapping,
      dateFormatPreference: 'YYYY-MM-DD',
      workspaceId: wsId,
    });

    expect(summary.validRecords).toBe(0);
    expect(summary.invalidRecords).toBe(2);
    expect(summary.issues.some((i) => i.code === 'MALFORMED_DATE')).toBe(true);
    expect(summary.issues.some((i) => i.code === 'MISSING_REQUIRED')).toBe(true);
  });

  it('flags intra-batch duplicate candidates without silently importing them and keeps invalidRecords at 0', () => {
    const rows = [
      { Date: '2026-08-10', Description: 'Gusto Payroll Run', Amount: '25000.00', Type: 'expense' },
      { Date: '2026-08-10', Description: 'Gusto Payroll Run', Amount: '25000.00', Type: 'expense' },
    ];

    const summary = validateCsvBatch(rows, {
      mapping,
      dateFormatPreference: 'YYYY-MM-DD',
      workspaceId: wsId,
    });

    expect(summary.totalRecords).toBe(2);
    expect(summary.validRecords).toBe(1);
    expect(summary.invalidRecords).toBe(0);
    expect(summary.duplicateCandidates).toBe(1);
    expect(summary.rowResults[0].status).toBe('valid');
    expect(summary.rowResults[1].status).toBe('duplicate');
    expect(summary.rowResults[1].isDuplicate).toBe(true);
    expect(summary.rowResults[1].isValid).toBe(false);
  });

  it('correctly classifies duplicate against existing workspace ledger (total: 1, valid: 0, invalid: 0, duplicates: 1)', () => {
    const existingFp = generateTransactionFingerprint(wsId, '2026-08-10', 'Gusto Payroll Run', 25000, 'expense');
    const existingSet = new Set([existingFp]);

    const rows = [
      { Date: '2026-08-10', Description: 'Gusto Payroll Run', Amount: '25000.00', Type: 'expense' },
    ];

    const summary = validateCsvBatch(rows, {
      mapping,
      dateFormatPreference: 'YYYY-MM-DD',
      workspaceId: wsId,
      existingFingerprints: existingSet,
    });

    expect(summary.totalRecords).toBe(1);
    expect(summary.validRecords).toBe(0);
    expect(summary.invalidRecords).toBe(0);
    expect(summary.duplicateCandidates).toBe(1);
    expect(summary.rowResults[0].status).toBe('duplicate');
    expect(summary.rowResults[0].isDuplicate).toBe(true);
  });

  it('correctly classifies multiple existing ledger duplicates (total: 2, valid: 0, invalid: 0, duplicates: 2)', () => {
    const fp1 = generateTransactionFingerprint(wsId, '2026-08-10', 'AWS Compute', 150, 'expense');
    const fp2 = generateTransactionFingerprint(wsId, '2026-08-11', 'Stripe Payout', 2000, 'income');
    const existingSet = new Set([fp1, fp2]);

    const rows = [
      { Date: '2026-08-10', Description: 'AWS Compute', Amount: '150.00', Type: 'expense' },
      { Date: '2026-08-11', Description: 'Stripe Payout', Amount: '2000.00', Type: 'income' },
    ];

    const summary = validateCsvBatch(rows, {
      mapping,
      dateFormatPreference: 'YYYY-MM-DD',
      workspaceId: wsId,
      existingFingerprints: existingSet,
    });

    expect(summary.totalRecords).toBe(2);
    expect(summary.validRecords).toBe(0);
    expect(summary.invalidRecords).toBe(0);
    expect(summary.duplicateCandidates).toBe(2);
    expect(summary.rowResults[0].status).toBe('duplicate');
    expect(summary.rowResults[1].status).toBe('duplicate');
  });

  it('correctly partitions mixed batch containing valid + invalid + duplicate records', () => {
    const existingFp = generateTransactionFingerprint(wsId, '2026-08-10', 'Existing Transaction', 500, 'expense');
    const existingSet = new Set([existingFp]);

    const rows = [
      // 1. Valid record
      { Date: '2026-08-01', Description: 'Fresh New Record', Amount: '100.00', Type: 'expense' },
      // 2. Invalid record (malformed amount)
      { Date: '2026-08-02', Description: 'Bad Amount Record', Amount: 'NotANumber', Type: 'expense' },
      // 3. Duplicate record (matches existing ledger)
      { Date: '2026-08-10', Description: 'Existing Transaction', Amount: '500.00', Type: 'expense' },
    ];

    const summary = validateCsvBatch(rows, {
      mapping,
      dateFormatPreference: 'YYYY-MM-DD',
      workspaceId: wsId,
      existingFingerprints: existingSet,
    });

    expect(summary.totalRecords).toBe(3);
    expect(summary.validRecords).toBe(1);
    expect(summary.invalidRecords).toBe(1);
    expect(summary.duplicateCandidates).toBe(1);

    // Sum invariant check: valid + invalid + duplicate must equal total
    expect(summary.validRecords + summary.invalidRecords + summary.duplicateCandidates).toBe(summary.totalRecords);

    expect(summary.rowResults[0].status).toBe('valid');
    expect(summary.rowResults[1].status).toBe('invalid');
    expect(summary.rowResults[2].status).toBe('duplicate');
  });

  it('flags malformed and non-numeric amounts', () => {
    const rows = [
      { Date: '2026-08-12', Description: 'Invalid Amount String', Amount: 'NotANumber', Type: 'expense' },
      { Date: '2026-08-12', Description: 'Zero Amount', Amount: '0.00', Type: 'expense' },
    ];

    const summary = validateCsvBatch(rows, {
      mapping,
      dateFormatPreference: 'YYYY-MM-DD',
      workspaceId: wsId,
    });

    expect(summary.validRecords).toBe(0);
    expect(summary.invalidRecords).toBe(2);
    expect(summary.duplicateCandidates).toBe(0);
    expect(summary.malformedAmounts).toBe(2);
  });

  it('flags missing categories and applies deterministic rules during normalization', () => {
    const rows = [
      { Date: '2026-08-14', Description: 'Google Ads Advertising', Amount: '1500.00', Type: 'expense', Category: '' },
    ];

    const summary = validateCsvBatch(rows, {
      mapping,
      dateFormatPreference: 'YYYY-MM-DD',
      workspaceId: wsId,
    });

    expect(summary.validRecords).toBe(1);
    expect(summary.invalidRecords).toBe(0);
    expect(summary.duplicateCandidates).toBe(0);
    expect(summary.missingCategories).toBe(1);

    const tx = normalizeCandidateToTransaction(summary.rowResults[0].candidate!, wsId);
    expect(tx.category).toBe('Marketing'); // Categorized by deterministic rules!
  });
});

describe('Data Pipeline — CSV Parsing Integrity', () => {
  it('parses valid CSV text into headers and rows', () => {
    const csv = `Date,Description,Amount,Type\n2026-08-01,AWS Hosting,250.00,expense\n2026-08-02,Client Payment,5000.00,income`;
    const res = parseCsvText(csv);
    expect(res.headers).toEqual(['Date', 'Description', 'Amount', 'Type']);
    expect(res.rows.length).toBe(2);
    expect(res.detectedMapping.date).toBe('Date');
    expect(res.detectedMapping.description).toBe('Description');
  });

  it('throws descriptive error on empty CSV text', () => {
    expect(() => parseCsvText('')).toThrow('CSV file content is empty.');
    expect(() => parseCsvText('   \n  \t ')).toThrow('CSV file content is empty.');
  });
});
