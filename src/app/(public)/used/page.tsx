import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '../../../components/ui/Logo';
import { Card } from '../../../components/ui/Card';
import { Container } from '../../../components/layout/Container';

export const metadata: Metadata = {
  title: 'Code Already Used — CoffeeBay Lucky Cup',
  description: 'This serial code has already been redeemed. Each code can only be used once.',
};

export default function UsedPage() {
  return (
    <div className="bg-brand-gradient min-h-dvh flex flex-col">

      {/* Background glows - premium floating glassmorphic orbs */}
      <div aria-hidden="true" className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[15%] w-[480px] h-[480px] rounded-full bg-amber-500/8 blur-[130px] animate-float-orb" />
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
                bg-amber-500/10 border border-amber-500/30
                flex items-center justify-center
              "
              role="img"
              aria-label="Locked icon"
            >
              <svg className="w-10 h-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>

            {/* Label */}
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 text-label">
              Already Redeemed
            </div>

            {/* Headline */}
            <div>
              <h1 className="text-hero text-cb-text mb-4">Code Already Used</h1>
              <p className="text-body text-cb-text-muted max-w-[36ch] mx-auto leading-relaxed">
                This serial code has already been redeemed. Each CoffeeBay cup
                code can only be used once to ensure fairness for everyone.
              </p>
            </div>

            {/* Info card */}
            <Card variant="glass" padding="md" className="text-left">
              <h2 className="text-sm font-bold text-cb-text-muted tracking-widest uppercase mb-4">
                What This Means
              </h2>
              <ul className="space-y-4" role="list">
                {[
                  {
                    icon: '✅',
                    title: 'Code was already redeemed',
                    desc: 'Someone has already submitted this code and received a result.',
                  },
                  {
                    icon: '🔒',
                    title: 'Each code is unique',
                    desc: 'For fairness, every code can only be entered once across our system.',
                  },
                  {
                    icon: '🤔',
                    title: 'Not you who used it?',
                    desc: 'If you believe this is an error, please speak to a CoffeeBay staff member immediately.',
                  },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 text-lg mt-0.5" aria-hidden="true">{item.icon}</span>
                    <div>
                      <p className="text-cb-text font-semibold text-sm">{item.title}</p>
                      <p className="text-cb-text-muted text-sm leading-relaxed mt-0.5">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                href="/claim"
                id="new-code-cta"
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
                Use a Different Code
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

          </div>
        </Container>
      </main>

      <footer className="relative z-10 text-center py-6 px-4">
        <p className="text-xs text-cb-text-subtle">
          Suspicious activity? Contact us at your nearest CoffeeBay branch.
        </p>
      </footer>
    </div>
  );
}
