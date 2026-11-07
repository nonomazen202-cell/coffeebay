import { NextRequest, NextResponse } from 'next/server';
import { sql, type SQL } from 'drizzle-orm';
import { getPayloadClient } from '@/lib/payload';
import { getAuthUser } from '@/lib/security/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required for operational reports.' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const campaignId = searchParams.get('campaignId');
    const branchId = searchParams.get('branchId');
    const cashierId = searchParams.get('cashierId');

    const payload = await getPayloadClient();
    const drizzle = payload.db.drizzle;

    // Build base filter conditions
    const baseConditions: SQL[] = [];

    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        baseConditions.push(sql`e.created_at >= ${start.toISOString()}`);
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        baseConditions.push(sql`e.created_at <= ${end.toISOString()}`);
      }
    }

    if (campaignId && campaignId !== 'all') {
      const cId = parseInt(campaignId, 10);
      if (!isNaN(cId)) {
        baseConditions.push(sql`e.campaign_id = ${cId}`);
      }
    }

    if (branchId && branchId !== 'all') {
      const bId = parseInt(branchId, 10);
      if (!isNaN(bId)) {
        baseConditions.push(sql`e.branch_id = ${bId}`);
      }
    }

    if (cashierId && cashierId !== 'all') {
      const uId = parseInt(cashierId, 10);
      if (!isNaN(uId)) {
        baseConditions.push(sql`e.cashier_id = ${uId}`);
      }
    }

    const whereClause =
      baseConditions.length > 0
        ? sql`WHERE ${sql.join(baseConditions, sql` AND `)}`
        : sql``;

    // Conditions strictly for redeemed vouchers
    const redeemedConditions = [
      sql`e.status = 'REDEEMED'`,
      ...baseConditions,
    ];
    const whereRedeemed = sql`WHERE ${sql.join(redeemedConditions, sql` AND `)}`;

    // Conditions for substitutions (selected_drink != redeemed_drink)
    const substitutedConditions = [
      sql`e.status = 'REDEEMED'`,
      sql`e.selected_drink_id IS NOT NULL`,
      sql`e.redeemed_drink_id IS NOT NULL`,
      sql`e.selected_drink_id != e.redeemed_drink_id`,
      ...baseConditions,
    ];
    const whereSubstituted = sql`WHERE ${sql.join(substitutedConditions, sql` AND `)}`;

    // 1. KPI Aggregations
    const kpiRaw = await drizzle.execute(sql`
      SELECT
        COUNT(*)::int AS total_issued,
        COUNT(CASE WHEN e.status = 'REDEEMED' THEN 1 END)::int AS total_redeemed,
        COUNT(CASE WHEN e.status = 'ISSUED' AND e.expires_at > now() THEN 1 END)::int AS total_unredeemed,
        COUNT(CASE WHEN e.status = 'EXPIRED' OR (e.status = 'ISSUED' AND e.expires_at <= now()) THEN 1 END)::int AS total_expired,
        COUNT(CASE WHEN e.status = 'CANCELLED' THEN 1 END)::int AS total_cancelled,
        COUNT(CASE WHEN e.status = 'REDEEMED' AND e.selected_drink_id != e.redeemed_drink_id THEN 1 END)::int AS total_substitutions
      FROM drink_entitlements e
      ${whereClause}
    `);

    const kpi = (kpiRaw.rows ?? kpiRaw)[0] || {
      total_issued: 0,
      total_redeemed: 0,
      total_unredeemed: 0,
      total_expired: 0,
      total_cancelled: 0,
      total_substitutions: 0,
    };

    // 2. Dispensed Drinks Breakdown
    const drinksRaw = await drizzle.execute(sql`
      SELECT
        COALESCE(d.name, 'Coffee Bay Beverage') AS drink_name,
        COALESCE(c.name, 'Uncategorized') AS category_name,
        COUNT(e.id)::int AS count
      FROM drink_entitlements e
      LEFT JOIN drinks d ON d.id = e.redeemed_drink_id
      LEFT JOIN drink_categories c ON c.id = d.category_id
      ${whereRedeemed}
      GROUP BY d.name, c.name
      ORDER BY count DESC
    `);
    const dispensedDrinks = drinksRaw.rows ?? drinksRaw;

    // 3. Branches Breakdown
    const branchesRaw = await drizzle.execute(sql`
      SELECT
        COALESCE(b.name, 'Unknown Branch') AS branch_name,
        COALESCE(b.code, '-') AS branch_code,
        COUNT(e.id)::int AS count
      FROM drink_entitlements e
      LEFT JOIN branches b ON b.id = e.branch_id
      ${whereRedeemed}
      GROUP BY b.name, b.code
      ORDER BY count DESC
    `);
    const dispensedBranches = branchesRaw.rows ?? branchesRaw;

    // 4. Cashiers Breakdown
    const cashiersRaw = await drizzle.execute(sql`
      SELECT
        COALESCE(u.name, u.email, 'Unknown Cashier') AS cashier_name,
        COUNT(e.id)::int AS count
      FROM drink_entitlements e
      LEFT JOIN users u ON u.id = e.cashier_id
      ${whereRedeemed}
      GROUP BY u.name, u.email
      ORDER BY count DESC
    `);
    const dispensedCashiers = cashiersRaw.rows ?? cashiersRaw;

    // 5. Drink Substitutions (Selected vs Redeemed differences)
    const substitutionsRaw = await drizzle.execute(sql`
      SELECT
        e.voucher_code,
        e.phone,
        e.customer_name,
        COALESCE(sd.name, 'Coffee Bay Beverage') AS selected_drink_name,
        COALESCE(rd.name, 'Coffee Bay Beverage') AS redeemed_drink_name,
        COALESCE(e.change_reason, 'No reason specified') AS change_reason,
        COALESCE(b.name, '-') AS branch_name,
        COALESCE(u.name, '-') AS cashier_name,
        e.redeemed_at
      FROM drink_entitlements e
      LEFT JOIN drinks sd ON sd.id = e.selected_drink_id
      LEFT JOIN drinks rd ON rd.id = e.redeemed_drink_id
      LEFT JOIN branches b ON b.id = e.branch_id
      LEFT JOIN users u ON u.id = e.cashier_id
      ${whereSubstituted}
      ORDER BY e.redeemed_at DESC
      LIMIT 100
    `);
    const substitutions = substitutionsRaw.rows ?? substitutionsRaw;

    // 6. Metadata for Filter Dropdowns
    const campaignsRaw = await drizzle.execute(sql`
      SELECT id, title FROM drink_campaigns ORDER BY created_at DESC
    `);
    const allBranchesRaw = await drizzle.execute(sql`
      SELECT id, name, code FROM branches WHERE active = true ORDER BY name ASC
    `);
    const allUsersRaw = await drizzle.execute(sql`
      SELECT id, name, email FROM users ORDER BY name ASC
    `);

    return NextResponse.json({
      kpi,
      dispensedDrinks,
      dispensedBranches,
      dispensedCashiers,
      substitutions,
      filters: {
        campaigns: campaignsRaw.rows ?? campaignsRaw,
        branches: allBranchesRaw.rows ?? allBranchesRaw,
        cashiers: allUsersRaw.rows ?? allUsersRaw,
      },
    });
  } catch (error) {
    console.error('[REPORTS API ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to generate operational reports' },
      { status: 500 },
    );
  }
}
