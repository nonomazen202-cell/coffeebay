import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '../../../components/ui/Logo';
import { Card } from '../../../components/ui/Card';
import { Container } from '../../../components/layout/Container';

export const metadata: Metadata = {
  title: 'Invalid Code — CoffeeBay Lucky Cup',
  description: 'The serial code you entered could not be found. Please check and try again.',
};

export default function InvalidPage() {
  return (
    <div className="bg-brand-gradient min-h-dvh flex flex-col">

      {/* Background glows - premium floating glassmorphic orbs */}
      <div aria-hidden="true" className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[15%] w-[480px] h-[480px] rounded-full bg-red-500/8 blur-[130px] animate-float-orb" />
        <div className="absolute bottom-[5%] right-[15%] w-[680px] h-[680px] rounded-full bg-cb-blue/15 blur-[130px] animate-float-orb-r" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex justify-center px-4 py-5">
        <Logo width={130} height={40} />
      </nav>

      {/* Main */}
      <main
        id="main-content"
        className="relative z-10 flex-1 flex items-center justify-center px-4 py-8"
      >
        <Container size="sm">
          <div className="space-y-6 text-center">

            {/* Icon */}
            <div
              className="
                mx-auto w-20 h-20 rounded-2xl
                bg-red-500/10 border border-red-500/30
                flex items-center justify-center
              "
              role="img"
              aria-label="Warning icon"
            >
              <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>

            {/* Label */}
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-red-500/10 border border-red-500/30 text-red-700 text-label">
              Code Not Found
            </div>

            {/* Headline */}
            <div>
              <h1 className="text-hero text-cb-text mb-4">Invalid Serial Code</h1>
              <p className="text-body text-cb-text-muted max-w-[36ch] mx-auto leading-relaxed">
                We couldn&apos;t find that code in our system. Please double-check
                and make sure you entered it correctly.
              </p>
            </div>

            {/* Tips card */}
            <Card variant="glass" padding="md" className="text-left">
              <h2 className="text-sm font-bold text-cb-text-muted tracking-widest uppercase mb-4">
                Things to Check
              </h2>
              <ul className="space-y-3" role="list">
                {[
                  { icon: '🔤', text: 'Codes are uppercase — no lowercase letters.' },
                  { icon: '📐', text: 'Format is XXXX-XXXX (8 characters + 1 hyphen).' },
                  { icon: '👁️', text: 'Watch for common mix-ups: 0 (zero) vs O (letter), 1 vs l vs I.' },
                  { icon: '📱', text: 'If you scanned a QR, try typing the code manually instead.' },
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-3 text-cb-text-muted text-sm">
                    <span className="flex-shrink-0 text-base mt-0.5" aria-hidden="true">{tip.icon}</span>
                    {tip.text}
                  </li>
                ))}
              </ul>

              {/* Example code */}
              <div className="mt-5 p-4 rounded-xl bg-cb-dark-surface border border-cb-dark-border">
                <p className="text-xs text-cb-text-subtle mb-2 font-semibold uppercase tracking-wider">
                  Example format
                </p>
                <p className="verification-code text-center">KB7X-91PA</p>
              </div>
            </Card>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                href="/claim"
                id="retry-cta"
                className="
                  inline-flex items-center justify-center gap-2
                  px-8 py-4 rounded-2xl
                  bg-cb-blue hover:bg-cb-blue-dark
                  text-white font-bold text-base
                  shadow-[0_0_30px_rgba(43,168,224,0.3)]
                  hover:shadow-[0_0_50px_rgba(43,168,224,0.45)]
                  transition-all duration-300
                  active:scale-[0.97]
                  touch-target
                "
              >
                Try Again
              </Link>
              <Link
                href="/"
                className="
                  inline-flex items-center justify-center gap-2
                  px-8 py-4 rounded-2xl
                  bg-transparent text-cb-text-muted
                  hover:text-cb-text
                  border border-cb-dark-border hover:border-cb-blue/30
                  font-semibold text-base
                  transition-all duration-200
                  touch-target
                "
              >
                Back to Home
              </Link>
            </div>

            {/* Help note */}
            <p className="text-xs text-cb-text-subtle pt-2">
              Still having trouble?{' '}
              <span className="text-cb-blue">Contact a CoffeeBay barista for assistance.</span>
            </p>

          </div>
        </Container>
      </main>

      <footer className="relative z-10 text-center py-6 px-4">
        <p className="text-xs text-cb-text-subtle">
          CoffeeBay Lucky Cup &mdash; Codes are printed on the inside of every cup.
        </p>
      </footer>
    </div>
  );
}
