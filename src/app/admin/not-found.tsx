import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ padding: '4rem 2rem', textAlign: 'center', fontFamily: 'sans-serif', backgroundColor: '#F4F6FB', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#150958', fontWeight: '800' }}>404 - Page Not Found</h1>
      <p style={{ fontSize: '1.1rem', color: '#64748B', marginBottom: '2rem' }}>
        The administrative page you are looking for does not exist.
      </p>
      <Link
        href="/admin"
        style={{
          display: 'inline-block',
          padding: '0.75rem 1.75rem',
          backgroundColor: '#150958',
          color: '#FFFFFF',
          textDecoration: 'none',
          borderRadius: '9999px',
          fontWeight: '700',
          boxShadow: '0 4px 14px rgba(21, 9, 88, 0.18)',
        }}
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
