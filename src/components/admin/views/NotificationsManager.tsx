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
    <div style={{ padding: '2rem 1.75rem', minHeight: '100vh', backgroundColor: '#F4F6FB' }}>
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
          borderBottom: '1px solid #E2E8F0',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: '800',
              color: '#150958',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
            }}
          >
            <span style={{ color: '#150958', display: 'inline-flex', alignItems: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            WhatsApp Notification Queue / طابور إشعارات الواتساب
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.9rem', margin: '0.35rem 0 0 0' }}>
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
        <div className="cb-wave-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '1rem', padding: '1.25rem 1.4rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(21, 9, 88, 0.05)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#150958', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Logs</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#150958', marginTop: '0.35rem' }}>{stats.total.toLocaleString()}</span>
        </div>

        <div className="cb-wave-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '4px solid #15803D', borderRadius: '1rem', padding: '1.25rem 1.4rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(21, 9, 88, 0.05)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#150958', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sent Successfully</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#150958', marginTop: '0.35rem' }}>{stats.sent.toLocaleString()}</span>
        </div>

        <div className="cb-wave-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '4px solid #150958', borderRadius: '1rem', padding: '1.25rem 1.4rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(21, 9, 88, 0.05)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#150958', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Queued</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#150958', marginTop: '0.35rem' }}>{stats.queued.toLocaleString()}</span>
        </div>

        <div className="cb-wave-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '4px solid #D97706', borderRadius: '1rem', padding: '1.25rem 1.4rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(21, 9, 88, 0.05)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Retrying</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#150958', marginTop: '0.35rem' }}>{stats.retryScheduled.toLocaleString()}</span>
        </div>

        <div className="cb-wave-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '4px solid #DC2626', borderRadius: '1rem', padding: '1.25rem 1.4rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(21, 9, 88, 0.05)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Dead Letter (DLQ)</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#150958', marginTop: '0.35rem' }}>{stats.deadLetter.toLocaleString()}</span>
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
          background: '#FFFFFF',
          padding: '1rem 1.25rem',
          borderRadius: '1rem',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 14px rgba(21, 9, 88, 0.04)',
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
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '9999px',
              padding: '0.7rem 1.25rem 0.7rem 2.65rem',
              color: '#1E293B',
              fontSize: '0.9rem',
              outline: 'none',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#150958')}
            onBlur={(e) => (e.target.style.borderColor = '#CBD5E1')}
          />
          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748B', display: 'flex', alignItems: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
          </span>
        </div>

        {/* Tab Filters */}
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          {['ALL', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'RETRY-SCHEDULED', 'DEAD-LETTER', 'FAILED'].map((tab) => {
            const isSelected = statusFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => handleStatusFilterChange(tab)}
                style={{
                  padding: '0.55rem 1.05rem',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  border: '1px solid',
                  borderColor: isSelected ? '#150958' : '#CBD5E1',
                  backgroundColor: isSelected ? '#150958' : '#FFFFFF',
                  color: isSelected ? '#FFFFFF' : '#150958',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
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
        <div style={{ padding: '1rem 1.25rem', backgroundColor: '#FEF2F2', color: '#B91C1C', borderRadius: '0.75rem', fontSize: '0.9rem', marginBottom: '1.5rem', border: '1px solid #FECACA' }}>
          ⚠️ <span style={{ fontWeight: '600' }}>{errorMsg}</span>
        </div>
      )}

      {/* Bulk Delete Selection Bar */}
      {selectedIds.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#EEF2FF', border: '1px solid #C7D2FE', padding: '0.85rem 1.25rem', borderRadius: '0.875rem', marginBottom: '1rem' }}>
          <span style={{ color: '#150958', fontSize: '0.875rem', fontWeight: '700' }}>Selected {selectedIds.length} logs</span>
          <button onClick={handleBulkDelete} disabled={deleting} style={{ padding: '0.5rem 1.25rem', backgroundColor: '#DC2626', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '0.8rem', cursor: deleting ? 'not-allowed' : 'pointer' }}>
            {deleting ? 'Deleting...' : 'Delete Selected / حذف المحدد'}
          </button>
        </div>
      )}

      {/* Main Table Layout */}
      <div style={{ border: '1px solid #E2E8F0', borderRadius: '1rem', backgroundColor: '#FFFFFF', overflow: 'hidden', boxShadow: '0 6px 24px rgba(21, 9, 88, 0.06)', opacity: isPending ? 0.7 : 1 }}>
        {initialNotifications.length === 0 ? (
          <div style={{ padding: '5rem 2rem', textAlign: 'center', color: '#64748B', fontSize: '0.95rem' }}>No notifications found matching filters.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#150958', color: '#FFFFFF' }}>
                <th style={{ padding: '1.15rem 1.25rem', width: '48px', textAlign: 'center' }}>
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
                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#150958' }}
                  />
                </th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700' }}>Phone & Template</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700' }}>Status</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700' }}>Priority</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700' }}>Attempts</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700' }}>Errors / Provider ID</th>
                <th style={{ padding: '1.15rem 1.25rem', fontWeight: '700', textAlign: 'right' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {initialNotifications.map((notif) => {
                const isSent = notif.status === 'sent' || notif.status === 'delivered' || notif.status === 'read';
                const isFailed = notif.status === 'failed' || notif.status === 'dead-letter';
                const isProgress = notif.status === 'locked' || notif.status === 'sending' || notif.status === 'queued';

                let badgeColor = '#64748B';
                let bgBadge = '#F1F5F9';
                let borderBadge = '#E2E8F0';

                if (isSent) {
                  badgeColor = '#15803D';
                  bgBadge = '#DCFCE7';
                  borderBadge = '#BBF7D0';
                } else if (isFailed) {
                  badgeColor = '#B91C1C';
                  bgBadge = '#FEF2F2';
                  borderBadge = '#FECACA';
                } else if (isProgress) {
                  badgeColor = '#150958';
                  bgBadge = '#EEF2FF';
                  borderBadge = '#C7D2FE';
                }

                return (
                  <tr key={notif.id} style={{ borderBottom: '1px solid #EEF2F6' }}>
                    <td style={{ padding: '1.15rem 1.25rem', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(notif.id)}
                        onChange={() => {
                          setSelectedIds((prev) =>
                            prev.includes(notif.id) ? prev.filter((id) => id !== notif.id) : [...prev, notif.id]
                          );
                        }}
                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#150958' }}
                      />
                    </td>
                    <td style={{ padding: '1.15rem 1rem' }}>
                      <Link
                        href={`/admin/collections/notifications/${notif.id}`}
                        style={{ fontWeight: '700', color: '#1E293B', textDecoration: 'none' }}
                      >
                        {notif.phone}
                      </Link>
                      <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '0.25rem' }}>{notif.template}</div>
                    </td>
                    <td style={{ padding: '1.15rem 1rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          padding: '0.25rem 0.65rem',
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
                    <td style={{ padding: '1.15rem 1rem', fontWeight: '700', color: '#150958' }}>{notif.priority}</td>
                    <td style={{ padding: '1.15rem 1rem', color: '#1E293B', fontWeight: '600' }}>
                      {notif.attempts} / {notif.maxAttempts}
                    </td>
                    <td style={{ padding: '1.15rem 1rem', fontSize: '0.8rem', color: '#475569', maxWidth: '320px' }}>
                      {notif.lastError ? (
                        <span style={{ color: '#B91C1C', fontWeight: '600' }}>⚠️ {notif.lastError}</span>
                      ) : notif.providerMessageId ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <code style={{ fontFamily: 'monospace', color: '#150958', backgroundColor: '#EEF2FF', padding: '0.15rem 0.45rem', borderRadius: '0.25rem', width: 'fit-content' }}>{notif.providerMessageId}</code>
                          {notif.sendDurationMs && <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Duration: {notif.sendDurationMs}ms</span>}
                        </div>
                      ) : (
                        <span style={{ color: '#94A3B8' }}>-</span>
                      )}
                      {notif.status === 'retry-scheduled' && notif.nextAttemptAt && (
                        <div style={{ color: '#92400E', fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: '600' }}>
                          Retry at: {new Date(notif.nextAttemptAt).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1.15rem 1.25rem', textAlign: 'right', color: '#64748B', fontSize: '0.8rem' }}>
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
      <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.825rem', color: '#64748B' }}>
        Showing {initialNotifications.length} notifications of {totalDocs.toLocaleString()} matches.
      </div>
    </div>
  );
}
