import React, { forwardRef } from 'react';
import { Spinner } from './Spinner';

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'danger';
type ButtonSize    = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-cb-blue text-white font-semibold
    hover:bg-cb-blue-dark
    active:scale-[0.98]
    shadow-[0_0_30px_rgba(43,168,224,0.3)]
    hover:shadow-[0_0_40px_rgba(43,168,224,0.45)]
    disabled:opacity-50 disabled:cursor-not-allowed
    disabled:shadow-none
  `,
  ghost: `
    bg-transparent text-cb-blue font-semibold
    hover:bg-cb-blue/10
    active:scale-[0.98]
    disabled:opacity-50 disabled:cursor-not-allowed
  `,
  outline: `
    bg-transparent text-cb-text font-semibold
    border border-cb-dark-border
    hover:border-cb-blue/50 hover:text-cb-blue
    active:scale-[0.98]
    disabled:opacity-50 disabled:cursor-not-allowed
  `,
  danger: `
    bg-red-500/10 text-red-700 font-semibold
    border border-red-500/30
    hover:bg-red-500/15
    active:scale-[0.98]
    disabled:opacity-50 disabled:cursor-not-allowed
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm:  'px-4 py-2 text-sm rounded-xl min-h-[36px]',
  md:  'px-6 py-3 text-base rounded-xl min-h-[44px]',
  lg:  'px-8 py-4 text-lg rounded-2xl min-h-[52px]',
  xl:  'px-10 py-5 text-xl rounded-2xl min-h-[60px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    loadingText,
    leftIcon,
    rightIcon,
    fullWidth = false,
    children,
    disabled,
    className = '',
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-busy={loading}
      aria-disabled={isDisabled}
      className={`
        inline-flex items-center justify-center gap-2.5
        transition-all duration-200
        cursor-pointer select-none
        touch-target
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <>
          <Spinner size="sm" color={variant === 'primary' ? 'white' : 'blue'} />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        <>
          {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
          {children}
          {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
        </>
      )}
    </button>
  );
});
