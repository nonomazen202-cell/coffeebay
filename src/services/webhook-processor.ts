/**
 * Webhook Processor — Handles incoming webhooks from providers
 *
 * This service parses incoming provider webhooks into generic WebhookEvent
 * objects using the active provider's parsing strategy, then:
 * - Updates the status of the corresponding notification record (sent → delivered, delivered → read)
 * - Logs audit trail records for webhook-driven updates
 * - Ignores unknown or irrelevant webhooks
 *
 * Strict provider isolation: WebhookProcessor knows nothing about Evolution.
 */

import { sql } from 'drizzle-orm';
import { getPayloadClient } from '../lib/payload';
import { createNotificationProvider, type WebhookEvent } from './notification-provider';
import { notificationMetrics } from '../lib/notification-metrics';

export class WebhookProcessor {
  /**
   * Processes a pre-parsed provider-agnostic webhook event.
   */
  async processEvent(event: WebhookEvent): Promise<{ success: boolean; eventType?: string; error?: string }> {
    try {
      const provider = createNotificationProvider();
      console.log(`[WebhookProcessor] Processing event: ${event.type} from ${provider.name}`);

      const payload = await getPayloadClient();

      if (event.type === 'message-status' && event.providerMessageId && event.status) {
        const messageId = event.providerMessageId;
        const status = event.status;

        // Perform status update inside transaction with guard check
        const updatedCount = await payload.db.drizzle.transaction(async (tx) => {
          // Verify current status to prevent out-of-order state transitions (e.g. read before delivered)
          const searchResult = await tx.execute(sql`
            SELECT id, status FROM notifications
            WHERE provider_message_id = ${messageId}
            LIMIT 1
          `);

          if (searchResult.rows.length === 0) {
            return 0;
          }

          const notif = searchResult.rows[0] as { id: number; status: string };

          // Status state transition safety guard
          if (notif.status === 'read') {
            return 0; // Already read, skip
          }
          if (notif.status === 'delivered' && status === 'delivered') {
            return 0; // Already delivered, skip
          }

          // Build dynamic column updates
          let updateQuery = sql`
            UPDATE notifications
            SET status = ${status},
                updated_at = NOW()
          `;

          if (status === 'delivered') {
            updateQuery = sql`${updateQuery}, delivered_at = NOW()`;
            notificationMetrics.recordDelivery();
          } else if (status === 'read') {
            updateQuery = sql`${updateQuery}, read_at = NOW()`;
            notificationMetrics.recordRead();
          }

          updateQuery = sql`${updateQuery} WHERE id = ${notif.id}`;
          const updateResult = await tx.execute(updateQuery);

          if ((updateResult.rowCount ?? 0) > 0) {
            await tx.execute(sql`
              INSERT INTO notification_audit (notification_id, from_status, to_status, actor, event_type, created_at, updated_at)
              VALUES (${notif.id}, ${notif.status}, ${status}, 'webhook', 'notification_transition', NOW(), NOW())
            `);
          }

          return updateResult.rowCount ?? 0;
        });

        if ((updatedCount ?? 0) > 0) {
          console.log(`[WebhookProcessor] Updated message ID ${messageId} to status "${status}"`);
        }
        return { success: true, eventType: event.type };
      }

      if (event.type === 'connection-status') {
        console.log(`[WebhookProcessor] Connection status changed to: ${event.connectionState}`);
        // SessionManager in worker process polls this or checks provider state,
        // so no direct action needed in Next.js HTTP thread.
        return { success: true, eventType: event.type };
      }

      return { success: true, eventType: event.type };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[WebhookProcessor] Failed processing webhook event:', err);
      return { success: false, error: errMsg };
    }
  }

  /**
   * Processes a raw provider webhook payload (deprecated backwards-compatible fallback).
   */
  async processWebhook(rawBody: unknown): Promise<{ success: boolean; eventType?: string; error?: string }> {
    try {
      const provider = createNotificationProvider();

      // Parse using provider-specific logic
      const event = provider.parseWebhook(rawBody);
      if (!event) {
        return { success: true, eventType: 'ignored' };
      }

      return this.processEvent(event);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[WebhookProcessor] Failed processing webhook raw body:', err);
      return { success: false, error: errMsg };
    }
  }
}

export const webhookProcessor = new WebhookProcessor();
