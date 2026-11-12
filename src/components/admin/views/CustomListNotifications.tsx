import React from 'react';
import { getPayload, type Where } from 'payload';
import config from '@payload-config';
import { headers } from 'next/headers';
import { NotificationsManager } from './NotificationsManager';
import { getCachedStats } from './cache';
import { isSuperAdmin, isPromotionsAdmin, isLuckyCupAdmin } from '@/lib/security/roles';

interface CustomListNotificationsProps {
  searchParams?: Promise<{
    page?: string;
    search?: string;
    status?: string;
  }>;
}

export async function CustomListNotifications({ searchParams }: CustomListNotificationsProps) {
  const resolvedParams = (await searchParams) || {};
  const page = Number(resolvedParams.page) || 1;
  const limit = 100;
  const search = resolvedParams.search || '';
  const statusFilter = resolvedParams.status || 'ALL';

  const payload = await getPayload({ config });

  // Authenticate session for domain isolation
  const authResult = await payload.auth({
    headers: await headers(),
  });
  const currentUser = authResult?.user;

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

  // 2. Fetch Paginated Records
  const notificationsResult = await payload.find({
    collection: 'notifications',
    page,
    limit,
    where,
    sort: '-createdAt',
  });

  // 3. Cache and Fetch Domain-Scoped Statistics (15-second TTL)
  const domainCacheKey = `notifications-stats-${currentUser?.role || 'GLOBAL'}`;
  const baseDomainWhere: Where = andConditions[0] ? andConditions[0] : {};

  const stats = await getCachedStats(domainCacheKey, 15000, async () => {
    const combine = (cond: Where): Where => {
      if (andConditions[0]) {
        return { and: [baseDomainWhere, cond] };
      }
      return cond;
    };

    const [total, sent, queued, retryScheduled, deadLetter, failed] = await Promise.all([
      payload.count({
        collection: 'notifications',
        where: baseDomainWhere,
      }),
      payload.count({
        collection: 'notifications',
        where: combine({
          or: [
            { status: { equals: 'sent' } },
            { status: { equals: 'provider-accepted' } },
          ],
        }),
      }),
      payload.count({
        collection: 'notifications',
        where: combine({ status: { equals: 'queued' } }),
      }),
      payload.count({
        collection: 'notifications',
        where: combine({ status: { equals: 'retry-scheduled' } }),
      }),
      payload.count({
        collection: 'notifications',
        where: combine({ status: { equals: 'dead-letter' } }),
      }),
      payload.count({
        collection: 'notifications',
        where: combine({ status: { equals: 'failed' } }),
      }),
    ]);

    return {
      total: total.totalDocs,
      sent: sent.totalDocs,
      queued: queued.totalDocs,
      retryScheduled: retryScheduled.totalDocs,
      deadLetter: deadLetter.totalDocs,
      failed: failed.totalDocs,
    };
  });

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
