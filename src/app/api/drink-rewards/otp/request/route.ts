import { NextRequest, NextResponse } from 'next/server';
import {
  drinkOtpService,
  PENDING_JOURNEY_COOKIE_TTL_SEC,
  VERIFIED_JOURNEY_COOKIE_TTL_SEC,
  CLAIMED_JOURNEY_COOKIE_MAX_SEC,
  type RewardJourneySessionPayload,
} from '../../../../../services/drink-rewards/drink-otp-service';
import { validateAndNormalizePhone } from '../../../../../lib/validators/phone-validator';
import { rateLimiter } from '../../../../../lib/security/rate-limiter';

interface RequestOtpBody {
  phone?: unknown;
  campaignSlug?: unknown;
  customerName?: unknown;
  selectedBranchId?: unknown;
  intent?: unknown;
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip')?.trim() ||
      'unknown-ip';

    let body: RequestOtpBody;
    try {
      body = (await req.json()) as RequestOtpBody;
    } catch {
      return NextResponse.json(
        { success: false, reason: 'INVALID_REQUEST', message: 'بيانات الطلب غير صالحة.' },
        { status: 400 },
      );
    }

    const campaignSlug =
      typeof body.campaignSlug === 'string' ? body.campaignSlug.trim() : '';
    if (!campaignSlug) {
      return NextResponse.json(
        { success: false, reason: 'CAMPAIGN_NOT_FOUND', message: 'معرف الحملة مطلوب.' },
        { status: 400 },
      );
    }

    const intent: 'start' | 'resend' =
      body.intent === 'resend' ? 'resend' : 'start';

    const cookieName = drinkOtpService.getJourneyCookieName(campaignSlug);
    const rawCookie = req.cookies.get(cookieName)?.value;
    const existingSession = drinkOtpService.verifyJourneyCookieValue(
      rawCookie,
      campaignSlug,
    );

    const rawPhone =
      typeof body.phone === 'string' && body.phone.trim().length > 0
        ? body.phone.trim()
        : existingSession?.phone || '';

    if (!rawPhone) {
      return NextResponse.json(
        { success: false, reason: 'INVALID_PHONE', message: 'رقم الهاتف مطلوب.' },
        { status: 400 },
      );
    }

