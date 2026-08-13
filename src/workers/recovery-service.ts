/**
 * Recovery Service — Crash/Restart Recovery
 *
 * Runs on worker startup before the processing loop.
 * Handles:
 * 1. Unlock expired leases (worker died while holding lock)
 * 2. Reset stuck sending (worker died mid-send)
 * 3. Mark expired notifications (TTL exceeded while in queue)
 * 4. Record audit entries for all recoveries
 */

import { sql } from 'drizzle-orm';
import { getPayloadClient } from '../lib/payload';

export interface RecoveryReport {
  expiredLeasesUnlocked: number;
  stuckSendingReset: number;
  expiredNotificationsMarked: number;
}

export class RecoveryService {
  private workerId: string;

  constructor(workerId: string) {
    this.workerId = workerId;
  }

  async recover(): Promise<RecoveryReport> {
    console.log(`[Recovery] Starting recovery scan (worker: ${this.workerId})...`);

    const payload = await getPayloadClient();
    const report: RecoveryReport = {
      expiredLeasesUnlocked: 0,
      stuckSendingReset: 0,
      expiredNotificationsMarked: 0,
    };

    // 1. Unlock expired leases
    //    Notifications that were locked by a worker that died before
    //    releasing the lock. leaseExpiresAt < NOW() indicates the lease expired.
    try {
      const expiredLeaseResult = await payload.db.drizzle.execute(sql`
        UPDATE notifications
        SET status = 'queued',
            locked_at = NULL,
            locked_by = NULL,
            lease_expires_at = NULL
        WHERE status = 'locked'
          AND lease_expires_at IS NOT NULL
          AND lease_expires_at < NOW()
      `);

      report.expiredLeasesUnlocked = expiredLeaseResult.rowCount || 0;
      if (report.expiredLeasesUnlocked > 0) {
        console.log(`[Recovery] Unlocked ${report.expiredLeasesUnlocked} expired leases`);

        // Audit each recovery
        await this.auditBulkRecovery(
          payload,
          'locked',
          'queued',
          report.expiredLeasesUnlocked,
          'Lease expired during worker downtime',
        );
      }
    } catch (err) {
      console.error('[Recovery] Failed to unlock expired leases:', err);
      throw err;
    }

    // 2. Reset stuck sending
    //    Notifications stuck in 'sending' for > 10 minutes (worker crashed mid-send)
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const stuckResult = await payload.db.drizzle.execute(sql`
        UPDATE notifications
        SET status = 'queued',
            locked_at = NULL,
            locked_by = NULL,
            lease_expires_at = NULL
        WHERE status = 'sending'
          AND locked_at IS NOT NULL
          AND locked_at < ${tenMinutesAgo}
      `);

      report.stuckSendingReset = stuckResult.rowCount || 0;
      if (report.stuckSendingReset > 0) {
        console.log(`[Recovery] Reset ${report.stuckSendingReset} stuck sending notifications`);

        await this.auditBulkRecovery(
          payload,
          'sending',
          'queued',
          report.stuckSendingReset,
          'Stuck in sending state during worker downtime',
        );
      }
    } catch (err) {
      console.error('[Recovery] Failed to reset stuck sending:', err);
      throw err;
    }

    // 3. Mark expired notifications
    //    Notifications whose TTL has passed while they were waiting in queue
    try {
      const expiredResult = await payload.db.drizzle.execute(sql`
        UPDATE notifications
        SET status = 'failed',
            last_error = 'Expired: TTL exceeded before delivery'
        WHERE expires_at IS NOT NULL
          AND expires_at < NOW()
          AND status IN ('queued', 'retry-scheduled', 'created')
      `);

      report.expiredNotificationsMarked = expiredResult.rowCount || 0;
      if (report.expiredNotificationsMarked > 0) {
        console.log(`[Recovery] Marked ${report.expiredNotificationsMarked} expired notifications as failed`);

        await this.auditBulkRecovery(
          payload,
          'queued',
          'failed',
          report.expiredNotificationsMarked,
          'TTL exceeded before delivery',
        );
      }
    } catch (err) {
      console.error('[Recovery] Failed to mark expired notifications:', err);
      throw err;
    }

    console.log(`[Recovery] Complete: ${JSON.stringify(report)}`);
    return report;
  }

  // ── Audit Helper ──────────────────────────────────────────────────

  private async auditBulkRecovery(
    payload: Awaited<ReturnType<typeof getPayloadClient>>,
    fromStatus: string,
    toStatus: string,
    count: number,
    error: string,
  ): Promise<void> {
    try {
      // Create a single summary audit record for bulk recovery
      await payload.create({
        collection: 'notification-audit',
        data: {
          eventType: 'recovery_bulk',
          fromStatus,
          toStatus,
          actor: `recovery-${this.workerId}`,
          error: `${error} (${count} notifications recovered)`,
          metadata: {
            recoveredCount: count,
          },
        },
      });
    } catch (err: unknown) {
      console.error('[Recovery] Failed to write recovery audit record:', err);
      throw err;
    }
  }
}
