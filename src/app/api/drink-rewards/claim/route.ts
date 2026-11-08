import { NextRequest, NextResponse } from 'next/server';
import { drinkCampaignService } from '../../../../services/drink-rewards/drink-campaign-service';
import {
  CLAIMED_JOURNEY_COOKIE_MAX_SEC,
  drinkOtpService,
  VERIFIED_SESSION_TTL_MS,
  type RewardJourneySessionPayload,
} from '../../../../services/drink-rewards/drink-otp-service';
import { rateLimiter } from '../../../../lib/security/rate-limiter';

interface ClaimEntitlementBody {
  sessionToken?: unknown;
  customerName?: unknown;
  selectedDrinkId?: unknown;
  selectedBranchId?: unknown;
  campaignSlug?: unknown;
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip')?.trim() ||
      'unknown-ip';

    // Rate Limit (5 claims per minute per IP)
    const ipLimit = await rateLimiter.checkRateLimit(`drink-claim-ip-${ip}`, {
      windowSeconds: 60,
      maxRequests: 5,
    });
    if (ipLimit.limited) {
      return NextResponse.json(
        {
          success: false,
          reason: 'RATE_LIMITED',
          message: `يرجى الانتظار ${ipLimit.retryAfterSeconds} ثانية.`,
        },
        { status: 429 },
      );
    }

    let body: ClaimEntitlementBody;
    try {
      body = (await req.json()) as ClaimEntitlementBody;
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

    const selectedDrinkId =
      typeof body.selectedDrinkId === 'number' ||
      (typeof body.selectedDrinkId === 'string' && body.selectedDrinkId.trim().length > 0)
        ? body.selectedDrinkId
        : null;

    if (selectedDrinkId === null) {
      return NextResponse.json(
        { success: false, reason: 'INVALID_DRINK', message: 'يجب اختيار مشروب من القائمة.' },
        { status: 400 },
      );
    }

    const cookieName = drinkOtpService.getJourneyCookieName(campaignSlug);
    const rawCookie = req.cookies.get(cookieName)?.value;
    const existingSession = drinkOtpService.verifyJourneyCookieValue(
      rawCookie,
      campaignSlug,
    );

    // Derive signed verification token primarily from the HttpOnly journey cookie,
    // falling back to explicit sessionToken only if no verified cookie is present.
    let resolvedSessionToken = '';
    if (
      existingSession &&
      (existingSession.status === 'VERIFIED' || existingSession.status === 'CLAIMED') &&
      existingSession.verifiedAt !== null &&
      existingSession.challengeId !== null
    ) {
      resolvedSessionToken = drinkOtpService.createSessionToken({
        phone: existingSession.phone,
        campaignId: existingSession.campaignId,
        challengeId: existingSession.challengeId,
        verifiedAt: existingSession.verifiedAt,
        exp: existingSession.verifiedAt + VERIFIED_SESSION_TTL_MS,
      });
    } else if (typeof body.sessionToken === 'string' && body.sessionToken.trim().length > 0) {
      resolvedSessionToken = body.sessionToken.trim();
    }

    if (!resolvedSessionToken) {
      return NextResponse.json(
        { success: false, reason: 'INVALID_SESSION', message: 'رمز الجلسة مفقود أو غير صالح.' },
        { status: 401 },
      );
    }

    // Resolve customer name (optional: defaults to 'Guest' if omitted)
    const customerName =
      typeof body.customerName === 'string' && body.customerName.trim().length > 0
        ? body.customerName.trim()
        : existingSession?.customerName?.trim() || 'Guest';

    const selectedBranchId =
      typeof body.selectedBranchId === 'number' ||
      (typeof body.selectedBranchId === 'string' && body.selectedBranchId.trim().length > 0)
        ? body.selectedBranchId
        : existingSession?.selectedBranchId ?? null;

    const result = await drinkCampaignService.claimEntitlement({
      sessionToken: resolvedSessionToken,
      customerName,
      selectedDrinkId,
      selectedBranchId,
      campaignSlug,
    });

    if (!result.success || !result.voucher) {
      const statusCode =
        result.reason === 'INVALID_SESSION'
          ? 401
          : result.reason === 'CAMPAIGN_NOT_FOUND'
            ? 404
            : result.reason === 'ALREADY_CLAIMED' ||
                result.reason === 'CAMPAIGN_EXHAUSTED' ||
                result.reason === 'CAMPAIGN_EXPIRED'
              ? 403
              : 400;

      return NextResponse.json(result, { status: statusCode });
    }

    const response = NextResponse.json(result, { status: 200 });

    // Upgrade the browser's HttpOnly journey cookie to CLAIMED so `/success` restores cleanly on F5 / Direct Visit
    const decodedToken = drinkOtpService.verifySessionToken(resolvedSessionToken);
    const nowMs = Date.now();
    const voucherExpiresMs = new Date(result.voucher.expiresAt).getTime();
    const remainingVoucherSec = Number.isFinite(voucherExpiresMs)
      ? Math.floor((voucherExpiresMs - nowMs) / 1000)
      : CLAIMED_JOURNEY_COOKIE_MAX_SEC;
    const cookieMaxAgeSec = Math.min(
      CLAIMED_JOURNEY_COOKIE_MAX_SEC,
      Math.max(3600, remainingVoucherSec),
    );

    const claimedCookiePayload: RewardJourneySessionPayload = {
      v: 1,
      campaignId: existingSession?.campaignId ?? decodedToken?.campaignId ?? '',
      campaignSlug,
      customerName: result.voucher.customerName,
      phone: result.voucher.phone,
      selectedBranchId: result.voucher.branchId ?? selectedBranchId ?? existingSession?.selectedBranchId ?? null,
      selectedDrinkId,
      challengeId: existingSession?.challengeId ?? decodedToken?.challengeId ?? null,
      status: 'CLAIMED',
      verifiedAt: existingSession?.verifiedAt ?? decodedToken?.verifiedAt ?? nowMs,
      entitlementId: result.voucher.entitlementId ?? null,
      voucherCode: result.voucher.voucherCode,
      iat: nowMs,
      exp: nowMs + cookieMaxAgeSec * 1000,
    };

    response.cookies.set(
      cookieName,
      drinkOtpService.createJourneyCookieValue(claimedCookiePayload),
      drinkOtpService.buildJourneyCookieOptions(cookieMaxAgeSec),
    );

    return response;
  } catch (error) {
    console.error('[API] Error claiming drink entitlement:', error);
    return NextResponse.json(
      { success: false, reason: 'INTERNAL_ERROR', message: 'حدث خطأ في الخادم أثناء إصدار القسيمة.' },
      { status: 500 },
    );
  }
}
