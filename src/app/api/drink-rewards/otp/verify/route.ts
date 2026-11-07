import { NextRequest, NextResponse } from 'next/server';
import {
  drinkOtpService,
  VERIFIED_JOURNEY_COOKIE_TTL_SEC,
  type RewardJourneySessionPayload,
} from '../../../../../services/drink-rewards/drink-otp-service';
import { validateAndNormalizePhone } from '../../../../../lib/validators/phone-validator';
import { rateLimiter } from '../../../../../lib/security/rate-limiter';

interface VerifyOtpBody {
  phone?: unknown;
  campaignSlug?: unknown;
  otpCode?: unknown;
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip')?.trim() ||
      'unknown-ip';

    // IP Rate Limit (10 verify attempts per 60 seconds)
    const ipLimit = await rateLimiter.checkRateLimit(`drink-verify-ip-${ip}`, {
      windowSeconds: 60,
      maxRequests: 10,
    });
    if (ipLimit.limited) {
      return NextResponse.json(
        {
          success: false,
          reason: 'RATE_LIMITED',
          message: `تم تجاوز معدل المحاولات. يرجى الانتظار ${ipLimit.retryAfterSeconds} ثانية.`,
        },
        { status: 429 },
      );
    }

    let body: VerifyOtpBody;
    try {
      body = (await req.json()) as VerifyOtpBody;
    } catch {
      return NextResponse.json(
        { success: false, reason: 'INVALID_CODE', message: 'بيانات الطلب غير صالحة.' },
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

    const otpCode = typeof body.otpCode === 'string' ? body.otpCode.trim() : '';
    if (!/^\d{6}$/.test(otpCode)) {
      return NextResponse.json(
        {
          success: false,
          reason: 'INVALID_CODE',
          message: 'يرجى إدخال رمز التحقق المكون من 6 أرقام.',
        },
        { status: 400 },
      );
    }

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
        { success: false, reason: 'INVALID_PHONE', message: 'رقم الهاتف غير صالح.' },
        { status: 400 },
      );
    }

    // Prevent verifying a phone number different from the active browser journey session
    if (existingSession && existingSession.phone !== phoneValidation.normalized) {
      return NextResponse.json(
        {
          success: false,
          reason: 'INVALID_PHONE',
          message: 'رقم الهاتف لا يطابق جلسة التحقق الحالية.',
        },
        { status: 400 },
      );
    }

    const result = await drinkOtpService.verifyOtp({
      phone: phoneValidation.normalized,
      campaignSlug,
      otpCode,
      expectedChallengeId: existingSession?.challengeId ?? null,
    });

    if (!result.success) {
      const statusCode =
        result.reason === 'MAX_ATTEMPTS_EXCEEDED' ||
        result.reason === 'EXPIRED_OR_NOT_FOUND'
          ? 400
          : 401;

      return NextResponse.json(result, { status: statusCode });
    }

    const nowMs = Date.now();
    const verifiedAt = result.verifiedAt ?? nowMs;
    const updatedCookie: RewardJourneySessionPayload = {
      v: 1,
      campaignId: result.campaignId ?? existingSession?.campaignId ?? '',
      campaignSlug,
      customerName: existingSession?.customerName || '',
      phone: result.normalizedPhone ?? phoneValidation.normalized,
      selectedBranchId: existingSession?.selectedBranchId ?? null,
      selectedDrinkId: existingSession?.selectedDrinkId ?? null,
      challengeId: result.challengeId ?? existingSession?.challengeId ?? null,
      status: 'VERIFIED',
      verifiedAt,
      entitlementId: null,
      voucherCode: null,
      iat: nowMs,
      exp: nowMs + VERIFIED_JOURNEY_COOKIE_TTL_SEC * 1000,
    };

    const response = NextResponse.json(result, { status: 200 });
    response.cookies.set(
      cookieName,
      drinkOtpService.createJourneyCookieValue(updatedCookie),
      drinkOtpService.buildJourneyCookieOptions(VERIFIED_JOURNEY_COOKIE_TTL_SEC),
    );

    return response;
  } catch (error) {
    console.error('[API] Error verifying drink reward OTP:', error);
    return NextResponse.json(
      {
        success: false,
        reason: 'INTERNAL_ERROR',
        message: 'حدث خطأ في الخادم أثناء التحقق من الرمز.',
      },
      { status: 500 },
    );
  }
}
