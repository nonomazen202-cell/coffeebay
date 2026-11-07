'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ExportButton } from '../ExportButton';
import { AdminPagination } from '../AdminPagination';
import { bulkDeleteAction } from './actions';

interface Participant {
  id: string | number;
  name: string;
  phone: string;
}

interface SerialCode {
  id: string | number;
  serialCode: string;
}

interface Entry {
  id: string | number;
  participant?: Participant | null;
  code?: SerialCode | null;
  result: 'WIN' | 'LOSE' | 'INVALID' | 'ALREADY_USED';
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  createdAt: string;
}

interface EntriesManagerProps {
  initialEntries: Entry[];
  currentPage: number;
  totalPages: number;
  totalDocs: number;
  stats: {
    total: number;
    win: number;
    lose: number;
    invalid: number;
    used: number;
  };
  initialSearch: string;
  initialResult: string;
}

export function EntriesManager({
  initialEntries,
  currentPage,
  totalPages,
  totalDocs,
  stats,
  initialSearch,
  initialResult,
}: EntriesManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(initialSearch);
  const [filter, setFilter] = useState(initialResult);
  const [copiedId, setCopiedId] = useState<{ id: string | number; type: 'phone' | 'requestId' } | null>(null);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [deleting, setDeleting] = useState(false);

  const updateUrlParams = useCallback((page: number, searchVal: string, filterVal: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    if (searchVal) {
      params.set('search', searchVal);
    } else {
      params.delete('search');
    }
    if (filterVal && filterVal !== 'ALL') {
      params.set('result', filterVal);
    } else {
      params.delete('result');
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

  // Sync Filter immediately
  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    updateUrlParams(1, search, newFilter);
  };

  const handlePageChange = (newPage: number) => {
    updateUrlParams(newPage, search, filter);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected entries?\nهل أنت متأكد من حذف المدخلات المحددة؟`)) {
      return;
    }

    setDeleting(true);
    try {
      const res = await bulkDeleteAction('entries', selectedIds);
      if (res.success) {
        setSelectedIds([]);
        router.refresh();
      } else {
        alert(res.error || 'Failed to delete entries.');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred during deletion.');
    } finally {
      setDeleting(false);
    }
  };

  const handleCopy = (id: string | number, text: string, type: 'phone' | 'requestId') => {
    navigator.clipboard.writeText(text);
    setCopiedId({ id, type });
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div style={{ padding: '2rem 1.75rem', minHeight: '100vh', backgroundColor: '#F4F6FB' }}>
      
      {/* Header Section */}
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
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <line x1="7" x2="17" y1="12" y2="12" />
              </svg>
            </span>
            Scan Entries / محاولات المسح والاشتراك
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.9rem', margin: '0.35rem 0 0 0' }}>
            Monitor real-time participation scans, campaign outcomes, and validation logs.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link
            href="/admin/collections/entries/create"
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
            + Add Entry / إضافة محاولة
          </Link>
          <ExportButton collectionSlug="entries" />
        </div>
      </div>

      {/* KPI Metrics */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: '1.25rem', 
          marginBottom: '2rem' 
        }}
      >
        <div className="cb-wave-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '1rem', padding: '1.25rem 1.4rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(21, 9, 88, 0.05)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#150958', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Entries</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#150958', marginTop: '0.35rem' }}>{stats.total.toLocaleString()}</span>
        </div>

        <div className="cb-wave-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '4px solid #150958', borderRadius: '1rem', padding: '1.25rem 1.4rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(21, 9, 88, 0.05)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#150958', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Wins</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#150958', marginTop: '0.35rem' }}>{stats.win.toLocaleString()}</span>
        </div>

        <div className="cb-wave-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '1rem', padding: '1.25rem 1.4rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(21, 9, 88, 0.05)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Loses</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#150958', marginTop: '0.35rem' }}>{stats.lose.toLocaleString()}</span>
        </div>

        <div className="cb-wave-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '4px solid #94A3B8', borderRadius: '1rem', padding: '1.25rem 1.4rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(21, 9, 88, 0.05)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Invalid Codes</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#150958', marginTop: '0.35rem' }}>{stats.invalid.toLocaleString()}</span>
        </div>

        <div className="cb-wave-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '4px solid #94A3B8', borderRadius: '1rem', padding: '1.25rem 1.4rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(21, 9, 88, 0.05)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Already Used</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#150958', marginTop: '0.35rem' }}>{stats.used.toLocaleString()}</span>
        </div>
      </div>

      {/* Control Panel (Search & Filtering) */}
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
            placeholder="Search entries by customer name, phone, code, request ID..."
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

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          {(['ALL', 'WIN', 'LOSE', 'INVALID', 'ALREADY_USED'] as const).map((tab) => {
            const isSelected = filter === tab;
            let label = 'All';
            if (tab === 'WIN') label = 'Wins';
            else if (tab === 'LOSE') label = 'Loses';
            else if (tab === 'INVALID') label = 'Invalid';
            else if (tab === 'ALREADY_USED') label = 'Already Used';

            return (
              <button
                key={tab}
                onClick={() => handleFilterChange(tab)}
                style={{
                  padding: '0.55rem 1.1rem',
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
                {label}
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
            Selected {selectedIds.length} entry/entries • تم تحديد {selectedIds.length} محاولة
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

      {/* Main Table */}
      {initialEntries.length === 0 ? (
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
          No scan entries found matching current criteria.
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
            transition: 'opacity 0.2s ease',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#150958', color: '#FFFFFF' }}>
                <th style={{ padding: '1.15rem 1.25rem', width: '48px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={initialEntries.length > 0 && initialEntries.every(e => selectedIds.includes(e.id))}
                    onChange={() => {
                      const allSelected = initialEntries.every(e => selectedIds.includes(e.id));
                      if (allSelected) {
                        setSelectedIds(prev => prev.filter(id => !initialEntries.some(e => e.id === id)));
                      } else {
                        const newIds = initialEntries.map(e => e.id);
                        setSelectedIds(prev => Array.from(new Set([...prev, ...newIds])));
                      }
                    }}
                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#150958' }}
                  />
                </th>
                <th style={{ padding: '1.15rem 1.25rem', fontWeight: '700' }}>Customer / Participant</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700' }}>Cup Code</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700' }}>Outcome</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700' }}>Request Log / IP</th>
                <th style={{ padding: '1.15rem 1.25rem', fontWeight: '700', textAlign: 'right' }}>Scanned At</th>
              </tr>
            </thead>
            <tbody>
              {initialEntries.map((entry) => {
                const isPhoneCopied = copiedId?.id === entry.id && copiedId?.type === 'phone';
                const isReqIdCopied = copiedId?.id === entry.id && copiedId?.type === 'requestId';

                // Format outcome labels
                let outcomeLabel = 'LOSE / خسارة';
                let outcomeStyle = {
                  backgroundColor: '#F1F5F9',
                  border: '1px solid #E2E8F0',
                  color: '#475569',
                };

                if (entry.result === 'WIN') {
                  outcomeLabel = '★ WIN / فوز';
                  outcomeStyle = {
                    backgroundColor: '#EEF2FF',
                    border: '1px solid #C7D2FE',
                    color: '#150958',
                  };
                } else if (entry.result === 'INVALID') {
                  outcomeLabel = 'INVALID / غير صالح';
                  outcomeStyle = {
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#B91C1C',
                  };
                } else if (entry.result === 'ALREADY_USED') {
                  outcomeLabel = 'USED / مستخدم';
                  outcomeStyle = {
                    backgroundColor: '#FEF3C7',
                    border: '1px solid #FDE68A',
                    color: '#92400E',
                  };
                }

                return (
                  <tr 
                    key={entry.id}
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
                    <td style={{ padding: '1.15rem 1.25rem', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(entry.id)}
                        onChange={() => {
                          setSelectedIds(prev => 
                            prev.includes(entry.id) 
                              ? prev.filter(id => id !== entry.id) 
                              : [...prev, entry.id]
                          );
                        }}
                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#150958' }}
                      />
                    </td>
                    {/* Customer */}
                    <td style={{ padding: '1.15rem 1.25rem' }}>
                      {entry.participant ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <Link 
                            href={`/admin/collections/participants/${entry.participant.id}`}
                            style={{ 
                              fontWeight: '700', 
                              color: '#1E293B',
                              fontSize: '0.925rem',
                              textDecoration: 'none'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#150958'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#1E293B'}
                          >
                            {entry.participant.name}
                          </Link>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.8rem', color: '#64748B' }}>{entry.participant.phone}</span>
                            <button
                              onClick={() => handleCopy(entry.id, entry.participant!.phone, 'phone')}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: isPhoneCopied ? '#150958' : '#64748B',
                                cursor: 'pointer',
                                padding: '0.1rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '0.2rem',
                              }}
                            >
                              {isPhoneCopied ? (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              ) : (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Anonymous / Unknown</span>
                      )}
                    </td>

                    {/* Cup Code */}
                    <td style={{ padding: '1.15rem 1rem' }}>
                      {entry.code ? (
                        <Link
                          href={`/admin/collections/codes/${entry.code.id}`}
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: '700',
                            color: '#150958',
                            textDecoration: 'none',
                            backgroundColor: '#EEF2FF',
                            padding: '0.25rem 0.6rem',
                            borderRadius: '0.375rem',
                            border: '1px solid #C7D2FE',
                            fontSize: '0.85rem'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#E0E7FF';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#EEF2FF';
                          }}
                        >
                          {entry.code.serialCode}
                        </Link>
                      ) : (
                        <span style={{ color: '#94A3B8', fontFamily: 'monospace', fontSize: '0.85rem' }}>-</span>
                      )}
                    </td>

                    {/* Outcome Badge */}
                    <td style={{ padding: '1.15rem 1rem' }}>
                      <Link
                        href={`/admin/collections/entries/${entry.id}`}
                        style={{ textDecoration: 'none' }}
                      >
                        <span
                          style={{
                            fontSize: '0.725rem',
                            fontWeight: '800',
                            padding: '0.25rem 0.65rem',
                            borderRadius: '9999px',
                            display: 'inline-block',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            ...outcomeStyle
                          }}
                        >
                          {outcomeLabel}
                        </span>
                      </Link>
                    </td>

                    {/* Request log info */}
                    <td style={{ padding: '1.15rem 1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', fontSize: '0.8rem' }}>
                        {entry.requestId ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ color: '#1E293B', fontFamily: 'monospace', fontWeight: '600' }}>
                              Req: {entry.requestId.substring(0, 8)}...
                            </span>
                            <button
                              onClick={() => handleCopy(entry.id, entry.requestId!, 'requestId')}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: isReqIdCopied ? '#150958' : '#64748B',
                                cursor: 'pointer',
                                padding: '0.1rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '0.2rem',
                              }}
                            >
                              {isReqIdCopied ? (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              ) : (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                                </svg>
                              )}
                            </button>
                          </div>
                        ) : null}
                        {entry.ip ? (
                          <span style={{ color: '#64748B' }}>IP: {entry.ip}</span>
                        ) : null}
                      </div>
                    </td>

                    {/* Scanned At */}
                    <td style={{ padding: '1.15rem 1.25rem', textAlign: 'right', color: '#64748B', fontSize: '0.8rem' }}>
                      {new Date(entry.createdAt).toLocaleString()}
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

      {/* Total entries count banner */}
      <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.825rem', color: '#64748B' }}>
        Showing {initialEntries.length} entries of {totalDocs.toLocaleString()} matches.
      </div>
    </div>
  );
}
