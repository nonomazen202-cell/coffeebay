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
    <div style={{ padding: '2rem 1.5rem', minHeight: '100vh', backgroundColor: '#231F20' }}>
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
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#2BA8E0' }}>📊</span> Campaign Serial Codes / أكواد الحملة
          </h1>
          <p style={{ color: '#d4d4d8', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            View and manage campaign serial codes, track scan claims, and import new serial data sets.
          </p>
        </div>
        
        {/* CSV Import/Export Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <Link
            href="/admin/collections/codes/create"
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: '1.25rem', 
          marginBottom: '2rem' 
        }}
      >
        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seeded Codes</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#ffffff', marginTop: '0.5rem' }}>{totalCodes.toLocaleString()}</span>
        </div>
        
        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderLeft: '4px solid #2BA8E0', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Claimed (Scanned)</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#2BA8E0', marginTop: '0.5rem', textShadow: '0 0 10px rgba(43, 168, 224, 0.2)' }}>{claimedCount.toLocaleString()}</span>
        </div>

        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderLeft: '4px solid #7B3B1B', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Losing Cups / الأكواب الخاسرة</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#ffffff', marginTop: '0.5rem', textShadow: '0 0 10px rgba(123, 59, 27, 0.25)' }}>{losingCount.toLocaleString()}</span>
        </div>

        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Winning Tickets</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#2BA8E0', marginTop: '0.5rem', textShadow: '0 0 10px rgba(43, 168, 224, 0.2)' }}>{winnersCount.toLocaleString()}</span>
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
          background: '#1b1819',
          padding: '1rem',
          borderRadius: '0.75rem',
          border: '1px solid rgba(255, 255, 255, 0.08)'
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
              backgroundColor: '#151314',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '0.5rem',
              padding: '0.625rem 1rem 0.625rem 2.5rem',
              color: '#ffffff',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'all 0.2s',
              opacity: isPending ? 0.7 : 1,
              cursor: isPending ? 'not-allowed' : 'text'
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

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  border: '1px solid',
                  borderColor: isSelected ? '#2BA8E0' : 'rgba(255, 255, 255, 0.1)',
                  backgroundColor: isSelected ? 'rgba(43, 168, 224, 0.15)' : 'rgba(0, 0, 0, 0.2)',
                  color: isSelected ? '#2BA8E0' : '#d4d4d8',
                  cursor: isLoading ? 'wait' : isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled && !isSelected ? 0.5 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
                  boxShadow: isSelected ? '0 0 10px rgba(43, 168, 224, 0.2)' : 'none',
                }}
              >
                {isLoading && (
                  <svg 
                    style={{ 
                      width: '12px', 
                      height: '12px', 
                      animation: 'codes-manager-spin 1s linear infinite',
                      color: '#2BA8E0'
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
            padding: '1rem',
            backgroundColor: 'rgba(123, 59, 27, 0.25)',
            color: '#ffffff',
            borderRadius: '0.5rem',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
            border: '1px solid #7B3B1B',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7B3B1B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
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
            Selected {selectedIds.length} code/codes • تم تحديد {selectedIds.length} كود
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setIsBulkEditOpen(true)}
              type="button"
              style={{
                padding: '0.5rem 1.25rem',
                backgroundColor: '#1b1819',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '0.375rem',
                fontWeight: '800',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1b1819'}
            >
              Edit Selected / تعديل المحدد
            </button>
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
        </div>
      )}

      {/* Main Codes Table */}
      {filteredCodes.length === 0 ? (
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
          No serial codes found matching search query/filters.
        </div>
      ) : (
        <div 
          style={{ 
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '0.75rem',
            backgroundColor: '#1b1819',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
            opacity: isPending ? 0.7 : 1,
            transition: 'opacity 0.2s ease'
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#151314', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#ffffff' }}>
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
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                </th>
                <th style={{ padding: '1.15rem 1.25rem', fontWeight: '600' }}>Serial Code</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '600' }}>Type / Winning Status</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '600' }}>Associated Prize</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '600' }}>Usage Status</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '600', textAlign: 'right' }}>Scanned At</th>
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
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </td>
                    {/* Serial Code */}
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <Link 
                        href={`/admin/collections/codes/${code.id}`}
                        style={{ 
                          fontFamily: 'monospace', 
                          fontWeight: '700', 
                          color: '#ffffff',
                          fontSize: '0.95rem',
                          textDecoration: 'none'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#2BA8E0'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#ffffff'}
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
                            padding: '0.25rem 0.5rem', 
                            borderRadius: '4px',
                            backgroundColor: 'rgba(43, 168, 224, 0.15)',
                            border: '1px solid rgba(43, 168, 224, 0.35)',
                            color: '#2BA8E0'
                          }}
                        >
                          ★ WINNER TICKET
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Standard Cup</span>
                      )}
                    </td>

                    {/* Associated Prize */}
                    <td style={{ padding: '1rem 1rem', fontWeight: '600', color: code.isWinner ? '#2BA8E0' : '#ffffff' }}>
                      {prizeName}
                    </td>

                    {/* Usage Status */}
                    <td style={{ padding: '1rem 1rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '9999px',
                          backgroundColor: code.claimed ? 'rgba(123, 59, 27, 0.35)' : 'rgba(43, 168, 224, 0.1)',
                          color: code.claimed ? '#7B3B1B' : '#2BA8E0',
                          border: '1px solid',
                          borderColor: code.claimed ? '#7B3B1B' : 'rgba(43, 168, 224, 0.3)'
                        }}
                      >
                        {code.claimed ? 'Claimed' : 'Available'}
                      </span>
                    </td>

                    {/* Scanned At */}
                    <td style={{ padding: '1rem 1rem', textAlign: 'right', color: '#a1a1aa', fontSize: '0.8rem' }}>
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
      <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.825rem', color: '#71717a' }}>
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
