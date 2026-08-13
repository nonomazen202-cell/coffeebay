'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ClaimDetails {
  claimId: string | number;
  verificationCode: string;
  status: 'PENDING' | 'DELIVERED' | 'CANCELLED';
  prizeName: string;
  participantName: string;
  participantPhone: string;
  claimedAt: string;
  verifiedAt?: string;
  verifiedBy?: string | number;
}

export function VerifyWidget() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [claim, setClaim] = useState<ClaimDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError(null);
    setMessage(null);
    setClaim(null);

    try {
      const res = await fetch(`/api/claims/${code.trim().toUpperCase()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setClaim(data.claim);
      } else {
        setError(data.errors?.join('\n') || 'Claim code lookup failed.');
      }
    } catch (err) {
      console.error(err);
      setError('A network error occurred while searching.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeliver = async () => {
    if (!claim) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationCode: claim.verificationCode }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage(data.message || 'Prize delivered successfully!');
        setClaim(data.claim || { ...claim, status: 'DELIVERED' });
        router.refresh();
      } else {
        setError(data.errors?.join('\n') || 'Prize delivery failed.');
      }
    } catch (err) {
      console.error(err);
      setError('A network error occurred while verifying delivery.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: '#1b1819',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '1rem',
        padding: '1.75rem',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
        color: '#ffffff',
      }}
    >
      <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: '#ffffff' }}>
        Prize Verification & Delivery
      </h2>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Enter Verification Code (e.g. CFB-123456)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={loading}
          style={{
            flex: 1,
            padding: '0.625rem 0.875rem',
            borderRadius: '0.375rem',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#ffffff',
            fontSize: '0.875rem',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => e.target.style.borderColor = '#2BA8E0'}
          onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.625rem 1.25rem',
            borderRadius: '0.375rem',
            backgroundColor: '#2BA8E0', // Primary Blue
            color: '#231F20', // High contrast text color
            fontWeight: '700',
            fontSize: '0.875rem',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = '#1d92ca';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = '#2BA8E0';
              e.currentTarget.style.transform = 'translateY(0)';
            }
          }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(123, 59, 27, 0.25)',
            color: '#ffffff',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            marginBottom: '1rem',
            border: '1px solid #7B3B1B',
            whiteSpace: 'pre-line',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {message && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(43, 168, 224, 0.15)',
            color: '#2BA8E0',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            marginBottom: '1rem',
            border: '1px solid rgba(43, 168, 224, 0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
            <span>{message}</span>
          </div>
        </div>
      )}

      {claim && (
        <div
          style={{
            padding: '1.25rem',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '0.375rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1rem', fontWeight: '700', color: '#ffffff' }}>
              Claim Information
            </span>
            <span
              style={{
                fontSize: '0.825rem',
                fontWeight: '700',
                padding: '0.25rem 0.625rem',
                borderRadius: '9999px',
                backgroundColor:
                  claim.status === 'DELIVERED'
                    ? 'rgba(43, 168, 224, 0.2)'
                    : claim.status === 'CANCELLED'
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(123, 59, 27, 0.4)',
                color:
                  claim.status === 'DELIVERED'
                    ? '#2BA8E0'
                    : claim.status === 'CANCELLED'
                    ? '#71717a'
                    : '#ffffff',
              }}
            >
              {claim.status}
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '0.5rem 0', color: '#a1a1aa' }}>Verification Code</td>
                <td style={{ padding: '0.5rem 0', fontWeight: '600', color: '#ffffff', textAlign: 'right' }}>{claim.verificationCode}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '0.5rem 0', color: '#a1a1aa' }}>Prize Item</td>
                <td style={{ padding: '0.5rem 0', fontWeight: '600', color: '#2BA8E0', textAlign: 'right' }}>{claim.prizeName}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '0.5rem 0', color: '#a1a1aa' }}>Winner Name</td>
                <td style={{ padding: '0.5rem 0', fontWeight: '600', color: '#ffffff', textAlign: 'right' }}>{claim.participantName}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '0.5rem 0', color: '#a1a1aa' }}>Phone Number</td>
                <td style={{ padding: '0.5rem 0', color: '#ffffff', textAlign: 'right' }}>{claim.participantPhone}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '0.5rem 0', color: '#a1a1aa' }}>Claimed At</td>
                <td style={{ padding: '0.5rem 0', color: '#ffffff', textAlign: 'right' }}>{new Date(claim.claimedAt).toLocaleString()}</td>
              </tr>
              {claim.status === 'DELIVERED' && claim.verifiedAt && (
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '0.5rem 0', color: '#a1a1aa' }}>Delivered At</td>
                  <td style={{ padding: '0.5rem 0', fontWeight: '700', color: '#2BA8E0', textAlign: 'right' }}>
                    {new Date(claim.verifiedAt).toLocaleString()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {claim.status === 'PENDING' && (
            <button
              onClick={handleDeliver}
              disabled={loading}
              style={{
                width: '100%',
                marginTop: '1.25rem',
                padding: '0.75rem',
                borderRadius: '0.375rem',
                backgroundColor: '#7B3B1B', // Coffee Brown
                color: '#ffffff', // Clean white text
                fontWeight: '700',
                fontSize: '0.875rem',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#5E2C14';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#7B3B1B';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {loading ? 'Processing...' : 'Confirm Delivery & Hand Over'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
