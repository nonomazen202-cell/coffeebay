import React from 'react';
import { getPayload, type Where } from 'payload';
import config from '@payload-config';
import { ParticipantsManager } from './ParticipantsManager';
import { getCachedStats } from './cache';

interface CustomListParticipantsProps {
  searchParams?: Promise<{
    page?: string;
    search?: string;
  }>;
}

export async function CustomListParticipants({ searchParams }: CustomListParticipantsProps) {
  const resolvedParams = (await searchParams) || {};
  const page = Number(resolvedParams.page) || 1;
  const limit = 100;
  const search = resolvedParams.search || '';

  const payload = await getPayload({ config });

  // 1. Build Query Conditions
  const where: Where = {};
  if (search) {
    where.or = [
      { name: { like: search } },
      { phone: { like: search } },
    ];
  }

  // 2. Fetch Paginated Records
  const participantsResult = await payload.find({
    collection: 'participants',
    page,
    limit,
    where,
    sort: '-createdAt',
  });

  // 3. Cache Global Counts (15-second TTL)
  const totalCount = await getCachedStats('participants-total-count', 15000, async () => {
    const res = await payload.count({ collection: 'participants' });
    return res.totalDocs;
  });

  const participants = participantsResult.docs.map(doc => ({
    id: doc.id,
    name: doc.name,
    phone: doc.phone,
    verified: doc.verified ?? false,
    blocked: doc.blocked ?? false,
    createdAt: doc.createdAt,
  }));

  return (
    <ParticipantsManager
      initialParticipants={participants}
      currentPage={page}
      totalPages={participantsResult.totalPages}
      totalDocs={participantsResult.totalDocs}
      totalCount={totalCount}
      initialSearch={search}
    />
  );
}
