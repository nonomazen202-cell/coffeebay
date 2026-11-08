import React from 'react';
import { getPayload, type Where } from 'payload';
import config from '@payload-config';
import { headers } from 'next/headers';
import { DrinkVouchersManager, type SerializedVoucher } from './DrinkVouchersManager';
import { getCachedStats } from './cache';

interface CustomListDrinkVouchersProps {
  searchParams?: Promise<{
    page?: string;
    search?: string;
    status?: string;
  }>;
}

export async function CustomListDrinkVouchers({ searchParams }: CustomListDrinkVouchersProps) {
  const resolvedParams = (await searchParams) || {};
  const page = Number(resolvedParams.page) || 1;
  const limit = 50;
  const search = resolvedParams.search || '';
  const statusFilter = resolvedParams.status || 'ALL';

  const payload = await getPayload({ config });

  // Authenticate user session
  const authResult = await payload.auth({
    headers: await headers(),
  });
  const userRole = (authResult?.user?.role as 'ADMIN' | 'STAFF') || 'STAFF';

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

  // 2. Fetch Paginated Records
  const entitlementsResult = await payload.find({
    collection: 'drink-entitlements',
    page,
    limit,
    where,
    depth: 1, // Populate drink, branch, cashier details
    sort: '-createdAt',
  });

  // 3. Cached KPI Counts (15-second TTL) to protect DB
  const totalCount = await getCachedStats('vouchers-total-count', 15000, async () => {
    const res = await payload.count({ collection: 'drink-entitlements' });
    return res.totalDocs;
  });

  const issuedCount = await getCachedStats('vouchers-issued-count', 15000, async () => {
    const res = await payload.count({
      collection: 'drink-entitlements',
      where: { status: { equals: 'ISSUED' } },
    });
    return res.totalDocs;
  });

  const redeemedCount = await getCachedStats('vouchers-redeemed-count', 15000, async () => {
    const res = await payload.count({
      collection: 'drink-entitlements',
      where: { status: { equals: 'REDEEMED' } },
    });
    return res.totalDocs;
  });

  const expiredCount = await getCachedStats('vouchers-expired-count', 15000, async () => {
    const res = await payload.count({
      collection: 'drink-entitlements',
      where: { status: { equals: 'EXPIRED' } },
    });
    return res.totalDocs;
  });

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
      customerName: doc.customer_name,
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

