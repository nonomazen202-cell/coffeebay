import React from 'react';

export function CustomLogo() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.65rem',
        margin: '0.5rem 0 1.75rem 0',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/drink-rewards/coffeebay-dark-logo.png"
        alt="Coffee Bay Logo"
        style={{
          width: '200px',
          height: 'auto',
          objectFit: 'contain',
        }}
      />
      <span
        style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.2em',
          color: '#150958',
          textTransform: 'uppercase',
          opacity: 0.75,
        }}
      >
        MORE THAN A COFFEE. IT&apos;S A GOOD TIME.
      </span>
    </div>
  );
}
