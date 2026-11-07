/**
 * Notification Service — Business Logic Facade
 *
 * This is the ONLY entry point for business services to queue notifications.
 * Business services call methods here; they never touch the queue directly
 * and never call any provider.
 *
 * Responsibilities:
 * 1. Validate phone numbers
 * 2. Build structured NotificationPayloads
 * 3. Render fallback message text
 * 4. Generate idempotency keys (duplicate detection fingerprint)
 * 5. Run duplicate detection
 * 6. Set priority and TTL
 * 7. Insert into notifications collection within the provided transaction
 * 8. Insert initial audit record
 */

import type { PayloadRequest } from 'payload';
import { getPayloadClient } from '../lib/payload';
import { validateAndNormalizePhone } from '../lib/validators/phone-validator';
import { duplicateDetector } from './duplicate-detector';
import { notificationMetrics } from '../lib/notification-metrics';
import { getCachedAdminPhone } from './settings-cache';
import type { NotificationPayload } from './notification-provider';
import {
  buildWinnerPayload,
  buildAdminAlertPayload,
  buildVerificationPayload,
  buildDrinkOtpPayload,
  buildDrinkVoucherPayload,
  buildDrinkAdminAlertPayload,
  TEMPLATE_PRIORITY,
  TEMPLATE_TTL_MS,
  type WinnerNotificationData,
  type AdminAlertData,
  type DrinkVoucherData,
  type DrinkAdminAlertData,
} from './notification-templates';

export class NotificationService {
  /**
   * Queue a winner notification inside an existing DB transaction.
   */
  async queueWinnerNotification(
    data: WinnerNotificationData & { phone: string },
    transactionID: string,
  ): Promise<void> {
    const notificationPayload = buildWinnerPayload(data);
    await this.insertNotification(
      data.phone,
      notificationPayload,
      transactionID,
    );
  }

  /**
   * Queue an admin alert notification inside an existing DB transaction.
   */
  async queueAdminAlert(
    data: AdminAlertData,
    transactionID: string,
  ): Promise<void> {
    let adminPhone = await getCachedAdminPhone();
    if (!adminPhone) {
      adminPhone = process.env.WHATSAPP_ADMIN_PHONE || null;
    }

    if (!adminPhone) {
      console.warn('[NotificationService] WhatsApp admin phone number is not configured (neither settings global nor env variable is set). Skipping admin alert.');
      return;
    }

    const notificationPayload = buildAdminAlertPayload(data);
    await this.insertNotification(
      adminPhone,
      notificationPayload,
      transactionID,
    );
  }

  /**
   * Queue a verification (OTP) notification inside an existing DB transaction.
   */
  async queueVerification(
    phone: string,
    code: string,
    transactionID: string,
    attemptId?: string,
  ): Promise<void> {
    const notificationPayload = buildVerificationPayload({ code, attemptId });
    await this.insertNotification(
      phone,
      notificationPayload,
      transactionID,
    );
  }

  /**
   * Queue a drink reward OTP notification inside a DB transaction.
   */
  async queueDrinkOtp(
    phone: string,
    code: string,
    transactionID: string,
    campaignSlug?: string,
  ): Promise<void> {
    const notificationPayload = buildDrinkOtpPayload({ code, campaignSlug });
    await this.insertNotification(
      phone,
      notificationPayload,
      transactionID,
    );
  }

  /**
   * Queue a drink reward voucher notification inside a DB transaction.
   */
  async queueDrinkVoucher(
    data: DrinkVoucherData & { phone: string },
    transactionID: string,
  ): Promise<void> {
    const notificationPayload = buildDrinkVoucherPayload(data);
    await this.insertNotification(
      data.phone,
      notificationPayload,
      transactionID,
    );
  }

  /**
   * Queue a drink reward admin alert inside a DB transaction.
   */
  async queueDrinkAdminAlert(
    data: DrinkAdminAlertData,
    transactionID: string,
  ): Promise<void> {
    let adminPhone = await getCachedAdminPhone();
    if (!adminPhone) {
      adminPhone = process.env.WHATSAPP_ADMIN_PHONE || null;
    }

    if (!adminPhone) {
      console.warn('[NotificationService] WhatsApp admin phone number is not configured. Skipping drink admin alert.');
      return;
    }

    const notificationPayload = buildDrinkAdminAlertPayload(data);
    await this.insertNotification(
      adminPhone,
      notificationPayload,
      transactionID,
    );
  }

  // ── Internal: Insert Notification ──────────────────────────────────

  private async insertNotification(
    rawPhone: string,
    notificationPayload: NotificationPayload,
    transactionID: string,
  ): Promise<void> {
    const payload = await getPayloadClient();

    // 1. Validate and normalize phone
    const phoneResult = validateAndNormalizePhone(rawPhone);
    if (!phoneResult.valid) {
      console.error(`[NotificationService] Invalid phone rejected before queue: ${rawPhone} — ${phoneResult.error}`);
      return;
    }

    const phone = phoneResult.normalized;
    const template = notificationPayload.type;
    const variables = notificationPayload.variables;

    // 2. Generate idempotency key (fingerprint)
    const idempotencyKey = duplicateDetector.buildFingerprint(phone, template, variables);

    // 3. Duplicate detection
    const isDuplicate = await duplicateDetector.isDuplicate(phone, template, variables);
    if (isDuplicate) {
      console.log(`[NotificationService] Duplicate detected — skipping: ${phone} / ${template}`);
      notificationMetrics.recordDuplicateSkipped();
      return;
    }

    // 4. Determine priority and TTL
    const priority = TEMPLATE_PRIORITY[template];
    const ttlMs = TEMPLATE_TTL_MS[template];
    const expiresAt = ttlMs ? new Date(Date.now() + ttlMs).toISOString() : null;

    // 5. Insert into notifications collection within the transaction (without pre-rendered plain text)
    await payload.create({
      collection: 'notifications',
      data: {
        phone,
        template,
        payload: notificationPayload as unknown as Record<string, unknown>,
        status: 'queued',
        priority,
        attempts: 0,
        maxAttempts: Number(process.env.NOTIFICATION_MAX_RETRIES) || 5,
        expiresAt,
        idempotencyKey,
      },
      ...(transactionID
        ? { req: { transactionID } as unknown as PayloadRequest }
        : {}),
    });

    // 7. Record metric
    notificationMetrics.recordQueued();

    console.log(`[NotificationService] Queued ${template} notification to ${phone} (priority: ${priority})`);
  }
}

export const notificationService = new NotificationService();
