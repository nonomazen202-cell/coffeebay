'use client';

import React, { useEffect, useRef, useCallback } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: Record<string, unknown>
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  theme?: 'dark' | 'light';
}

export function TurnstileWidget({
  siteKey,
  onVerify,
  onExpire,
  onError,
  theme = 'dark',
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef  = useRef<string | null>(null);

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return;

    // Clean up previous instance
    if (widgetIdRef.current !== null) {
      try { window.turnstile.remove(widgetIdRef.current); } catch { /* noop */ }
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey:  siteKey,
      theme,
      callback:        onVerify,
      'expired-callback': onExpire,
      'error-callback':   onError,
    });
  }, [siteKey, theme, onVerify, onExpire, onError]);

  useEffect(() => {
    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Inject Turnstile script if not already present
    const existing = document.querySelector('script[data-turnstile]');
    if (existing) {
      existing.addEventListener('load', renderWidget);
      return () => existing.removeEventListener('load', renderWidget);
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = 'true';
    script.onload = renderWidget;
    document.head.appendChild(script);

    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* noop */ }
      }
    };
  }, [renderWidget]);

  return (
    <div
      ref={containerRef}
      className="flex justify-center"
      aria-label="Security verification"
    />
  );
}
