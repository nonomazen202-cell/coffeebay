import { NextRequest, NextResponse } from 'next/server';
import { getPayload, type Payload } from 'payload';
import config from '@payload-config';
import { getAuthUser } from '@/lib/security/auth-helper';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface CollectionCounts {
  prizeClaims: number;
  entries: number;
  participants: number;
  notifications: number;
  notificationAudit: number;
  codes: number;
  prizes: number;
}

/**
 * Counts the documents in all relevant collections in a fast and resource-efficient manner.
 */
async function getCollectionCounts(payload: Payload): Promise<CollectionCounts> {
  const [prizeClaims, entries, participants, notifications, notificationAudit, codes, prizes] = await Promise.all([
    payload.find({ collection: 'prize-claims', limit: 1 }),
    payload.find({ collection: 'entries', limit: 1 }),
    payload.find({ collection: 'participants', limit: 1 }),
    payload.find({ collection: 'notifications', limit: 1 }),
    payload.find({ collection: 'notification-audit', limit: 1 }),
    payload.find({ collection: 'codes', limit: 1 }),
    payload.find({ collection: 'prizes', limit: 1 }),
  ]);

  return {
    prizeClaims: prizeClaims.totalDocs,
    entries: entries.totalDocs,
    participants: participants.totalDocs,
    notifications: notifications.totalDocs,
    notificationAudit: notificationAudit.totalDocs,
    codes: codes.totalDocs,
    prizes: prizes.totalDocs,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleClearCodes(req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleClearCodes(req);
}

async function handleClearCodes(req: NextRequest): Promise<NextResponse> {
  const searchParams = req.nextUrl.searchParams;
  const dryRun = searchParams.get('dryRun') === 'true';
  const dropAll = searchParams.get('dropAll') === 'true';
  const cascade = searchParams.get('cascade') === 'true';

  try {
    // 1. Authenticate session
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

    const payload = await getPayload({ config });

    // Query all table names in the database schema
    const tablesResult = await payload.db.drizzle.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const rows = tablesResult.rows as unknown as Array<{ table_name: string }>;
    const tables = rows.map((row) => row.table_name);

    // 1. Retrieve the state of the database collections before modifying anything
    const beforeCounts = await getCollectionCounts(payload);

    // 2. Dry run simulation check
    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: 'Dry run simulation completed successfully. No changes were made to the database.',
        dryRun: true,
        dropAll,
        cascade,
        tables,
        before: beforeCounts,
      });
    }

    // 3. Safety Check: Protect against accidental deletion of active transactional data
    const hasDataToDelete =
      beforeCounts.prizeClaims > 0 ||
      beforeCounts.entries > 0 ||
      beforeCounts.participants > 0 ||
      beforeCounts.notifications > 0 ||
      beforeCounts.notificationAudit > 0 ||
      (dropAll && beforeCounts.codes > 0) ||
      (dropAll && beforeCounts.prizes > 0);

    if (hasDataToDelete && !cascade) {
      return NextResponse.json(
        {
          success: false,
          message: 'Operation aborted. Database contains records that would be deleted. Please pass cascade=true to confirm.',
          dryRun: false,
          dropAll,
          cascade: false,
          before: beforeCounts,
        },
        { status: 400 }
      );
    }

    // 4. Perform atomic deletion via direct SQL queries inside a single database transaction for maximum performance
    await payload.db.drizzle.transaction(async (tx) => {
      if (dropAll) {
        // Drop the entire public schema to remove all tables, sequences, and structures immediately
        await tx.execute(sql`DROP SCHEMA public CASCADE`);
        await tx.execute(sql`CREATE SCHEMA public`);
        await tx.execute(sql`GRANT ALL ON SCHEMA public TO postgres`);
        await tx.execute(sql`GRANT ALL ON SCHEMA public TO public`);
      } else {
        // Delete transactional tables in correct dependency order
        if (beforeCounts.prizeClaims > 0) {
          await tx.execute(sql`DELETE FROM prize_claims`);
        }
        if (beforeCounts.entries > 0) {
          await tx.execute(sql`DELETE FROM entries`);
        }
        if (beforeCounts.participants > 0) {
          await tx.execute(sql`DELETE FROM participants`);
        }
        if (beforeCounts.notificationAudit > 0) {
          await tx.execute(sql`DELETE FROM notification_audit`);
        }
        if (beforeCounts.notifications > 0) {
          await tx.execute(sql`DELETE FROM notifications`);
        }
        // Reset claimed codes status
        await tx.execute(sql`UPDATE codes SET claimed = false, claimed_at = null WHERE claimed = true`);
      }
    });

    // 5. Retrieve the state of the database collections after the modifications
    const afterCounts = dropAll
      ? { prizeClaims: 0, entries: 0, participants: 0, notifications: 0, notificationAudit: 0, codes: 0, prizes: 0 }
      : await getCollectionCounts(payload);

    return NextResponse.json({
      success: true,
      message: dropAll
        ? 'Database has been fully reset and cleared successfully.'
        : 'Campaign data has been cleared and codes have been reset successfully.',
      dryRun: false,
      dropAll,
      cascade,
      before: beforeCounts,
      after: afterCounts,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[API ERROR] /api/clear-codes:`, err);
    return NextResponse.json(
      {
        success: false,
        message: 'An unexpected internal server error occurred.',
        dryRun,
        dropAll,
        cascade,
        errors: [errorMsg],
      },
      { status: 500 }
    );
  }
}
