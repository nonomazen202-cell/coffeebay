'use client';

import React, { useRef, useState } from 'react';

export function ImportButton() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Only CSV files are supported.');
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/import/codes', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message || 'Import successful!');
        window.location.reload();
      } else {
        alert(`Import failed:\n${data.errors?.join('\n') || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('[Import Client Error]', err);
      alert('Network error occurred during import.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv"
        style={{ display: 'none' }}
      />
      <button
        onClick={handleButtonClick}
        disabled={loading}
        type="button"
        style={{
          padding: '0.625rem 1.25rem',
          fontSize: '0.875rem',
          fontWeight: '700',
          backgroundColor: '#150958',
          color: '#FFFFFF',
          border: '1px solid #150958',
          borderRadius: '9999px',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginRight: '0.75rem',
          marginBottom: '1rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          opacity: loading ? 0.7 : 1,
          boxShadow: '0 4px 12px rgba(21, 9, 88, 0.16)',
          transition: 'all 0.15s ease-in-out',
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.backgroundColor = '#1E117A';
            e.currentTarget.style.borderColor = '#1E117A';
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.currentTarget.style.backgroundColor = '#150958';
            e.currentTarget.style.borderColor = '#150958';
          }
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
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {loading ? 'Importing...' : 'Import Codes CSV'}
      </button>
    </>
  );
}
