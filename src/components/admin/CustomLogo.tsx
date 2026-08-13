import React from 'react';

export function CustomLogo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0 1.5rem 0' }}>
      <img
        src="/Coffee-bay-logo.svg"
        alt="CoffeeBay Logo"
        style={{
          width: '120px',
          height: '120px',
          objectFit: 'contain'
        }}
      />
    </div>
  );
}
