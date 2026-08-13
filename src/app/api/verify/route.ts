 
import { NextRequest, NextResponse } from 'next/server';
import { securityService } from '../../../services/security-service';
import { claimService } from '../../../services/claim-service';
import { getAuthUser } from '../../../lib/security/auth-helper';

export async function POST(req: NextRequest) {
  const requestId = securityService.generateRequestId();

  try {
    // 1. Authenticate user session
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, errors: ['Unauthorized'], requestId },
        { status: 401 }
      );
    }

    // 2. Authorize role (must be STAFF or ADMIN)
    if (user.role !== 'STAFF' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, errors: ['Forbidden'], requestId },
        { status: 403 }
      );
    }

    let body: { verificationCode?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, errors: ['Malformed JSON payload'], requestId },
        { status: 400 }
      );
    }

    const { verificationCode } = body;
    if (!verificationCode) {
      return NextResponse.json(
        { success: false, errors: ['Verification code is required'], requestId },
        { status: 400 }
      );
    }

    // 3. Delegate to claim service
    const result = await claimService.deliverPrize({
      verificationCode,
      staffUserId: String(user.id),
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          errors: [result.message || 'Prize verification/delivery failed'],
          requestId,
        },
        { status: 400 }
      );
    }

    // 4. Return structured verify claim response
    return NextResponse.json({
      success: true,
      message: result.message,
      claim: result.claim,
      requestId,
    });
  } catch (err: unknown) {
    console.error(`[API ERROR] POST /api/verify - Request ID: ${requestId}`, err);
    return NextResponse.json(
      { success: false, errors: ['Internal Server Error'], requestId },
      { status: 500 }
    );
  }
}
