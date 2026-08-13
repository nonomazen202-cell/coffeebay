import React from 'react';
import { Input } from '../ui/Input';

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  inputProps: React.InputHTMLAttributes<HTMLInputElement> & {
    codeStyle?: boolean;
    leftElement?: React.ReactNode;
    rightElement?: React.ReactNode;
  };
}

export function FormField({
  id,
  label,
  error,
  hint,
  required = false,
  inputProps,
}: FormFieldProps) {
  const { codeStyle, leftElement, rightElement, ...rest } = inputProps;
  const errorId = `${id}-error`;
  const hintId  = `${id}-hint`;

  const describedBy = [
    error ? errorId : null,
    hint  ? hintId  : null,
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-cb-text-muted tracking-wide"
      >
        {label}
        {required && (
          <span className="text-cb-blue ml-1" aria-label="required">
            *
          </span>
        )}
      </label>

      <Input
        id={id}
        name={id}
        codeStyle={codeStyle}
        hasError={!!error}
        leftElement={leftElement}
        rightElement={rightElement}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        {...rest}
      />

      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5 text-sm text-red-600 mt-1"
        >
          <svg
            aria-hidden="true"
            className="w-3.5 h-3.5 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}

      {hint && !error && (
        <p id={hintId} className="text-xs text-cb-text-subtle mt-1">
          {hint}
        </p>
      )}
    </div>
  );
}
