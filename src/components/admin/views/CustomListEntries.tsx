import React from 'react';
import { getPayload, type Where } from 'payload';
import config from '@payload-config';
import { EntriesManager } from './EntriesManager';
import { getCachedStats } from './cache';

interface CustomListEntriesProps {
  searchParams?: Promise<{
    page?: string;
    search?: string;
    result?: string;
  }>;
}

export async function CustomListEntries({ searchParams }: CustomListEntriesProps) {
  const resolvedParams = (await searchParams) || {};
  const page = Number(resolvedParams.page) || 1;
  const limit = 100;
  const search = resolvedParams.search || '';
  const resultFilter = resolvedParams.result || 'ALL';

  const payload = await getPayload({ config });

  // 1. Build Query Conditions
  const where: Where = {};
  if (resultFilter !== 'ALL') {
    where.result = { equals: resultFilter };
  }
  if (search) {
    where.or = [
      { ip: { like: search } },
      { user_agent: { like: search } },
      { request_id: { like: search } },
      { participant: { equals: search } }, // Hook in Entries.ts intercepts and performs participant searches
    ];
  }

  // 2. Fetch Paginated Records
  const entriesResult = await payload.find({
    collection: 'entries',
    page,
    limit,
    where,
    depth: 1, // Fetch participant and serial code details
    sort: '-createdAt',
  });

  // 3. Cache Global Counts (15-second TTL)
  const stats = await getCachedStats('entries-global-stats', 15000, async () => {
    const [total, win, lose, invalid, used] = await Promise.all([
      payload.count({ collection: 'entries' }),
      payload.count({
        collection: 'entries',
        where: { result: { equals: 'WIN' } },
      }),
      payload.count({
        collection: 'entries',
        where: { result: { equals: 'LOSE' } },
      }),
      payload.count({
        collection: 'entries',
        where: { result: { equals: 'INVALID' } },
      }),
      payload.count({
        collection: 'entries',
        where: { result: { equals: 'ALREADY_USED' } },
      }),
    ]);

    return {
      total: total.totalDocs,
      win: win.totalDocs,
      lose: lose.totalDocs,
      invalid: invalid.totalDocs,
      used: used.totalDocs,
    };
  });

  const entries = entriesResult.docs.map(doc => {
    let participantInfo = null;
    if (doc.participant && typeof doc.participant === 'object') {
      participantInfo = {
        id: doc.participant.id,
        name: doc.participant.name,
        phone: doc.participant.phone,
      };
    }

    let codeInfo = null;
    if (doc.code && typeof doc.code === 'object') {
      codeInfo = {
        id: doc.code.id,
        serialCode: doc.code.serial_code,
      };
    }

    return {
      id: doc.id,
      participant: participantInfo,
      code: codeInfo,
      result: doc.result,
      ip: doc.ip || null,
      userAgent: doc.user_agent || null,
      requestId: doc.request_id || null,
      createdAt: doc.createdAt,
    };
  });

  return (
    <EntriesManager
      initialEntries={entries}
      currentPage={page}
      totalPages={entriesResult.totalPages}
      totalDocs={entriesResult.totalDocs}
      stats={stats}
      initialSearch={search}
      initialResult={resultFilter}
    />
  );
}
