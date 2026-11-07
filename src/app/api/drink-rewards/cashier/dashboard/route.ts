import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getPayloadClient } from '@/lib/payload';
import { getAuthUser } from '@/lib/security/auth-helper';
import { drinkRedemptionService } from '@/services/drink-rewards/drink-redemption-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'يجب تسجيل الدخول للوصول إلى لوحة الكاشير.' },
        { status: 401 },
      );
    }

    if (user.role !== 'ADMIN' && user.role !== 'STAFF') {
      return NextResponse.json(
        { success: false, message: 'غير مصرح لك بالوصول إلى لوحة صرف المشروبات.' },
        { status: 403 },
      );
    }

    // Resolve Cashier Context (assigned branch)
    const contextRes = await drinkRedemptionService.resolveCashierContext();
    const branchContext = contextRes.success ? contextRes.context : null;

    const payload = await getPayloadClient();
    const drizzle = payload.db.drizzle;

    // 1. Fast KPI Aggregation via Raw SQL with indexes
    const kpiRaw = await drizzle.execute(sql`
      SELECT
        COUNT(CASE WHEN e.status = 'REDEEMED' AND e.redeemed_at >= CURRENT_DATE THEN 1 END)::int AS today_redeemed,
        COUNT(CASE WHEN e.status = 'ISSUED' AND e.expires_at > now() THEN 1 END)::int AS active_vouchers,
        COUNT(CASE WHEN e.status = 'REDEEMED' THEN 1 END)::int AS total_redeemed,
        COUNT(CASE WHEN e.status = 'REDEEMED' AND e.selected_drink_id != e.redeemed_drink_id THEN 1 END)::int AS total_substitutions
      FROM drink_entitlements e
    `);

    const kpiRows = Array.isArray(kpiRaw) ? kpiRaw : (kpiRaw as { rows?: unknown[] }).rows || [];
    const kpi = (kpiRows[0] || {
      today_redeemed: 0,
      active_vouchers: 0,
      total_redeemed: 0,
      total_substitutions: 0,
    }) as {
      today_redeemed: number;
      active_vouchers: number;
      total_redeemed: number;
      total_substitutions: number;
    };

    // 2. Fetch Top Drink of Today
    const topDrinkRaw = await drizzle.execute(sql`
      SELECT d.name, COUNT(*)::int AS count
      FROM drink_entitlements e
      JOIN drinks d ON COALESCE(e.redeemed_drink_id, e.selected_drink_id) = d.id
      WHERE e.status = 'REDEEMED' AND e.redeemed_at >= CURRENT_DATE
      GROUP BY d.name
      ORDER BY count DESC
      LIMIT 1
    `);
    const topDrinkRows = Array.isArray(topDrinkRaw) ? topDrinkRaw : (topDrinkRaw as { rows?: unknown[] }).rows || [];
    const topDrink = (topDrinkRows[0] || null) as { name: string; count: number } | null;

    // 3. Fetch Recent 25 Redemptions (Fast indexed query)
    const recentRaw = await drizzle.execute(sql`
      SELECT
        e.id,
        e.voucher_code,
        e.customer_name,
        e.phone,
        e.status,
        e.issued_at,
        e.redeemed_at,
        e.change_reason,
        sd.name AS selected_drink_name,
        rd.name AS redeemed_drink_name,
        b.name AS branch_name,
        u.name AS cashier_name
      FROM drink_entitlements e
      LEFT JOIN drinks sd ON e.selected_drink_id = sd.id
      LEFT JOIN drinks rd ON e.redeemed_drink_id = rd.id
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN users u ON e.cashier_id = u.id
      WHERE e.status = 'REDEEMED'
      ORDER BY e.redeemed_at DESC NULLS LAST
      LIMIT 25
    `);
    const recentRows = Array.isArray(recentRaw) ? recentRaw : (recentRaw as { rows?: unknown[] }).rows || [];

    const recentRedemptions = (recentRows as Array<{
      id: number;
      voucher_code: string;
      customer_name: string;
      phone: string;
      status: string;
      issued_at: string;
      redeemed_at: string | null;
      change_reason: string | null;
      selected_drink_name: string | null;
      redeemed_drink_name: string | null;
      branch_name: string | null;
      cashier_name: string | null;
    }>).map((r) => ({
      id: r.id,
      voucherCode: r.voucher_code,
      customerName: r.customer_name,
      phone: r.phone || '',
      maskedPhone: r.phone || '',
      status: r.status,
      issuedAt: r.issued_at,
      redeemedAt: r.redeemed_at,
      changeReason: r.change_reason,
      selectedDrinkName: r.selected_drink_name || 'مشروب محدد',
      servedDrinkName: r.redeemed_drink_name || r.selected_drink_name || 'مشروب محدد',
      wasSubstituted: Boolean(r.redeemed_drink_name && r.selected_drink_name && r.redeemed_drink_name !== r.selected_drink_name),
      branchName: r.branch_name || 'الفرع الرئيسي',
      cashierName: r.cashier_name || 'الكاشير',
    }));

    return NextResponse.json({
      success: true,
      cashier: {
        name: user.name || user.email,
        role: user.role,
        branchName: branchContext?.branchName || (user.role === 'ADMIN' ? 'جميع الفروع (مشرف عام)' : 'غير محدد'),
        branchCode: branchContext?.branchCode || 'ALL',
      },
      kpi: {
        todayRedeemed: kpi.today_redeemed,
        activeVouchers: kpi.active_vouchers,
        totalRedeemed: kpi.total_redeemed,
        totalSubstitutions: kpi.total_substitutions,
        topDrinkToday: topDrink ? `${topDrink.name} (${topDrink.count})` : 'لا يوجد بعد',
      },
      recentRedemptions,
    });
  } catch (error) {
    console.error('[API] Error in cashier dashboard route:', error);
    return NextResponse.json(
      { success: false, message: 'حدث خطأ في الخادم أثناء تحميل بيانات لوحة الكاشير.' },
      { status: 500 },
    );
  }
}

