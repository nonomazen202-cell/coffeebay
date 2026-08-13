'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AdminPagination } from '../AdminPagination';
import { bulkDeleteAction } from './actions';

interface NotificationRecord {
  id: string | number;
  phone: string;
  template: string;
  status: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt?: string | null;
  expiresAt?: string | null;
  lastError?: string | null;
  sentAt?: string | null;
  providerMessageId?: string | null;
  providerName?: string | null;
  sendDurationMs?: number | null;
  createdAt: string;
}

interface NotificationsManagerProps {
  initialNotifications: NotificationRecord[];
  currentPage: number;
  totalPages: number;
  totalDocs: number;
  stats: {
    total: number;
    sent: number;
    queued: number;
    retryScheduled: number;
    deadLetter: number;
    failed: number;
  };
  initialSearch: string;
  initialStatus: string;
}

export function NotificationsManager({
  initialNotifications,
  currentPage,
  totalPages,
  totalDocs,
  stats,
  initialSearch,
  initialStatus,
}: NotificationsManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const updateUrlParams = useCallback((page: number, searchVal: string, statusVal: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    if (searchVal) {
      params.set('search', searchVal);
    } else {
      params.delete('search');
    }
    if (statusVal && statusVal !== 'ALL') {
      params.set('status', statusVal);
    } else {
      params.delete('status');
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }, [pathname, router, searchParams]);

  // Sync Search state to URL on 400ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== initialSearch) {
        updateUrlParams(1, search, statusFilter);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search, initialSearch, statusFilter, updateUrlParams]);

  // Sync Status state to URL immediately
  const handleStatusFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    updateUrlParams(1, search, newStatus);
  };

  const handlePageChange = (newPage: number) => {
    updateUrlParams(newPage, search, statusFilter);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to delete the ${selectedIds.length} selected notification logs?\nهل أنت متأكد من حذف سجلات الإشعارات المحددة؟`
      )
    ) {
      return;
    }

    setDeleting(true);
    setErrorMsg(null);
    try {
      const res = await bulkDeleteAction('notifications', selectedIds);
      if (res.success) {
        setSelectedIds([]);
        router.refresh();
      } else {
        setErrorMsg(res.error || 'Failed to delete notifications.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('An error occurred during deletion.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ padding: '2rem 1.5rem', minHeight: '100vh', backgroundColor: '#231F20' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '2rem',
          paddingBottom: '1.25rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: '900',
              color: '#ffffff',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span style={{ color: '#25D366' }}>💬</span> WhatsApp Notification Queue / طابور إشعارات الواتساب
          </h1>
          <p style={{ color: '#d4d4d8', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Monitor WhatsApp OTP verification, winner notifications, admin alerts, delivery status, and logs.
          </p>
        </div>
      </div>

      {/* KPI Stats Panel */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem',
        }}
      >
        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Logs</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#ffffff', marginTop: '0.5rem' }}>{stats.total.toLocaleString()}</span>
        </div>

        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderLeft: '4px solid #25D366', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sent Successfully</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#25D366', marginTop: '0.5rem' }}>{stats.sent.toLocaleString()}</span>
        </div>

        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderLeft: '4px solid #3B82F6', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Queued</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#3B82F6', marginTop: '0.5rem' }}>{stats.queued.toLocaleString()}</span>
        </div>

        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderLeft: '4px solid #F59E0B', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Retrying</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#F59E0B', marginTop: '0.5rem' }}>{stats.retryScheduled.toLocaleString()}</span>
        </div>

        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderLeft: '4px solid #EF4444', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dead Letter (DLQ)</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#EF4444', marginTop: '0.5rem' }}>{stats.deadLetter.toLocaleString()}</span>
        </div>
      </div>

      {/* Filters & Search Control Card */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
          background: '#1b1819',
          padding: '1.25rem',
          borderRadius: '0.75rem',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1', minWidth: '280px' }}>
          <input
            type="text"
            placeholder="Search phone number, template, message ID, or error..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: '#151314',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem 0.75rem 2.5rem',
              color: '#ffffff',
              fontSize: '0.9rem',
              outline: 'none',
            }}
          />
          <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa' }}>🔍</span>
        </div>

        {/* Tab Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['ALL', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'RETRY-SCHEDULED', 'DEAD-LETTER', 'FAILED'].map((tab) => {
            const isSelected = statusFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => handleStatusFilterChange(tab)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  border: '1px solid',
                  borderColor: isSelected ? '#25D366' : 'rgba(255, 255, 255, 0.1)',
                  backgroundColor: isSelected ? 'rgba(37, 211, 102, 0.15)' : 'rgba(0, 0, 0, 0.2)',
                  color: isSelected ? '#25D366' : '#d4d4d8',
                  cursor: 'pointer',
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Message banner */}
      {errorMsg && (
        <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ffffff', borderRadius: '0.5rem', fontSize: '0.9rem', marginBottom: '1.5rem', border: '1px solid #EF4444' }}>
          ⚠️ <span style={{ fontWeight: '600' }}>{errorMsg}</span>
        </div>
      )}

      {/* Bulk Delete Selection Bar */}
      {selectedIds.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(123, 59, 27, 0.15)', border: '1px solid #7B3B1B', padding: '0.85rem 1.25rem', borderRadius: '0.75rem', marginBottom: '1rem' }}>
          <span style={{ color: '#ffffff', fontSize: '0.85rem', fontWeight: '600' }}>Selected {selectedIds.length} logs</span>
          <button onClick={handleBulkDelete} disabled={deleting} style={{ padding: '0.5rem 1.25rem', backgroundColor: '#7B3B1B', color: '#ffffff', border: 'none', borderRadius: '0.375rem', fontWeight: '800', cursor: deleting ? 'not-allowed' : 'pointer' }}>
            {deleting ? 'Deleting...' : 'Delete Selected / حذف المحدد'}
          </button>
        </div>
      )}

      {/* Main Table Layout */}
      <div style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', backgroundColor: '#1b1819', overflow: 'hidden', opacity: isPending ? 0.7 : 1 }}>
        {initialNotifications.length === 0 ? (
          <div style={{ padding: '5rem 2rem', textAlign: 'center', color: '#a1a1aa', fontSize: '0.95rem' }}>No notifications found matching filters.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#151314', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#ffffff' }}>
                <th style={{ padding: '1.25rem', width: '48px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={initialNotifications.length > 0 && initialNotifications.every((e) => selectedIds.includes(e.id))}
                    onChange={() => {
                      const allSelected = initialNotifications.every((e) => selectedIds.includes(e.id));
                      if (allSelected) {
                        setSelectedIds((prev) => prev.filter((id) => !initialNotifications.some((e) => e.id === id)));
                      } else {
                        const newIds = initialNotifications.map((e) => e.id);
                        setSelectedIds((prev) => Array.from(new Set([...prev, ...newIds])));
                      }
                    }}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                </th>
                <th style={{ padding: '1.25rem 1rem', fontWeight: '600' }}>Phone & Template</th>
                <th style={{ padding: '1.25rem 1rem', fontWeight: '600' }}>Status</th>
                <th style={{ padding: '1.25rem 1rem', fontWeight: '600' }}>Priority</th>
                <th style={{ padding: '1.25rem 1rem', fontWeight: '600' }}>Attempts</th>
                <th style={{ padding: '1.25rem 1rem', fontWeight: '600' }}>Errors / Provider ID</th>
                <th style={{ padding: '1.25rem', fontWeight: '600', textAlign: 'right' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {initialNotifications.map((notif) => {
                const isSent = notif.status === 'sent' || notif.status === 'delivered' || notif.status === 'read';
                const isFailed = notif.status === 'failed' || notif.status === 'dead-letter';
                const isProgress = notif.status === 'locked' || notif.status === 'sending' || notif.status === 'queued';

                let badgeColor = '#a1a1aa';
                let bgBadge = 'rgba(255, 255, 255, 0.05)';
                let borderBadge = 'rgba(255, 255, 255, 0.1)';

                if (isSent) {
                  badgeColor = '#25D366';
                  bgBadge = 'rgba(37, 211, 102, 0.1)';
                  borderBadge = 'rgba(37, 211, 102, 0.3)';
                } else if (isFailed) {
                  badgeColor = '#EF4444';
                  bgBadge = 'rgba(239, 68, 68, 0.1)';
                  borderBadge = 'rgba(239, 68, 68, 0.3)';
                } else if (isProgress) {
                  badgeColor = '#3B82F6';
                  bgBadge = 'rgba(59, 130, 246, 0.1)';
                  borderBadge = 'rgba(59, 130, 246, 0.3)';
                }

                return (
                  <tr key={notif.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '1.15rem 1.25rem', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(notif.id)}
                        onChange={() => {
                          setSelectedIds((prev) =>
                            prev.includes(notif.id) ? prev.filter((id) => id !== notif.id) : [...prev, notif.id]
                          );
                        }}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </td>
                    <td style={{ padding: '1.15rem 1rem' }}>
                      <Link
                        href={`/admin/collections/notifications/${notif.id}`}
                        style={{ fontWeight: '700', color: '#ffffff', textDecoration: 'none' }}
                      >
                        {notif.phone}
                      </Link>
                      <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginTop: '0.25rem' }}>{notif.template}</div>
                    </td>
                    <td style={{ padding: '1.15rem 1rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '9999px',
                          backgroundColor: bgBadge,
                          color: badgeColor,
                          border: '1px solid',
                          borderColor: borderBadge,
                        }}
                      >
                        {notif.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '1.15rem 1rem', fontWeight: '600', color: '#ffffff' }}>{notif.priority}</td>
                    <td style={{ padding: '1.15rem 1rem', color: '#ffffff' }}>
                      {notif.attempts} / {notif.maxAttempts}
                    </td>
                    <td style={{ padding: '1.15rem 1rem', fontSize: '0.8rem', color: '#d4d4d8', maxWidth: '320px' }}>
                      {notif.lastError ? (
                        <span style={{ color: '#EF4444' }}>⚠️ {notif.lastError}</span>
                      ) : notif.providerMessageId ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <code style={{ fontFamily: 'monospace', color: '#a1a1aa' }}>{notif.providerMessageId}</code>
                          {notif.sendDurationMs && <span style={{ fontSize: '0.7rem', color: '#71717a' }}>Duration: {notif.sendDurationMs}ms</span>}
                        </div>
                      ) : (
                        <span style={{ color: '#71717a' }}>-</span>
                      )}
                      {notif.status === 'retry-scheduled' && notif.nextAttemptAt && (
                        <div style={{ color: '#F59E0B', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          Retry at: {new Date(notif.nextAttemptAt).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1.15rem 1.25rem', textAlign: 'right', color: '#a1a1aa' }}>
                      {new Date(notif.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <AdminPagination
          currentPage={currentPage}
          totalPages={totalPages}
          isPending={isPending}
          onPageChange={handlePageChange}
        />
      </div>
      {/* Total matches count banner */}
      <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.825rem', color: '#71717a' }}>
        Showing {initialNotifications.length} notifications of {totalDocs.toLocaleString()} matches.
      </div>
    </div>
  );
}
