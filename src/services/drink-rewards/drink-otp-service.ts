import crypto from 'crypto';
import { sql } from 'drizzle-orm';
import { getPayloadClient } from '../../lib/payload';
import { validateAndNormalizePhone } from '../../lib/validators/phone-validator';
import { notificationService } from '../notification-service';

export type RewardJourneyStatus = 'PENDING_OTP' | 'VERIFIED' | 'CLAIMED';

export type RewardJourneyStage =
  | 'UNINITIALIZED'
  | 'PENDING_OTP'
  | 'EXPIRED_OTP'
  | 'VERIFIED'
  | 'CLAIMED';

export type RewardRouteStage = 'DETAILS' | 'VERIFY' | 'CHOOSE_DRINK' | 'SUCCESS';

export type RouteAccessDecision =
  | { allowed: true }
  | { allowed: false; redirectTo: string };

export interface RewardJourneySessionPayload {
  v: 1;
  campaignId: number | string;
  campaignSlug: string;
  customerName: string;
  phone: string;
  selectedBranchId: number | string | null;
  selectedDrinkId: number | string | null;
  challengeId: number | string | null;
  status: RewardJourneyStatus;
  verifiedAt: number | null;
  entitlementId: number | string | null;
  voucherCode: string | null;
  iat: number;
  exp: number;
}

export type VoucherLifecycleStatus = 'ISSUED' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED';

export interface IssuedVoucherSnapshot {
  entitlementId?: number | string;
  voucherCode: string;
  customerName: string;
  phone: string;
  drinkName: string;
  drinkImageUrl?: string | null;
  branchId?: number | string | null;
  branchName?: string | null;
  campaignTitle: string;
  status?: VoucherLifecycleStatus;
  redeemedAt?: string | null;
  expiresAt: string;
  issuedAt: string;
}

export interface ResolvedRewardJourneyState {
  stage: RewardJourneyStage;
  campaignSlug: string;
  customerName: string;
  phone: string;
  selectedBranchId: number | string | null;
  selectedDrinkId: number | string | null;
  challengeId: number | string | null;
  expiresAt: string | null;
  resendAvailableAt: string | null;
  verifiedExpiresAt: string | null;
  attemptsRemaining: number | null;
  voucher: IssuedVoucherSnapshot | null;
  serverNow: string;
}

export interface RequestOtpParams {
  phone: string;
  campaignSlug: string;
  intent?: 'start' | 'resend';
  existingSession?: RewardJourneySessionPayload | null;
}

export interface RequestOtpResult {
  success: boolean;
  message: string;
  reason?:
    | 'INVALID_PHONE'
    | 'CAMPAIGN_NOT_FOUND'
    | 'CAMPAIGN_INACTIVE'
    | 'CAMPAIGN_EXPIRED'
    | 'CAMPAIGN_EXHAUSTED'
    | 'ALREADY_CLAIMED'
    | 'COOLDOWN_ACTIVE'
    | 'INTERNAL_ERROR';
  resumed?: boolean;
  nextStep?: 'VERIFY' | 'CHOOSE_DRINK' | 'SUCCESS';
  normalizedPhone?: string;
  campaignId?: number | string;
  challengeId?: number | string;
  verifiedAt?: number | null;
  resendAvailableAt?: string;
  expiresAt?: string;
  serverNow?: string;
  voucher?: IssuedVoucherSnapshot;
}

export interface VerifyOtpParams {
  phone: string;
  campaignSlug: string;
  otpCode: string;
  expectedChallengeId?: number | string | null;
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  reason?:
    | 'INVALID_PHONE'
    | 'CAMPAIGN_NOT_FOUND'
    | 'EXPIRED_OR_NOT_FOUND'
    | 'MAX_ATTEMPTS_EXCEEDED'
    | 'INVALID_CODE'
    | 'INTERNAL_ERROR';
  verificationToken?: string;
  attemptsRemaining?: number;
  normalizedPhone?: string;
  campaignId?: number | string;
  challengeId?: number | string;
  verifiedAt?: number;
}

export interface VerificationSessionPayload {
  phone: string;
  campaignId: number | string;
  challengeId: number | string;
  verifiedAt: number;
  exp: number;
}

interface ChallengeDbRow {
  id: number;
  code: string;
  expires_at: string;
  last_sent_at: string;
  attempts: number;
  verified_at: string | null;
  used_at: string | null;
}

interface EntitlementDbRow {
  id: number;
  voucher_code: string;
  customer_name: string;
  phone: string;
  selected_drink_id: number;
  branch_id: number | null;
  branch_name: string | null;
  status?: VoucherLifecycleStatus;
  redeemed_at?: string | null;
  issued_at: string;
  expires_at: string;
  drink_name: string;
  drink_image_url: string | null;
}

export const OTP_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes (code entry window)
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
export const OTP_MAX_ATTEMPTS = 3;
export const VERIFIED_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (once phone is verified via OTP, customer stays verified until claim!)
export const PENDING_JOURNEY_COOKIE_TTL_SEC = 60 * 60; // 60 minutes (journey metadata continuity while OTP is pending)
export const VERIFIED_JOURNEY_COOKIE_TTL_SEC = 7 * 24 * 60 * 60; // 7 days (persists verified drink-selection stage across reloads & sessions)
export const CLAIMED_JOURNEY_COOKIE_MAX_SEC = 7 * 24 * 60 * 60; // up to 7 days

function timingSafeCompareStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export class DrinkOtpService {
  private getSecret(): string {
    const secret = process.env.DRINK_OTP_SECRET || process.env.PAYLOAD_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          '[Security Exception] DRINK_OTP_SECRET or PAYLOAD_SECRET environment variable is mandatory in production mode. Refusing to run with fallback secret.',
        );
      }
      return 'coffeebay-drink-otp-hmac-secret-salt-2026';
    }
    return secret;
  }

  private getAesKey(): Buffer {
    return crypto
      .createHash('sha256')
      .update(`coffeebay-drj-aes-v1:${this.getSecret()}`)
      .digest();
  }

  private signData(dataStr: string): string {
    return crypto
      .createHmac('sha256', this.getSecret())
      .update(dataStr)
      .digest('base64url');
  }

  /**
   * Deterministic, campaign-isolated HttpOnly cookie name.
   * Prevents cross-campaign session collisions or mixing in the same browser.
   */
  getJourneyCookieName(campaignSlug: string): string {
    const normalizedSlug = campaignSlug.trim().toLowerCase();
    const digest = crypto
      .createHash('sha256')
      .update(normalizedSlug)
      .digest('hex')
      .slice(0, 10);
    return `cb_drj_${digest}`;
  }

  /**
   * Standard security attributes for the HttpOnly Reward Journey cookie.
   */
  buildJourneyCookieOptions(maxAgeSeconds: number): {
    httpOnly: boolean;
    sameSite: 'lax';
    secure: boolean;
    path: string;
    maxAge: number;
  } {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: Math.max(0, Math.floor(maxAgeSeconds)),
    };
  }

  /**
   * Encrypts the Reward Journey session into authenticated ciphertext (AES-256-GCM).
   * Ensures that personal customer data (phone number, customer name) is NEVER readable in plaintext
   * anywhere inside the browser's cookie storage, while guaranteeing cryptographic tamper resistance.
   */
  createJourneyCookieValue(payload: RewardJourneySessionPayload): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.getAesKey(), iv);
    const jsonStr = JSON.stringify(payload);
    let ciphertext = cipher.update(jsonStr, 'utf8', 'base64url');
    ciphertext += cipher.final('base64url');
    const authTag = cipher.getAuthTag().toString('base64url');
    return `enc.${iv.toString('base64url')}.${authTag}.${ciphertext}`;
  }

  /**
   * Cryptographically decrypts and verifies an authenticated Reward Journey cookie (AES-256-GCM).
   * Enforces integrity authentication tag, expiration, schema version, and optional campaignSlug binding.
   */
  verifyJourneyCookieValue(
    cookieValue: string | undefined | null,
    expectedCampaignSlug?: string,
  ): RewardJourneySessionPayload | null {
    if (!cookieValue || typeof cookieValue !== 'string') {
      return null;
    }

    try {
      const parts = cookieValue.split('.');
      let raw: Partial<RewardJourneySessionPayload> | null = null;

      if (parts.length === 4 && parts[0] === 'enc') {
        // Authenticated AES-256-GCM AEAD decryption
        const [, ivStr, tagStr, cipherStr] = parts;
        if (!ivStr || !tagStr || !cipherStr) return null;

        const iv = Buffer.from(ivStr, 'base64url');
        const authTag = Buffer.from(tagStr, 'base64url');
        if (iv.length !== 12 || authTag.length !== 16) return null;

        const decipher = crypto.createDecipheriv('aes-256-gcm', this.getAesKey(), iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(cipherStr, 'base64url', 'utf8');
        decrypted += decipher.final('utf8');
        raw = JSON.parse(decrypted) as Partial<RewardJourneySessionPayload>;
      } else if (parts.length === 2) {
        // Legacy HMAC format backward compatibility
        const [dataStr, signature] = parts;
        if (!dataStr || !signature) return null;
        const expectedSig = this.signData(dataStr);
        if (!timingSafeCompareStrings(signature, expectedSig)) {
          return null;
        }
        raw = JSON.parse(
          Buffer.from(dataStr, 'base64url').toString('utf8'),
        ) as Partial<RewardJourneySessionPayload>;
      } else {
        return null;
      }

      if (
        !raw ||
        raw.v !== 1 ||
        typeof raw.campaignSlug !== 'string' ||
        typeof raw.phone !== 'string' ||
        typeof raw.customerName !== 'string' ||
        typeof raw.exp !== 'number' ||
        (raw.status !== 'PENDING_OTP' &&
          raw.status !== 'VERIFIED' &&
          raw.status !== 'CLAIMED')
      ) {
        return null;
      }

      if (Date.now() > raw.exp) {
        return null;
      }

      if (
        expectedCampaignSlug &&
        raw.campaignSlug.trim().toLowerCase() !==
          expectedCampaignSlug.trim().toLowerCase()
      ) {
        return null;
      }

      return {
        v: 1,
        campaignId: raw.campaignId ?? '',
        campaignSlug: raw.campaignSlug,
        customerName: raw.customerName,
        phone: raw.phone,
        selectedBranchId: raw.selectedBranchId ?? null,
        selectedDrinkId: raw.selectedDrinkId ?? null,
        challengeId: raw.challengeId ?? null,
        status: raw.status,
        verifiedAt: typeof raw.verifiedAt === 'number' ? raw.verifiedAt : null,
        entitlementId: raw.entitlementId ?? null,
        voucherCode: typeof raw.voucherCode === 'string' ? raw.voucherCode : null,
        iat: typeof raw.iat === 'number' ? raw.iat : Date.now(),
        exp: raw.exp,
      };
    } catch {
      return null;
    }
  }

  /**
   * Creates a signed tamper-proof verification session token for entitlement claiming.
   */
  createSessionToken(payload: VerificationSessionPayload): string {
    const dataStr = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = this.signData(dataStr);
    return `${dataStr}.${signature}`;
  }

  /**
   * Verifies and decodes a signed verification session token.
   */
  verifySessionToken(token: string): VerificationSessionPayload | null {
    if (!token || typeof token !== 'string') {
      return null;
    }
    try {
      const parts = token.split('.');
      if (parts.length !== 2) return null;
      const [dataStr, signature] = parts;
      if (!dataStr || !signature) return null;

      const expectedSig = this.signData(dataStr);
      if (!timingSafeCompareStrings(signature, expectedSig)) {
        return null;
      }

      const decoded = JSON.parse(
        Buffer.from(dataStr, 'base64url').toString('utf8'),
      ) as VerificationSessionPayload;
      if (typeof decoded.exp !== 'number' || Date.now() > decoded.exp) {
        return null;
      }
      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * Checks whether an incoming request can resume an already-owned challenge/session
   * without sending a new SMS (used by route handler to avoid burning SMS rate limits on Back/Forward).
   */
  canAttemptSilentResume(
    intent: 'start' | 'resend',
    rawPhone: string,
    campaignSlug: string,
    existingSession: RewardJourneySessionPayload | null,
  ): boolean {
    if (intent !== 'start' || !existingSession) {
      return false;
    }
    const phoneCheck = validateAndNormalizePhone(rawPhone);
    if (!phoneCheck.valid) {
      return false;
    }
    return (
      existingSession.campaignSlug.trim().toLowerCase() ===
        campaignSlug.trim().toLowerCase() &&
      existingSession.phone === phoneCheck.normalized
    );
  }

  /**
   * Lightweight campaign header lookup (`id`, `slug`, `title`) for session state resolution
   * without loading full drink/category/branch menus.
   */
  async getCampaignHeaderBySlug(
    campaignSlug: string,
  ): Promise<{ id: number | string; slug: string; title: string } | null> {
    const payload = await getPayloadClient();
    const docs = await payload.find({
      collection: 'drink-campaigns',
      where: { slug: { equals: campaignSlug.trim() } },
      limit: 1,
      depth: 0,
    });
    if (docs.totalDocs === 0) {
      return null;
    }
    const camp = docs.docs[0];
    return {
      id: camp.id,
      slug: camp.slug,
      title: camp.title,
    };
  }

  /**
   * Resolves the authoritative Reward Journey state by cross-checking the signed
   * HttpOnly cookie against PostgreSQL (`drink_entitlements` & `drink_otp_challenges`).
   * Never trusts client state; server DB is always the final source of truth.
   */
  async resolveJourneyState(
    campaignInfo: { id: number | string; slug: string; title: string },
    cookieValue?: string | null,
  ): Promise<ResolvedRewardJourneyState> {
    const nowMs = Date.now();
    const serverNow = new Date(nowMs).toISOString();

    const emptyState: ResolvedRewardJourneyState = {
      stage: 'UNINITIALIZED',
      campaignSlug: campaignInfo.slug,
      customerName: '',
      phone: '',
      selectedBranchId: null,
      selectedDrinkId: null,
      challengeId: null,
      expiresAt: null,
      resendAvailableAt: null,
      verifiedExpiresAt: null,
      attemptsRemaining: null,
      voucher: null,
      serverNow,
    };

    const session = this.verifyJourneyCookieValue(cookieValue, campaignInfo.slug);
    if (!session || String(session.campaignId) !== String(campaignInfo.id)) {
      return emptyState;
    }

    const payload = await getPayloadClient();
    const campaignIdNum = Number(campaignInfo.id);

    // 1. If this browser completed OTP verification, check if an entitlement voucher was issued
    if (session.verifiedAt !== null) {
      const entitlementRes = await payload.db.drizzle.execute(sql`
        SELECT e.id, e.voucher_code, e.customer_name, e.phone, e.selected_drink_id,
               e.branch_id, b.name AS branch_name,
               e.status, e.redeemed_at,
               e.issued_at, e.expires_at,
               COALESCE(d.name, 'Coffee Bay Beverage') AS drink_name,
               m.url AS drink_image_url
        FROM drink_entitlements e
        LEFT JOIN drinks d ON d.id = COALESCE(e.redeemed_drink_id, e.selected_drink_id)
        LEFT JOIN media m ON m.id = d.image_id
        LEFT JOIN branches b ON b.id = e.branch_id
        WHERE e.campaign_id = ${campaignIdNum}
          AND e.phone = ${session.phone}
        LIMIT 1
      `);

      if (entitlementRes.rows && entitlementRes.rows.length > 0) {
        const ent = entitlementRes.rows[0] as unknown as EntitlementDbRow;
        const issuedMs = new Date(ent.issued_at).getTime();
        const isBoundToBrowserVerification =
          session.status === 'CLAIMED' || issuedMs >= session.verifiedAt - 15_000;

        if (isBoundToBrowserVerification) {
          const rawStatus: VoucherLifecycleStatus = ent.status || 'ISSUED';
          const effectiveStatus: VoucherLifecycleStatus =
            rawStatus === 'ISSUED' && new Date(ent.expires_at).getTime() <= nowMs
              ? 'EXPIRED'
              : rawStatus;

          return {
            stage: 'CLAIMED',
            campaignSlug: campaignInfo.slug,
            customerName: ent.customer_name,
            phone: ent.phone,
            selectedBranchId: ent.branch_id ?? session.selectedBranchId,
            selectedDrinkId: ent.selected_drink_id,
            challengeId: session.challengeId,
            expiresAt: null,
            resendAvailableAt: null,
            verifiedExpiresAt: null,
            attemptsRemaining: null,
            voucher: {
              entitlementId: ent.id,
              voucherCode: ent.voucher_code,
              customerName: ent.customer_name,
              phone: ent.phone,
              drinkName: ent.drink_name,
              drinkImageUrl: ent.drink_image_url ?? null,
              branchId: ent.branch_id ?? session.selectedBranchId ?? null,
              branchName: ent.branch_name ?? null,
              campaignTitle: campaignInfo.title,
              status: effectiveStatus,
              redeemedAt: ent.redeemed_at ? new Date(ent.redeemed_at).toISOString() : null,
              expiresAt: new Date(ent.expires_at).toISOString(),
              issuedAt: new Date(ent.issued_at).toISOString(),
            },
            serverNow,
          };
        }
      }
    }

    // 2. If verified and within the 15-minute verification window, verify DB challenge is still unconsumed
    if (
      session.status === 'VERIFIED' &&
      session.verifiedAt !== null &&
      session.challengeId !== null
    ) {
      const verifiedExpiresMs = session.verifiedAt + VERIFIED_SESSION_TTL_MS;
      if (nowMs < verifiedExpiresMs) {
        const challengeRes = await payload.db.drizzle.execute(sql`
          SELECT id, expires_at, last_sent_at, attempts, verified_at, used_at
          FROM drink_otp_challenges
          WHERE id = ${Number(session.challengeId)}
            AND phone = ${session.phone}
            AND campaign_id = ${campaignIdNum}
          LIMIT 1
        `);

        if (challengeRes.rows && challengeRes.rows.length > 0) {
          const ch = challengeRes.rows[0] as unknown as ChallengeDbRow;
          if (ch.verified_at !== null && ch.used_at === null) {
            return {
              stage: 'VERIFIED',
              campaignSlug: campaignInfo.slug,
              customerName: session.customerName,
              phone: session.phone,
              selectedBranchId: session.selectedBranchId,
              selectedDrinkId: session.selectedDrinkId,
              challengeId: ch.id,
              expiresAt: null,
              resendAvailableAt: null,
              verifiedExpiresAt: new Date(verifiedExpiresMs).toISOString(),
              attemptsRemaining: null,
              voucher: null,
              serverNow,
            };
          }
        }
      }

      // Verification window expired -> allow clean OTP re-request while preserving customer details
      return {
        stage: 'EXPIRED_OTP',
        campaignSlug: campaignInfo.slug,
        customerName: session.customerName,
        phone: session.phone,
        selectedBranchId: session.selectedBranchId,
        selectedDrinkId: session.selectedDrinkId,
        challengeId: null,
        expiresAt: null,
        resendAvailableAt: null,
        verifiedExpiresAt: null,
        attemptsRemaining: 0,
        voucher: null,
        serverNow,
      };
    }

    // 3. Pending or un-upgraded OTP challenge state -> inspect exact DB challenge timestamps
    if (session.challengeId !== null) {
      const challengeRes = await payload.db.drizzle.execute(sql`
        SELECT id, expires_at, last_sent_at, attempts, verified_at, used_at
        FROM drink_otp_challenges
        WHERE id = ${Number(session.challengeId)}
          AND phone = ${session.phone}
          AND campaign_id = ${campaignIdNum}
        LIMIT 1
      `);

      if (challengeRes.rows && challengeRes.rows.length > 0) {
        const ch = challengeRes.rows[0] as unknown as ChallengeDbRow;

        // If DB shows this browser's challenge was ALREADY verified and not yet consumed,
        // keep the customer in VERIFIED stage instead of downgrading to EXPIRED_OTP!
        if (ch.verified_at !== null && ch.used_at === null) {
          const verifiedBaseMs =
            session.verifiedAt ?? new Date(ch.verified_at).getTime();
          const verifiedExpiresMs = verifiedBaseMs + VERIFIED_SESSION_TTL_MS;
          if (nowMs < verifiedExpiresMs) {
            return {
              stage: 'VERIFIED',
              campaignSlug: campaignInfo.slug,
              customerName: session.customerName,
              phone: session.phone,
              selectedBranchId: session.selectedBranchId,
              selectedDrinkId: session.selectedDrinkId,
              challengeId: ch.id,
              expiresAt: null,
              resendAvailableAt: null,
              verifiedExpiresAt: new Date(verifiedExpiresMs).toISOString(),
              attemptsRemaining: null,
              voucher: null,
              serverNow,
            };
          }
        }

        const expiresAtMs = new Date(ch.expires_at).getTime();
        const resendAtMs = new Date(ch.last_sent_at).getTime() + OTP_RESEND_COOLDOWN_MS;
        const resendAvailableAt =
          resendAtMs > nowMs ? new Date(resendAtMs).toISOString() : null;
        const attemptsRemaining = Math.max(0, OTP_MAX_ATTEMPTS - (ch.attempts || 0));

        const isChallengeActive =
          ch.used_at === null &&
          ch.verified_at === null &&
          (ch.attempts || 0) < OTP_MAX_ATTEMPTS &&
          expiresAtMs > nowMs;

        if (isChallengeActive) {
          return {
            stage: 'PENDING_OTP',
            campaignSlug: campaignInfo.slug,
            customerName: session.customerName,
            phone: session.phone,
            selectedBranchId: session.selectedBranchId,
            selectedDrinkId: session.selectedDrinkId,
            challengeId: ch.id,
            expiresAt: new Date(expiresAtMs).toISOString(),
            resendAvailableAt: new Date(resendAtMs).toISOString(),
            verifiedExpiresAt: null,
            attemptsRemaining,
            voucher: null,
            serverNow,
          };
        }

        return {
          stage: 'EXPIRED_OTP',
          campaignSlug: campaignInfo.slug,
          customerName: session.customerName,
          phone: session.phone,
          selectedBranchId: session.selectedBranchId,
          selectedDrinkId: session.selectedDrinkId,
          challengeId: ch.id,
          expiresAt: null,
          resendAvailableAt,
          verifiedExpiresAt: null,
          attemptsRemaining,
          voucher: null,
          serverNow,
        };
      }
    }

    return emptyState;
  }

  /**
   * Authoritative server-side route guard for the 4-stage Drink Rewards journey.
   * Ensures no customer can skip OTP verification or open `/success` without a
   * real server-issued entitlement bound to their browser session.
   */
  evaluateRouteAccess(
    campaignSlug: string,
    requestedStage: RewardRouteStage,
    journey: ResolvedRewardJourneyState,
    options?: { allowWelcomeWhenClaimed?: boolean },
  ): RouteAccessDecision {
    const basePath = `/drink-rewards/${encodeURIComponent(campaignSlug.trim())}`;

    if (requestedStage === 'DETAILS') {
      if (journey.stage === 'CLAIMED' && journey.voucher && !options?.allowWelcomeWhenClaimed) {
        return { allowed: false, redirectTo: `${basePath}/success` };
      }
      return { allowed: true };
    }

    if (requestedStage === 'VERIFY') {
      if (journey.stage === 'PENDING_OTP' || journey.stage === 'EXPIRED_OTP') {
        return { allowed: true };
      }
      if (journey.stage === 'VERIFIED') {
        return { allowed: false, redirectTo: `${basePath}/choose-drink` };
      }
      if (journey.stage === 'CLAIMED' && journey.voucher) {
        return { allowed: false, redirectTo: `${basePath}/success` };
      }
      return { allowed: false, redirectTo: `${basePath}?step=details` };
    }

    if (requestedStage === 'CHOOSE_DRINK') {
      if (journey.stage === 'VERIFIED') {
        return { allowed: true };
      }
      if (journey.stage === 'CLAIMED' && journey.voucher) {
        return { allowed: false, redirectTo: `${basePath}/success` };
      }
      if (journey.stage === 'PENDING_OTP' || journey.stage === 'EXPIRED_OTP') {
        return { allowed: false, redirectTo: `${basePath}/verify` };
      }
      return { allowed: false, redirectTo: basePath };
    }

    // requestedStage === 'SUCCESS'
    if (journey.stage === 'CLAIMED' && journey.voucher) {
      return { allowed: true };
    }
    if (journey.stage === 'VERIFIED') {
      return { allowed: false, redirectTo: `${basePath}/choose-drink` };
    }
    if (journey.stage === 'PENDING_OTP' || journey.stage === 'EXPIRED_OTP') {
      return { allowed: false, redirectTo: `${basePath}/verify` };
    }
    return { allowed: false, redirectTo: basePath };
  }

  /**
   * Request or resume a 6-digit OTP challenge.
   * Enforces:
   * 1. E.164 phone normalization
   * 2. Active campaign check, date window & max_claims ceiling
   * 3. PostgreSQL transaction-scoped advisory lock (`pg_advisory_xact_lock`) preventing concurrent duplicate SMS races
   * 4. Session-bound challenge resumption when returning from Step 1 (`intent === 'start'`) with an active challenge
   * 5. Once-Per-Campaign check
   * 6. Authoritative 60-second server cooldown on new/resent codes
   * 7. Atomic invalidation of previous unconsumed challenges when issuing a new code
   */
  async requestOtp(params: RequestOtpParams): Promise<RequestOtpResult> {
    const {
      phone: rawPhone,
      campaignSlug,
      intent = 'start',
      existingSession = null,
    } = params;

    // 1. Validate & normalize phone
    const phoneResult = validateAndNormalizePhone(rawPhone);
    if (!phoneResult.valid) {
      return {
        success: false,
        reason: 'INVALID_PHONE',
        message: 'رقم الهاتف المدخل غير صحيح. يرجى إدخال رقم هاتف صالح.',
      };
    }
    const normalizedPhone = phoneResult.normalized;

    const payload = await getPayloadClient();

    // 2. Lookup campaign
    const campaignDocs = await payload.find({
      collection: 'drink-campaigns',
      where: {
        slug: { equals: campaignSlug.trim() },
      },
      limit: 1,
    });

    if (campaignDocs.totalDocs === 0) {
      return {
        success: false,
        reason: 'CAMPAIGN_NOT_FOUND',
        message: 'الحملة المطلوبة غير موجودة.',
      };
    }

    const campaign = campaignDocs.docs[0];
    const campaignIdNum = Number(campaign.id);
    const now = new Date();

    if (!campaign.active) {
      return {
        success: false,
        reason: 'CAMPAIGN_INACTIVE',
        message: 'هذا العرض غير متاح حالياً.',
      };
    }

    if (campaign.start_date && new Date(campaign.start_date) > now) {
      return {
        success: false,
        reason: 'CAMPAIGN_INACTIVE',
        message: 'هذا العرض لم يبدأ بعد.',
      };
    }

    if (campaign.end_date && new Date(campaign.end_date) <= now) {
      return {
        success: false,
        reason: 'CAMPAIGN_EXPIRED',
        message: 'عذراً، لقد انتهت فترة هذا العرض.',
      };
    }

    const ownsPhoneInCampaign = Boolean(
      existingSession &&
        existingSession.campaignSlug.trim().toLowerCase() ===
          campaign.slug.trim().toLowerCase() &&
        String(existingSession.campaignId) === String(campaign.id) &&
        existingSession.phone === normalizedPhone,
    );

    try {
      type TxOutcome =
        | { kind: 'RESUMED_CLAIMED'; voucher: IssuedVoucherSnapshot; nowMs: number }
        | {
            kind: 'RESUMED_VERIFIED';
            challengeId: number;
            verifiedAt: number;
            nowMs: number;
          }
        | {
            kind: 'RESUMED_PENDING';
            challengeId: number;
            expiresAtIso: string;
            resendAtIso: string;
            nowMs: number;
          }
        | { kind: 'ALREADY_CLAIMED' }
        | { kind: 'CAMPAIGN_EXHAUSTED' }
        | {
            kind: 'COOLDOWN_ACTIVE';
            waitSec: number;
            resendAtIso: string;
            expiresAtIso?: string;
            challengeId?: number;
            nowMs: number;
          }
        | {
            kind: 'ISSUED_NEW';
            challengeId: number;
            rawOtp: string;
            expiresAtIso: string;
            resendAtIso: string;
            nowMs: number;
          };

      const txOutcome = await payload.db.drizzle.transaction(
        async (tx): Promise<TxOutcome> => {
          // Serialize all OTP operations for (campaignId, normalizedPhone) across tabs/processes
          await tx.execute(sql`
            SELECT pg_advisory_xact_lock(${campaignIdNum}, hashtext(${normalizedPhone}))
          `);

          const txNowMs = Date.now();

          // A. Check existing entitlement for (campaign, phone)
          const entitlementRes = await tx.execute(sql`
            SELECT e.id, e.voucher_code, e.customer_name, e.phone, e.selected_drink_id,
                   e.branch_id, b.name AS branch_name,
                   e.status, e.redeemed_at,
                   e.issued_at, e.expires_at,
                   COALESCE(d.name, 'Coffee Bay Beverage') AS drink_name,
                   m.url AS drink_image_url
            FROM drink_entitlements e
            LEFT JOIN drinks d ON d.id = COALESCE(e.redeemed_drink_id, e.selected_drink_id)
            LEFT JOIN media m ON m.id = d.image_id
            LEFT JOIN branches b ON b.id = e.branch_id
            WHERE e.campaign_id = ${campaignIdNum}
              AND e.phone = ${normalizedPhone}
            LIMIT 1
          `);

          if (entitlementRes.rows && entitlementRes.rows.length > 0) {
            if (
              intent === 'start' &&
              ownsPhoneInCampaign &&
              existingSession?.verifiedAt !== null &&
              existingSession?.verifiedAt !== undefined
            ) {
              const ent = entitlementRes.rows[0] as unknown as EntitlementDbRow;
              const issuedMs = new Date(ent.issued_at).getTime();
              if (
                existingSession.status === 'CLAIMED' ||
                issuedMs >= existingSession.verifiedAt - 15_000
              ) {
                const rawStatus: VoucherLifecycleStatus = ent.status || 'ISSUED';
                const effectiveStatus: VoucherLifecycleStatus =
                  rawStatus === 'ISSUED' && new Date(ent.expires_at).getTime() <= txNowMs
                    ? 'EXPIRED'
                    : rawStatus;

                return {
                  kind: 'RESUMED_CLAIMED',
                  nowMs: txNowMs,
                  voucher: {
                    entitlementId: ent.id,
                    voucherCode: ent.voucher_code,
                    customerName: ent.customer_name,
                    phone: ent.phone,
                    drinkName: ent.drink_name,
                    drinkImageUrl: ent.drink_image_url ?? null,
                    branchId: ent.branch_id ?? existingSession.selectedBranchId ?? null,
                    branchName: ent.branch_name ?? null,
                    campaignTitle: campaign.title,
                    status: effectiveStatus,
                    redeemedAt: ent.redeemed_at ? new Date(ent.redeemed_at).toISOString() : null,
                    expiresAt: new Date(ent.expires_at).toISOString(),
                    issuedAt: new Date(ent.issued_at).toISOString(),
                  },
                };
              }
            }

            return { kind: 'ALREADY_CLAIMED' };
          }

          // B. Check campaign ceiling (for non-claimed customers)
          const campQuotaRes = await tx.execute(sql`
            SELECT max_claims, total_claimed
            FROM drink_campaigns
            WHERE id = ${campaignIdNum}
            LIMIT 1
          `);
          if (campQuotaRes.rows && campQuotaRes.rows.length > 0) {
            const quota = campQuotaRes.rows[0] as {
              max_claims: number | null;
              total_claimed: number;
            };
            if (
              typeof quota.max_claims === 'number' &&
              quota.max_claims > 0 &&
              (quota.total_claimed || 0) >= quota.max_claims
            ) {
              return { kind: 'CAMPAIGN_EXHAUSTED' };
            }
          }

          // C1. If this browser session ALREADY has a verified, unconsumed challenge for this phone & campaign,
          //     resume VERIFIED stage immediately (even on accidental resend click) to prevent wasting OTP codes!
          if (ownsPhoneInCampaign && existingSession && existingSession.challengeId !== null) {
            const verRes = await tx.execute(sql`
              SELECT id, verified_at, used_at
              FROM drink_otp_challenges
              WHERE id = ${Number(existingSession.challengeId)}
                AND phone = ${normalizedPhone}
                AND campaign_id = ${campaignIdNum}
              LIMIT 1
            `);
            if (verRes.rows && verRes.rows.length > 0) {
              const verRow = verRes.rows[0] as {
                id: number;
                verified_at: string | null;
                used_at: string | null;
              };
              if (verRow.verified_at !== null && verRow.used_at === null) {
                const resolvedVerifiedAt =
                  existingSession.verifiedAt ?? new Date(verRow.verified_at).getTime();
                if (txNowMs < resolvedVerifiedAt + VERIFIED_SESSION_TTL_MS) {
                  return {
                    kind: 'RESUMED_VERIFIED',
                    challengeId: verRow.id,
                    verifiedAt: resolvedVerifiedAt,
                    nowMs: txNowMs,
                  };
                }
              }
            }
          }

          // C2. If starting/continuing from Step 1 with a valid pending challenge for the SAME phone,
          //     resume the existing active challenge instead of sending a new SMS!
          if (intent === 'start' && ownsPhoneInCampaign && existingSession) {
            if (existingSession.challengeId !== null) {
              const activeRes = await tx.execute(sql`
                SELECT id, expires_at, last_sent_at, attempts, verified_at, used_at
                FROM drink_otp_challenges
                WHERE id = ${Number(existingSession.challengeId)}
                  AND phone = ${normalizedPhone}
                  AND campaign_id = ${campaignIdNum}
                LIMIT 1
                FOR UPDATE
              `);

              if (activeRes.rows && activeRes.rows.length > 0) {
                const activeRow = activeRes.rows[0] as unknown as ChallengeDbRow;
                const expMs = new Date(activeRow.expires_at).getTime();
                const resendMs =
                  new Date(activeRow.last_sent_at).getTime() + OTP_RESEND_COOLDOWN_MS;

                if (
                  activeRow.used_at === null &&
                  activeRow.verified_at === null &&
                  (activeRow.attempts || 0) < OTP_MAX_ATTEMPTS &&
                  expMs > txNowMs
                ) {
                  return {
                    kind: 'RESUMED_PENDING',
                    challengeId: activeRow.id,
                    expiresAtIso: new Date(expMs).toISOString(),
                    resendAtIso: new Date(resendMs).toISOString(),
                    nowMs: txNowMs,
                  };
                }
              }
            }
          }

          // D. Authoritative 60-second cooldown check across all challenges for (phone, campaign)
          const recentRes = await tx.execute(sql`
            SELECT id, last_sent_at, expires_at, used_at, verified_at, attempts
            FROM drink_otp_challenges
            WHERE phone = ${normalizedPhone}
              AND campaign_id = ${campaignIdNum}
            ORDER BY last_sent_at DESC
            LIMIT 1
            FOR UPDATE
          `);

          if (recentRes.rows && recentRes.rows.length > 0) {
            const recentRow = recentRes.rows[0] as unknown as ChallengeDbRow;
            const lastSentMs = new Date(recentRow.last_sent_at).getTime();
            const resendAtMs = lastSentMs + OTP_RESEND_COOLDOWN_MS;

            if (txNowMs < resendAtMs) {
              const waitSec = Math.max(1, Math.ceil((resendAtMs - txNowMs) / 1000));
              const expMs = new Date(recentRow.expires_at).getTime();
              const isStillUsableByOwner =
                ownsPhoneInCampaign &&
                recentRow.used_at === null &&
                recentRow.verified_at === null &&
                (recentRow.attempts || 0) < OTP_MAX_ATTEMPTS &&
                expMs > txNowMs;

              return {
                kind: 'COOLDOWN_ACTIVE',
                waitSec,
                resendAtIso: new Date(resendAtMs).toISOString(),
                expiresAtIso: isStillUsableByOwner
                  ? new Date(expMs).toISOString()
                  : undefined,
                challengeId: isStillUsableByOwner ? recentRow.id : undefined,
                nowMs: txNowMs,
              };
            }
          }

          // E. Issue fresh 6-digit CSPRNG OTP & atomically invalidate prior unconsumed challenges
          const rawOtp = crypto.randomInt(100000, 1000000).toString();
          const expiresAtIso = new Date(txNowMs + OTP_VALIDITY_MS).toISOString();
          const resendAtIso = new Date(txNowMs + OTP_RESEND_COOLDOWN_MS).toISOString();
          const sentAtIso = new Date(txNowMs).toISOString();

          await tx.execute(sql`
            UPDATE drink_otp_challenges
            SET used_at = NOW(), updated_at = NOW()
            WHERE phone = ${normalizedPhone}
              AND campaign_id = ${campaignIdNum}
              AND used_at IS NULL
          `);

          const insertRes = await tx.execute(sql`
            INSERT INTO drink_otp_challenges (
              phone,
              campaign_id,
              code,
              expires_at,
              last_sent_at,
              attempts,
              created_at,
              updated_at
            ) VALUES (
              ${normalizedPhone},
              ${campaignIdNum},
              ${rawOtp},
              ${expiresAtIso},
              ${sentAtIso},
              0,
              NOW(),
              NOW()
            )
            RETURNING id
          `);

          const insertedRow = insertRes.rows?.[0] as { id: number } | undefined;
          if (!insertedRow) {
            throw new Error('FAILED_TO_INSERT_OTP_CHALLENGE');
          }

          return {
            kind: 'ISSUED_NEW',
            challengeId: insertedRow.id,
            rawOtp,
            expiresAtIso,
            resendAtIso,
            nowMs: txNowMs,
          };
        },
      );

      if (txOutcome.kind === 'ALREADY_CLAIMED') {
        return {
          success: false,
          reason: 'ALREADY_CLAIMED',
          message:
            'هذا الرقم غير مؤهل للاستفادة من هذا العرض أو تم استخدام القسيمة مسبقاً.',
        };
      }

      if (txOutcome.kind === 'CAMPAIGN_EXHAUSTED') {
        return {
          success: false,
          reason: 'CAMPAIGN_EXHAUSTED',
          message: 'عذراً، نفدت جميع المشروبات المتاحة لهذا العرض.',
        };
      }

      if (txOutcome.kind === 'RESUMED_CLAIMED') {
        return {
          success: true,
          resumed: true,
          nextStep: 'SUCCESS',
          message: 'تم استعادة قسيمة مشروبك الصادرة مسبقاً.',
          normalizedPhone,
          campaignId: campaign.id,
          voucher: txOutcome.voucher,
          serverNow: new Date(txOutcome.nowMs).toISOString(),
        };
      }

      if (txOutcome.kind === 'RESUMED_VERIFIED') {
        return {
          success: true,
          resumed: true,
          nextStep: 'CHOOSE_DRINK',
          message: 'تم استعادة جلسة التحقق النشطة.',
          normalizedPhone,
          campaignId: campaign.id,
          challengeId: txOutcome.challengeId,
          verifiedAt: txOutcome.verifiedAt,
          serverNow: new Date(txOutcome.nowMs).toISOString(),
        };
      }

      if (txOutcome.kind === 'RESUMED_PENDING') {
        return {
          success: true,
          resumed: true,
          nextStep: 'VERIFY',
          message: 'تم استعادة طلب التحقق الحالي.',
          normalizedPhone,
          campaignId: campaign.id,
          challengeId: txOutcome.challengeId,
          expiresAt: txOutcome.expiresAtIso,
          resendAvailableAt: txOutcome.resendAtIso,
          serverNow: new Date(txOutcome.nowMs).toISOString(),
        };
      }

      if (txOutcome.kind === 'COOLDOWN_ACTIVE') {
        return {
          success: false,
          reason: 'COOLDOWN_ACTIVE',
          message: `يرجى الانتظار ${txOutcome.waitSec} ثانية قبل طلب رمز تحقق جديد.`,
          resendAvailableAt: txOutcome.resendAtIso,
          ...(txOutcome.expiresAtIso ? { expiresAt: txOutcome.expiresAtIso } : {}),
          ...(txOutcome.challengeId !== undefined
            ? { challengeId: txOutcome.challengeId }
            : {}),
          serverNow: new Date(txOutcome.nowMs).toISOString(),
        };
      }

      // Queue OTP SMS via notificationService outside advisory lock (without opening a redundant nested transaction)
      try {
        await notificationService.queueDrinkOtp(
          normalizedPhone,
          txOutcome.rawOtp,
          '',
          campaign.slug,
        );
      } catch (queueErr) {
        console.error('[DrinkOtpService] Failed to queue OTP message:', queueErr);
      }

      return {
        success: true,
        resumed: false,
        nextStep: 'VERIFY',
        message: 'تم إرسال رمز التحقق إلى هاتفك عبر رسالة نصية قصيرة (SMS).',
        normalizedPhone,
        campaignId: campaign.id,
        challengeId: txOutcome.challengeId,
        expiresAt: txOutcome.expiresAtIso,
        resendAvailableAt: txOutcome.resendAtIso,
        serverNow: new Date(txOutcome.nowMs).toISOString(),
      };
    } catch (err) {
      console.error('[DrinkOtpService] Failed to create/resume OTP challenge:', err);
      return {
        success: false,
        reason: 'INTERNAL_ERROR',
        message: 'حدث خطأ مؤقت أثناء إرسال رمز التحقق. يرجى المحاولة مرة أخرى.',
      };
    }
  }

  /**
   * Verify customer entered OTP code inside an atomic row-locked transaction.
   * Enforces:
   * 1. 5-minute validity window
   * 2. Max 3 failed attempts
   * 3. Cryptographic timing-safe comparison (`crypto.timingSafeEqual`)
   * 4. Issues signed 15-minute verification session token on success
   */
  async verifyOtp(params: VerifyOtpParams): Promise<VerifyOtpResult> {
    const {
      phone: rawPhone,
      campaignSlug,
      otpCode,
      expectedChallengeId = null,
    } = params;

    const phoneResult = validateAndNormalizePhone(rawPhone);
    if (!phoneResult.valid) {
      return {
        success: false,
        reason: 'INVALID_PHONE',
        message: 'رقم الهاتف غير صالح.',
      };
    }
    const normalizedPhone = phoneResult.normalized;

    const payload = await getPayloadClient();

    const campaignDocs = await payload.find({
      collection: 'drink-campaigns',
      where: { slug: { equals: campaignSlug.trim() } },
      limit: 1,
    });
    if (campaignDocs.totalDocs === 0) {
      return {
        success: false,
        reason: 'CAMPAIGN_NOT_FOUND',
        message: 'الحملة المطلوبة غير موجودة.',
      };
    }
    const campaign = campaignDocs.docs[0];
    const campaignIdNum = Number(campaign.id);

    try {
      const outcome = await payload.db.drizzle.transaction(
        async (tx): Promise<VerifyOtpResult> => {
          const challengeQuery =
            expectedChallengeId !== null && expectedChallengeId !== undefined
              ? sql`
                  SELECT id, code, expires_at, last_sent_at, attempts, verified_at, used_at
                  FROM drink_otp_challenges
                  WHERE id = ${Number(expectedChallengeId)}
                    AND phone = ${normalizedPhone}
                    AND campaign_id = ${campaignIdNum}
                    AND used_at IS NULL
                  LIMIT 1
                  FOR UPDATE
                `
              : sql`
                  SELECT id, code, expires_at, last_sent_at, attempts, verified_at, used_at
                  FROM drink_otp_challenges
                  WHERE phone = ${normalizedPhone}
                    AND campaign_id = ${campaignIdNum}
                    AND used_at IS NULL
                  ORDER BY created_at DESC
                  LIMIT 1
                  FOR UPDATE
                `;

          const challengeRes = await tx.execute(challengeQuery);

          if (!challengeRes.rows || challengeRes.rows.length === 0) {
            return {
              success: false,
              reason: 'EXPIRED_OR_NOT_FOUND',
              message:
                'رمز التحقق غير صحيح أو انتهت صلاحيته. يرجى طلب رمز جديد.',
            };
          }

          const challenge = challengeRes.rows[0] as unknown as ChallengeDbRow;
          const nowMs = Date.now();
          const nowIso = new Date(nowMs).toISOString();

          // Idempotent success if this exact unconsumed challenge was just verified
          if (
            challenge.verified_at !== null &&
            timingSafeCompareStrings(challenge.code.trim(), otpCode.trim())
          ) {
            const verifiedAtMs = new Date(challenge.verified_at).getTime();
            if (nowMs < verifiedAtMs + VERIFIED_SESSION_TTL_MS) {
              const sessionToken = this.createSessionToken({
                phone: normalizedPhone,
                campaignId: campaign.id,
                challengeId: challenge.id,
                verifiedAt: verifiedAtMs,
                exp: verifiedAtMs + VERIFIED_SESSION_TTL_MS,
              });
              return {
                success: true,
                message: 'تم التحقق من رقم الهاتف بنجاح.',
                verificationToken: sessionToken,
                normalizedPhone,
                campaignId: campaign.id,
                challengeId: challenge.id,
                verifiedAt: verifiedAtMs,
              };
            }
          }

          // Check expiration
          if (new Date(challenge.expires_at).getTime() <= nowMs) {
            await tx.execute(sql`
              UPDATE drink_otp_challenges
              SET used_at = ${nowIso}, updated_at = NOW()
              WHERE id = ${challenge.id}
            `);
            return {
              success: false,
              reason: 'EXPIRED_OR_NOT_FOUND',
              message:
                'انتهت صلاحية رمز التحقق (صالح لمدة 5 دقائق). يرجى طلب رمز جديد.',
            };
          }

          // Check attempts limit
          const currentAttempts = challenge.attempts || 0;
          if (currentAttempts >= OTP_MAX_ATTEMPTS) {
            await tx.execute(sql`
              UPDATE drink_otp_challenges
              SET used_at = ${nowIso}, updated_at = NOW()
              WHERE id = ${challenge.id}
            `);
            return {
              success: false,
              reason: 'MAX_ATTEMPTS_EXCEEDED',
              message:
                'تم تجاوز الحد الأقصى للمحاولات (3 محاولات). يرجى طلب رمز جديد.',
            };
          }

          // Timing-safe OTP comparison
          const isMatch = timingSafeCompareStrings(
            String(challenge.code || '').trim(),
            otpCode.trim(),
          );

          if (!isMatch) {
            const nextAttempts = currentAttempts + 1;
            const attemptsRemaining = Math.max(0, OTP_MAX_ATTEMPTS - nextAttempts);

            if (attemptsRemaining === 0) {
              await tx.execute(sql`
                UPDATE drink_otp_challenges
                SET attempts = ${nextAttempts}, used_at = ${nowIso}, updated_at = NOW()
                WHERE id = ${challenge.id}
              `);
            } else {
              await tx.execute(sql`
                UPDATE drink_otp_challenges
                SET attempts = ${nextAttempts}, updated_at = NOW()
                WHERE id = ${challenge.id}
              `);
            }

            return {
              success: false,
              reason: 'INVALID_CODE',
              message:
                attemptsRemaining > 0
                  ? `رمز التحقق غير صحيح. متبقي لديك ${attemptsRemaining} محاولة.`
                  : 'رمز التحقق غير صحيح. تم تجاوز الحد الأقصى للمحاولات.',
              attemptsRemaining,
            };
          }

          // Successful verification
          await tx.execute(sql`
            UPDATE drink_otp_challenges
            SET verified_at = ${nowIso}, updated_at = NOW()
            WHERE id = ${challenge.id}
          `);

          const sessionToken = this.createSessionToken({
            phone: normalizedPhone,
            campaignId: campaign.id,
            challengeId: challenge.id,
            verifiedAt: nowMs,
            exp: nowMs + VERIFIED_SESSION_TTL_MS,
          });

          return {
            success: true,
            message: 'تم التحقق من رقم الهاتف بنجاح.',
            verificationToken: sessionToken,
            normalizedPhone,
            campaignId: campaign.id,
            challengeId: challenge.id,
            verifiedAt: nowMs,
          };
        },
      );

      return outcome;
    } catch (err) {
      console.error('[DrinkOtpService] Error verifying OTP:', err);
      return {
        success: false,
        reason: 'INTERNAL_ERROR',
        message: 'حدث خطأ في الخادم أثناء التحقق من الرمز.',
      };
    }
  }
}

export const drinkOtpService = new DrinkOtpService();
