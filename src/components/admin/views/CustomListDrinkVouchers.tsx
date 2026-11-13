import React from 'react';
import { getPayload, type Payload, type Where } from 'payload';
import { sql } from 'drizzle-orm';
import config from '@payload-config';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DrinkVouchersManager, type SerializedVoucher } from './DrinkVouchersManager';
import { getCachedStats } from './cache';
import { hasPromotionsAdminAccess } from '@/lib/security/roles';
import type { User } from '@/payload-types';

interface CustomListDrinkVouchersProps {
  user?: User | null;
  payload?: Payload;
  searchParams?: Promise<{
    page?: string;
    search?: string;
    status?: string;
  }> | {
    page?: string;
    search?: string;
    status?: string;
  };
}

export async function CustomListDrinkVouchers({
  user: propUser,
  payload: propPayload,
  searchParams,
}: CustomListDrinkVouchersProps) {
  const resolvedParams = (await searchParams) || {};
  const page = Number(resolvedParams.page) || 1;
  const limit = 50;
  const search = resolvedParams.search || '';
  const statusFilter = resolvedParams.status || 'ALL';

  const payload = propPayload || (await getPayload({ config }));

  // Reuse Payload's already-authenticated user from ListView serverProps (zero duplicate auth!)
  const currentUser =
    propUser !== undefined
      ? propUser
      : (
          await payload.auth({
            headers: await headers(),
          })
        )?.user;
  if (!currentUser || !hasPromotionsAdminAccess(currentUser)) {
    redirect('/admin');
  }
  const userRole = (currentUser.role as string) || 'PROMOTIONS_ADMIN';

  // 1. Build Query Conditions
  const andConditions: Where[] = [];

  if (search.trim()) {
    const s = search.trim();
    const digits = s.replace(/\D/g, '');
    const orList: Where[] = [
      { voucher_code: { like: s } },
      { phone: { like: s } },
      { customer_name: { like: s } },
    ];
    if (digits.length >= 8) {
      // Matches both 010... and +2010... by matching the unique trailing digits
      const localDigits = digits.length >= 10 ? digits.slice(-10) : digits;
      orList.push({ phone: { like: localDigits } });
    }
    andConditions.push({ or: orList });
  }

  if (statusFilter && statusFilter !== 'ALL') {
    andConditions.push({
      status: { equals: statusFilter },
    });
  }

  const where: Where = andConditions.length > 0 ? { and: andConditions } : {};

  // 2. Fetch Paginated Records & Single-Query Consolidated KPI Counts in parallel
  const [entitlementsResult, kpiCounts] = await Promise.all([
    payload.find({
      collection: 'drink-entitlements',
      page,
      limit,
      where,
      depth: 1, // Populate drink, branch, cashier details
      sort: '-createdAt',
    }),
    getCachedStats('vouchers-consolidated-kpi', 15000, async () => {
      const res = await payload.db.drizzle.execute(sql`
        SELECT
          count(*)::int AS total_count,
          count(*) FILTER (WHERE status = 'ISSUED')::int AS issued_count,
          count(*) FILTER (WHERE status = 'REDEEMED')::int AS redeemed_count,
          count(*) FILTER (WHERE status = 'EXPIRED')::int AS expired_count
        FROM drink_entitlements;
      `);
      const rows = Array.isArray(res)
        ? res
        : (res as { rows?: unknown[] }).rows || [];
      const row = (rows[0] as {
        total_count?: number;
        issued_count?: number;
        redeemed_count?: number;
        expired_count?: number;
      }) || {};
      return {
        totalCount: Number(row.total_count) || 0,
        issuedCount: Number(row.issued_count) || 0,
        redeemedCount: Number(row.redeemed_count) || 0,
        expiredCount: Number(row.expired_count) || 0,
      };
    }),
  ]);

  const { totalCount, issuedCount, redeemedCount, expiredCount } = kpiCounts;

  // 4. Map Lean Records
  const vouchers: SerializedVoucher[] = entitlementsResult.docs.map((doc) => {
    const campaignTitle =
      doc.campaign && typeof doc.campaign === 'object'
        ? doc.campaign.title
        : 'حملة ترويجية';

    const selectedDrinkName =
      doc.selected_drink && typeof doc.selected_drink === 'object'
        ? doc.selected_drink.name
        : 'مشروب محدد';

    const redeemedDrinkName =
      doc.redeemed_drink && typeof doc.redeemed_drink === 'object'
        ? doc.redeemed_drink.name
        : null;

    const branchName =
      doc.branch && typeof doc.branch === 'object'
        ? doc.branch.name
        : null;

    const cashierName =
      doc.cashier && typeof doc.cashier === 'object'
        ? (doc.cashier.name || doc.cashier.email)
        : null;

    return {
      id: doc.id,
      voucherCode: doc.voucher_code,
      customerName: doc.customer_name || '',
      phone: doc.phone,
      status: doc.status as 'ISSUED' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED',
      campaignTitle,
      selectedDrinkName,
      redeemedDrinkName,
      branchName,
      cashierName,
      changeReason: doc.change_reason || null,
      issuedAt: doc.issued_at,
      redeemedAt: doc.redeemed_at || null,
      expiresAt: doc.expires_at,
      reclaimAllowed: Boolean(doc.reclaim_allowed),
    };
  });

  return (
    <DrinkVouchersManager
      initialVouchers={vouchers}
      currentPage={page}
      totalPages={entitlementsResult.totalPages}
      totalDocs={entitlementsResult.totalDocs}
      totalCount={totalCount}
      issuedCount={issuedCount}
      redeemedCount={redeemedCount}
      expiredCount={expiredCount}
      initialSearch={search}
      initialStatus={statusFilter}
      userRole={userRole}
    />
  );
}

