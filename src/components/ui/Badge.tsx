import React from 'react';

type BadgeVariant = 'win' | 'lose' | 'invalid' | 'used' | 'blue' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  win:     'bg-emerald-500/10 text-emerald-700 border border-emerald-500/30',
  lose:    'bg-cb-brown/10 text-cb-brown border border-cb-brown/30',
  invalid: 'bg-red-500/10 text-red-700 border border-red-500/30',
  used:    'bg-amber-500/10 text-amber-700 border border-amber-500/30',
  blue:    'bg-cb-blue/10 text-cb-blue border border-cb-blue/30',
  neutral: 'bg-cb-dark-surface text-cb-text-muted border border-cb-dark-border',
};

export function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        px-3 py-1 rounded-full
        text-xs font-semibold tracking-wider uppercase
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
