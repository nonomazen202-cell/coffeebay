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
        padding: '0.5rem 1rem',
        fontSize: '0.875rem',
        fontWeight: '600',
        backgroundColor: '#1f2937', // zinc-800/gray-800 look
        color: '#ffffff',
        border: '1px solid #374151',
        borderRadius: '0.375rem',
        cursor: 'pointer',
        marginRight: '0.75rem',
        marginBottom: '1rem',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        transition: 'all 0.15s ease-in-out',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#374151';
        e.currentTarget.style.borderColor = '#4b5563';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#1f2937';
        e.currentTarget.style.borderColor = '#374151';
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
