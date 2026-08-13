import React from 'react';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'glass' | 'elevated' | 'glow';
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
  as?: React.ElementType;
}

const variantStyles = {
  default:  'bg-cb-dark-card border border-cb-dark-border',
  glass:    'glass',
  elevated: 'bg-cb-dark-card border border-cb-dark-border shadow-elevated',
  glow:     'bg-cb-dark-card border border-cb-blue/30 glow-blue-sm',
};

const paddingStyles = {
  sm: 'p-4 sm:p-5',
  md: 'p-6 sm:p-8',
  lg: 'p-8 sm:p-10 md:p-12',
};

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  as: Tag = 'div',
}: CardProps) {
  return (
    <Tag
      className={`
        rounded-2xl
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        ${className}
      `}
    >
      {children}
    </Tag>
  );
}
