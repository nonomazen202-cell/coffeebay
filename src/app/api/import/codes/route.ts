import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { getAuthUser } from '@/lib/security/auth-helper';
import { verificationService } from '@/services/verification-service';
import type { PgTable } from 'drizzle-orm/pg-core';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, errors: ['Unauthorized'] },
        { status: 401 }
      );
    }

    // 2. Authorize role (must be ADMIN)
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, errors: ['Forbidden'] },
        { status: 403 }
      );
    }

    // 3. Extract uploaded CSV file
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json(
        { success: false, errors: ['No file uploaded. Please upload a valid CSV.'] },
        { status: 400 }
      );
    }

    const fileText = await file.text();
    const lines = fileText.split(/\r?\n/);
    const parsedCodes: Array<{
      serial_code: string;
      is_winner: boolean;
      prize_id?: number | null;
    }> = [];

    // 4. Parse rows
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      const parts = line.split(',');
      const serialCode = parts[0]?.trim().toUpperCase();
      const isWinnerStr = parts[1]?.trim().toLowerCase();
      const prizeIdStr = parts[2]?.trim();

      // Skip CSV Header row if matches titles
      if (i === 0 && (serialCode.includes('SERIAL') || serialCode.includes('CODE'))) {
        continue;
      }

      if (!serialCode) {
        return NextResponse.json(
          { success: false, errors: [`Row ${i + 1}: Serial code is missing.`] },
          { status: 400 }
        );
      }

      if (!verificationService.isValidSerialCode(serialCode)) {
        return NextResponse.json(
          { success: false, errors: [`Row ${i + 1}: Serial code "${serialCode}" format is invalid. Must be XXXX-XXXX.`] },
          { status: 400 }
        );
      }

      const isWinner = isWinnerStr === 'true' || isWinnerStr === '1' || isWinnerStr === 'yes';
      let prizeId: number | null = null;

      if (prizeIdStr && /^\d+$/.test(prizeIdStr)) {
        prizeId = Number(prizeIdStr);
      }

      parsedCodes.push({
        serial_code: serialCode,
        is_winner: isWinner,
        prize_id: prizeId,
      });
    }

    // Check for duplicate serial codes inside the CSV file itself
    const serialsInCsv = parsedCodes.map((c) => c.serial_code);
    const uniqueSerialsInCsv = new Set(serialsInCsv);
    if (uniqueSerialsInCsv.size !== serialsInCsv.length) {
      return NextResponse.json(
        { success: false, errors: ['The uploaded CSV contains duplicate serial codes.'] },
        { status: 400 }
      );
    }

    const payload = await getPayload({ config });

    // Check for duplicate serial codes in the database in batches of 2000
    const checkBatchSize = 2000;
    for (let i = 0; i < serialsInCsv.length; i += checkBatchSize) {
      const chunk = serialsInCsv.slice(i, i + checkBatchSize);
      const duplicateCheck = await payload.find({
        collection: 'codes',
        where: {
          serial_code: {
            in: chunk,
          },
        },
        limit: 1,
      });

      if (duplicateCheck.docs.length > 0) {
        return NextResponse.json(
          {
            success: false,
            errors: [
              `Serial code "${duplicateCheck.docs[0].serial_code}" already exists in the database.`,
            ],
          },
          { status: 400 }
        );
      }
    }

    // 5. Begin Drizzle transaction and perform bulk insert
    const codesTable = (payload.db as { tables: Record<string, PgTable> }).tables.codes;

    try {
      await payload.db.drizzle.transaction(async (tx) => {
        const insertBatchSize = 1000;
        for (let i = 0; i < parsedCodes.length; i += insertBatchSize) {
          const batch = parsedCodes.slice(i, i + insertBatchSize);

          const valuesToInsert = batch.map((code) => ({
            serial_code: code.serial_code,
            is_winner: code.is_winner,
            prize_id: code.prize_id || null,
            claimed: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

          // Execute bulk insert on the transaction Drizzle instance
          await tx.insert(codesTable).values(valuesToInsert);
        }
      });

      return NextResponse.json({
        success: true,
        message: `Successfully imported ${parsedCodes.length} codes.`,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { success: false, errors: [errMsg || 'Import transaction failed.'] },
        { status: 400 }
      );
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[IMPORT ERROR] POST /api/import/codes', err);
    return NextResponse.json(
      { success: false, errors: [errMsg || 'Internal Server Error'] },
      { status: 500 }
    );
  }
}
