import { NextRequest, NextResponse } from 'next/server';
import {
  drinkOtpService,
  type RewardJourneySessionPayload,
} from '../../../../services/drink-rewards/drink-otp-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface UpdateSessionBody {
  campaignSlug?: unknown;
  selectedDrinkId?: unknown;
  customerName?: unknown;
  selectedBranchId?: unknown;
}

/**
 * Lightweight, cookie-gated endpoint to fetch the authoritative reward journey
 * and voucher lifecycle status (`ISSUED`, `REDEEMED`, `EXPIRED`, `CANCELLED`)
 * from PostgreSQL for active `/success` pass synchronization.
 */
export async function GET(req: NextRequest) {
  try {
    const campaignSlug = req.nextUrl.searchParams.get('campaignSlug')?.trim() || '';
    if (!campaignSlug) {
      return NextResponse.json(
        { success: false, message: 'معرف الحملة مطلوب.' },
        { status: 400 },
      );
    }

    const cookieName = drinkOtpService.getJourneyCookieName(campaignSlug);
    const rawCookie = req.cookies.get(cookieName)?.value;
    const existingSession = drinkOtpService.verifyJourneyCookieValue(
      rawCookie,
      campaignSlug,
    );

    // Reject unauthenticated requests before touching PostgreSQL
    if (!existingSession) {
      return NextResponse.json(
        { success: false, reason: 'NO_ACTIVE_SESSION', message: 'لا توجد جلسة نشطة.' },
        { status: 401 },
      );
    }

    const campaignHeader = await drinkOtpService.getCampaignHeaderBySlug(campaignSlug);
    if (!campaignHeader) {
      return NextResponse.json(
        { success: false, reason: 'CAMPAIGN_NOT_FOUND', message: 'الحملة غير موجودة.' },
        { status: 404 },
      );
    }

    const journey = await drinkOtpService.resolveJourneyState(
      campaignHeader,
      rawCookie,
    );

    return NextResponse.json(
      { success: true, journey },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      },
    );
  } catch (error) {
    console.error('[API] Error fetching drink reward session:', error);
    return NextResponse.json(
      { success: false, message: 'تعذر جلب حالة القسيمة.' },
      { status: 500 },
    );
  }
}

/**
 * Lightweight, zero-database-hit endpoint to persist transient step preferences
 * (such as selectedDrinkId on `/choose-drink`) inside the campaign-isolated
 * HMAC-signed HttpOnly Reward Journey cookie.
 */
export async function PATCH(req: NextRequest) {
  try {
    let body: UpdateSessionBody;
    try {
      body = (await req.json()) as UpdateSessionBody;
    } catch {
      return NextResponse.json(
        { success: false, message: 'بيانات الطلب غير صالحة.' },
        { status: 400 },
      );
    }

    const campaignSlug =
      typeof body.campaignSlug === 'string' ? body.campaignSlug.trim() : '';
    if (!campaignSlug) {
      return NextResponse.json(
        { success: false, message: 'معرف الحملة مطلوب.' },
        { status: 400 },
      );
    }

    const cookieName = drinkOtpService.getJourneyCookieName(campaignSlug);
    const rawCookie = req.cookies.get(cookieName)?.value;
    const existingSession = drinkOtpService.verifyJourneyCookieValue(
      rawCookie,
      campaignSlug,
    );

    if (!existingSession) {
      return NextResponse.json(
        { success: false, reason: 'NO_ACTIVE_SESSION', message: 'لا توجد جلسة نشطة.' },
        { status: 401 },
      );
    }

    const nowMs = Date.now();
    const remainingSec = Math.max(60, Math.floor((existingSession.exp - nowMs) / 1000));

    let nextSelectedDrinkId = existingSession.selectedDrinkId;
    if (existingSession.status !== 'CLAIMED' && body.selectedDrinkId !== undefined) {
      if (
        typeof body.selectedDrinkId === 'number' ||
        typeof body.selectedDrinkId === 'string'
      ) {
        nextSelectedDrinkId = body.selectedDrinkId;
      } else if (body.selectedDrinkId === null) {
        nextSelectedDrinkId = null;
      }
    }

    const nextCustomerName =
      existingSession.status !== 'CLAIMED' &&
      typeof body.customerName === 'string' &&
      body.customerName.trim().length > 0
        ? body.customerName.trim().slice(0, 120)
        : existingSession.customerName;

    const nextBranchId =
      body.selectedBranchId !== undefined &&
      (typeof body.selectedBranchId === 'string' ||
        typeof body.selectedBranchId === 'number' ||
        body.selectedBranchId === null)
        ? body.selectedBranchId
        : existingSession.selectedBranchId;

    const updatedPayload: RewardJourneySessionPayload = {
      ...existingSession,
      selectedDrinkId: nextSelectedDrinkId,
      customerName: nextCustomerName,
      selectedBranchId: nextBranchId,
    };

    const response = NextResponse.json({ success: true }, { status: 200 });
    response.cookies.set(
      cookieName,
      drinkOtpService.createJourneyCookieValue(updatedPayload),
      drinkOtpService.buildJourneyCookieOptions(remainingSec),
    );
    return response;
  } catch (error) {
    console.error('[API] Error updating drink reward session:', error);
    return NextResponse.json(
      { success: false, message: 'تعذر تحديث الجلسة.' },
      { status: 500 },
    );
  }
}

/**
 * Clears the campaign-specific HttpOnly Reward Journey cookie when a user
 * explicitly requests to start over with another phone number.
 */
export async function DELETE(req: NextRequest) {
  try {
    let campaignSlug = req.nextUrl.searchParams.get('campaignSlug')?.trim() || '';
    if (!campaignSlug) {
      try {
        const body = (await req.json()) as { campaignSlug?: unknown };
        if (typeof body.campaignSlug === 'string') {
          campaignSlug = body.campaignSlug.trim();
        }
      } catch {
        // Query param may be used without JSON body
      }
    }

    if (!campaignSlug) {
      return NextResponse.json(
        { success: false, message: 'معرف الحملة مطلوب.' },
        { status: 400 },
      );
    }

    const cookieName = drinkOtpService.getJourneyCookieName(campaignSlug);
    const response = NextResponse.json({ success: true }, { status: 200 });
    response.cookies.set(
      cookieName,
      '',
      drinkOtpService.buildJourneyCookieOptions(0),
    );
    return response;
  } catch (error) {
    console.error('[API] Error clearing drink reward session:', error);
    return NextResponse.json(
      { success: false, message: 'تعذر إنهاء الجلسة.' },
      { status: 500 },
    );
  }
}

