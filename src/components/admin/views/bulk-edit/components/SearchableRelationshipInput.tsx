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
          backgroundColor: '#151314',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '0.375rem',
          padding: '0.625rem 1rem',
          color: '#ffffff',
          cursor: 'pointer',
          fontSize: '0.9rem',
          minHeight: '38px',
        }}
      >
        <span style={{ color: displayValue ? '#ffffff' : '#a1a1aa' }}>
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
                color: '#a1a1aa',
                cursor: 'pointer',
                padding: '2px',
                fontSize: '12px',
                lineHeight: 1,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#a1a1aa')}
            >
              ✕
            </button>
          )}
          <span style={{ color: '#a1a1aa', fontSize: '10px' }}>▼</span>
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
            backgroundColor: '#1b1819',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '0.375rem',
            zIndex: 1000,
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
            maxHeight: '220px',
            overflowY: 'auto',
          }}
        >
          {/* Inner Search Field */}
          <div style={{ padding: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <input
              type="text"
              placeholder="Type to filter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                backgroundColor: '#151314',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '0.25rem',
                padding: '0.4rem 0.6rem',
                color: '#ffffff',
                fontSize: '0.85rem',
                outline: 'none',
              }}
              autoFocus
            />
          </div>

          {/* List Options */}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {loading && (
              <li style={{ padding: '0.75rem 1rem', color: '#a1a1aa', fontSize: '0.85rem', textAlign: 'center' }}>
                Loading options...
              </li>
            )}
            {error && (
              <li style={{ padding: '0.75rem 1rem', color: '#7B3B1B', fontSize: '0.85rem', textAlign: 'center' }}>
                {error}
              </li>
            )}
            {!loading && !error && options.length === 0 && (
              <li style={{ padding: '0.75rem 1rem', color: '#a1a1aa', fontSize: '0.85rem', textAlign: 'center' }}>
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
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    backgroundColor: value === opt.value ? 'rgba(43, 168, 224, 0.15)' : 'transparent',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      value === opt.value ? 'rgba(43, 168, 224, 0.2)' : 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      value === opt.value ? 'rgba(43, 168, 224, 0.15)' : 'transparent';
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