    const phoneValidation = validateAndNormalizePhone(rawPhone);
    if (!phoneValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          reason: 'INVALID_PHONE',
          message: 'رقم الهاتف المدخل غير صحيح. يرجى إدخال رقم هاتف صالح.',
        },
        { status: 400 },
      );
    }
    const normalizedPhone = phoneValidation.normalized;

    const resolvedCustomerName =
      typeof body.customerName === 'string' && body.customerName.trim().length > 0
        ? body.customerName.trim().slice(0, 120)
        : existingSession?.customerName || '';

    const resolvedBranchId: number | string | null =
      typeof body.selectedBranchId === 'string' ||
      typeof body.selectedBranchId === 'number'
        ? body.selectedBranchId
        : existingSession?.selectedBranchId ?? null;

    // ── Silent Resume Check (only when continuing from Step 1 with the SAME verified/pending session)
    if (
      drinkOtpService.canAttemptSilentResume(
        intent,
        normalizedPhone,
        campaignSlug,
        existingSession,
      ) &&
      existingSession
    ) {
      const campaignHeader = await drinkOtpService.getCampaignHeaderBySlug(campaignSlug);
      if (campaignHeader) {
        const resolved = await drinkOtpService.resolveJourneyState(
          campaignHeader,
          rawCookie,
        );

        if (
          resolved.stage === 'PENDING_OTP' ||
          resolved.stage === 'VERIFIED' ||
          resolved.stage === 'CLAIMED'
        ) {
          const nowMs = Date.now();
          const nextStep =
            resolved.stage === 'CLAIMED'
              ? 'SUCCESS'
              : resolved.stage === 'VERIFIED'
                ? 'CHOOSE_DRINK'
                : 'VERIFY';

          const maxAgeSec =
            resolved.stage === 'CLAIMED'
              ? CLAIMED_JOURNEY_COOKIE_MAX_SEC
              : resolved.stage === 'VERIFIED'
                ? VERIFIED_JOURNEY_COOKIE_TTL_SEC
                : Math.max(
                    60,
                    Math.floor((existingSession.exp - nowMs) / 1000),
                  );

          const updatedCookiePayload: RewardJourneySessionPayload = {
            ...existingSession,
            customerName: resolvedCustomerName || existingSession.customerName,
            selectedBranchId: resolvedBranchId,
            status:
              resolved.stage === 'CLAIMED'
                ? 'CLAIMED'
                : resolved.stage === 'VERIFIED'
                  ? 'VERIFIED'
                  : 'PENDING_OTP',
            exp: nowMs + maxAgeSec * 1000,
          };

          const response = NextResponse.json(
            {
              success: true,
              resumed: true,
              nextStep,
              message:
                resolved.stage === 'PENDING_OTP'
                  ? 'تم استعادة طلب التحقق الحالي.'
                  : 'تم استعادة جلستك النشطة.',
              expiresAt: resolved.expiresAt,
              resendAvailableAt: resolved.resendAvailableAt,
              serverNow: resolved.serverNow,
              voucher: resolved.voucher,
            },
            { status: 200 },
          );

          response.cookies.set(
            cookieName,
            drinkOtpService.createJourneyCookieValue(updatedCookiePayload),
            drinkOtpService.buildJourneyCookieOptions(maxAgeSec),
          );

          return response;
        }
      }
    }

    // ── Rate Limits for New / Resent OTP SMS Generation ──────────────────────
    const ipLimitWindow = Number(process.env.DRINK_OTP_IP_LIMIT_WINDOW_SECONDS) || 60;
    const ipLimitMax = Number(process.env.DRINK_OTP_IP_LIMIT_MAX_REQUESTS) || 5;
    const ipLimit = await rateLimiter.checkRateLimit(`drink-otp-ip-${ip}`, {
      windowSeconds: ipLimitWindow,
      maxRequests: ipLimitMax,
    });
    if (ipLimit.limited) {
      return NextResponse.json(
        {
          success: false,
          reason: 'RATE_LIMITED',
          message: `تم تجاوز معدل الطلبات المسموح. يرجى الانتظار ${ipLimit.retryAfterSeconds} ثانية.`,
        },
        { status: 429 },
      );
    }

    const phoneLimitWindow = Number(process.env.DRINK_OTP_PHONE_LIMIT_WINDOW_SECONDS) || 60;
    const phoneLimitMax = Number(process.env.DRINK_OTP_PHONE_LIMIT_MAX_REQUESTS) || 3;
    const phoneLimit = await rateLimiter.checkRateLimit(
      `drink-otp-phone-${normalizedPhone}`,
      {
        windowSeconds: phoneLimitWindow,
        maxRequests: phoneLimitMax,
      },
    );
    if (phoneLimit.limited) {
      return NextResponse.json(
        {
          success: false,
          reason: 'RATE_LIMITED',
          message: `يرجى الانتظار ${phoneLimit.retryAfterSeconds} ثانية قبل طلب رمز جديد لهذا الرقم.`,
        },
        { status: 429 },
      );
    }

    const result = await drinkOtpService.requestOtp({
      phone: normalizedPhone,
      campaignSlug,
      intent,
      existingSession,
    });

    if (!result.success) {
      const statusCode =
        result.reason === 'COOLDOWN_ACTIVE'
          ? 429
          : result.reason === 'CAMPAIGN_NOT_FOUND'
            ? 404
            : result.reason === 'ALREADY_CLAIMED' ||
                result.reason === 'ACTIVE_VOUCHER_EXISTS' ||
                result.reason === 'CAMPAIGN_EXHAUSTED' ||
                result.reason === 'CAMPAIGN_EXPIRED'
              ? 403
              : 400;

      return NextResponse.json(result, { status: statusCode });
    }

    const nowMs = Date.now();
    const isSamePhoneAsExisting = existingSession?.phone === normalizedPhone;

    const cookieTtlSec =
      result.nextStep === 'SUCCESS'
        ? CLAIMED_JOURNEY_COOKIE_MAX_SEC
        : result.nextStep === 'CHOOSE_DRINK'
          ? VERIFIED_JOURNEY_COOKIE_TTL_SEC
          : PENDING_JOURNEY_COOKIE_TTL_SEC;

    const newCookiePayload: RewardJourneySessionPayload = {
      v: 1,
      campaignId: result.campaignId ?? existingSession?.campaignId ?? '',
      campaignSlug,
      customerName: resolvedCustomerName,
      phone: result.normalizedPhone ?? normalizedPhone,
      selectedBranchId: resolvedBranchId,
      selectedDrinkId: isSamePhoneAsExisting
        ? (existingSession?.selectedDrinkId ?? null)
        : null,
      challengeId: result.challengeId ?? null,
      status:
        result.nextStep === 'SUCCESS'
          ? 'CLAIMED'
          : result.nextStep === 'CHOOSE_DRINK'
            ? 'VERIFIED'
            : 'PENDING_OTP',
      verifiedAt: result.verifiedAt ?? null,
      entitlementId: result.voucher?.entitlementId ?? null,
      voucherCode: result.voucher?.voucherCode ?? null,
      iat: nowMs,
      exp: nowMs + cookieTtlSec * 1000,
    };

    const response = NextResponse.json(result, { status: 200 });
    response.cookies.set(
      cookieName,
      drinkOtpService.createJourneyCookieValue(newCookiePayload),
      drinkOtpService.buildJourneyCookieOptions(cookieTtlSec),
    );

    return response;
  } catch (error) {
    console.error('[API] Error requesting drink reward OTP:', error);
    return NextResponse.json(
      {
        success: false,
        reason: 'INTERNAL_ERROR',
        message: 'حدث خطأ في الخادم أثناء معالجة الطلب.',
      },
      { status: 500 },
    );
  }
}
