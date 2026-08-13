/**
 * Evolution API Provider Implementation
 *
 * This file is the ONLY place in the entire codebase where Evolution API
 * URLs, headers, and response handling exist.
 *
 * All Evolution-specific logic is contained within this directory.
 * The rest of the system interacts only with the NotificationProvider interface.
 */

import type {
  NotificationProvider,
  Notification,
  ProviderSendResult,
  ProviderCapabilities,
  ProviderHealthStatus,
  WebhookEvent,
  WebhookValidationResult,
} from "../../notification-provider";
import type {
  EvolutionSendTextRequest,
  EvolutionSendTextResponse,
  EvolutionConnectionStateResponse,
} from "./evolution-types";
import { parseEvolutionWebhook } from "./evolution-webhook";
import { EvolutionTemplateBuilder } from "./evolution-templates";

export class EvolutionProvider implements NotificationProvider {
  readonly name = "evolution";

  readonly capabilities: ProviderCapabilities = {
    supportsReadReceipts: true,
    supportsDeliveryReceipts: true,
    supportsMedia: true,
    supportsTemplates: false,
    supportsTyping: true,
    supportsButtons: false,
    supportsWebhooks: true,
    supportsSessionManagement: true,
    maxMessageLength: 65536,
    requiresHumanDelay: true,
    defaultRateLimitPerMinute: Number(process.env.NOTIFICATION_RATE_LIMIT_PER_MINUTE) || 20,
    supportsOTP: true,
    supportsPromotional: true,
    supportsAdminAlerts: true,
    supportsBulkSending: false,
  };

  private baseUrl: string;
  private apiKey: string;
  private instanceName: string;

  constructor() {
    this.baseUrl = process.env.EVOLUTION_API_URL || "";
    this.apiKey = process.env.EVOLUTION_API_KEY || "";
    this.instanceName = process.env.EVOLUTION_INSTANCE_NAME || "";
  }

  // ── Configuration Validation ────────────────────────────────────────

  private validateConfig(): void {
    if (!this.baseUrl) throw new Error("EVOLUTION_API_URL is not configured");
    if (!this.apiKey) throw new Error("EVOLUTION_API_KEY is not configured");
    if (!this.instanceName)
      throw new Error("EVOLUTION_INSTANCE_NAME is not configured");
  }

