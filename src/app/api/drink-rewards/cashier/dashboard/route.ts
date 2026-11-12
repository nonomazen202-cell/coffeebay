import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/security/auth-helper";
import { hasPromotionsAccess } from "@/lib/security/roles";
import { drinkRedemptionService } from "@/services/drink-rewards/drink-redemption-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "يجب تسجيل الدخول للوصول إلى لوحة الكاشير.",
        },
        { status: 401 },
      );
    }

    if (!hasPromotionsAccess(user)) {
      return NextResponse.json(
        {
          success: false,
          message: "غير مصرح لك بالوصول إلى لوحة صرف المشروبات.",
        },
        { status: 403 },
      );
    }

    const data = await drinkRedemptionService.getCashierDashboardData(user);
    if (!data) {
      return NextResponse.json(
        { success: false, message: "تعذر جلب بيانات الكاشير." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error("[API] Error in cashier dashboard route:", error);
    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ في الخادم أثناء تحميل بيانات لوحة الكاشير.",
      },
      { status: 500 },
    );
  }
}
