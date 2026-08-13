'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { AdminPagination } from '../AdminPagination';
import { bulkDeleteAction } from './actions';

interface Claim {
  id: string | number;
  verificationCode: string;
  status: 'PENDING' | 'DELIVERED' | 'CANCELLED';
  verified: boolean;
  verifiedAt?: string | null;
  createdAt: string;
  participantName: string;
  participantPhone: string;
  prizeName: string;
}

interface ClaimsManagerProps {
  initialClaims: Claim[];
  currentPage: number;
  totalPages: number;
  totalDocs: number;
  stats: {
    total: number;
    pending: number;
    delivered: number;
  };
  initialSearch: string;
  initialStatus: string;
}

export function ClaimsManager({
  initialClaims,
  currentPage,
  totalPages,
  totalDocs,
  stats,
  initialSearch,
  initialStatus,
}: ClaimsManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [claims, setClaims] = useState<Claim[]>(initialClaims);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [loadingId, setLoadingId] = useState<string | number | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [deleting, setDeleting] = useState(false);

  // Sync state when initialClaims changes (after a page/filter navigation)
  useEffect(() => {
    setClaims(initialClaims);
  }, [initialClaims]);

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

  // Sync Status immediately
  const handleStatusFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    updateUrlParams(1, search, newStatus);
  };

  const handlePageChange = (newPage: number) => {
    updateUrlParams(newPage, search, statusFilter);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected claims?\nهل أنت متأكد من حذف المطالبات المحددة؟`)) {
      return;
    }

    setDeleting(true);
    try {
      const res = await bulkDeleteAction('prize-claims', selectedIds);
      if (res.success) {
        setSelectedIds([]);
        router.refresh();
      } else {
        setAlert({ type: 'error', message: res.error || 'Failed to delete claims.' });
      }
    } catch (err) {
      console.error(err);
      setAlert({ type: 'error', message: 'An error occurred during deletion.' });
    } finally {
      setDeleting(false);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  // Direct Inline Verification/Delivery handler
  const handleDeliverClaim = async (claimId: string | number, verificationCode: string) => {
    setLoadingId(claimId);
    setAlert(null);

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationCode }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setAlert({ type: 'success', message: `Successfully verified & delivered "${data.claim?.prizeName || 'Prize'}" to ${data.claim?.participantName || 'Winner'}!` });
        // Update local state row immediately
        setClaims(prev => prev.map(c => c.id === claimId ? { ...c, status: 'DELIVERED', verified: true, verifiedAt: new Date().toISOString() } : c));
        router.refresh();
      } else {
        setAlert({ type: 'error', message: data.errors?.join('\n') || 'Verification failed.' });
      }
    } catch (err) {
      console.error(err);
      setAlert({ type: 'error', message: 'A network error occurred during verification.' });
    } finally {
      setLoadingId(null);
    }
  };

  // Export CSV handler
  const handleExport = () => {
    window.location.href = `/api/export/prize-claims`;
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
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#2BA8E0' }}>🎫</span> Claims Manager / إدارة استلام الجوائز
          </h1>
          <p style={{ color: '#d4d4d8', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Verify client coupons, deliver physical coffee gifts, and review participant information.
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link 
            href="/admin/collections/prize-claims/create"
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#7B3B1B',
              color: '#ffffff',
              fontWeight: '800',
              fontSize: '0.875rem',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              border: '1px solid #7B3B1B',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 15px rgba(123, 59, 27, 0.3)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#9c4c24';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#7B3B1B';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            + Add Claim / إضافة طلب
          </Link>

          <button 
            onClick={handleExport}
            type="button"
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#1b1819',
              color: '#ffffff',
              fontWeight: '800',
              fontSize: '0.875rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1b1819';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export Claims CSV / تصدير البيانات
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alert && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: alert.type === 'success' ? 'rgba(43, 168, 224, 0.15)' : 'rgba(123, 59, 27, 0.25)',
            color: '#ffffff',
            borderRadius: '0.5rem',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
            border: '1px solid',
            borderColor: alert.type === 'success' ? '#2BA8E0' : '#7B3B1B',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}
        >
          {alert.type === 'success' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2BA8E0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7B3B1B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
            </svg>
          )}
          <span style={{ fontWeight: '600' }}>{alert.message}</span>
        </div>
      )}

      {/* KPI Stats Panel */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1.25rem', 
          marginBottom: '2rem' 
        }}
      >
        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Claim Submissions</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#ffffff', marginTop: '0.5rem' }}>{stats.total.toLocaleString()}</span>
        </div>
        
        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderLeft: '4px solid #7B3B1B', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Deliveries</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#ffffff', marginTop: '0.5rem', textShadow: '0 0 10px rgba(123, 59, 27, 0.25)' }}>{stats.pending.toLocaleString()}</span>
        </div>

        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderLeft: '4px solid #2BA8E0', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Delivered Prizes</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#2BA8E0', marginTop: '0.5rem', textShadow: '0 0 10px rgba(43, 168, 224, 0.2)' }}>{stats.delivered.toLocaleString()}</span>
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
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)'
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1', minWidth: '280px' }}>
          <input
            type="text"
            placeholder="Search winner name, phone, email, coupon..."
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
              transition: 'all 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#2BA8E0'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
          />
          <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa', display: 'flex', alignItems: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
          </span>
        </div>

        {/* Tab Filters */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['ALL', 'PENDING', 'DELIVERED', 'CANCELLED'] as const).map((tab) => {
            const isSelected = statusFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => handleStatusFilterChange(tab)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  border: '1px solid',
                  borderColor: isSelected ? '#2BA8E0' : 'rgba(255, 255, 255, 0.1)',
                  backgroundColor: isSelected ? 'rgba(43, 168, 224, 0.15)' : 'rgba(0, 0, 0, 0.2)',
                  color: isSelected ? '#2BA8E0' : '#d4d4d8',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk Delete Bar */}
      {selectedIds.length > 0 && (
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            background: 'rgba(123, 59, 27, 0.15)', 
            border: '1px solid #7B3B1B', 
            padding: '0.85rem 1.25rem', 
            borderRadius: '0.75rem',
            marginBottom: '1rem',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <span style={{ color: '#ffffff', fontSize: '0.85rem', fontWeight: '600' }}>
            Selected {selectedIds.length} claim/claims • تم تحديد {selectedIds.length} طلب استلام
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={deleting}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: '#7B3B1B',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.375rem',
              fontWeight: '800',
              fontSize: '0.8rem',
              cursor: deleting ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!deleting) e.currentTarget.style.backgroundColor = '#9c4c24';
            }}
            onMouseLeave={(e) => {
              if (!deleting) e.currentTarget.style.backgroundColor = '#7B3B1B';
            }}
          >
            {deleting ? 'Deleting...' : 'Delete Selected / حذف المحدد'}
          </button>
        </div>
      )}

      {/* Main Table Container */}
      {claims.length === 0 ? (
        <div 
          style={{ 
            padding: '5rem 2rem', 
            textAlign: 'center', 
            color: '#a1a1aa', 
            fontSize: '0.95rem',
            border: '1px dashed rgba(255, 255, 255, 0.1)', 
            borderRadius: '0.75rem',
            background: '#1b1819'
          }}
        >
          No registered prize claims found matching the search/filters.
        </div>
      ) : (
        <div 
          style={{ 
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '0.75rem',
            backgroundColor: '#1b1819',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)'
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#151314', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#ffffff' }}>
                <th style={{ padding: '1.25rem 1rem', width: '48px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={claims.length > 0 && claims.every(c => selectedIds.includes(c.id))}
                    onChange={() => {
                      const allSelected = claims.every(c => selectedIds.includes(c.id));
                      if (allSelected) {
                        setSelectedIds(prev => prev.filter(id => !claims.some(c => c.id === id)));
                      } else {
                        const newIds = claims.map(c => c.id);
                        setSelectedIds(prev => Array.from(new Set([...prev, ...newIds])));
                      }
                    }}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                </th>
                <th style={{ padding: '1.25rem 1rem', fontWeight: '600' }}>Winner Info</th>
                <th style={{ padding: '1.25rem 1rem', fontWeight: '600' }}>Verification Code</th>
                <th style={{ padding: '1.25rem 1rem', fontWeight: '600' }}>Prize Item</th>
                <th style={{ padding: '1.25rem 1rem', fontWeight: '600' }}>Status</th>
                <th style={{ padding: '1.25rem 1rem', fontWeight: '600', textAlign: 'center' }}>Delivery Action</th>
                <th style={{ padding: '1.25rem 1rem', fontWeight: '600', textAlign: 'right' }}>Claimed Date</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => {
                const isClaimPending = claim.status === 'PENDING';
                const isLoading = loadingId === claim.id;

                return (
                  <tr 
                    key={claim.id}
                    style={{ 
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {/* Checkbox Column */}
                    <td style={{ padding: '1.15rem 1rem', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(claim.id)}
                        onChange={() => {
                          setSelectedIds(prev => 
                            prev.includes(claim.id) 
                              ? prev.filter(id => id !== claim.id) 
                              : [...prev, claim.id]
                          );
                        }}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </td>
                    {/* Winner details column */}
                    <td style={{ padding: '1.15rem 1rem' }}>
                      <Link
                        href={`/admin/collections/prize-claims/${claim.id}`}
                        style={{ 
                          fontWeight: '700', 
                          color: '#ffffff', 
                          fontSize: '0.95rem',
                          textDecoration: 'none'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#2BA8E0'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#ffffff'}
                      >
                        {claim.participantName}
                      </Link>
                      <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {claim.participantPhone && (
                          <span style={{ fontSize: '0.8rem', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
                            {claim.participantPhone}
                          </span>
                        )}

                      </div>
                    </td>

                    {/* Verification Code */}
                    <td style={{ padding: '1.15rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <code
                          style={{
                            backgroundColor: '#151314',
                            padding: '0.3rem 0.625rem',
                            borderRadius: '0.25rem',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: '#e4e4e7',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            fontWeight: '600'
                          }}
                        >
                          {claim.verificationCode}
                        </code>
                        <button
                          onClick={() => handleCopy(claim.verificationCode)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: copiedCode === claim.verificationCode ? '#2BA8E0' : '#a1a1aa',
                            cursor: 'pointer',
                            padding: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '0.25rem',
                            transition: 'all 0.15s'
                          }}
                        >
                          {copiedCode === claim.verificationCode ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Prize Item */}
                    <td style={{ padding: '1.15rem 1rem', color: '#2BA8E0', fontWeight: '700', fontSize: '0.95rem' }}>
                      {claim.prizeName}
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '1.15rem 1rem' }}>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: '800',
                          padding: '0.25rem 0.625rem',
                          borderRadius: '9999px',
                          backgroundColor:
                            claim.status === 'DELIVERED'
                              ? 'rgba(43, 168, 224, 0.15)'
                              : claim.status === 'CANCELLED'
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'rgba(123, 59, 27, 0.4)',
                          color:
                            claim.status === 'DELIVERED'
                              ? '#2BA8E0'
                              : claim.status === 'CANCELLED'
                              ? '#71717a'
                              : '#ffffff',
                          border: '1px solid',
                          borderColor:
                            claim.status === 'DELIVERED'
                              ? 'rgba(43, 168, 224, 0.35)'
                              : claim.status === 'CANCELLED'
                              ? 'rgba(255, 255, 255, 0.1)'
                              : '#7B3B1B'
                        }}
                      >
                        {claim.status}
                      </span>
                    </td>

                    {/* Tablet Cashier Action: Deliver inline */}
                    <td style={{ padding: '1.15rem 1rem', textAlign: 'center' }}>
                      {isClaimPending ? (
                        <button
                          onClick={() => handleDeliverClaim(claim.id, claim.verificationCode)}
                          disabled={isLoading}
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: '#7B3B1B',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '0.375rem',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            boxShadow: '0 2px 8px rgba(123, 59, 27, 0.2)',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (!isLoading) e.currentTarget.style.backgroundColor = '#9c4c24';
                          }}
                          onMouseLeave={(e) => {
                            if (!isLoading) e.currentTarget.style.backgroundColor = '#7B3B1B';
                          }}
                        >
                          {isLoading ? 'Processing...' : 'Verify & Hand Over / تسليم الجائزة'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.825rem', color: '#a1a1aa', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2BA8E0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Handed Over / تم التسليم
                        </span>
                      )}
                    </td>

                    {/* Claimed Date */}
                    <td style={{ padding: '1.15rem 1rem', textAlign: 'right', color: '#a1a1aa', fontSize: '0.8rem' }}>
                      <div>{new Date(claim.createdAt).toLocaleString()}</div>
                      {claim.status === 'DELIVERED' && claim.verifiedAt && (
                        <div style={{ color: '#2BA8E0', marginTop: '0.35rem', fontSize: '0.75rem', fontWeight: '600' }}>
                          Delivered: {new Date(claim.verifiedAt).toLocaleString()}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            isPending={isPending}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* Total claims count banner */}
      <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.825rem', color: '#71717a' }}>
        Showing {claims.length} claims of {totalDocs.toLocaleString()} matches.
      </div>
    </div>
  );
}
