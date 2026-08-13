 
import { NextRequest, NextResponse } from 'next/server';
import { securityService } from '../../../../services/security-service';
import { claimService } from '../../../../services/claim-service';
import { getAuthUser } from '../../../../lib/security/auth-helper';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ verificationCode: string }> }
) {
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

    // 3. Resolve dynamic route params (Next 15 params promise resolution)
    const { verificationCode } = await params;
    if (!verificationCode) {
      return NextResponse.json(
        { success: false, errors: ['Verification code is required'], requestId },
        { status: 400 }
      );
    }

    // 4. Delegate to claim service
    const claim = await claimService.getClaimDetails(verificationCode);

    if (!claim) {
      return NextResponse.json(
        { success: false, errors: ['Claim details not found'], requestId },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      claim,
      requestId,
    });
  } catch (err: unknown) {
    console.error(
      `[API ERROR] GET /api/claims/[verificationCode] - Request ID: ${requestId}`,
      err
    );
    return NextResponse.json(
      { success: false, errors: ['Internal Server Error'], requestId },
      { status: 500 }
    );
  }
}
