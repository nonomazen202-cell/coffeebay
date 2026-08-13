/**
 * Duplicate Detector — Prevents sending identical notifications.
 *
 * Goes beyond simple idempotency keys by checking:
 * - Same phone number
 * - Same template type
 * - Same variables
 * - Within a configurable time window (default 30 seconds)
 *
 * If a match is found, the notification is silently skipped.
 */

import crypto from 'crypto';
import { sql } from 'drizzle-orm';
import { getPayloadClient } from '../lib/payload';
import type { TemplateType } from './notification-provider';

const DEFAULT_WINDOW_MS = 30_000;

export class DuplicateDetector {
  /**
   * Check if an identical notification was queued recently.
   *
   * @returns true if a duplicate exists and should be skipped.
   */
  async isDuplicate(
    phone: string,
    template: TemplateType,
    variables: Record<string, string>,
    windowMs: number = DEFAULT_WINDOW_MS,
  ): Promise<boolean> {
    const payload = await getPayloadClient();

    const cutoff = new Date(Date.now() - windowMs).toISOString();

    // Build a fingerprint hash of the variables for comparison
    const fingerprint = this.buildFingerprint(phone, template, variables);

    try {
      const result = await payload.db.drizzle.execute(sql`
        SELECT id FROM notifications
        WHERE phone = ${phone}
          AND template = ${template}
          AND idempotency_key = ${fingerprint}
          AND created_at >= ${cutoff}
        LIMIT 1
      `);

      return (result.rows?.length ?? 0) > 0;
    } catch {
      // If query fails, err on the side of allowing delivery
      return false;
    }
  }

  /**
   * Build a deterministic fingerprint for duplicate detection.
   * Used as the idempotency key.
   */
  buildFingerprint(
    phone: string,
    template: TemplateType,
    variables: Record<string, string>,
  ): string {
    // Sort variable keys for deterministic hashing
    const sortedVars = Object.keys(variables)
      .sort()
      .map((k) => `${k}=${variables[k]}`)
      .join('|');

    const input = `${phone}:${template}:${sortedVars}`;
    return crypto.createHash('sha256').update(input).digest('hex').substring(0, 40);
  }
}

export const duplicateDetector = new DuplicateDetector();
