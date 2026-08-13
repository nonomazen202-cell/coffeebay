import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Logo } from "../../components/ui/Logo";
import { Container } from "../../components/layout/Container";
import { Section } from "../../components/layout/Section";

export const metadata: Metadata = {
  title: "CoffeeBay Lucky Cup — Try Your Luck",
  description:
    "Your CoffeeBay cup features a serial code. Enter it below and discover if fortune is on your side today.",
};

// ─────────────────────────────────────────────────────────────────────
//  Section icons
// ─────────────────────────────────────────────────────────────────────

function CupIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="w-full h-full"
    >
      <rect
        x="8"
        y="14"
        width="32"
        height="4"
        rx="2"
        fill="#2BA8E0"
        opacity="0.9"
      />
      <path
        d="M10 18 L13 42 Q13 44 16 44 L32 44 Q35 44 35 42 L38 18Z"
        fill="#2BA8E0"
        opacity="0.85"
      />
      <path
        d="M38 22 Q46 22 46 30 Q46 38 38 38"
        stroke="#2BA8E0"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M19 10 Q22 5 19 0"
        stroke="#7B3B1B"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M24 10 Q27 4 24 -1"
        stroke="#7B3B1B"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M29 10 Q32 5 29 0"
        stroke="#7B3B1B"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="24" cy="32" r="6" fill="#231F20" />
      <path
        d="M24 26L25.5 30.5L30.5 30.5L26.5 33.5L28 38L24 35L20 38L21.5 33.5L17.5 30.5L22.5 30.5Z"
        fill="#2BA8E0"
      />
    </svg>
  );
}

function QRIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="w-full h-full"
    >
      <rect
        x="6"
        y="6"
        width="14"
        height="14"
        rx="2"
        stroke="#2BA8E0"
        strokeWidth="2.5"
        fill="none"
      />
      <rect x="10" y="10" width="6" height="6" rx="1" fill="#2BA8E0" />
      <rect
        x="28"
        y="6"
        width="14"
        height="14"
        rx="2"
        stroke="#2BA8E0"
        strokeWidth="2.5"
        fill="none"
      />
      <rect x="32" y="10" width="6" height="6" rx="1" fill="#2BA8E0" />
      <rect
        x="6"
        y="28"
        width="14"
        height="14"
        rx="2"
        stroke="#2BA8E0"
        strokeWidth="2.5"
        fill="none"
      />
      <rect x="10" y="32" width="6" height="6" rx="1" fill="#2BA8E0" />
      <path
        d="M28 28h4v4h-4z M36 28h4v4h-4z M32 32h4v4h-4z M28 36h4v4h-4z M36 36h4v4h-4z"
        fill="#2BA8E0"
      />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="w-full h-full"
    >
      <path
        d="M16 6 H32 V28 Q32 38 24 40 Q16 38 16 28 Z"
        fill="none"
        stroke="#2BA8E0"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M16 12 Q8 12 8 20 Q8 28 16 28"
        stroke="#2BA8E0"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M32 12 Q40 12 40 20 Q40 28 32 28"
        stroke="#2BA8E0"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M18 40 H30 M21 40 L20 44 H28 L27 40"
        stroke="#2BA8E0"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 14 L25.5 18.5 L30 18.5 L26.5 21.5 L28 26 L24 23 L20 26 L21.5 21.5 L18 18.5 L22.5 18.5 Z"
        fill="#2BA8E0"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  DATA
// ─────────────────────────────────────────────────────────────────────

const steps = [
  {
    step: "01",
    title: "Buy Your Cup",
    description:
      "Purchase any beverage at CoffeeBay. Each cup features a unique serial number printed on it.",
    icon: CupIcon,
  },
  {
    step: "02",
    title: "Scan & Enter Code",
    description:
      "Scan the QR code on your cup to open this page, then enter your serial number.",
    icon: QRIcon,
  },
  {
    step: "03",
    title: "Discover Your Prize",
    description:
      "Fill in your details and press reveal. You could win an iPhone, AirPods, discount coupons, and more.",
    icon: TrophyIcon,
  },
] as const;

