'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { AdminPagination } from '../AdminPagination';
import { bulkDeleteAction } from './actions';

interface Participant {
  id: string | number;
  name: string;
  phone: string;
  verified?: boolean;
  blocked?: boolean;
  createdAt: string;
}

interface ParticipantsManagerProps {
  initialParticipants: Participant[];
  currentPage: number;
  totalPages: number;
  totalDocs: number;
  totalCount: number;
  initialSearch: string;
}

export function ParticipantsManager({
  initialParticipants,
  currentPage,
  totalPages,
  totalDocs,
  totalCount,
  initialSearch,
}: ParticipantsManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(initialSearch);
  const [copiedId, setCopiedId] = useState<{ id: string | number; type: 'phone' } | null>(null);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const updateUrlParams = useCallback((page: number, searchVal: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    if (searchVal) {
      params.set('search', searchVal);
    } else {
      params.delete('search');
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }, [pathname, router, searchParams]);

  // Sync Search state to URL on 400ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== initialSearch) {
        updateUrlParams(1, search);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search, initialSearch, updateUrlParams]);

  const handlePageChange = (newPage: number) => {
    updateUrlParams(newPage, search);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected customers?\nهل أنت متأكد من حذف العملاء المحددين؟`)) {
      return;
    }

    setDeleting(true);
    setErrorMsg(null);
    try {
      const res = await bulkDeleteAction('participants', selectedIds);
      if (res.success) {
        setSelectedIds([]);
        router.refresh();
      } else {
        setErrorMsg(res.error || 'Failed to delete customers.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('An error occurred during deletion.');
    } finally {
      setDeleting(false);
    }
  };

  const handleCopy = (id: string | number, text: string, type: 'phone') => {
    navigator.clipboard.writeText(text);
    setCopiedId({ id, type });
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleExport = () => {
    window.location.href = `/api/export/participants`;
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
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            Registered Customers / العملاء المسجلين
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.9rem', margin: '0.35rem 0 0 0' }}>
            View and manage customer data collected during QR code scans and serial activations.
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <Link
            href="/admin/collections/participants/create"
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
            + Add Customer / إضافة عميل
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
            Export Customers CSV / تصدير العملاء
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
          gap: '1.25rem', 
          marginBottom: '2rem' 
        }}
      >
        <div className="cb-wave-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '4px solid #150958', borderRadius: '1rem', padding: '1.35rem 1.5rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(21, 9, 88, 0.05)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#150958', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Registered Customers</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#150958', marginTop: '0.35rem' }}>{totalCount.toLocaleString()}</span>
        </div>
      </div>

      {/* Control Bar (Search Box) */}
      <div 
        style={{ 
          marginBottom: '1.5rem',
          background: '#FFFFFF',
          padding: '1rem 1.25rem',
          borderRadius: '1rem',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 14px rgba(21, 9, 88, 0.04)'
        }}
      >
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            type="text"
            placeholder="Search customers by name, phone number, or email..."
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
      </div>

      {/* Main Participants Table */}
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
            Selected {selectedIds.length} customer/customers • تم تحديد {selectedIds.length} عميل
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

      {initialParticipants.length === 0 ? (
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
          No registered customers found matching search filters.
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
                    checked={initialParticipants.length > 0 && initialParticipants.every(p => selectedIds.includes(p.id))}
                    onChange={() => {
                      const allSelected = initialParticipants.every(p => selectedIds.includes(p.id));
                      if (allSelected) {
                        setSelectedIds(prev => prev.filter(id => !initialParticipants.some(p => p.id === id)));
                      } else {
                        const newIds = initialParticipants.map(p => p.id);
                        setSelectedIds(prev => Array.from(new Set([...prev, ...newIds])));
                      }
                    }}
                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#150958' }}
                  />
                </th>
                <th style={{ padding: '1.15rem 1.25rem', fontWeight: '700' }}>Customer Name</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700' }}>Phone Number</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700', textAlign: 'center' }}>Verified</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '1.15rem 1rem', fontWeight: '700', textAlign: 'right' }}>Registered At</th>
              </tr>
            </thead>
            <tbody>
              {initialParticipants.map((participant) => {
                const isPhoneCopied = copiedId?.id === participant.id && copiedId?.type === 'phone';

                return (
                  <tr 
                    key={participant.id}
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
                        checked={selectedIds.includes(participant.id)}
                        onChange={() => {
                          setSelectedIds(prev => 
                            prev.includes(participant.id) 
                              ? prev.filter(id => id !== participant.id) 
                              : [...prev, participant.id]
                          );
                        }}
                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#150958' }}
                      />
                    </td>
                    {/* Customer Name linked to details */}
                    <td style={{ padding: '1.15rem 1.25rem' }}>
                      <Link 
                        href={`/admin/collections/participants/${participant.id}`}
                        style={{ 
                          fontWeight: '700', 
                          color: '#1E293B',
                          fontSize: '0.95rem',
                          textDecoration: 'none'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#150958'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#1E293B'}
                      >
                        {participant.name}
                      </Link>
                    </td>

                    {/* Phone Number */}
                    <td style={{ padding: '1.15rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: '#1E293B', fontWeight: '600' }}>{participant.phone}</span>
                        <button
                           onClick={() => handleCopy(participant.id, participant.phone, 'phone')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: isPhoneCopied ? '#150958' : '#64748B',
                            cursor: 'pointer',
                            padding: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '0.25rem',
                            transition: 'all 0.15s'
                          }}
                        >
                          {isPhoneCopied ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Verified Status */}
                    <td style={{ padding: '1.15rem 1rem', textAlign: 'center' }}>
                      {participant.verified ? (
                        <span style={{ 
                          padding: '0.25rem 0.65rem', 
                          borderRadius: '9999px', 
                          backgroundColor: '#EEF2FF', 
                          border: '1px solid #C7D2FE',
                          color: '#150958',
                          fontSize: '0.75rem',
                          fontWeight: '800'
                        }}>
                          ✓ Verified
                        </span>
                      ) : (
                        <span style={{ 
                          padding: '0.25rem 0.65rem', 
                          borderRadius: '9999px', 
                          backgroundColor: '#F1F5F9', 
                          border: '1px solid #E2E8F0',
                          color: '#64748B',
                          fontSize: '0.75rem',
                          fontWeight: '700'
                        }}>
                          Unverified
                        </span>
                      )}
                    </td>

                    {/* Blocked Status */}
                    <td style={{ padding: '1.15rem 1rem', textAlign: 'center' }}>
                      {participant.blocked ? (
                        <span style={{ 
                          padding: '0.25rem 0.65rem', 
                          borderRadius: '9999px', 
                          backgroundColor: '#FEF2F2', 
                          color: '#B91C1C',
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          border: '1px solid #FECACA'
                        }}>
                          Blocked
                        </span>
                      ) : (
                        <span style={{ 
                          padding: '0.25rem 0.65rem', 
                          borderRadius: '9999px', 
                          backgroundColor: '#DCFCE7', 
                          border: '1px solid #BBF7D0',
                          color: '#15803D',
                          fontSize: '0.75rem',
                          fontWeight: '800'
                        }}>
                          Active
                        </span>
                      )}
                    </td>

                    {/* Registration Date */}
                    <td style={{ padding: '1.15rem 1rem', textAlign: 'right', color: '#64748B', fontSize: '0.8rem' }}>
                      {new Date(participant.createdAt).toLocaleString()}
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

      {/* Total participants count banner */}
      <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.825rem', color: '#64748B' }}>
        Showing {initialParticipants.length} participants of {totalDocs.toLocaleString()} matches.
      </div>
    </div>
  );
}
