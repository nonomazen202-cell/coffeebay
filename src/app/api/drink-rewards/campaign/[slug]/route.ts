import { NextRequest, NextResponse } from 'next/server';
import { getDrinkRewardsCacheVersion } from '@/lib/cache/drink-rewards-cache';
import { drinkCampaignService } from '@/services/drink-rewards/drink-campaign-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json(
        { success: false, message: 'معرف الحملة مطلوب' },
        { status: 400 },
      );
    }

    const forceFresh = req.nextUrl.searchParams.get('fresh') === '1';
    const campaign = await drinkCampaignService.getPublicCampaignWithMenu(slug, {
      bypassCache: forceFresh,
    });
    if (!campaign) {
      return NextResponse.json(
        { success: false, message: 'الحملة المطلوبة غير موجودة' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        campaign,
        cacheVersion: getDrinkRewardsCacheVersion(),
      },
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
    console.error('[API] Error fetching drink campaign:', error);
    return NextResponse.json(
      { success: false, message: 'حدث خطأ في جلب بيانات الحملة' },
      { status: 500 },
    );
  }
}
