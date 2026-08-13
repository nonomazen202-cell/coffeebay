import React from 'react';
import { getPayload, type Where } from 'payload';
import config from '@payload-config';
import { CodesManager } from './CodesManager';
import { getCachedStats } from './cache';

interface CustomListCodesProps {
  searchParams?: Promise<{
    page?: string;
    search?: string;
    filter?: string;
  }>;
}

export async function CustomListCodes({ searchParams }: CustomListCodesProps) {
  const resolvedParams = (await searchParams) || {};
  const page = Number(resolvedParams.page) || 1;
  const limit = 50;
  const search = resolvedParams.search || '';
  const filter = resolvedParams.filter || 'ALL';

  const payload = await getPayload({ config });

  // 1. Build Query Conditions
  const andConditions: Where[] = [];

  if (search) {
    // Find matching prizes by name
    const matchingPrizes = await payload.find({
      collection: 'prizes',
      where: {
        name: { like: search },
      },
      limit: 100,
    });
    const prizeIds = matchingPrizes.docs.map((d) => d.id);

    const searchOrConditions: Where[] = [
      { serial_code: { like: search } },
    ];
    if (prizeIds.length > 0) {
      searchOrConditions.push({ prize_id: { in: prizeIds } });
    }

    andConditions.push({ or: searchOrConditions });
  }

  if (filter === 'CLAIMED') {
    andConditions.push({ claimed: { equals: true } });
  } else if (filter === 'REMAINING') {
    andConditions.push({ claimed: { equals: false } });
  } else if (filter === 'WINNERS') {
    andConditions.push({ is_winner: { equals: true } });
  }

  const where: Where = andConditions.length > 0 ? { and: andConditions } : {};

  // 2. Fetch Paginated Records
  const codesResult = await payload.find({
    collection: 'codes',
    page,
    limit,
    where,
    depth: 1, // Populate the prizes relationship details
    sort: '-createdAt',
  });

  // 3. Cache Global Counts (15-second TTL) for the KPI cards
  const totalCount = await getCachedStats('codes-total-count', 15000, async () => {
    const res = await payload.count({ collection: 'codes' });
    return res.totalDocs;
  });

  const claimedCount = await getCachedStats('codes-claimed-count', 15000, async () => {
    const res = await payload.count({
      collection: 'codes',
      where: { claimed: { equals: true } },
    });
    return res.totalDocs;
  });

  const winnersCount = await getCachedStats('codes-winners-count', 15000, async () => {
    const res = await payload.count({
      collection: 'codes',
      where: { is_winner: { equals: true } },
    });
    return res.totalDocs;
  });

  const losingCount = totalCount - winnersCount;

  const codes = codesResult.docs.map(doc => {
    let prizeInfo = null;
    if (doc.prize_id && typeof doc.prize_id === 'object') {
      prizeInfo = {
        id: doc.prize_id.id,
        name: doc.prize_id.name,
      };
    }

    return {
      id: doc.id,
      serialCode: doc.serial_code,
      isWinner: Boolean(doc.is_winner),
      prizeId: prizeInfo,
      claimed: Boolean(doc.claimed),
      claimedAt: doc.claimed_at || null,
      createdAt: doc.createdAt,
    };
  });

  return (
    <CodesManager
      initialCodes={codes}
      currentPage={page}
      totalPages={codesResult.totalPages}
      totalDocs={codesResult.totalDocs}
      totalCount={totalCount}
      claimedCodesCount={claimedCount}
      losingCodesCount={losingCount}
      winningCodesCount={winnersCount}
      initialSearch={search}
      initialFilter={filter as 'ALL' | 'CLAIMED' | 'REMAINING' | 'WINNERS'}
    />
  );
}
