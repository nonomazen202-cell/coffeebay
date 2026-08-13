import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** If true, renders with mono font and uppercase — for serial codes */
  codeStyle?: boolean;
  /** Shows an error ring */
  hasError?: boolean;
  /** Left decorative icon/element */
  leftElement?: React.ReactNode;
  /** Right decorative icon/element */
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    codeStyle = false,
    hasError = false,
    leftElement,
    rightElement,
    className = '',
    ...props
  },
  ref
) {
  return (
    <div className="relative flex items-center">
      {leftElement && (
        <span className="absolute left-3.5 text-cb-text-muted pointer-events-none" aria-hidden="true">
          {leftElement}
        </span>
      )}

      <input
        ref={ref}
        className={`
          w-full
          bg-cb-dark-surface
          border
          ${hasError
            ? 'border-red-500/70 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
            : 'border-cb-dark-border focus:border-cb-blue focus:ring-2 focus:ring-cb-blue/20'
          }
          text-cb-text
          placeholder:text-cb-text-subtle
          rounded-xl
          px-4 py-3.5
          text-base
          min-h-[52px]
          transition-all duration-200
          outline-none
          ${leftElement ? 'pl-10' : ''}
          ${rightElement ? 'pr-10' : ''}
          ${codeStyle ? 'serial-code-input font-mono tracking-wider' : ''}
          ${className}
        `}
        {...props}
      />

      {rightElement && (
        <span className="absolute right-3.5 text-cb-text-muted pointer-events-none" aria-hidden="true">
          {rightElement}
        </span>
      )}
    </div>
  );
});
