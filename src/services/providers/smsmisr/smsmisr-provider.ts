/**
 * SMS Misr Provider Implementation
 *
 * Implements NotificationProvider interface for SMS Misr REST APIs.
 * Uses SmsMisrClient for HTTP layer isolation and SmsMisrTemplateBuilder
 * for pure template formatting.
 */

import type {
  NotificationProvider,
  Notification,
  ProviderSendResult,
  ProviderCapabilities,
  ProviderHealthStatus,
  WebhookEvent,
  WebhookValidationResult,
} from '../../notification-provider';
import { SmsMisrClient } from './smsmisr-client';
import { SmsMisrTemplateBuilder } from './smsmisr-templates';

export class SmsMisrProvider implements NotificationProvider {
  readonly name = 'smsmisr';

  readonly capabilities: ProviderCapabilities = {
    supportsReadReceipts: false,
    supportsDeliveryReceipts: false,
    supportsMedia: false,
    supportsTemplates: true,
    supportsTyping: false,
    supportsButtons: false,
    supportsWebhooks: false,
    supportsSessionManagement: false,
    maxMessageLength: 160,
    requiresHumanDelay: false,
    defaultRateLimitPerMinute: Number(process.env.SMSMISR_RATE_LIMIT_PER_MINUTE ?? 600),
    supportsOTP: true,
    supportsPromotional: true,
    supportsAdminAlerts: false,
    supportsBulkSending: true,
  };

  private client: SmsMisrClient;

  constructor() {
    this.client = new SmsMisrClient();
  }

  // ── Phone Validation & Normalization ────────────────────────────────

  /**
   * Validates and normalizes Egyptian phone numbers.
   * Expected output: 201XXXXXXXXX (12 digits)
   */
  private normalizePhone(phone: string): { valid: boolean; normalized?: string; error?: string } {
    if (!phone) return { valid: false, error: 'Phone number is empty' };

    // Remove all non-digits
    const cleanDigits = phone.replace(/\D/g, '');

    // Case 1: 010XXXXXXXX (11 digits starting with 01) -> remove leading zero
    if (/^01[0125]\d{8}$/.test(cleanDigits)) {
      return { valid: true, normalized: `20${cleanDigits.slice(1)}` };
    }

    // Case 2: 201XXXXXXXXX (12 digits starting with 201)
    if (/^201[0125]\d{8}$/.test(cleanDigits)) {
      return { valid: true, normalized: cleanDigits };
    }

    // Case 3: International format without 20 (e.g., 10XXXXXXXX)
    if (/^1[0125]\d{8}$/.test(cleanDigits)) {
      return { valid: true, normalized: `20${cleanDigits}` };
    }

    return { valid: false, error: `Invalid Egyptian mobile number format: ${phone}` };
  }

  // ── NotificationProvider.send() ─────────────────────────────────────

  async send(notification: Notification): Promise<ProviderSendResult> {
    const startTime = Date.now();
    const payloadType = notification.payload?.type;

    // 1. Bypass Admin Alerts Safely (No-Op)
    if (payloadType === 'admin-alert' || !this.capabilities.supportsAdminAlerts) {
      if (payloadType === 'admin-alert') {
        console.log(`[SmsMisrProvider] Safely bypassing admin-alert notification ID:${notification.id} (No-Op on SMS Misr)`);
        return {
          success: true,
          messageId: `bypassed-admin-alert-${notification.id}`,
          status: 'delivered',
          renderedMessage: 'Admin alert bypassed on SMS Misr',
        };
      }
    }

    // 2. Validate & Normalize Phone Number
    const phoneResult = this.normalizePhone(notification.phone);
    if (!phoneResult.valid || !phoneResult.normalized) {
      console.warn(`[SmsMisrProvider] Pre-send phone validation failed for notification ID:${notification.id}: ${phoneResult.error}`);
      return {
        success: false,
        error: phoneResult.error,
        retryable: false, // Fatal error: Bad phone number format
      };
    }

    const normalizedPhone = phoneResult.normalized;

    // 3. Determine Intent & Render Text Template
    const intent = payloadType === 'verification' ? 'otp' : 'transactional';
    const otpCode = payloadType === 'verification' ? notification.payload.variables.code : undefined;
    const text = notification.message || SmsMisrTemplateBuilder.build(notification.payload);

    // 4. Dispatch via Isolated SmsMisrClient
    const clientResult = await this.client.sendSms({
      mobile: normalizedPhone,
      message: text,
      intent,
      otpCode,
      templateId: process.env.SMSMISR_OTP_TEMPLATE_ID,
    });

    const latencyMs = Date.now() - startTime;

    // 5. Structured Context Logging
    console.log(
      `[SmsMisrProvider] Dispatch Complete | QueueID:${notification.id} | Intent:${intent} | ` +
      `Latency:${latencyMs}ms | Code:${clientResult.code || 'N/A'} | ` +
      `Success:${clientResult.success} | IdempotencyKey:${notification.idempotencyKey}`
    );

    if (clientResult.success) {
      return {
        success: true,
        messageId: clientResult.messageId,
        status: 'provider-accepted',
        renderedMessage: text,
        deliveryPayload: clientResult.rawResponse,
      };
    }

    return {
      success: false,
      error: clientResult.error,
      retryable: clientResult.retryable,
      renderedMessage: text,
      deliveryPayload: clientResult.rawResponse,
    };
  }

  // ── NotificationProvider Health & Session Stubs ────────────────────

  async checkHealth(): Promise<ProviderHealthStatus> {
    const isConfigured = Boolean(process.env.SMSMISR_USERNAME && process.env.SMSMISR_PASSWORD);
    return {
      healthy: isConfigured,
      sessionConnected: true,
      phoneConnected: true,
      details: {
        provider: 'smsmisr',
        environment: process.env.SMSMISR_ENVIRONMENT || 'test',
        senderId: process.env.SMSMISR_SENDER_ID || 'seashell',
      },
    };
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async reconnect(): Promise<void> {}

  async getSessionState(): Promise<'connected' | 'disconnected' | 'connecting' | 'qr-required'> {
    return 'connected';
  }

  parseWebhook(): WebhookEvent | null {
    return null; // SMS Misr synchronous status API
  }

  async validateAndParseWebhook(): Promise<WebhookValidationResult> {
    return { verified: true, event: null };
  }

  async initialize(): Promise<void> {
    console.log(`[SmsMisrProvider] Initialized with Sender ID: ${process.env.SMSMISR_SENDER_ID || 'seashell'}`);
  }

  async shutdown(): Promise<void> {
    console.log('[SmsMisrProvider] Shutdown complete');
  }
}
