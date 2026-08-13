/**
 * Evolution API — Webhook Parser
 *
 * Parses Evolution-specific webhook payloads and converts them
 * to the generic WebhookEvent type defined in the provider interface.
 *
 * This file is INTERNAL to providers/evolution/. Never import outside.
 */

import type { WebhookEvent } from '../../notification-provider';
import {
  EVOLUTION_STATUS_MAP,
  type EvolutionWebhookMessageUpdate,
  type EvolutionWebhookConnectionUpdate,
} from './evolution-types';

/**
 * Parse a raw Evolution webhook body into a generic WebhookEvent.
 * Returns null if the payload is unrecognized or irrelevant.
 */
export function parseEvolutionWebhook(rawBody: unknown): WebhookEvent | null {
  if (!rawBody || typeof rawBody !== 'object') {
    return null;
  }

  const body = rawBody as Record<string, unknown>;
  const event = body.event as string | undefined;

  if (!event) return null;

  // ── Message Status Updates (delivered, read) ────────────────────────
  if (event === 'messages.update') {
    const payload = body as unknown as EvolutionWebhookMessageUpdate;
    const messageId = payload.data?.key?.id;
    const statusCode = payload.data?.update?.status;

    if (!messageId || statusCode === undefined) return null;

    const mappedStatus = EVOLUTION_STATUS_MAP[statusCode];
    if (!mappedStatus || mappedStatus === 'sent') return null; // We only care about delivered/read

    return {
      type: 'message-status',
      providerMessageId: messageId,
      status: mappedStatus,
      timestamp: payload.data?.messageTimestamp
        ? new Date(Number(payload.data.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString(),
      raw: { event, statusCode },
    };
  }

  // ── Connection State Changes ────────────────────────────────────────
  if (event === 'connection.update') {
    const payload = body as unknown as EvolutionWebhookConnectionUpdate;
    const state = payload.data?.state;

    if (!state) return null;

    const connectionMap: Record<string, WebhookEvent['connectionState']> = {
      'open': 'connected',
      'close': 'disconnected',
      'connecting': 'qr-required',
    };

    const connectionState = connectionMap[state];
    if (!connectionState) return null;

    return {
      type: 'connection-status',
      connectionState,
      timestamp: new Date().toISOString(),
      raw: { event, state, statusReason: payload.data?.statusReason },
    };
  }

  // ── QR Code Events ──────────────────────────────────────────────────
  if (event === 'qrcode.updated') {
    return {
      type: 'connection-status',
      connectionState: 'qr-required',
      timestamp: new Date().toISOString(),
      raw: { event },
    };
  }

  return null;
}
