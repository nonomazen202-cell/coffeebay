import React from 'react';

export function CustomIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/drink-rewards/coffeebay-icon-dark.png"
      alt="Coffee Bay"
      style={{
        height: '24px',
        width: 'auto',
        maxHeight: '26px',
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    />
  );
}
