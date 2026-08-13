/**
 * Notification Provider Interface — Core Abstraction Layer
 *
 * This file defines the provider-agnostic contract for all notification providers.
 * No provider-specific code (Evolution, Meta, Twilio, etc.) may appear here.
 *
 * The factory function reads NOTIFICATION_PROVIDER env var and instantiates
 * the correct implementation.
 */
import { EvolutionProvider } from './providers/evolution/evolution-provider';
import { SmsMisrProvider } from './providers/smsmisr/smsmisr-provider';

// ── Notification Payload (structured, not strings) ──────────────────────

export type TemplateType = 'verification' | 'winner-notification' | 'admin-alert';

export interface NotificationPayload {
  type: TemplateType;
  variables: Record<string, string>;
}

// ── Notification Object (what the provider receives) ────────────────────

export interface Notification {
  id: number;
  phone: string;
  payload: NotificationPayload;
  message: string;
  idempotencyKey: string;
  priority: number;
  createdAt: string;
  expiresAt: string | null;
}

// ── Provider Result ─────────────────────────────────────────────────────

export type DeliveryStatus =
  | 'provider-accepted'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export interface ProviderSendResult {
  success: boolean;
  messageId?: string;
  status?: DeliveryStatus;
  error?: string;
  retryable?: boolean;
  deliveryPayload?: unknown;
  renderedMessage?: string;
}

// ── Provider Capabilities ───────────────────────────────────────────────

export interface ProviderCapabilities {
  supportsReadReceipts: boolean;
  supportsDeliveryReceipts: boolean;
  supportsMedia: boolean;
  supportsTemplates: boolean;
  supportsTyping: boolean;
  supportsButtons: boolean;
  supportsWebhooks: boolean;
  supportsSessionManagement: boolean;
  maxMessageLength: number;
  requiresHumanDelay: boolean;
  defaultRateLimitPerMinute: number;
  supportsOTP: boolean;
  supportsPromotional: boolean;
  supportsAdminAlerts: boolean;
  supportsBulkSending: boolean;
}

// ── Provider Health ─────────────────────────────────────────────────────

export interface ProviderHealthStatus {
  healthy: boolean;
  sessionConnected: boolean;
  phoneConnected: boolean;
  details: Record<string, unknown>;
}

// ── Webhook Event (generic, provider-agnostic) ──────────────────────────

export interface WebhookEvent {
  type: 'message-status' | 'connection-status';
  providerMessageId?: string;
  status?: 'delivered' | 'read' | 'failed';
  connectionState?: 'connected' | 'disconnected' | 'qr-required';
  timestamp: string;
  raw?: Record<string, unknown>;
}

export interface WebhookValidationResult {
  verified: boolean;
  challenge?: string;
  event?: WebhookEvent | null;
  error?: string;
}

// ── Provider Interface ──────────────────────────────────────────────────

export interface NotificationProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  /** Send a notification. Receives the full Notification object. */
  send(notification: Notification): Promise<ProviderSendResult>;

  /** Check provider and session health. */
  checkHealth(): Promise<ProviderHealthStatus>;

  /** Establish provider session/connection. */
  connect(): Promise<void>;

  /** Disconnect provider session. */
  disconnect(): Promise<void>;

  /** Reconnect after disconnect. */
  reconnect(): Promise<void>;

  /** Get current session state. */
  getSessionState(): Promise<'connected' | 'disconnected' | 'connecting' | 'qr-required'>;

  /** Parse a raw webhook body into a generic WebhookEvent. */
  parseWebhook(rawBody: unknown): WebhookEvent | null;

  /** Validates and parses an incoming webhook request in a provider-agnostic manner. */
  validateAndParseWebhook(request: {
    method: string;
    headers: Headers;
    searchParams: Record<string, string>;
    rawBody: string;
  }): Promise<WebhookValidationResult>;

  /** One-time initialization (called at worker startup). */
  initialize(): Promise<void>;

  /** Clean shutdown (called during graceful termination). */
  shutdown(): Promise<void>;
}

// ── Provider Factory ────────────────────────────────────────────────────

let cachedProvider: NotificationProvider | null = null;

export function createNotificationProvider(): NotificationProvider {
  if (cachedProvider) return cachedProvider;

  const providerName = process.env.NOTIFICATION_PROVIDER || 'evolution';
  let providerInstance: NotificationProvider;

  if (providerName === 'evolution') {
    providerInstance = new EvolutionProvider();
  } else if (providerName === 'smsmisr') {
    providerInstance = new SmsMisrProvider();
  } else {
    throw new Error(
      `Invalid notification provider: "${providerName}". ` +
      `Supported providers: "evolution", "smsmisr".`,
    );
  }

  cachedProvider = providerInstance;
  console.log(`[NotificationProvider] Initialized provider: ${cachedProvider.name}`);
  return cachedProvider;
}

/**
 * Reset the cached provider (used in tests or when switching providers).
 */
export function resetNotificationProvider(): void {
  cachedProvider = null;
}

