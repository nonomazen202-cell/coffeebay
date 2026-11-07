import { NextRequest, NextResponse } from 'next/server';
import { drinkRedemptionService } from '../../../../../services/drink-rewards/drink-redemption-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { voucherCode, servedDrinkId, changeReason, adminOverrideBranchId } = body;

    if (!voucherCode || typeof voucherCode !== 'string') {
      return NextResponse.json(
        { success: false, reason: 'VOUCHER_NOT_FOUND', message: 'كود القسيمة مطلوب.' },
        { status: 400 },
      );
    }

    const result = await drinkRedemptionService.redeemVoucher({
      voucherCode: voucherCode.trim(),
      servedDrinkId,
      changeReason,
      adminOverrideBranchId,
    });

    if (!result.success) {
      const statusCode =
        result.reason === 'UNAUTHENTICATED'
          ? 401
          : result.reason === 'UNAUTHORIZED' || result.reason === 'NO_BRANCH_ASSIGNED' || result.reason === 'BRANCH_NOT_ALLOWED'
          ? 403
          : result.reason === 'VOUCHER_NOT_FOUND'
          ? 404
          : result.reason === 'ALREADY_REDEEMED' || result.reason === 'VOUCHER_EXPIRED' || result.reason === 'VOUCHER_CANCELLED'
          ? 409
          : 400;

      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API] Error in cashier redemption route:', error);
    return NextResponse.json(
      { success: false, reason: 'INTERNAL_ERROR', message: 'حدث خطأ في الخادم أثناء تسجيل صرف القسيمة.' },
      { status: 500 },
    );
  }
}
