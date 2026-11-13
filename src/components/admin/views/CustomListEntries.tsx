import React from 'react';
import { getPayload, type Payload, type Where } from 'payload';
import { sql } from 'drizzle-orm';
import config from '@payload-config';
import { EntriesManager } from './EntriesManager';
import { getCachedStats } from './cache';

interface CustomListEntriesProps {
  payload?: Payload;
  searchParams?: Promise<{
    page?: string;
    search?: string;
    result?: string;
  }> | {
    page?: string;
    search?: string;
    result?: string;
  };
}

export async function CustomListEntries({ payload: propPayload, searchParams }: CustomListEntriesProps) {
  const resolvedParams = (await searchParams) || {};
  const page = Number(resolvedParams.page) || 1;
  const limit = 100;
  const search = resolvedParams.search || '';
  const resultFilter = resolvedParams.result || 'ALL';

  const payload = propPayload || (await getPayload({ config }));

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

  // 2. Fetch Paginated Records & Single-Query Consolidated KPI Counts in parallel
  const [entriesResult, stats] = await Promise.all([
    payload.find({
      collection: 'entries',
      page,
      limit,
      where,
      depth: 1, // Fetch participant and serial code details
      sort: '-createdAt',
    }),
    getCachedStats('entries-global-stats', 15000, async () => {
      const res = await payload.db.drizzle.execute(sql`
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE result = 'WIN')::int AS win,
          count(*) FILTER (WHERE result = 'LOSE')::int AS lose,
          count(*) FILTER (WHERE result = 'INVALID')::int AS invalid,
          count(*) FILTER (WHERE result = 'ALREADY_USED')::int AS used
        FROM entries;
      `);
      const rows = Array.isArray(res)
        ? res
        : (res as { rows?: unknown[] }).rows || [];
      const row = (rows[0] as {
        total?: number;
        win?: number;
        lose?: number;
        invalid?: number;
        used?: number;
      }) || {};

      return {
        total: Number(row.total) || 0,
        win: Number(row.win) || 0,
        lose: Number(row.lose) || 0,
        invalid: Number(row.invalid) || 0,
        used: Number(row.used) || 0,
      };
    }),
  ]);

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
