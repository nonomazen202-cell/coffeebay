'use client';

import React, { useCallback } from 'react';
import { Input } from '../ui/Input';

interface CodeInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  hasError?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

/** Formats raw input into KB7X-91PA style (4-4 with hyphens) */
function formatSerialCode(raw: string): string {
  // Remove all non-alphanumeric characters and uppercase
  const clean = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);

  // Insert hyphens at position 4
  const parts: string[] = [];
  if (clean.length > 0) parts.push(clean.slice(0, 4));
  if (clean.length > 4) parts.push(clean.slice(4, 8));

  return parts.join('-');
}

export function CodeInput({
  id,
  value,
  onChange,
  hasError = false,
  disabled = false,
  placeholder = 'XXXX-XXXX',
}: CodeInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatSerialCode(e.target.value);
      onChange(formatted);
    },
    [onChange]
  );

  return (
    <Input
      id={id}
      name={id}
      type="text"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      codeStyle
      hasError={hasError}
      disabled={disabled}
      inputMode="text"
      autoCapitalize="characters"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      maxLength={9} /* 8 chars + 1 hyphen */
      aria-label="Serial code"
      aria-describedby={`${id}-format-hint`}
      className="text-center text-lg"
    />
  );
}
