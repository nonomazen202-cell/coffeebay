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
    <div style={{ padding: '2rem 1.5rem', minHeight: '100vh', backgroundColor: '#231F20' }}>
      
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
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#2BA8E0' }}>🎫</span> Scan Entries / محاولات المسح والاشتراك
          </h1>
          <p style={{ color: '#d4d4d8', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Monitor real-time participation scans, campaign outcomes, and validation logs.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link
            href="/admin/collections/entries/create"
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
        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Entries</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#ffffff', marginTop: '0.5rem' }}>{stats.total.toLocaleString()}</span>
        </div>

        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderLeft: '4px solid #2BA8E0', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wins</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#2BA8E0', marginTop: '0.5rem', textShadow: '0 0 10px rgba(43, 168, 224, 0.2)' }}>{stats.win.toLocaleString()}</span>
        </div>

        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Loses</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#ffffff', marginTop: '0.5rem' }}>{stats.lose.toLocaleString()}</span>
        </div>

        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderLeft: '4px solid #7B3B1B', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invalid Codes</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#7B3B1B', marginTop: '0.5rem', textShadow: '0 0 10px rgba(123, 59, 27, 0.2)' }}>{stats.invalid.toLocaleString()}</span>
        </div>

        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderLeft: '4px solid #7B3B1B', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Already Used</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#7B3B1B', marginTop: '0.5rem', textShadow: '0 0 10px rgba(123, 59, 27, 0.2)' }}>{stats.used.toLocaleString()}</span>
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
          background: '#1b1819',
          padding: '1rem',
          borderRadius: '0.75rem',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)'
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
              backgroundColor: '#151314',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '0.5rem',
              padding: '0.625rem 1rem 0.625rem 2.5rem',
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

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {(['ALL', 'WIN', 'LOSE', 'INVALID', 'ALREADY_USED'] as const).map((tab) => {
            const isSelected = filter === tab;
            let label = 'All';
            let activeColor = '#2BA8E0';
            let activeBg = 'rgba(43, 168, 224, 0.15)';

            if (tab === 'WIN') {
              label = 'Wins';
            } else if (tab === 'LOSE') {
              label = 'Loses';
              activeColor = '#ffffff';
              activeBg = 'rgba(255, 255, 255, 0.12)';
            } else if (tab === 'INVALID') {
              label = 'Invalid';
              activeColor = '#7B3B1B';
              activeBg = 'rgba(123, 59, 27, 0.2)';
            } else if (tab === 'ALREADY_USED') {
              label = 'Already Used';
              activeColor = '#7B3B1B';
              activeBg = 'rgba(123, 59, 27, 0.2)';
            }

            return (
              <button
                key={tab}
                onClick={() => handleFilterChange(tab)}
                style={{
                  padding: '0.5rem 0.85rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  border: '1px solid',
                  borderColor: isSelected ? activeColor : 'rgba(255, 255, 255, 0.1)',
                  backgroundColor: isSelected ? activeBg : 'rgba(0, 0, 0, 0.2)',
                  color: isSelected ? activeColor : '#d4d4d8',
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
            Selected {selectedIds.length} entry/entries • تم تحديد {selectedIds.length} محاولة
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

      {/* Main Table */}
      {initialEntries.length === 0 ? (
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
          No scan entries found matching current criteria.
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
            transition: 'opacity 0.2s ease',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#151314', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#ffffff' }}>
                <th style={{ padding: '1.25rem', width: '48px', textAlign: 'center' }}>
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
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                </th>
                <th style={{ padding: '1.25rem 1.25rem', fontWeight: '600' }}>Customer / Participant</th>
                <th style={{ padding: '1.25rem 1rem', fontWeight: '600' }}>Cup Code</th>
                <th style={{ padding: '1.25rem 1rem', fontWeight: '600' }}>Outcome</th>
                <th style={{ padding: '1.25rem 1rem', fontWeight: '600' }}>Request Log / IP</th>
                <th style={{ padding: '1.25rem 1.25rem', fontWeight: '600', textAlign: 'right' }}>Scanned At</th>
              </tr>
            </thead>
            <tbody>
              {initialEntries.map((entry) => {
                const isPhoneCopied = copiedId?.id === entry.id && copiedId?.type === 'phone';
                const isReqIdCopied = copiedId?.id === entry.id && copiedId?.type === 'requestId';

                // Format outcome labels
                let outcomeLabel = 'LOSE / خسارة';
                let outcomeStyle = {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#d4d4d8',
                };

                if (entry.result === 'WIN') {
                  outcomeLabel = '★ WIN / فوز';
                  outcomeStyle = {
                    backgroundColor: 'rgba(43, 168, 224, 0.15)',
                    border: '1px solid rgba(43, 168, 224, 0.35)',
                    color: '#2BA8E0',
                  };
                } else if (entry.result === 'INVALID') {
                  outcomeLabel = 'INVALID / غير صالح';
                  outcomeStyle = {
                    backgroundColor: 'rgba(123, 59, 27, 0.2)',
                    border: '1px solid rgba(123, 59, 27, 0.4)',
                    color: '#7B3B1B',
                  };
                } else if (entry.result === 'ALREADY_USED') {
                  outcomeLabel = 'USED / مستخدم';
                  outcomeStyle = {
                    backgroundColor: 'rgba(123, 59, 27, 0.2)',
                    border: '1px solid rgba(123, 59, 27, 0.4)',
                    color: '#7B3B1B',
                  };
                }

                return (
                  <tr 
                    key={entry.id}
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
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
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
                              color: '#ffffff',
                              fontSize: '0.925rem',
                              textDecoration: 'none'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#2BA8E0'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#ffffff'}
                          >
                            {entry.participant.name}
                          </Link>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>{entry.participant.phone}</span>
                            <button
                              onClick={() => handleCopy(entry.id, entry.participant!.phone, 'phone')}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: isPhoneCopied ? '#2BA8E0' : '#71717a',
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
                        <span style={{ color: '#71717a', fontStyle: 'italic' }}>Anonymous / Unknown</span>
                      )}
                    </td>

                    {/* Cup Code */}
                    <td style={{ padding: '1.15rem 1rem' }}>
                      {entry.code ? (
                        <Link
                          href={`/admin/collections/codes/${entry.code.id}`}
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: '600',
                            color: '#ffffff',
                            textDecoration: 'none',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            padding: '0.2rem 0.4rem',
                            borderRadius: '4px',
                            border: '1px solid rgba(255,255,255,0.08)',
                            fontSize: '0.85rem'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#2BA8E0';
                            e.currentTarget.style.borderColor = '#2BA8E0';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#ffffff';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                          }}
                        >
                          {entry.code.serialCode}
                        </Link>
                      ) : (
                        <span style={{ color: '#71717a', fontFamily: 'monospace', fontSize: '0.85rem' }}>-</span>
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
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            display: 'inline-block',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            ...outcomeStyle
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.filter = 'brightness(1.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.filter = 'none';
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
                            <span style={{ color: '#ffffff', fontFamily: 'monospace' }}>
                              Req: {entry.requestId.substring(0, 8)}...
                            </span>
                            <button
                              onClick={() => handleCopy(entry.id, entry.requestId!, 'requestId')}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: isReqIdCopied ? '#2BA8E0' : '#71717a',
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
                          <span style={{ color: '#71717a' }}>IP: {entry.ip}</span>
                        ) : null}
                      </div>
                    </td>

                    {/* Scanned At */}
                    <td style={{ padding: '1.15rem 1.25rem', textAlign: 'right', color: '#a1a1aa', fontSize: '0.8rem' }}>
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
      <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.825rem', color: '#71717a' }}>
        Showing {initialEntries.length} entries of {totalDocs.toLocaleString()} matches.
      </div>
    </div>
  );
}