const prizeCategories = [
  {
    label: "Free Beverages",
    desc: "Warm coffee, cold brews, or refreshing specialty drinks.",
    color: "#2BA8E0",
  },
  {
    label: "Bakery & Sweets",
    desc: "Freshly baked croissants, cookies, or signature cakes.",
    color: "#7B3B1B",
  },
  {
    label: "Discount Vouchers",
    desc: "Immediate discounts (up to 50%) on your next order.",
    color: "#5fc0ea",
  },
  {
    label: "Tech Accessories",
    desc: "Exciting tech gifts and smart accessories.",
    color: "#a0522d",
  },
] as const;

// ─────────────────────────────────────────────────────────────────────
//  PAGE
// ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="bg-brand-gradient min-h-dvh overflow-x-hidden relative">
      {/* ── Layer 2: Animated glow orbs (placed relative to hero height, but not clipped) ── */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-dvh pointer-events-none z-0"
      >
        {/* Main Blue Glow: right on desktop, below text on mobile */}
        <div
          className="
            absolute rounded-full bg-cb-blue/26 blur-[110px] animate-float-orb animate-glow-pulse
            w-[450px] h-[450px] lg:w-[680px] lg:h-[680px]
            top-[42%] lg:top-[-10%]
            left-1/2 lg:left-auto lg:right-[5%]
            -translate-x-1/2 lg:translate-x-0
          "
        />
        {/* Brown Glow: bottom-left to balance the blue */}
        <div
          className="
            absolute rounded-full bg-cb-brown/12 blur-[90px] animate-float-orb-r
            w-[300px] h-[300px] lg:w-[400px] lg:h-[400px]
            bottom-[-5%] lg:bottom-[-8%]
            left-[5%] lg:left-[8%]
          "
        />

        {/* Subtle Warm highlight */}
        <div
          className="
            absolute rounded-full bg-amber-400/6 blur-[60px] animate-float-orb-r
            w-[200px] h-[200px]
            top-[20%] right-[-5%]
          "
          style={{ animationDelay: "1.5s" }}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════ */}
      <header className="relative min-h-dvh flex flex-col overflow-hidden">
        {/* ── Layer 1: Animated grid ── */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to bottom, black 60%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 60%, transparent 100%)",
          }}
        >
          <svg
            className="absolute inset-0 w-full h-full animate-grid-fade"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="hero-grid"
                width="60"
                height="60"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 60 0 L 0 0 0 60"
                  fill="none"
                  stroke="rgba(43,168,224,1)"
                  strokeWidth="0.4"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-grid)" />
          </svg>
          {/* Fade edges so grid vanishes at borders without hard boundary cuts */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 40%, rgba(246, 244, 240, 0.9) 85%, transparent 100%)",
            }}
          />
        </div>

        {/* ── Nav bar ── */}
        <nav className="relative z-10 flex items-center justify-between w-full mx-auto max-w-8xl px-4 sm:px-8 lg:px-16 xl:px-24 py-5">
          <Logo width={100} height={45} />
          <Link
            href="/claim"
            id="nav-cta"
            className="
              inline-flex items-center gap-2 px-5 py-2.5
              bg-cb-blue/10 hover:bg-cb-blue/20
              text-cb-blue text-sm font-semibold
              border border-cb-blue/25 hover:border-cb-blue/50
              rounded-full transition-all duration-200
              touch-target
            "
          >
            Try Your Luck
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
        </nav>

        {/* ── Hero body ── */}
        <div
          className="
          relative z-10 flex-1 flex
          flex-col lg:flex-row
          items-center
          justify-center
          gap-10 lg:gap-6
          w-full mx-auto max-w-8xl
          px-4 sm:px-8 lg:px-16 xl:px-24
          pb-10 pt-4
        "
        >
          {/* ──── LEFT: Text ──── */}
          <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left max-w-xl w-full">
            {/* Badge */}
            <div
              className="
              inline-flex items-center gap-2.5
              px-4 py-1.5 mb-8 rounded-full
              glass-blue text-cb-blue text-label
              animate-badge-glow
            "
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cb-blue animate-pulse" />
              Limited Time Campaign
            </div>

            {/* Main headline */}
            <h1 className="text-display uppercase tracking-[5px]! text-cb-text mb-6">
              <span className="text-cb-blue">Every Cup</span>
              <br />
              <span className="text-cb-brown text-glow-brown font-bold!">
                Hides a
              </span>
              <br />
              <span className="animate-shimmer-brown">Secret</span>
            </h1>

            <p className="text-body text-cb-text-muted mb-10 max-w-[38ch] mx-auto lg:mx-0">
              Your CoffeeBay cup features a serial code. Enter it below
              and discover if fortune is on your side today.
            </p>

            {/* Primary CTA */}
            <Link
              href="/claim"
              id="hero-cta"
              className="
                inline-flex items-center justify-center gap-3
                px-10 py-5 rounded-2xl
                bg-cb-blue hover:bg-cb-blue-dark
                text-white text-lg font-bold
                shadow-[0_0_40px_rgba(43,168,224,0.45)]
                hover:shadow-[0_0_70px_rgba(43,168,224,0.65)]
                transition-all duration-300
                active:scale-[0.97]
                touch-target w-full sm:w-auto
                relative overflow-hidden
                group
              "
            >
              {/* Shimmer sweep on hover */}
              <span
                aria-hidden="true"
                className="
                  absolute inset-0
                  bg-gradient-to-r from-transparent via-white/15 to-transparent
                  -translate-x-full group-hover:translate-x-full
                  transition-transform duration-700
                "
              />
              <span className="relative flex items-center gap-3">
                Try Your Luck
                <svg
                  aria-hidden="true"
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </span>
            </Link>


          </div>

          {/* ──── RIGHT: Animated Cup Visual ──── */}
          <div className="flex-1 flex items-center justify-center w-full max-w-sm lg:max-w-none">
            <div className="relative w-[260px] h-[260px] sm:w-[320px] sm:h-[320px] lg:w-[380px] lg:h-[380px]">
              {/* Outer pulse ring 1 */}
              <div
                className="absolute inset-0 rounded-full border border-cb-blue/25 animate-ring-pulse"
                style={{ animationDelay: "0s" }}
              />
              {/* Outer pulse ring 2 */}
              <div
                className="absolute inset-0 rounded-full border border-cb-blue/15 animate-ring-pulse"
                style={{ animationDelay: "1s" }}
              />
              {/* Outer pulse ring 3 */}
              <div
                className="absolute inset-0 rounded-full border border-cb-blue/10 animate-ring-pulse"
                style={{ animationDelay: "1.8s" }}
              />

              {/* Static decorative rings */}
              <div className="absolute inset-[12%] rounded-full border border-cb-blue/10" />
              <div className="absolute inset-[24%] rounded-full border border-cb-blue/15" />

              {/* Glow behind cup */}
              <div className="absolute inset-[22%] rounded-full bg-cb-blue/35 blur-3xl animate-cup-halo" />

              {/* ── Orbiting elements ── */}
              {/* iPhone prize — orbits clockwise */}
              <div
                className="absolute animate-orbit"
                style={{ top: "calc(50% - 18px)", left: "calc(50% - 18px)" }}
              >
                <div
                  className="
                  w-9 h-9 rounded-full
                  glass-blue flex items-center justify-center text-base
                  border border-cb-blue/30
                  shadow-[0_0_16px_rgba(43,168,224,0.4)]
                "
                >
                  📱
                </div>
              </div>

              {/* Star — orbits counter-clockwise at different radius */}
              <div
                className="absolute animate-orbit-sm"
                style={{ top: "calc(50% - 14px)", left: "calc(50% - 14px)" }}
              >
                <div
                  className="
                  w-7 h-7 rounded-full
                  bg-amber-400/15 border border-amber-400/40
                  flex items-center justify-center text-xs
                  shadow-[0_0_12px_rgba(251,191,36,0.35)]
                "
                >
                  ⭐
                </div>
              </div>

              {/* Gift — orbit clockwise, larger radius, delayed */}
              <div
                className="absolute animate-orbit"
                style={{
                  top: "calc(50% - 14px)",
                  left: "calc(50% - 14px)",
                  animationDuration: "16s",
                  animationDelay: "-6s",
                }}
              >
                <div
                  className="
                  w-7 h-7 rounded-full
                  bg-cb-brown/30 border border-cb-brown-light/40
                  flex items-center justify-center text-xs
                  shadow-[0_0_12px_rgba(160,82,45,0.3)]
                "
                >
                  🎁
                </div>
              </div>

              {/* ── Central cup + steam ── */}
              <div className="absolute inset-0 flex flex-col items-center justify-center animate-float-slow">
                {/* Cup wrapper — relative so steam can be absolutely positioned over lid */}
                <div className="relative w-[190px] sm:w-[230px] lg:w-[270px]">
                  {/* Steam wisps — emerge from lid (top ~18% of image) */}
                  <div
                    aria-hidden="true"
                    className="absolute left-1/2 -translate-x-1/2 flex gap-3 items-end pointer-events-none"
                    style={{ top: "-28px", zIndex: 10 }}
                  >
                    <div className="w-[5px] h-7 rounded-full bg-cb-blue/60 blur-[3px] steam-1" />
                    <div className="w-[6px] h-9 rounded-full bg-cb-blue/50 blur-[3px] steam-2" />
                    <div className="w-[5px] h-7 rounded-full bg-cb-blue/60 blur-[3px] steam-3" />
                  </div>

                  {/* Cup image — mix-blend-mode screen removes white bg on dark surfaces */}
                  <Image
                    src="/Coffee_Cup_Mockup.png"
                    alt="CoffeeBay Lucky Cup"
                    width={520}
                    height={620}
                    priority
                    className="
                      w-full h-auto object-contain
                      mix-blend-mode-screen
                      drop-shadow-[0_0_60px_rgba(43,168,224,0.6)]
                      [mix-blend-mode:screen]
                    "
                  />
                </div>
              </div>

              {/* Subtle radial gradient overlay for depth */}
              <div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse 60% 60% at 50% 50%, transparent 50%, rgba(43, 168, 224, 0.06) 100%)",
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Scroll indicator ── */}
        <div className="relative z-10 flex justify-center pb-8">
          <a
            href="#how-it-works"
            aria-label="Scroll to learn how it works"
            className="flex flex-col items-center gap-2 text-cb-text-subtle hover:text-cb-blue transition-colors duration-300 group"
          >
            <span className="text-xs tracking-widest uppercase font-medium">
              How it works
            </span>
            <svg
              aria-hidden="true"
              className="w-5 h-5 animate-bounce group-hover:text-cb-blue"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </a>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════════════════ */}
      <Section id="how-it-works" spacing="lg">
        <Container size="lg">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-label text-cb-blue mb-3">Simple &amp; Fast</p>
            <h2 className="text-hero text-cb-text font-semibold!">
              How It Works
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            {steps.map((s, i) => (
              <article
                key={s.step}
                className="
                  relative flex flex-col items-center sm:items-start
                  text-center sm:text-left
                  p-6 sm:p-8 rounded-2xl
                  bg-cb-dark-card border border-cb-dark-border
                  hover:border-cb-blue/30 hover:shadow-[0_4px_30px_rgba(43,168,224,0.1)]
                  transition-all duration-300
                "
              >
                <span className="absolute top-5 right-5 text-xs font-bold text-cb-text-subtle tracking-widest">
                  {s.step}
                </span>
                <div className="w-12 h-12 mb-5 sm:mb-6" aria-hidden="true">
                  <s.icon />
                </div>
                <h3 className="text-title text-cb-text mb-3">{s.title}</h3>
                <p className="text-body text-cb-text-muted leading-relaxed">
                  {s.description}
                </p>
                {i < steps.length - 1 && (
                  <div
                    aria-hidden="true"
                    className="hidden sm:block absolute top-1/2 -right-4 w-8 h-px bg-cb-dark-border z-10"
                  />
                )}
              </article>
            ))}
          </div>
        </Container>
      </Section>

      {/* ══════════════════════════════════════════════════════════════
          PRIZES PREVIEW
      ══════════════════════════════════════════════════════════════ */}
      <Section id="prizes" spacing="lg" className="bg-cb-dark-card/50">
        <Container size="lg">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-label text-cb-brown mb-3">What&apos;s Inside</p>
            <h2 className="text-hero text-cb-text font-semibold!">
              What You Can Win
            </h2>
            <p className="text-body text-cb-text-muted mt-4 max-w-[44ch] mx-auto">
              From daily discounts and warm beverages to exclusive merchandise
              and tech gifts — every cup redemption holds an exciting surprise.
            </p>
          </div>

          <div className="flex flex-col sm:grid sm:grid-cols-4 gap-3 sm:gap-4">
            {prizeCategories.map((prize) => (
              <div
                key={prize.label}
                className="
                  flex sm:flex-col items-center sm:items-center
                  gap-4 sm:gap-3
                  p-4 sm:p-5 rounded-2xl
                  glass
                  hover:border-cb-blue/30 hover:shadow-[0_8px_32px_rgba(43,168,224,0.08)]
                  transition-all duration-200
                "
              >
                <div
                  className="flex-shrink-0 w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: prize.color,
                    boxShadow: `0 0 12px ${prize.color}80`,
                  }}
                  aria-hidden="true"
                />
                <div className="flex-1 sm:text-center">
                  <p className="text-cb-text font-bold text-base sm:text-sm">
                    {prize.label}
                  </p>
                  <p className="text-cb-text-subtle text-xs mt-1 leading-relaxed">
                    {prize.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* ══════════════════════════════════════════════════════════════
          BOTTOM CTA
      ══════════════════════════════════════════════════════════════ */}
      <Section spacing="xl">
        <Container size="sm">
          <div
            className="
            text-center p-10 sm:p-16 rounded-3xl
            glass-blue relative overflow-hidden
          "
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-cb-blue/5 rounded-3xl"
            />
            <div className="relative z-10">
              <p className="text-label text-cb-blue mb-4">Ready?</p>
              <h2 className="text-hero text-cb-text mb-5">Your Prize Awaits</h2>
              <p className="text-body text-cb-text-muted mb-8 max-w-[30ch] mx-auto">
                Enter your serial code now. It only takes 30 seconds.
              </p>
              <Link
                href="/claim"
                id="bottom-cta"
                className="
                  inline-flex items-center justify-center gap-3
                  px-10 py-5 rounded-2xl
                  bg-cb-blue hover:bg-cb-blue-dark
                  text-white text-lg font-bold
                  shadow-[0_0_40px_rgba(43,168,224,0.4)]
                  hover:shadow-[0_0_60px_rgba(43,168,224,0.55)]
                  transition-all duration-300
                  active:scale-[0.97]
                  w-full sm:w-auto
                  touch-target
                "
              >
                Claim Your Prize
                <svg
                  aria-hidden="true"
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </Container>
      </Section>

      {/* ══════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-cb-dark-border py-8">
        <Container size="lg">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Logo width={100} height={30} />
            <p className="text-cb-text-subtle text-sm text-center">
              &copy; {new Date().getFullYear()} CoffeeBay. All rights reserved.
            </p>
            <p className="text-cb-text-subtle text-xs text-center">
              Terms &amp; conditions apply. Limited time offer.
            </p>
          </div>
        </Container>
      </footer>
    </div>
  );
}
