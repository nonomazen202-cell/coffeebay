/**
 * Notification Templates — Structured Payload Builders
 *
 * Messages are structured payloads with type + variables.
 * Each provider converts the payload to its own format.
 * A pre-rendered text fallback is stored for providers that consume raw text.
 *
 * Never build messages inline inside business services.
 * Never concatenate strings across the project.
 */

import type { NotificationPayload, TemplateType } from './notification-provider';

// ── Template Data Types ─────────────────────────────────────────────────

export interface WinnerNotificationData {
  participantName: string;
  serialCode: string;
  prizeName: string;
  verificationCode: string;
  prizeImageUrl?: string;
}

export interface AdminAlertData {
  participantName: string;
  participantPhone: string;
  prizeName: string;
  serialCode: string;
}

export interface VerificationData {
  code: string;
  attemptId?: string;
}

// ── Priority & TTL Configuration ────────────────────────────────────────

export const TEMPLATE_PRIORITY: Record<TemplateType, number> = {
  'verification': 100,
  'winner-notification': 90,
  'admin-alert': 80,
};

/** TTL in milliseconds. null = no expiry. */
export const TEMPLATE_TTL_MS: Record<TemplateType, number | null> = {
  'verification': 5 * 60 * 1000,     // 5 minutes
  'winner-notification': 24 * 60 * 60 * 1000, // 24 hours
  'admin-alert': 24 * 60 * 60 * 1000,         // 24 hours
};

// ── Payload Builders ────────────────────────────────────────────────────

export function buildWinnerPayload(data: WinnerNotificationData): NotificationPayload {
  return {
    type: 'winner-notification',
    variables: {
      participantName: data.participantName,
      serialCode: data.serialCode,
      prizeName: data.prizeName,
      verificationCode: data.verificationCode,
      prizeImageUrl: data.prizeImageUrl || '',
    },
  };
}

export function buildAdminAlertPayload(data: AdminAlertData): NotificationPayload {
  return {
    type: 'admin-alert',
    variables: {
      participantName: data.participantName,
      participantPhone: data.participantPhone,
      prizeName: data.prizeName,
      serialCode: data.serialCode,
    },
  };
}

export function buildVerificationPayload(data: VerificationData): NotificationPayload {
  const variables: Record<string, string> = {
    code: data.code,
  };
  if (data.attemptId) {
    variables.attemptId = data.attemptId;
  }
  return {
    type: 'verification',
    variables,
  };
}


