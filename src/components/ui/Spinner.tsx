import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'white';
  className?: string;
}

const sizeMap = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]',
};

const colorMap = {
  blue: 'border-cb-blue/30 border-t-cb-blue',
  white: 'border-white/30 border-t-white',
};

export function Spinner({ size = 'md', color = 'blue', className = '' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block rounded-full animate-spin ${sizeMap[size]} ${colorMap[color]} ${className}`}
    />
  );
}
