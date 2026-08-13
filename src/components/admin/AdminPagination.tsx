'use client';

import React from 'react';

interface AdminPaginationProps {
  currentPage: number;
  totalPages: number;
  isPending: boolean;
  onPageChange: (newPage: number) => void;
  pendingPage?: number | null;
}

export function AdminPagination({
  currentPage,
  totalPages,
  isPending,
  onPageChange,
  pendingPage = null,
}: AdminPaginationProps) {
  if (totalPages <= 1) return null;

  const delta = 2; // Number of pages to show before and after current page
  const range: (number | string)[] = [];

  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - delta && i <= currentPage + delta)
    ) {
      range.push(i);
    } else if (range[range.length - 1] !== '...') {
      range.push('...');
    }
  }

  const isPrevLoading = isPending && pendingPage === currentPage - 1;
  const isNextLoading = isPending && pendingPage === currentPage + 1;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.25rem 1.5rem',
        backgroundColor: '#1b1819',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        opacity: isPending ? 0.6 : 1,
        pointerEvents: isPending ? 'none' : 'auto',
        transition: 'opacity 0.2s ease',
        flexWrap: 'wrap',
        gap: '1rem',
      }}
    >
      {/* Pagination Status Text */}
      <span style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: '500' }}>
        Page <strong style={{ color: '#ffffff' }}>{currentPage}</strong> of{' '}
        <strong style={{ color: '#ffffff' }}>{totalPages}</strong>
      </span>

      {/* Pagination Buttons Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        {/* Previous Page Button */}
        <button
          onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || isPending}
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: '0.375rem',
            fontSize: '0.85rem',
            fontWeight: '700',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: currentPage === 1 ? '#71717a' : '#d4d4d8',
            cursor: isPrevLoading ? 'wait' : currentPage === 1 ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
          onMouseEnter={(e) => {
            if (currentPage !== 1 && !isPending) {
              e.currentTarget.style.borderColor = '#2BA8E0';
              e.currentTarget.style.color = '#ffffff';
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== 1 && !isPending) {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = '#d4d4d8';
            }
          }}
        >
          {isPrevLoading ? (
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
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          )}
          Prev
        </button>

        {/* Page Numbers sliding window */}
        {range.map((page, idx) => {
          if (page === '...') {
            return (
              <span
                key={`ellipsis-${idx}`}
                style={{
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.85rem',
                  color: '#71717a',
                  fontWeight: '700',
                  userSelect: 'none',
                }}
              >
                ...
              </span>
            );
          }

          const isCurrent = page === currentPage;
          const isPageLoading = isPending && pendingPage === page;

          return (
            <button
              key={`page-${page}`}
              onClick={() => onPageChange(page as number)}
              disabled={isPending || isCurrent}
              style={{
                minWidth: '2.25rem',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                fontSize: '0.85rem',
                fontWeight: '700',
                border: '1px solid',
                borderColor: isCurrent ? '#2BA8E0' : 'rgba(255, 255, 255, 0.08)',
                backgroundColor: isCurrent ? 'rgba(43, 168, 224, 0.15)' : 'rgba(0, 0, 0, 0.2)',
                color: isCurrent ? '#2BA8E0' : '#d4d4d8',
                cursor: isPageLoading ? 'wait' : isPending ? 'not-allowed' : isCurrent ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
              }}
              onMouseEnter={(e) => {
                if (!isCurrent && !isPending) {
                  e.currentTarget.style.borderColor = '#2BA8E0';
                  e.currentTarget.style.color = '#ffffff';
                }
              }}
              onMouseLeave={(e) => {
                if (!isCurrent && !isPending) {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.color = '#d4d4d8';
                }
              }}
            >
              {isPageLoading && (
                <svg 
                  style={{ 
                    width: '10px', 
                    height: '10px', 
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
              {page}
            </button>
          );
        })}

        {/* Next Page Button */}
        <button
          onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || isPending}
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: '0.375rem',
            fontSize: '0.85rem',
            fontWeight: '700',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: currentPage === totalPages ? '#71717a' : '#d4d4d8',
            cursor: isNextLoading ? 'wait' : currentPage === totalPages ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
          onMouseEnter={(e) => {
            if (currentPage !== totalPages && !isPending) {
              e.currentTarget.style.borderColor = '#2BA8E0';
              e.currentTarget.style.color = '#ffffff';
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== totalPages && !isPending) {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = '#d4d4d8';
            }
          }}
        >
          Next
          {isNextLoading ? (
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
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
