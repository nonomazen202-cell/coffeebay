import React from 'react';
import { getPayload, type Where } from 'payload';
import config from '@payload-config';
import { NotificationsManager } from './NotificationsManager';
import { getCachedStats } from './cache';

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

  // 1. Build Query Conditions
  const where: Where = {};
  if (statusFilter !== 'ALL') {
    if (statusFilter === 'SENT') {
      where.or = [
        { status: { equals: 'sent' } },
        { status: { equals: 'provider-accepted' } },
      ];
    } else {
      where.status = { equals: statusFilter.toLowerCase() };
    }
  }
  if (search) {
    where.or = [
      { phone: { like: search } },
      { providerMessageId: { like: search } },
      { lastError: { like: search } },
    ];
  }

  // 2. Fetch Paginated Records
  const notificationsResult = await payload.find({
    collection: 'notifications',
    page,
    limit,
    where,
    sort: '-createdAt',
  });

  // 3. Cache and Fetch Global Statistics (15-second TTL)
  const stats = await getCachedStats('notifications-global-stats', 15000, async () => {
    const [total, sent, queued, retryScheduled, deadLetter, failed] = await Promise.all([
      payload.count({ collection: 'notifications' }),
      payload.count({
        collection: 'notifications',
        where: {
          or: [
            { status: { equals: 'sent' } },
            { status: { equals: 'provider-accepted' } },
          ],
        },
      }),
      payload.count({
        collection: 'notifications',
        where: { status: { equals: 'queued' } },
      }),
      payload.count({
        collection: 'notifications',
        where: { status: { equals: 'retry-scheduled' } },
      }),
      payload.count({
        collection: 'notifications',
        where: { status: { equals: 'dead-letter' } },
      }),
      payload.count({
        collection: 'notifications',
        where: { status: { equals: 'failed' } },
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
