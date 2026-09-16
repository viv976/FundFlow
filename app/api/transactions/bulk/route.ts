import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { DatabaseTransaction } from '@/lib/supabase/types';
import { isValidUUID, isValidISODate } from '@/lib/validation';
import { getUserSafeErrorMessage } from '@/lib/errors';
import { generateTransactionFingerprint } from '@/lib/finance/data-pipeline/fingerprint';
import { generateUUID } from '@/lib/finance/data-pipeline/normalizer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      workspaceId,
      transactions,
      fileName = 'import.csv',
      fileSizeBytes = 0,
      userId,
    } = body;

    // 1. Validate Workspace UUID
    if (!isValidUUID(workspaceId)) {
      return NextResponse.json(
        { success: false, error: 'A valid Workspace UUID is required' },
        { status: 400 }
      );
    }

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No transaction rows provided for import' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // 2. Resolve User & Tenant Authorization Check
    let targetUserId = typeof userId === 'string' && userId.trim() ? userId.trim() : null;

    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (token) {
        const { data: userData } = await supabase.auth.getUser(token);
        if (userData?.user?.id) {
          targetUserId = userData.user.id;
        }
      }
    }

    if (!targetUserId) {
      // Find workspace owner
      const { data: wsData } = await supabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', workspaceId)
        .single();
      if (wsData?.owner_id) {
        targetUserId = wsData.owner_id;
      } else {
        targetUserId = '2750de4a-7e18-4345-9d29-72385783cf2c';
      }
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', targetUserId)
      .limit(1);

    const { data: wsOwnerCheck } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single();

    const isAuthorized =
      (membership && membership.length > 0) ||
      (wsOwnerCheck && wsOwnerCheck.owner_id === targetUserId);

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: You do not have permission to import into this workspace' },
        { status: 403 }
      );
    }

    // 3. Independent Server-Side Validation & Duplicate Partitioning
    const validatedPayloads: DatabaseTransaction[] = [];
    const rejected: { row: number; reason: string }[] = [];
    const duplicates: { row: number; description: string; amount: number; fingerprint: string }[] = [];

    const seenBatchFingerprints = new Set<string>();

    // Fetch existing transaction fingerprints in this workspace to pre-filter known records
    const { data: existingRows } = await supabase
      .from('transactions')
      .select('transaction_date, description, amount, transaction_type')
      .eq('workspace_id', workspaceId);

    const existingDbFingerprints = new Set<string>();
    if (existingRows && Array.isArray(existingRows)) {
      for (const row of existingRows) {
        existingDbFingerprints.add(
          generateTransactionFingerprint(
            workspaceId,
            row.transaction_date,
            row.description,
            Number(row.amount),
            row.transaction_type
          )
        );
      }
    }

    transactions.forEach((item: Record<string, unknown>, index: number) => {
      const rowNum = index + 1;

      // Validate Date
      const dateStr = String(item.transaction_date || '').trim();
      if (!isValidISODate(dateStr)) {
        rejected.push({ row: rowNum, reason: `Invalid date "${dateStr}". Must be YYYY-MM-DD.` });
        return;
      }

      // Validate Description
      const desc = typeof item.description === 'string' ? item.description.trim() : '';
      if (!desc) {
        rejected.push({ row: rowNum, reason: 'Transaction description cannot be blank.' });
        return;
      }

      // Validate Amount (strictly positive finite number)
      const numAmount = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount));
      if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
        rejected.push({ row: rowNum, reason: 'Amount must be a positive finite number greater than zero.' });
        return;
      }

      // Validate Transaction Type
      const type = item.transaction_type;
      if (type !== 'income' && type !== 'expense') {
        rejected.push({ row: rowNum, reason: `Invalid transaction_type "${type}". Must be 'income' or 'expense'.` });
        return;
      }

      // Generate Deterministic Fingerprint
      const fingerprint = generateTransactionFingerprint(
        workspaceId,
        dateStr,
        desc,
        numAmount,
        type
      );

      // Check intra-batch duplicate
      if (seenBatchFingerprints.has(fingerprint)) {
        duplicates.push({ row: rowNum, description: desc, amount: numAmount, fingerprint });
        return;
      }
      seenBatchFingerprints.add(fingerprint);

      // Check existing database duplicate
      if (existingDbFingerprints.has(fingerprint)) {
        duplicates.push({ row: rowNum, description: desc, amount: numAmount, fingerprint });
        return;
      }

      const txId = isValidUUID(item.id) ? item.id : generateUUID();

      const dbRow: DatabaseTransaction = {
        id: txId,
        workspace_id: workspaceId,
        transaction_date: dateStr,
        amount: Math.abs(numAmount),
        transaction_type: type,
        category_id: null,
        category: typeof item.category === 'string' && item.category.trim() ? item.category.trim() : 'Uncategorized',
        merchant: typeof item.merchant === 'string' && item.merchant.trim() ? item.merchant.trim() : null,
        description: desc.slice(0, 500),
        account_name: typeof item.external_reference === 'string' ? item.external_reference.slice(0, 200) : 'Operating Account',
        currency: typeof item.currency === 'string' && item.currency.trim() ? item.currency.trim().toUpperCase() : 'USD',
        source: 'csv_import',
        source_file_id: null,
        is_recurring: false,
        created_by: targetUserId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      validatedPayloads.push(dbRow);
    });

    // 4. Concurrency-Safe Chunked Persistence
    const CHUNK_SIZE = 50;
    let totalInserted = 0;

    for (let i = 0; i < validatedPayloads.length; i += CHUNK_SIZE) {
      const chunk = validatedPayloads.slice(i, i + CHUNK_SIZE);
      const { data: inserted, error: insErr } = await supabase
        .from('transactions')
        .insert(chunk)
        .select('id');

      if (insErr) {
        // Postgres error 23505 is unique_violation (concurrent insert duplicate conflict)
        if (insErr.code === '23505') {
          // Fall back to row-by-row insertion in this chunk to isolate the conflicting duplicate
          for (const singleRow of chunk) {
            const { error: singleErr } = await supabase
              .from('transactions')
              .insert(singleRow);

            if (singleErr) {
              if (singleErr.code === '23505') {
                const fp = generateTransactionFingerprint(
                  workspaceId,
                  singleRow.transaction_date,
                  singleRow.description,
                  singleRow.amount,
                  singleRow.transaction_type
                );
                duplicates.push({
                  row: -1,
                  description: singleRow.description,
                  amount: singleRow.amount,
                  fingerprint: fp,
                });
              } else {
                rejected.push({
                  row: -1,
                  reason: `Database error: ${singleErr.message}`,
                });
              }
            } else {
              totalInserted += 1;
            }
          }
        } else {
          console.error('Error inserting transaction chunk in DB:', insErr);
          return NextResponse.json(
            { success: false, error: `Database error inserting transactions: ${insErr.message}` },
            { status: 500 }
          );
        }
      } else {
        totalInserted += inserted ? inserted.length : chunk.length;
      }
    }

    // 5. Record file in uploaded_files log
    try {
      await supabase.from('uploaded_files').insert({
        workspace_id: workspaceId,
        file_name: fileName,
        file_type: 'text/csv',
        file_size_bytes: fileSizeBytes,
        rows_imported: totalInserted,
        status: 'completed',
        uploaded_by: targetUserId,
      });
    } catch (uploadLogErr) {
      console.warn('Non-fatal upload log note:', uploadLogErr);
    }

    // 6. Structured Response distinguishing imported, rejected, and duplicate/skipped
    return NextResponse.json({
      success: true,
      workspaceId,
      importedCount: totalInserted,
      rejectedCount: rejected.length,
      duplicateCount: duplicates.length,
      rejected,
      duplicates,
    });
  } catch (err: unknown) {
    const msg = getUserSafeErrorMessage(err, 'Internal error processing transaction import');
    console.error('Unhandled exception in POST /api/transactions/bulk:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
