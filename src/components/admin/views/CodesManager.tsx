'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ImportButton } from '../ImportButton';
import { ExportButton } from '../ExportButton';
import { AdminPagination } from '../AdminPagination';
import { bulkDeleteAction } from './actions';
import { BulkEditManager } from './bulk-edit/components/BulkEditManager';

interface Prize {
  id: string | number;
  name: string;
}

interface SerialCode {
  id: string | number;
  serialCode: string;
  isWinner: boolean;
  prizeId?: string | Prize | null;
  claimed: boolean;
  claimedAt?: string | null;
  createdAt: string;
}

interface CodesManagerProps {
  initialCodes: SerialCode[];
  currentPage: number;
  totalPages: number;
  totalDocs: number;
  totalCount: number;
  claimedCodesCount: number;
  losingCodesCount: number;
  winningCodesCount: number;
  initialSearch?: string;
  initialFilter?: 'ALL' | 'CLAIMED' | 'REMAINING' | 'WINNERS';
}

export function CodesManager({
  initialCodes,
  currentPage,
  totalPages,
  totalDocs,
  totalCount,
  claimedCodesCount,
  losingCodesCount,
  winningCodesCount,
  initialSearch = '',
  initialFilter = 'ALL',
}: CodesManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [codes, setCodes] = useState<SerialCode[]>(initialCodes);
  const [search, setSearch] = useState(initialSearch);
  const [filter, setFilter] = useState<'ALL' | 'CLAIMED' | 'REMAINING' | 'WINNERS'>(initialFilter);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);

  const [pendingFilter, setPendingFilter] = useState<'ALL' | 'CLAIMED' | 'REMAINING' | 'WINNERS' | null>(null);
  const [pendingPage, setPendingPage] = useState<number | null>(null);

  // Sync state with incoming props on server updates / browser navigation
  useEffect(() => {
    setCodes(initialCodes);
  }, [initialCodes]);

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  // Reset tracking states once server transitions finish
  useEffect(() => {
    if (!isPending) {
      setPendingFilter(null);
      setPendingPage(null);
    }
  }, [isPending]);

  const updateUrlParams = useCallback((page: number, searchVal: string, filterVal: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    
    if (searchVal) {
      params.set('search', searchVal);
    } else {
      params.delete('search');
    }

    if (filterVal && filterVal !== 'ALL') {
      params.set('filter', filterVal);
    } else {
      params.delete('filter');
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }, [pathname, router, searchParams]);

  // Sync Search state to URL on 400ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== initialSearch) {
        updateUrlParams(1, search, filter);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search, initialSearch, filter, updateUrlParams]);

  const handlePageChange = (newPage: number) => {
    if (newPage === currentPage || isPending) return;
    setPendingPage(newPage);
    updateUrlParams(newPage, search, filter);
  };

  const handleFilterChange = (newFilter: 'ALL' | 'CLAIMED' | 'REMAINING' | 'WINNERS') => {
    if (newFilter === filter || isPending) return;
    setPendingFilter(newFilter);
    setFilter(newFilter);
    updateUrlParams(1, search, newFilter);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected codes?\nهل أنت متأكد من حذف الأكواد المحددة؟`)) {
      return;
    }

    setDeleting(true);
    setErrorMsg(null);
    try {
      const res = await bulkDeleteAction('codes', selectedIds);
      if (res.success) {
        setSelectedIds([]);
        router.refresh();
      } else {
        setErrorMsg(res.error || 'Failed to delete codes.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('An error occurred during deletion.');
    } finally {
      setDeleting(false);
    }
  };

  // Since search and filter are performed on the server-side,
  // filteredCodes is bound to the state-controlled codes array!
  const filteredCodes = codes;

  const bulkEditFields = [
    { name: 'is_winner', label: 'Is Winner / هل هو كود فائز؟', type: 'checkbox' as const },
    { name: 'claimed', label: 'Claimed / هل تم استخدامه؟', type: 'checkbox' as const },
    { name: 'prize_id', label: 'Assigned Prize / الجائزة المحددة', type: 'relationship' as const, relationTo: 'prizes' },
  ];

  const handleBulkEditSuccess = (updatedFields: Record<string, unknown>) => {
    setCodes((prev) =>
      prev.map((c) => {
        if (selectedIds.includes(c.id)) {
          const updatedCode = { ...c };
          if ('is_winner' in updatedFields) {
            updatedCode.isWinner = Boolean(updatedFields.is_winner);
          }
          if ('claimed' in updatedFields) {
            updatedCode.claimed = Boolean(updatedFields.claimed);
            if (updatedFields.claimed) {
              updatedCode.claimedAt = new Date().toISOString();
            } else {
              updatedCode.claimedAt = null;
            }
          }
          if ('prize_id' in updatedFields) {
            updatedCode.prizeId = updatedFields.prize_id
              ? { id: updatedFields.prize_id as string | number, name: 'Updating...' }
              : null;
          }
          return updatedCode;
        }
        return c;
      })
    );
    setSelectedIds([]);
    setIsBulkEditOpen(false);
    
    // Trigger Server Component re-sync in the background
    startTransition(() => {
      router.refresh();
    });
  };

  // Use server-side counts
  const totalCodes = totalCount;
  const claimedCount = claimedCodesCount;
  const losingCount = losingCodesCount;
  const winnersCount = winningCodesCount;

  return (
    <div style={{ padding: '2rem 1.75rem', minHeight: '100vh', backgroundColor: '#F4F6FB' }}>
      <style>{`
        @keyframes codes-manager-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      
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
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#150958', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ color: '#150958', display: 'inline-flex', alignItems: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                <path d="m3.3 7 8.7 5 8.7-5" />
                <path d="M12 22V12" />
              </svg>
            </span>
            Campaign Serial Codes / أكواد الحملة
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.9rem', margin: '0.35rem 0 0 0' }}>
            View and manage campaign serial codes, track scan claims, and import new serial data sets.
          </p>
        </div>
        
        {/* CSV Import/Export Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <Link
            href="/admin/collections/codes/create"
            style={{
              padding: '0.65rem 1.4rem',
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
              marginBottom: '1rem',
              marginRight: '0.25rem',
              boxShadow: '0 4px 12px rgba(21, 9, 88, 0.16)',
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
            + Add Code / إضافة كود
          </Link>
          <ImportButton />
          <ExportButton collectionSlug="codes" />
        </div>
      </div>

      {/* KPI Stats */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', 
          gap: '1.25rem', 
          marginBottom: '2rem' 
        }}
      >
        <div className="cb-wave-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '1rem', padding: '1.35rem 1.5rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(21, 9, 88, 0.05)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#150958', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Seeded Codes</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#150958', marginTop: '0.35rem' }}>{totalCodes.toLocaleString()}</span>
        </div>
        
        <div className="cb-wave-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '4px solid #150958', borderRadius: '1rem', padding: '1.35rem 1.5rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(21, 9, 88, 0.05)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#150958', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Claimed (Scanned)</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#150958', marginTop: '0.35rem' }}>{claimedCount.toLocaleString()}</span>
        </div>

        <div className="cb-wave-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '4px solid #94A3B8', borderRadius: '1rem', padding: '1.35rem 1.5rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(21, 9, 88, 0.05)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Losing Cups / الأكواب الخاسرة</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#150958', marginTop: '0.35rem' }}>{losingCount.toLocaleString()}</span>
        </div>

        <div className="cb-wave-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '4px solid #150958', borderRadius: '1rem', padding: '1.35rem 1.5rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(21, 9, 88, 0.05)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#150958', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Winning Tickets</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#150958', marginTop: '0.35rem' }}>{winnersCount.toLocaleString()}</span>
        </div>
      </div>

      {/* Control Panel (Search & Tabs) */}
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
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '280px' }}>
          <input
            type="text"
            placeholder="Search serial codes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={isPending}
            style={{
              width: '100%',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '9999px',
              padding: '0.7rem 1.25rem 0.7rem 2.65rem',
              color: '#1E293B',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'all 0.2s',
              opacity: isPending ? 0.7 : 1,
              cursor: isPending ? 'not-allowed' : 'text'
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

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {(['ALL', 'CLAIMED', 'REMAINING', 'WINNERS'] as const).map((tab) => {
            const isSelected = filter === tab;
            const isLoading = isPending && pendingFilter === tab;
            const isDisabled = isPending;
            const label = tab === 'ALL' ? 'All Codes' : tab === 'CLAIMED' ? 'Claimed' : tab === 'REMAINING' ? 'Remaining' : 'Winners Only';
            
            return (
              <button
                key={tab}
                onClick={() => handleFilterChange(tab)}
                disabled={isDisabled}
                style={{
                  padding: '0.55rem 1.15rem',
                  borderRadius: '9999px',
                  fontSize: '0.825rem',
                  fontWeight: '700',
                  border: '1px solid',
                  borderColor: isSelected ? '#150958' : '#CBD5E1',
                  backgroundColor: isSelected ? '#150958' : '#FFFFFF',
                  color: isSelected ? '#FFFFFF' : '#150958',
                  cursor: isLoading ? 'wait' : isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled && !isSelected ? 0.5 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
                }}
              >
                {isLoading && (
                  <svg 
                    style={{ 
                      width: '12px', 
                      height: '12px', 
                      animation: 'codes-manager-spin 1s linear infinite',
                      color: isSelected ? '#FFFFFF' : '#150958'
                    }} 
                    viewBox="0 0 24 24" 
                    fill="none"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.2 }} />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: '#FEF2F2',
            color: '#B91C1C',
            borderRadius: '0.75rem',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
            border: '1px solid #FECACA',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
          </svg>
          <span style={{ fontWeight: '600', whiteSpace: 'pre-wrap' }}>{errorMsg}</span>
        </div>
      )}

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
            Selected {selectedIds.length} code/codes • تم تحديد {selectedIds.length} كود
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setIsBulkEditOpen(true)}
              type="button"
              style={{
                padding: '0.5rem 1.25rem',
                backgroundColor: '#FFFFFF',
                color: '#150958',
                border: '1px solid #CBD5E1',
                borderRadius: '9999px',
                fontWeight: '700',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
            >
              Edit Selected / تعديل المحدد
            </button>
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
        </div>
      )}

      {/* Main Codes Table */}
      {filteredCodes.length === 0 ? (
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
          No serial codes found matching search query/filters.
        </div>
      ) : (
        <div 
          style={{ 
            border: '1px solid #E2E8F0',
            borderRadius: '1rem',
            backgroundColor: '#FFFFFF',
            overflow: 'hidden',
            boxShadow: '0 6px 24px rgba(21, 9, 88, 0.06)',
            opacity: isPending ? 0.7 : 1,
            transition: 'opacity 0.2s ease'
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#150958', color: '#FFFFFF' }}>
                <th style={{ padding: '1.15rem 1.25rem', width: '48px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={filteredCodes.length > 0 && filteredCodes.every(c => selectedIds.includes(c.id))}
                    onChange={() => {
                      const allSelected = filteredCodes.every(c => selectedIds.includes(c.id));
                      if (allSelected) {
                        setSelectedIds(prev => prev.filter(id => !filteredCodes.some(c => c.id === id)));
                      } else {
                        const newIds = filteredCodes.map(c => c.id);
                        setSelectedIds(prev => Array.from(new Set([...prev, ...newIds])));
                      }
                    }}
                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#150958' }}
                  />
                </th>
                <th style={{ padding: '1.15rem 1.25rem', fontWeight: '700' }}>Serial Code</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700' }}>Type / Winning Status</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700' }}>Associated Prize</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700' }}>Usage Status</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700', textAlign: 'right' }}>Scanned At</th>
              </tr>
            </thead>
            <tbody>
              {filteredCodes.map((code) => {
                const prizeName = typeof code.prizeId === 'object' && code.prizeId !== null 
                  ? code.prizeId.name 
                  : '-';

                return (
                  <tr 
                    key={code.id}
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
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(code.id)}
                        onChange={() => {
                          setSelectedIds(prev => 
                            prev.includes(code.id) 
                              ? prev.filter(id => id !== code.id) 
                              : [...prev, code.id]
                          );
                        }}
                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#150958' }}
                      />
                    </td>
                    {/* Serial Code */}
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <Link 
                        href={`/admin/collections/codes/${code.id}`}
                        style={{ 
                          fontFamily: 'monospace', 
                          fontWeight: '700', 
                          color: '#150958',
                          backgroundColor: '#EEF2FF',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '0.375rem',
                          border: '1px solid #C7D2FE',
                          fontSize: '0.9rem',
                          textDecoration: 'none'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E0E7FF'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EEF2FF'}
                      >
                        {code.serialCode}
                      </Link>
                    </td>

                    {/* Winning Status */}
                    <td style={{ padding: '1rem 1rem' }}>
                      {code.isWinner ? (
                        <span 
                          style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: '800', 
                            padding: '0.25rem 0.65rem', 
                            borderRadius: '9999px',
                            backgroundColor: '#EEF2FF',
                            border: '1px solid #C7D2FE',
                            color: '#150958'
                          }}
                        >
                          ★ WINNER TICKET
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.825rem', color: '#64748B', fontWeight: '500' }}>Standard Cup</span>
                      )}
                    </td>

                    {/* Associated Prize */}
                    <td style={{ padding: '1rem 1rem', fontWeight: '700', color: code.isWinner ? '#150958' : '#64748B' }}>
                      {prizeName}
                    </td>

                    {/* Usage Status */}
                    <td style={{ padding: '1rem 1rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '9999px',
                          backgroundColor: code.claimed ? '#FEF3C7' : '#DCFCE7',
                          color: code.claimed ? '#92400E' : '#15803D',
                          border: '1px solid',
                          borderColor: code.claimed ? '#FDE68A' : '#BBF7D0'
                        }}
                      >
                        {code.claimed ? 'Claimed' : 'Available'}
                      </span>
                    </td>

                    {/* Scanned At */}
                    <td style={{ padding: '1rem 1rem', textAlign: 'right', color: '#64748B', fontSize: '0.8rem' }}>
                      {code.claimedAt ? new Date(code.claimedAt).toLocaleString() : '-'}
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
            pendingPage={pendingPage}
          />
        </div>
      )}
      
      {/* Total codes count banner */}
      <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.825rem', color: '#64748B' }}>
        Showing {initialCodes.length} codes of {totalDocs.toLocaleString()} matches.
      </div>

      {/* Reusable Generic Bulk Edit Modal */}
      {isBulkEditOpen && (
        <BulkEditManager
          collectionSlug="codes"
          selectedIds={selectedIds}
          selectedDocs={codes.filter((c) => selectedIds.includes(c.id)) as unknown as Record<string, unknown>[]}
          fields={bulkEditFields}
          onSuccess={handleBulkEditSuccess}
          onClose={() => setIsBulkEditOpen(false)}
        />
      )}
    </div>
  );
}
