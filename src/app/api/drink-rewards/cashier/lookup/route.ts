import { NextRequest, NextResponse } from 'next/server';
import { drinkRedemptionService } from '../../../../../services/drink-rewards/drink-redemption-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { voucherCode, adminOverrideBranchId } = body;

    if (!voucherCode || typeof voucherCode !== 'string') {
      return NextResponse.json(
        { found: false, message: 'كود القسيمة مطلوب.' },
        { status: 400 },
      );
    }

    const result = await drinkRedemptionService.lookupVoucher(
      voucherCode.trim(),
      adminOverrideBranchId,
    );

    if (!result.found) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API] Error looking up voucher for cashier:', error);
    return NextResponse.json(
      { found: false, message: 'حدث خطأ في الخادم أثناء البحث عن القسيمة.' },
      { status: 500 },
    );
  }
}
