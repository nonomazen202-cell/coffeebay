import React from 'react';
import { getPayload, type Payload, type Where } from 'payload';
import { sql } from 'drizzle-orm';
import config from '@payload-config';
import { headers } from 'next/headers';
import { NotificationsManager } from './NotificationsManager';
import { getCachedStats } from './cache';
import { isSuperAdmin, isPromotionsAdmin, isLuckyCupAdmin } from '@/lib/security/roles';
import type { User } from '@/payload-types';

interface CustomListNotificationsProps {
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

export async function CustomListNotifications({
  user: propUser,
  payload: propPayload,
  searchParams,
}: CustomListNotificationsProps) {
  const resolvedParams = (await searchParams) || {};
  const page = Number(resolvedParams.page) || 1;
  const limit = 100;
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

  // 1. Build Query Conditions
  const andConditions: Where[] = [];

  // Domain Scope Template Restriction:
  // - Promotions Admin sees ONLY promotional campaign alerts and vouchers
  // - Lucky Cup Admin sees ONLY lucky cup verifications and winning notifications
  // - Super Admin sees all templates
  if (currentUser && !isSuperAdmin(currentUser)) {
    if (isPromotionsAdmin(currentUser)) {
      andConditions.push({
        template: {
          in: ['drink-reward-otp', 'drink-reward-voucher', 'drink-reward-admin-alert'],
        },
      });
    } else if (isLuckyCupAdmin(currentUser)) {
      andConditions.push({
        template: {
          in: ['verification', 'winner-notification', 'admin-alert'],
        },
      });
    }
  }

  if (statusFilter !== 'ALL') {
    if (statusFilter === 'SENT') {
      andConditions.push({
        or: [
          { status: { equals: 'sent' } },
          { status: { equals: 'provider-accepted' } },
        ],
      });
    } else {
      andConditions.push({
        status: { equals: statusFilter.toLowerCase() },
      });
    }
  }
  if (search) {
    andConditions.push({
      or: [
        { phone: { like: search } },
        { providerMessageId: { like: search } },
        { lastError: { like: search } },
      ],
    });
  }

  const where: Where = andConditions.length > 0 ? { and: andConditions } : {};

  // 2. Fetch Paginated Records & Single-Query Domain-Scoped Statistics in parallel
  const domainCacheKey = `notifications-stats-${currentUser?.role || 'GLOBAL'}`;
  const isPromoScoped = Boolean(currentUser && !isSuperAdmin(currentUser) && isPromotionsAdmin(currentUser));
  const isLuckyScoped = Boolean(currentUser && !isSuperAdmin(currentUser) && isLuckyCupAdmin(currentUser));

  const [notificationsResult, stats] = await Promise.all([
    payload.find({
      collection: 'notifications',
      page,
      limit,
      where,
      sort: '-createdAt',
    }),
    getCachedStats(domainCacheKey, 15000, async () => {
      const domainClause = isPromoScoped
        ? sql`WHERE template IN ('drink-reward-otp', 'drink-reward-voucher', 'drink-reward-admin-alert')`
        : isLuckyScoped
          ? sql`WHERE template IN ('verification', 'winner-notification', 'admin-alert')`
          : sql``;

      const res = await payload.db.drizzle.execute(sql`
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE status IN ('sent', 'provider-accepted'))::int AS sent,
          count(*) FILTER (WHERE status = 'queued')::int AS queued,
          count(*) FILTER (WHERE status = 'retry-scheduled')::int AS retry_scheduled,
          count(*) FILTER (WHERE status = 'dead-letter')::int AS dead_letter,
          count(*) FILTER (WHERE status = 'failed')::int AS failed
        FROM notifications
        ${domainClause};
      `);
      const rows = Array.isArray(res)
        ? res
        : (res as { rows?: unknown[] }).rows || [];
      const row = (rows[0] as {
        total?: number;
        sent?: number;
        queued?: number;
        retry_scheduled?: number;
        dead_letter?: number;
        failed?: number;
      }) || {};

      return {
        total: Number(row.total) || 0,
        sent: Number(row.sent) || 0,
        queued: Number(row.queued) || 0,
        retryScheduled: Number(row.retry_scheduled) || 0,
        deadLetter: Number(row.dead_letter) || 0,
        failed: Number(row.failed) || 0,
      };
    }),
  ]);

  const notifications = notificationsResult.docs.map((doc) => ({
    id: doc.id,
    phone: doc.phone,
    template: doc.template,
    status: doc.status,
    priority: doc.priority,
    attempts: doc.attempts,
    maxAttempts: doc.maxAttempts,
    nextAttemptAt: doc.nextAttemptAt || null,
    expiresAt: doc.expiresAt || null,
    lastError: doc.lastError || null,
    sentAt: doc.sentAt || null,
    providerMessageId: doc.providerMessageId || null,
    providerName: doc.providerName || null,
    sendDurationMs: doc.sendDurationMs || null,
    createdAt: doc.createdAt,
  }));

  return (
    <NotificationsManager
      initialNotifications={notifications}
      currentPage={page}
      totalPages={notificationsResult.totalPages}
      totalDocs={notificationsResult.totalDocs}
      stats={stats}
      initialSearch={search}
      initialStatus={statusFilter}
    />
  );
}