  // ── HTTP Helper ─────────────────────────────────────────────────────

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<{ ok: boolean; status: number; data: T }> {
    this.validateConfig();

    const url = `${this.baseUrl.replace(/\/$/, "")}${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });

    let data: T;
    try {
      data = (await response.json()) as T;
    } catch {
      data = {} as T;
    }

    return { ok: response.ok, status: response.status, data };
  }

  // ── Phone Formatting ────────────────────────────────────────────────

  /**
   * Convert E.164 phone to Evolution format.
   * Evolution expects: "5511999999999" (digits only, no '+')
   */
  private formatPhone(e164Phone: string): string {
    return e164Phone.replace(/^\+/, "");
  }

  private async sendPresence(
    phone: string,
    presence: "composing" | "recording" | "paused",
    delayMs: number,
  ): Promise<void> {
    try {
      const result = await this.request<unknown>(
        "POST",
        `/chat/sendPresence/${this.instanceName}`,
        {
          number: phone,
          delay: delayMs,
          presence,
        },
      );
      console.log(
        `[EvolutionProvider] sendPresence response for ${phone}: ok=${result.ok}, status=${result.status}, data=${JSON.stringify(result.data)}`
      );
    } catch (err) {
      console.error("[EvolutionProvider] sendPresence exception error:", err);
    }
  }

  // ── NotificationProvider.send() ─────────────────────────────────────

  async send(notification: Notification): Promise<ProviderSendResult> {
    const phone = this.formatPhone(notification.phone);
    const text =
      notification.message ||
      EvolutionTemplateBuilder.build(notification.payload);

    const isVerification = notification.payload?.type === "verification";

    let mediaToSend = "";
    let mediaFileName = "";
    let mediaMimeType = "";

    const siteUrl = (
      process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000"
    ).replace(/\/$/, "");
    const prizeImageUrl = notification.payload?.variables?.prizeImageUrl;

    if (prizeImageUrl && notification.payload.type === "winner-notification") {
      mediaToSend = `${siteUrl}${prizeImageUrl}`;
      mediaFileName =
        prizeImageUrl.substring(prizeImageUrl.lastIndexOf("/") + 1) ||
        "Coffee-bay-logo.jpg";
      mediaMimeType = "image/jpeg";
    } else if (!isVerification) {
      mediaToSend = `${siteUrl}/Coffee-bay-logo.jpg`;
      mediaFileName = "Coffee-bay-logo.jpg";
      mediaMimeType = "image/jpeg";
    }

    const delaySamples = [1200, 1800, 2500, 3100, 3500];
    const simulatedDelay =
      delaySamples[Math.floor(Math.random() * delaySamples.length)];

    // Trigger typing presence first and await the delay in our runtime to guarantee it shows up in WhatsApp
    await this.sendPresence(phone, "composing", simulatedDelay);
    await new Promise((resolve) => setTimeout(resolve, simulatedDelay));

    if (mediaToSend && !isVerification) {
      const mediaRequestBody = {
        number: phone,
        mediatype: "image",
        mimetype: mediaMimeType,
        media: mediaToSend,
        fileName: mediaFileName,
        caption: text,
        options: {
          delay: simulatedDelay,
          presence: "composing" as const,
        },
      };

      try {
        interface EvolutionSendMediaResponse {
          key?: {
            id?: string;
          };
        }

        const mediaResult = await this.request<EvolutionSendMediaResponse>(
          "POST",
          `/message/sendMedia/${this.instanceName}`,
          mediaRequestBody,
        );

        if (mediaResult.ok && mediaResult.data?.key?.id) {
          console.log(
            `[EvolutionProvider] Successfully sent branded media message ${mediaResult.data.key.id} to ${phone}`,
          );
          return {
            success: true,
            messageId: mediaResult.data.key.id,
            status: "provider-accepted",
            deliveryPayload: {
              number: phone,
              fileName: mediaFileName,
              caption: text,
              options: mediaRequestBody.options,
            },
            renderedMessage: text,
          };
        }

        console.warn(
          `[EvolutionProvider] sendMedia failed with status ${mediaResult.status}, falling back to sendText...`,
        );
      } catch (mediaErr) {
        console.error(
          "[EvolutionProvider] sendMedia exception, falling back to sendText:",
          mediaErr,
        );
      }
    }

    // Standard sendText fallback if logo is missing or sendMedia fails
    const requestBody: EvolutionSendTextRequest = {
      number: phone,
      text,
      options: {
        delay: simulatedDelay,
        presence: "composing",
      },
    };

    try {
      const result = await this.request<EvolutionSendTextResponse>(
        "POST",
        `/message/sendText/${this.instanceName}`,
        requestBody,
      );

      if (result.ok && result.data?.key?.id) {
        return {
          success: true,
          messageId: result.data.key.id,
          status: "provider-accepted",
          deliveryPayload: requestBody,
          renderedMessage: text,
        };
      }

      // Determine if the failure is retryable
      const retryable =
        result.status === 429 || result.status >= 500 || result.status === 408;

      return {
        success: false,
        error: `Provider returned HTTP ${result.status}: ${JSON.stringify(result.data).substring(0, 200)}`,
        retryable,
        deliveryPayload: requestBody,
        renderedMessage: text,
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const isTimeout = errMsg.includes("timeout") || errMsg.includes("abort");
      const isNetwork =
        errMsg.includes("ECONNREFUSED") ||
        errMsg.includes("ECONNRESET") ||
        errMsg.includes("ENOTFOUND") ||
        errMsg.includes("fetch failed");

      return {
        success: false,
        error: errMsg,
        retryable: isTimeout || isNetwork,
        deliveryPayload: requestBody,
        renderedMessage: text,
      };
    }
  }

  // ── NotificationProvider.checkHealth() ──────────────────────────────

  async checkHealth(): Promise<ProviderHealthStatus> {
    try {
      const result = await this.request<EvolutionConnectionStateResponse>(
        "GET",
        `/instance/connectionState/${this.instanceName}`,
      );

      if (!result.ok) {
        return {
          healthy: false,
          sessionConnected: false,
          phoneConnected: false,
          details: { httpStatus: result.status },
        };
      }

      const state = result.data?.instance?.state;

      return {
        healthy: state === "open",
        sessionConnected: state === "open",
        phoneConnected: state === "open",
        details: {
          instanceName: result.data?.instance?.instanceName,
          state,
        },
      };
    } catch (error: unknown) {
      return {
        healthy: false,
        sessionConnected: false,
        phoneConnected: false,
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  // ── NotificationProvider.connect() ──────────────────────────────────

  async connect(): Promise<void> {
    this.validateConfig();

    const result = await this.request<Record<string, unknown>>(
      "GET",
      `/instance/connect/${this.instanceName}`,
    );

    if (!result.ok) {
      console.error("[EvolutionProvider] Failed to connect:", result.data);
    } else {
      console.log("[EvolutionProvider] Connection initiated");
    }
  }

  // ── NotificationProvider.disconnect() ───────────────────────────────

  async disconnect(): Promise<void> {
    try {
      await this.request<Record<string, unknown>>(
        "DELETE",
        `/instance/logout/${this.instanceName}`,
      );
      console.log("[EvolutionProvider] Disconnected");
    } catch {
      // Best effort
    }
  }

  async reconnect(): Promise<void> {
    console.log("[EvolutionProvider] Reconnecting instance...");
    try {
      await this.request<Record<string, unknown>>(
        "PUT",
        `/instance/restart/${this.instanceName}`,
      );
      console.log("[EvolutionProvider] Restart command sent successfully");
    } catch (error) {
      console.error("[EvolutionProvider] Failed to trigger restart:", error);
    }
  }

  // ── NotificationProvider.getSessionState() ──────────────────────────

  async getSessionState(): Promise<
    "connected" | "disconnected" | "connecting" | "qr-required"
  > {
    try {
      const health = await this.checkHealth();
      if (health.sessionConnected) return "connected";

      const state = health.details.state as string | undefined;
      if (state === "connecting") return "connecting";
      if (state === "close") return "disconnected";

      return "disconnected";
    } catch {
      return "disconnected";
    }
  }

  // ── NotificationProvider.parseWebhook() ─────────────────────────────

  parseWebhook(rawBody: unknown): WebhookEvent | null {
    return parseEvolutionWebhook(rawBody);
  }

  async validateAndParseWebhook(request: {
    method: string;
    headers: Headers;
    searchParams: Record<string, string>;
    rawBody: string;
  }): Promise<WebhookValidationResult> {
    if (request.method !== "POST") {
      return { verified: false, error: "Method Not Allowed" };
    }

    const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET;
    if (webhookSecret) {
      const authHeader =
        request.headers.get("Authorization") || request.headers.get("apikey");
      if (authHeader !== webhookSecret) {
        return { verified: false, error: "Unauthorized signature" };
      }
    }

    let body: unknown;
    try {
      body = request.rawBody ? JSON.parse(request.rawBody) : {};
    } catch {
      return { verified: false, error: "Malformed JSON payload" };
    }

    const event = this.parseWebhook(body);
    return {
      verified: true,
      event,
    };
  }

  // ── NotificationProvider.initialize() ───────────────────────────────

  async initialize(): Promise<void> {
    this.baseUrl = process.env.EVOLUTION_API_URL || "";
    this.apiKey = process.env.EVOLUTION_API_KEY || "";
    this.instanceName = process.env.EVOLUTION_INSTANCE_NAME || "";

    this.validateConfig();
    console.log(
      `[EvolutionProvider] Initialized for instance: ${this.instanceName}`,
    );
  }

  // ── NotificationProvider.shutdown() ─────────────────────────────────

  async shutdown(): Promise<void> {
    console.log("[EvolutionProvider] Shutdown complete");
  }
}
