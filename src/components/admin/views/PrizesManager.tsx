'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { bulkDeleteAction } from './actions';

interface Media {
  id: string | number;
  url?: string | null;
  filename?: string | null;
}

interface Prize {
  id: string | number;
  name: string;
  quantity: number;
  description?: string;
  image?: string | number | Media | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PrizesManagerProps {
  initialPrizes: Prize[];
  totalClaims: number;
}

export function PrizesManager({ initialPrizes, totalClaims }: PrizesManagerProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'LOW_STOCK'>('ALL');
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected prizes?\nهل أنت متأكد من حذف الجوائز المحددة؟`)) {
      return;
    }

    setDeleting(true);
    setErrorMsg(null);
    try {
      const res = await bulkDeleteAction('prizes', selectedIds);
      if (res.success) {
        setSelectedIds([]);
        window.location.reload();
      } else {
        setErrorMsg(res.error || 'Failed to delete prizes.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('An error occurred during deletion.');
    } finally {
      setDeleting(false);
    }
  };

  // Filter logic
  const filteredPrizes = initialPrizes.filter((prize) => {
    const matchesSearch = prize.name.toLowerCase().includes(search.toLowerCase()) || 
                          (prize.description && prize.description.toLowerCase().includes(search.toLowerCase()));
    
    let matchesFilter = true;
    if (filter === 'ACTIVE') matchesFilter = prize.active;
    if (filter === 'INACTIVE') matchesFilter = !prize.active;
    if (filter === 'LOW_STOCK') matchesFilter = prize.quantity <= 5;

    return matchesSearch && matchesFilter;
  });

  // Calculate statistics
  const totalItems = initialPrizes.length;
  const totalRemaining = initialPrizes.reduce((sum, p) => sum + p.quantity, 0);
  const totalInitial = totalRemaining + totalClaims;
  const lowStockCount = initialPrizes.filter(p => p.quantity <= 5).length;

  return (
    <div style={{ padding: '2rem 1.5rem', minHeight: '100vh', backgroundColor: '#231F20' }}>
      {/* Title Header Section */}
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
            <span style={{ color: '#2BA8E0' }}>🎁</span> Prizes Catalog / كتالوج الجوائز
          </h1>
          <p style={{ color: '#d4d4d8', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Manage promo items, active status, and live quantities for the lucky cup campaign.
          </p>
        </div>
        
        <Link 
          href="/admin/collections/prizes/create"
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#7B3B1B',
            color: '#ffffff',
            fontWeight: '800',
            fontSize: '0.875rem',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            boxShadow: '0 4px 15px rgba(123, 59, 27, 0.3)',
            transition: 'all 0.2s ease',
            border: '1px solid #7B3B1B'
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
          + Add New Prize / إضافة جائزة
        </Link>
      </div>

      {/* KPI Statistics Dashboard Section */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1.25rem', 
          marginBottom: '2rem' 
        }}
      >
        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Prize Types</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#ffffff', marginTop: '0.5rem' }}>{totalItems}</span>
        </div>
        
        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderLeft: '4px solid #2BA8E0', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Initial Prizes / إجمالي الجوائز التي كانت موجودة</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#2BA8E0', marginTop: '0.5rem', textShadow: '0 0 10px rgba(43, 168, 224, 0.2)' }}>{totalInitial}</span>
        </div>

        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderLeft: '4px solid #10B981', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Remaining Prizes / إجمالي الجوائز المتبقية</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#10B981', marginTop: '0.5rem', textShadow: '0 0 10px rgba(16, 185, 129, 0.2)' }}>{totalRemaining}</span>
        </div>

        <div style={{ background: '#1b1819', border: '1px solid rgba(255, 255, 255, 0.08)', borderLeft: '4px solid #7B3B1B', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Low Stock Alert (&le; 5)</span>
          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#ffffff', marginTop: '0.5rem', textShadow: '0 0 10px rgba(123, 59, 27, 0.2)' }}>{lowStockCount}</span>
        </div>
      </div>

      {/* Control Bar (Search & Filter Options) */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '1rem', 
          marginBottom: '2rem',
          background: '#1b1819',
          padding: '1rem',
          borderRadius: '0.75rem',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        {/* Select All Checkbox */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingRight: '0.5rem' }}>
          <input
            type="checkbox"
            checked={filteredPrizes.length > 0 && filteredPrizes.every(p => selectedIds.includes(p.id))}
            onChange={() => {
              const allSelected = filteredPrizes.every(p => selectedIds.includes(p.id));
              if (allSelected) {
                setSelectedIds(prev => prev.filter(id => !filteredPrizes.some(p => p.id === id)));
              } else {
                const newIds = filteredPrizes.map(p => p.id);
                setSelectedIds(prev => Array.from(new Set([...prev, ...newIds])));
              }
            }}
            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
          />
          <span style={{ fontSize: '0.85rem', color: '#d4d4d8', fontWeight: '700', whiteSpace: 'nowrap' }}>Select All / تحديد الكل</span>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '280px' }}>
          <input
            type="text"
            placeholder="Search prizes by name or description..."
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

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['ALL', 'ACTIVE', 'INACTIVE', 'LOW_STOCK'] as const).map((tab) => {
            const label = tab === 'ALL' ? 'All' : tab === 'ACTIVE' ? 'Active' : tab === 'INACTIVE' ? 'Inactive' : 'Low Stock';
            const isSelected = filter === tab;
            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  border: '1px solid',
                  borderColor: isSelected ? '#2BA8E0' : 'rgba(255, 255, 255, 0.1)',
                  backgroundColor: isSelected ? 'rgba(43, 168, 224, 0.15)' : 'rgba(0,0,0,0.15)',
                  color: isSelected ? '#2BA8E0' : '#d4d4d8',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
              >
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
            marginBottom: '1.5rem',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <span style={{ color: '#ffffff', fontSize: '0.85rem', fontWeight: '600' }}>
            Selected {selectedIds.length} prize/prizes • تم تحديد {selectedIds.length} جائزة
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

      {/* Grid of Prize Cards */}
      {filteredPrizes.length === 0 ? (
        <div 
          style={{ 
            padding: '4rem 2rem', 
            textAlign: 'center', 
            color: '#a1a1aa', 
            fontSize: '0.95rem',
            border: '1px dashed rgba(255, 255, 255, 0.1)', 
            borderRadius: '0.75rem',
            background: '#1b1819'
          }}
        >
          No prizes found matching the current search/filters.
        </div>
      ) : (
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
            gap: '1.5rem' 
          }}
        >
          {filteredPrizes.map((prize) => {
            // Retrieve image source URL
            const imageUrl = typeof prize.image === 'object' && prize.image !== null && 'url' in prize.image 
              ? (prize.image as Media).url 
              : null;
            
            const isOutOfStock = prize.quantity === 0;
            const isLowStock = prize.quantity > 0 && prize.quantity <= 5;

            return (
              <div
                key={prize.id}
                style={{
                  background: '#1b1819',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '0.75rem',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.25)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.borderColor = prize.active ? '#2BA8E0' : 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.boxShadow = prize.active 
                    ? '0 10px 25px rgba(43, 168, 224, 0.2)' 
                    : '0 10px 25px rgba(0, 0, 0, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.25)';
                }}
              >
                {/* Product Image Section */}
                <div 
                  style={{ 
                    height: '160px', 
                    width: '100%', 
                    backgroundColor: '#151314', 
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                  }}
                >
                  {/* Select Checkbox on Card */}
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(prize.id)}
                    onChange={() => {
                      setSelectedIds(prev => 
                        prev.includes(prize.id) 
                          ? prev.filter(id => id !== prize.id) 
                          : [...prev, prize.id]
                      );
                    }}
                    style={{
                      position: 'absolute',
                      top: '0.75rem',
                      left: '0.75rem',
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      zIndex: 10,
                    }}
                  />

                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={imageUrl} 
                      alt={prize.name} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: '#a1a1aa' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                      </svg>
                      <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>No Image / لا توجد صورة</span>
                    </div>
                  )}

                  {/* Active Capsule Status badge */}
                  <span
                    style={{
                      position: 'absolute',
                      top: '0.75rem',
                      right: '0.75rem',
                      fontSize: '0.7rem',
                      fontWeight: '800',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '9999px',
                      backgroundColor: prize.active ? 'rgba(43, 168, 224, 0.2)' : 'rgba(0,0,0,0.6)',
                      border: '1px solid',
                      borderColor: prize.active ? '#2BA8E0' : 'rgba(255, 255, 255, 0.2)',
                      color: prize.active ? '#2BA8E0' : '#a1a1aa',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    {prize.active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Content info section */}
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffffff', margin: 0, lineHeight: '1.3' }}>
                    {prize.name}
                  </h3>
                  
                  {prize.description && (
                    <p 
                      style={{ 
                        color: '#a1a1aa', 
                        fontSize: '0.8rem', 
                        marginTop: '0.5rem', 
                        marginBottom: '1rem',
                        lineHeight: '1.4',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        height: '2.25rem'
                      }}
                    >
                      {prize.description}
                    </p>
                  )}

                  {/* Stock Quantity Status Section */}
                  <div 
                    style={{ 
                      marginTop: prize.description ? '0' : '1rem', 
                      marginBottom: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#151314',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.375rem',
                      border: '1px solid rgba(255,255,255,0.04)'
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: '#d4d4d8', fontWeight: '600' }}>Stock Quantity:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span 
                        style={{ 
                          fontSize: '0.9rem', 
                          fontWeight: '900', 
                          color: isOutOfStock ? '#7B3B1B' : isLowStock ? '#7B3B1B' : '#2BA8E0' 
                        }}
                      >
                        {prize.quantity}
                      </span>
                      {isOutOfStock ? (
                        <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: 'rgba(123, 59, 27, 0.2)', border: '1px solid #7B3B1B', color: '#7B3B1B', fontWeight: '800' }}>OUT</span>
                      ) : isLowStock ? (
                        <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: 'rgba(123, 59, 27, 0.15)', border: '1px solid #7B3B1B', color: '#7B3B1B', fontWeight: '800' }}>LOW</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
                    <Link
                      href={`/admin/collections/prizes/${prize.id}`}
                      style={{
                        flex: 1,
                        padding: '0.5rem 0.75rem',
                        backgroundColor: 'rgba(43, 168, 224, 0.1)',
                        border: '1px solid rgba(43, 168, 224, 0.3)',
                        borderRadius: '0.375rem',
                        color: '#2BA8E0',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        textDecoration: 'none',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#2BA8E0';
                        e.currentTarget.style.color = '#231F20';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(43, 168, 224, 0.1)';
                        e.currentTarget.style.color = '#2BA8E0';
                      }}
                    >
                      Edit Details / تعديل
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
