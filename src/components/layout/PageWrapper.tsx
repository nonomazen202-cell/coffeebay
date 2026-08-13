import React from 'react';

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
  /** Apply the brand radial gradient overlay */
  withGradient?: boolean;
  /** Center content vertically (good for result pages) */
  centered?: boolean;
}

export function PageWrapper({
  children,
  className = '',
  withGradient = true,
  centered = false,
}: PageWrapperProps) {
  return (
    <div
      className={`
        min-h-dvh relative
        ${withGradient ? 'bg-brand-gradient' : 'bg-cb-dark'}
        ${centered ? 'flex flex-col items-center justify-center' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
