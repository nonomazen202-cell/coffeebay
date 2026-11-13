import React from 'react';
import { getPayload, type Payload, type Where } from 'payload';
import config from '@payload-config';
import { ParticipantsManager } from './ParticipantsManager';
import { getCachedStats } from './cache';

interface CustomListParticipantsProps {
  payload?: Payload;
  searchParams?: Promise<{
    page?: string;
    search?: string;
  }> | {
    page?: string;
    search?: string;
  };
}

export async function CustomListParticipants({ payload: propPayload, searchParams }: CustomListParticipantsProps) {
  const resolvedParams = (await searchParams) || {};
  const page = Number(resolvedParams.page) || 1;
  const limit = 100;
  const search = resolvedParams.search || '';

  const payload = propPayload || (await getPayload({ config }));

  // 1. Build Query Conditions
  const where: Where = {};
  if (search) {
    where.or = [
      { name: { like: search } },
      { phone: { like: search } },
    ];
  }

  // 2. Fetch Paginated Records & Cached Global Count in parallel
  const [participantsResult, totalCount] = await Promise.all([
    payload.find({
      collection: 'participants',
      page,
      limit,
      where,
      sort: '-createdAt',
    }),
    getCachedStats('participants-total-count', 15000, async () => {
      const res = await payload.count({ collection: 'participants' });
      return res.totalDocs;
    }),
  ]);

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
