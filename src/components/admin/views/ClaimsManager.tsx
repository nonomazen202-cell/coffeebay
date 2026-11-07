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
          borderBottom: '1px solid #E2E8F0'
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#150958', margin: 0, display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ color: '#150958', display: 'inline-flex', alignItems: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 12 20 22 4 22 4 12" />
                <rect width="20" height="5" x="2" y="7" rx="1" />
                <line x1="12" x2="12" y1="22" y2="7" />
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
              </svg>
            </span>
            Claims Manager / إدارة استلام الجوائز
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.9rem', margin: '0.35rem 0 0 0' }}>
            Verify client coupons, deliver physical coffee gifts, and review participant information.
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <Link 
            href="/admin/collections/prize-claims/create"
            style={{
              padding: '0.7rem 1.5rem',
              backgroundColor: '#150958',
              color: '#FFFFFF',
              fontWeight: '700',
              fontSize: '0.875rem',
              borderRadius: '9999px',
              textDecoration: 'none',
              border: '1px solid #150958',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 14px rgba(21, 9, 88, 0.18)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1E117A';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#150958';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            + Add Claim / إضافة طلب
          </Link>

          <button 
            onClick={handleExport}
            type="button"
            style={{
              padding: '0.7rem 1.5rem',
              backgroundColor: '#FFFFFF',
              color: '#150958',
              fontWeight: '700',
              fontSize: '0.875rem',
              borderRadius: '9999px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              border: '1px solid #CBD5E1',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 2px 8px rgba(21, 9, 88, 0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#EEF2FF';
              e.currentTarget.style.borderColor = '#150958';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.borderColor = '#CBD5E1';
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
            padding: '1rem 1.25rem',
            backgroundColor: alert.type === 'success' ? '#EEF2FF' : '#FEF2F2',
            color: alert.type === 'success' ? '#150958' : '#B91C1C',
            borderRadius: '0.75rem',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
            border: '1px solid',
            borderColor: alert.type === 'success' ? '#C7D2FE' : '#FECACA',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}
        >
          {alert.type === 'success' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#150958" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
          gap: '1.25rem', 
          marginBottom: '2rem' 
        }}
      >
        <div className="cb-wave-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '1rem', padding: '1.35rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(21, 9, 88, 0.05)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#EEF2FF', color: '#150958', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#150958', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Claim Submissions</span>
            <span style={{ fontSize: '2rem', fontWeight: '900', color: '#150958', marginTop: '0.2rem', lineHeight: 1.1 }}>{stats.total.toLocaleString()}</span>
          </div>
        </div>
        
        <div className="cb-wave-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '1rem', padding: '1.35rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(21, 9, 88, 0.05)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#EEF2FF', color: '#150958', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
              <path d="M15 18H9" />
              <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
              <circle cx="17" cy="18" r="2" />
              <circle cx="7" cy="18" r="2" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#150958', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending Deliveries</span>
            <span style={{ fontSize: '2rem', fontWeight: '900', color: '#150958', marginTop: '0.2rem', lineHeight: 1.1 }}>{stats.pending.toLocaleString()}</span>
          </div>
        </div>

        <div className="cb-wave-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '1rem', padding: '1.35rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(21, 9, 88, 0.05)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#EEF2FF', color: '#150958', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#150958', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Delivered Prizes</span>
            <span style={{ fontSize: '2rem', fontWeight: '900', color: '#150958', marginTop: '0.2rem', lineHeight: 1.1 }}>{stats.delivered.toLocaleString()}</span>
          </div>
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
          boxShadow: '0 4px 14px rgba(21, 9, 88, 0.04)'
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
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '9999px',
              padding: '0.7rem 1.25rem 0.7rem 2.65rem',
              color: '#1E293B',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'all 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#150958'}
            onBlur={(e) => e.target.style.borderColor = '#CBD5E1'}
          />
          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748B', display: 'flex', alignItems: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
          </span>
        </div>

        {/* Tab Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(['ALL', 'PENDING', 'DELIVERED', 'CANCELLED'] as const).map((tab) => {
            const isSelected = statusFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => handleStatusFilterChange(tab)}
                style={{
                  padding: '0.55rem 1.15rem',
                  borderRadius: '9999px',
                  fontSize: '0.825rem',
                  fontWeight: '700',
                  border: '1px solid',
                  borderColor: isSelected ? '#150958' : '#CBD5E1',
                  backgroundColor: isSelected ? '#150958' : '#FFFFFF',
                  color: isSelected ? '#FFFFFF' : '#150958',
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
            background: '#EEF2FF', 
            border: '1px solid #C7D2FE', 
            padding: '0.85rem 1.25rem', 
            borderRadius: '0.875rem',
            marginBottom: '1rem',
            boxShadow: '0 4px 12px rgba(21, 9, 88, 0.06)',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <span style={{ color: '#150958', fontSize: '0.875rem', fontWeight: '700' }}>
            Selected {selectedIds.length} claim/claims • تم تحديد {selectedIds.length} طلب استلام
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={deleting}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '9999px',
              fontWeight: '700',
              fontSize: '0.8rem',
              cursor: deleting ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!deleting) e.currentTarget.style.backgroundColor = '#B91C1C';
            }}
            onMouseLeave={(e) => {
              if (!deleting) e.currentTarget.style.backgroundColor = '#DC2626';
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
            color: '#64748B', 
            fontSize: '0.95rem',
            border: '1px dashed #CBD5E1', 
            borderRadius: '1rem',
            background: '#FFFFFF'
          }}
        >
          No registered prize claims found matching the search/filters.
        </div>
      ) : (
        <div 
          style={{ 
            border: '1px solid #E2E8F0',
            borderRadius: '1rem',
            backgroundColor: '#FFFFFF',
            overflow: 'hidden',
            boxShadow: '0 6px 24px rgba(21, 9, 88, 0.06)'
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#150958', color: '#FFFFFF' }}>
                <th style={{ padding: '1.15rem 1rem', width: '48px', textAlign: 'center' }}>
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
                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#150958' }}
                  />
                </th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700' }}>Winner Info</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700' }}>Verification Code</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700' }}>Prize Item</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700' }}>Status</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700', textAlign: 'center' }}>Delivery Action</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700', textAlign: 'right' }}>Claimed Date</th>
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
                      borderBottom: '1px solid #EEF2F6',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#F8FAFC';
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
                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#150958' }}
                      />
                    </td>
                    {/* Winner details column */}
                    <td style={{ padding: '1.15rem 1rem' }}>
                      <Link
                        href={`/admin/collections/prize-claims/${claim.id}`}
                        style={{ 
                          fontWeight: '700', 
                          color: '#1E293B', 
                          fontSize: '0.95rem',
                          textDecoration: 'none'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#150958'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#1E293B'}
                      >
                        {claim.participantName}
                      </Link>
                      <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {claim.participantPhone && (
                          <span style={{ fontSize: '0.8rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
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
                            backgroundColor: '#EEF2FF',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '0.375rem',
                            border: '1px solid #C7D2FE',
                            color: '#150958',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            fontWeight: '700'
                          }}
                        >
                          {claim.verificationCode}
                        </code>
                        <button
                          onClick={() => handleCopy(claim.verificationCode)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: copiedCode === claim.verificationCode ? '#150958' : '#64748B',
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
                    <td style={{ padding: '1.15rem 1rem', color: '#1E293B', fontWeight: '700', fontSize: '0.95rem' }}>
                      {claim.prizeName}
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '1.15rem 1rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          padding: '0.25rem 0.7rem',
                          borderRadius: '9999px',
                          backgroundColor:
                            claim.status === 'DELIVERED'
                              ? '#DCFCE7'
                              : claim.status === 'CANCELLED'
                              ? '#F1F5F9'
                              : '#FEF3C7',
                          color:
                            claim.status === 'DELIVERED'
                              ? '#15803D'
                              : claim.status === 'CANCELLED'
                              ? '#64748B'
                              : '#92400E',
                          border: '1px solid',
                          borderColor:
                            claim.status === 'DELIVERED'
                              ? '#BBF7D0'
                              : claim.status === 'CANCELLED'
                              ? '#E2E8F0'
                              : '#FDE68A'
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
                            padding: '0.55rem 1.15rem',
                            backgroundColor: '#150958',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '9999px',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            boxShadow: '0 3px 10px rgba(21, 9, 88, 0.16)',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (!isLoading) e.currentTarget.style.backgroundColor = '#1E117A';
                          }}
                          onMouseLeave={(e) => {
                            if (!isLoading) e.currentTarget.style.backgroundColor = '#150958';
                          }}
                        >
                          {isLoading ? 'Processing...' : 'Verify & Hand Over / تسليم الجائزة'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.825rem', color: '#15803D', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Handed Over / تم التسليم
                        </span>
                      )}
                    </td>

                    {/* Claimed Date */}
                    <td style={{ padding: '1.15rem 1rem', textAlign: 'right', color: '#64748B', fontSize: '0.8rem' }}>
                      <div>{new Date(claim.createdAt).toLocaleString()}</div>
                      {claim.status === 'DELIVERED' && claim.verifiedAt && (
                        <div style={{ color: '#15803D', marginTop: '0.35rem', fontSize: '0.75rem', fontWeight: '700' }}>
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
      <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.825rem', color: '#64748B' }}>
        Showing {claims.length} claims of {totalDocs.toLocaleString()} matches.
      </div>
    </div>
  );
}
