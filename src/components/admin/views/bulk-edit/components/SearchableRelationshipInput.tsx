'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Option {
  label: string;
  value: string | number;
}

interface SearchableRelationshipInputProps {
  relationTo: string;
  value: string | number | null;
  onChange: (val: string | number | null) => void;
  placeholder?: string;
}

export function SearchableRelationshipInput({
  relationTo,
  value,
  onChange,
  placeholder = 'Search to select...',
}: SearchableRelationshipInputProps) {
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch initial options or filter options on search query update
  const fetchOptions = useCallback(async (query: string, signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      // Build API search URL using Payload REST API conventions
      // Search is restricted to limit=15 to minimize CPU usage and RAM allocation on the 1 vCPU server
      let url = `/api/${relationTo}?limit=15`;
      if (query.trim()) {
        // Query relies on 'name' index, which is standard for relation lookups (e.g. Prizes)
        url += `&where[name][like]=${encodeURIComponent(query.trim())}`;
      }

      const res = await fetch(url, { signal });
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const data = await res.json();
      const docs = (data?.docs || []) as Record<string, unknown>[];

      // Map document structures to options
      // Handles fallback if title/name is empty, ensuring UI doesn't break
      const mappedOptions = docs.map((doc) => ({
        label: (doc['name'] || doc['title'] || doc['serial_code'] || `ID: ${doc['id']}`) as string,
        value: doc['id'] as string | number,
      }));

      setOptions(mappedOptions);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error(`[SearchableRelationshipInput] Failed fetching relationship for "${relationTo}":`, err);
        setError('Failed to load options.');
      }
    } finally {
      setLoading(false);
    }
  }, [relationTo]);

  // Trigger search with 300ms debouncing and AbortController request cancellation
  useEffect(() => {
    // Cancel any previous debounced searches
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Cancel any active network requests that are currently in-flight
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create a new AbortController for this search action
    const controller = new AbortController();
    abortControllerRef.current = controller;

    searchTimeoutRef.current = setTimeout(() => {
      fetchOptions(search, controller.signal);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      controller.abort();
    };
  }, [search, fetchOptions]);

  // Clean up refs on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSelect = (option: Option) => {
    onChange(option.value);
    setSearch('');
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setSearch('');
  };

  // Find the selected option's label to display in the input box
  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption ? selectedOption.label : value ? `ID: ${value}` : '';

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Dropdown Input Box */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          border: '1px solid #CBD5E1',
          borderRadius: '0.5rem',
          padding: '0.625rem 1rem',
          color: '#1E293B',
          cursor: 'pointer',
          fontSize: '0.9rem',
          minHeight: '38px',
        }}
      >
        <span style={{ color: displayValue ? '#1E293B' : '#94A3B8', fontWeight: displayValue ? '600' : '400' }}>
          {displayValue || placeholder}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {value !== null && (
            <button
              onClick={handleClear}
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                padding: '2px',
                fontSize: '12px',
                lineHeight: 1,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#150958')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#64748B')}
            >
              ✕
            </button>
          )}
          <span style={{ color: '#64748B', fontSize: '10px' }}>▼</span>
        </div>
      </div>

      {/* Floating Dropdown List */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: '0.5rem',
            zIndex: 1000,
            boxShadow: '0 10px 25px rgba(21, 9, 88, 0.14)',
            maxHeight: '220px',
            overflowY: 'auto',
          }}
        >
          {/* Inner Search Field */}
          <div style={{ padding: '0.5rem', borderBottom: '1px solid #EEF2F6' }}>
            <input
              type="text"
              placeholder="Type to filter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                backgroundColor: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '0.375rem',
                padding: '0.45rem 0.65rem',
                color: '#1E293B',
                fontSize: '0.85rem',
                outline: 'none',
              }}
              autoFocus
            />
          </div>

          {/* List Options */}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {loading && (
              <li style={{ padding: '0.75rem 1rem', color: '#64748B', fontSize: '0.85rem', textAlign: 'center' }}>
                Loading options...
              </li>
            )}
            {error && (
              <li style={{ padding: '0.75rem 1rem', color: '#B91C1C', fontSize: '0.85rem', textAlign: 'center' }}>
                {error}
              </li>
            )}
            {!loading && !error && options.length === 0 && (
              <li style={{ padding: '0.75rem 1rem', color: '#64748B', fontSize: '0.85rem', textAlign: 'center' }}>
                No results found.
              </li>
            )}
            {!loading &&
              !error &&
              options.map((opt) => (
                <li
                  key={opt.value}
                  onClick={() => handleSelect(opt)}
                  style={{
                    padding: '0.625rem 1rem',
                    color: value === opt.value ? '#150958' : '#1E293B',
                    fontWeight: value === opt.value ? '700' : '500',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    backgroundColor: value === opt.value ? '#EEF2FF' : 'transparent',
                    borderBottom: '1px solid #F1F5F9',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      value === opt.value ? '#E0E7FF' : '#F8FAFC';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      value === opt.value ? '#EEF2FF' : 'transparent';
                  }}
                >
                  {opt.label}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
