'use client';

import React from 'react';

interface ExportButtonProps {
  collectionSlug: string;
}

export function ExportButton({ collectionSlug }: ExportButtonProps) {
  const handleExport = () => {
    window.location.href = `/api/export/${collectionSlug}`;
  };

  // Human friendly label
  const label = collectionSlug === 'prize-claims' ? 'claims' : collectionSlug;

  return (
    <button
      onClick={handleExport}
      type="button"
      style={{
        padding: '0.625rem 1.25rem',
        fontSize: '0.875rem',
        fontWeight: '700',
        backgroundColor: '#FFFFFF',
        color: '#150958',
        border: '1px solid #CBD5E1',
        borderRadius: '9999px',
        cursor: 'pointer',
        marginRight: '0.75rem',
        marginBottom: '1rem',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.45rem',
        boxShadow: '0 2px 6px rgba(21, 9, 88, 0.05)',
        transition: 'all 0.15s ease-in-out',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#EEF2FF';
        e.currentTarget.style.borderColor = '#150958';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#FFFFFF';
        e.currentTarget.style.borderColor = '#CBD5E1';
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Export {label.charAt(0).toUpperCase() + label.slice(1)} CSV
    </button>
  );
}
