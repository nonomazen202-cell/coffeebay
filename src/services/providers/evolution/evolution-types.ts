/**
 * Evolution API — Internal Type Definitions
 *
 * These types are INTERNAL to the Evolution provider directory.
 * They must NEVER be exported or imported outside of providers/evolution/.
 */

// ── Send Text Request ───────────────────────────────────────────────────

export interface EvolutionSendTextRequest {
  number: string;
  text: string;
  options?: {
    delay?: number;
    presence?: 'composing' | 'recording' | 'paused';
  };
}

// ── Send Text Response ──────────────────────────────────────────────────

export interface EvolutionSendTextResponse {
  key?: {
    remoteJid?: string;
    fromMe?: boolean;
    id?: string;
  };
  message?: {
    extendedTextMessage?: {
      text?: string;
    };
    conversation?: string;
  };
  messageTimestamp?: number | string;
  status?: string;
}

// ── Connection State Response ───────────────────────────────────────────

export interface EvolutionConnectionStateResponse {
  instance?: {
    instanceName?: string;
    state?: 'open' | 'close' | 'connecting';
  };
}

// ── Webhook Payloads ────────────────────────────────────────────────────

export interface EvolutionWebhookMessageUpdate {
  event?: string;
  instance?: string;
  data?: {
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
      id?: string;
    };
    update?: {
      status?: number; // 2=sent, 3=delivered, 4=read
    };
    messageTimestamp?: number;
  };
}

export interface EvolutionWebhookConnectionUpdate {
  event?: string;
  instance?: string;
  data?: {
    state?: 'open' | 'close' | 'connecting';
    statusReason?: number;
  };
}

// ── Status Code Mapping ─────────────────────────────────────────────────

export const EVOLUTION_STATUS_MAP: Record<number, 'sent' | 'delivered' | 'read'> = {
  2: 'sent',
  3: 'delivered',
  4: 'read',
};
