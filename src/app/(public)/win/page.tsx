"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { Logo } from "../../../components/ui/Logo";
import { Card } from "../../../components/ui/Card";

// Dynamic import — particles are heavy and not needed on initial paint
const CelebrationParticles = dynamic(
  () =>
    import("../../../components/animations/CelebrationParticles").then(
      (m) => m.CelebrationParticles,
    ),
  { ssr: false },
);

// ─────────────────────────────────────────────────────────────────────
//  Animation variants
// ─────────────────────────────────────────────────────────────────────

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
};

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: EASE_OUT_EXPO },
  },
};

const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.65, ease: EASE_OUT_EXPO },
  },
};

const glowPulse: Variants = {
  animate: {
    boxShadow: [
      "0 0 30px rgba(43, 168, 224, 0.15)",
      "0 0 60px rgba(43, 168, 224, 0.35)",
      "0 0 30px rgba(43, 168, 224, 0.15)",
    ],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
  },
};

// ─────────────────────────────────────────────────────────────────────
//  Copy-to-clipboard button
// ─────────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? "Copied!" : "Copy verification code"}
      className="
        inline-flex items-center gap-2
        px-4 py-2 rounded-xl
        bg-cb-blue/10 hover:bg-cb-blue/20
        text-cb-blue text-sm font-bold
        border border-cb-blue/30 hover:border-cb-blue/50
        transition-all duration-200
        active:scale-95
        touch-target
      "
    >
      {copied ? (
        <>
          <svg
            aria-hidden="true"
            className="w-4 h-4 text-emerald-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="text-emerald-500">Copied!</span>
        </>
      ) : (
        <>
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
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Copy Ticket Key
        </>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Next Steps list
// ─────────────────────────────────────────────────────────────────────

const NEXT_STEPS = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2BA8E0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
    title: "SMS Confirmation",
    desc: "A confirmation message with your ticket key has been queued to your phone.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2BA8E0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    title: "Visit Any CoffeeBay Branch",
    desc: "Head to your nearest branch and present your ticket key to our staff.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2BA8E0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
        <path d="M12 18h.01" />
      </svg>
    ),
    title: "Claim & Enjoy",
    desc: "Our team will verify the ticket in the system and deliver your prize instantly.",
  },
];

const KENZ_BRANDS = [
  "Zara",
  "Bershka",
  "Stradivarius",
  "Oysho",
  "Kiko Milano",
  "Pull & Bear",
  "Massimo Dutti",
  "Sunglass Hut",
];

// ─────────────────────────────────────────────────────────────────────
//  Win Page Content Component
// ─────────────────────────────────────────────────────────────────────

function WinContent() {
  const params = useSearchParams();
  const verificationCode = params.get("code") ?? "";
  const prizeName = params.get("prize") ?? "Your Prize";
  const prizeImageUrl = params.get("image") ?? "";
  const [showParticles, setShowParticles] = useState(false);

  // Fire particles after initial animation settles
  useEffect(() => {
    const t = setTimeout(() => setShowParticles(true), 900);
    return () => clearTimeout(t);
  }, []);

  const isKenz = prizeName.toLowerCase().includes("kenz");

  return (
    <div className="bg-brand-gradient min-h-dvh flex flex-col overflow-x-hidden">
      {/* Background ambient lighting glows */}
      <div
        aria-hidden="true"
        className="fixed inset-0 overflow-hidden pointer-events-none z-0"
      >
        <div className="absolute top-[8%] left-[10%] w-[700px] h-[700px] rounded-full bg-cb-blue/15 blur-[140px] animate-float-orb" />
        <div className="absolute bottom-[5%] right-[10%] w-[520px] h-[520px] rounded-full bg-emerald-500/10 blur-[140px] animate-float-orb-r" />
      </div>

      {/* Celebration particles */}
      <CelebrationParticles active={showParticles} count={130} />

      {/* Navigation Header */}
      <nav className="relative z-10 flex justify-center px-4 py-5 sm:py-6">
        <Link href="/" aria-label="Go to homepage">
          <Logo width={130} height={42} />
        </Link>
      </nav>

      {/* Main Container */}
      <main
        id="main-content"
        className="relative z-10 flex-1 flex items-center justify-center px-3 sm:px-6 py-4 sm:py-8"
      >
        <div className="w-full max-w-md sm:max-w-lg mx-auto">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {/* ── 1. TOP WIN BADGE ── */}
            <motion.div variants={fadeUpVariants} className="text-center">
              <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs sm:text-sm font-bold tracking-wide shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                CONGRATULATIONS!
              </div>
            </motion.div>

            {/* ── 2. HEADLINE & PRIZE NAME (ABOVE THE BOX) ── */}
            <motion.div variants={fadeUpVariants} className="text-center space-y-2">
              <h1 className="text-3xl sm:text-5xl font-extrabold text-cb-text tracking-tight">
                You{" "}
                <motion.span
                  className="text-cb-blue text-glow-blue inline-block font-black"
                  animate={{
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    duration: 2.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  Won!
                </motion.span>
              </h1>
              
              <div className="pt-2">
                <p className="text-xs sm:text-sm font-extrabold tracking-widest text-cb-blue uppercase mb-1">
                  ✦ Your Official Prize ✦
                </p>
                <h2 className="text-2xl sm:text-4xl font-black text-cb-brown leading-tight drop-shadow-sm px-2">
                  {prizeName}
                </h2>
              </div>
            </motion.div>

            {/* ── 3. FULL PRODUCT SHOWCASE CARD (DIRECT EDGE-TO-EDGE) ── */}
            <motion.div variants={scaleInVariants}>
              <motion.div
                variants={glowPulse}
                animate="animate"
                className="
                  rounded-3xl bg-cb-dark-card/95 backdrop-blur-xl
                  border border-cb-blue/35 text-center
                  relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.12)]
                "
              >
                {/* Holographic Shimmer Effect */}
                <motion.div
                  className="absolute inset-0 pointer-events-none z-20"
                  style={{
                    background:
                      "linear-gradient(115deg, transparent 35%, rgba(43, 168, 224, 0.05) 48%, rgba(43, 168, 224, 0.15) 50%, rgba(43, 168, 224, 0.05) 52%, transparent 65%)",
                    backgroundSize: "200% 100%",
                  }}
                  animate={{
                    backgroundPosition: ["150% 0%", "-50% 0%"],
                  }}
                  transition={{
                    duration: 3.8,
                    repeat: Infinity,
                    ease: "linear",
                    repeatDelay: 1.5,
                  }}
                />

                {/* Decorative Sparkle Icons */}
                <motion.span
                  className="absolute right-4 top-4 text-cb-blue select-none opacity-70 z-20"
                  animate={{
                    scale: [0.8, 1.2, 0.8],
                    opacity: [0.4, 0.9, 0.4],
                    rotate: [0, 45, 0],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  </svg>
                </motion.span>

                <motion.span
                  className="absolute left-4 top-4 text-cb-blue select-none opacity-70 z-20"
                  animate={{
                    scale: [1.2, 0.8, 1.2],
                    opacity: [0.3, 0.8, 0.3],
                    rotate: [0, -45, 0],
                  }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  </svg>
                </motion.span>

                {/* ── MASSIVE HERO IMAGE (SNUG FIT WITHOUT SIDE GAPS) ── */}
                {prizeImageUrl ? (
                  <div className="relative w-full aspect-square overflow-hidden flex items-center justify-center bg-gradient-to-b from-cb-blue/15 via-transparent to-cb-dark-surface/50">
                    {/* Ambient Radial Spotlight */}
                    <div className="absolute inset-0 bg-radial-gradient from-cb-blue/25 via-transparent to-transparent opacity-90 pointer-events-none" />
                    
                    <Image
                      src={prizeImageUrl}
                      alt={prizeName}
                      fill
                      sizes="(max-width: 640px) 100vw, 500px"
                      className="object-cover w-full h-full drop-shadow-[0_25px_50px_rgba(43,168,224,0.45)] transition-transform duration-500 hover:scale-105"
                      priority
                    />
                  </div>
                ) : (
                  <div className="my-6 py-16 relative z-10 flex flex-col items-center justify-center">
                    <div className="w-24 h-24 rounded-3xl bg-cb-blue/10 border border-cb-blue/30 flex items-center justify-center text-cb-blue mb-3 shadow-inner">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-cb-text-muted">Special Winning Cup</p>
                  </div>
                )}

                {/* ── KENZ CARD BRAND LIST ── */}
                {isKenz && (
                  <div className="p-4 sm:p-5 m-3 sm:m-4 rounded-2xl bg-cb-dark-surface/90 border border-cb-blue/25 relative z-10 text-center shadow-sm">
                    <p className="text-xs font-bold text-cb-blue tracking-wider uppercase mb-2.5 flex items-center justify-center gap-1.5">
                      <span>🛍️</span>
                      <span>Redeemable at Top Fashion &amp; Lifestyle Brands</span>
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-md mx-auto">
                      {KENZ_BRANDS.map((brand) => (
                        <span
                          key={brand}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-cb-blue/10 border border-cb-blue/25 text-cb-text shadow-xs"
                        >
                          {brand}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="px-4 py-3 sm:py-4 border-t border-cb-blue/15 bg-cb-dark-surface/30">
                  <p className="text-cb-text-muted text-xs sm:text-sm relative z-10 font-medium">
                    Present your ticket key at any CoffeeBay branch to claim your prize.
                  </p>
                </div>
              </motion.div>
            </motion.div>

            {/* ── 4. OFFICIAL TICKET KEY BOX ── */}
            {verificationCode && (
              <motion.div variants={fadeUpVariants}>
                <Card variant="glass" padding="md" className="border-cb-blue/30 shadow-md">
                  <div className="text-center py-1">
                    <p className="text-xs font-bold tracking-widest text-cb-blue uppercase mb-2">
                      Official Ticket Key
                    </p>
                    <p
                      className="text-2xl sm:text-4xl font-mono font-black text-cb-text tracking-wider my-2 select-all bg-cb-dark-surface/80 py-2.5 px-4 rounded-xl border border-cb-blue/20 inline-block shadow-inner"
                      aria-label={`Verification code: ${verificationCode}`}
                    >
                      {verificationCode}
                    </p>
                    <div className="flex items-center justify-center gap-3 flex-wrap mt-3">
                      <CopyButton text={verificationCode} />
                      <p className="text-xs text-cb-text-subtle font-medium">
                        Also sent via SMS (from &apos;Seashell&apos;)
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ── 5. NEXT STEPS GUIDE ── */}
            <motion.div variants={fadeUpVariants}>
              <Card variant="default" padding="md" className="border-cb-dark-border/80">
                <h2 className="text-xs font-bold text-cb-text-muted tracking-widest uppercase mb-5">
                  How To Claim Your Prize
                </h2>
                <ol
                  className="space-y-4"
                  aria-label="Steps to claim your prize"
                >
                  {NEXT_STEPS.map((step, i) => (
                    <li key={i} className="flex items-start gap-3.5">
                      <span
                        className="flex-shrink-0 w-10 h-10 rounded-2xl bg-cb-dark-surface border border-cb-blue/20 flex items-center justify-center text-lg shadow-xs"
                        aria-hidden="true"
                      >
                        {step.icon}
                      </span>
                      <div className="pt-0.5">
                        <p className="text-cb-text font-bold text-sm sm:text-base">
                          {step.title}
                        </p>
                        <p className="text-cb-text-muted text-xs sm:text-sm leading-relaxed mt-0.5">
                          {step.desc}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
            </motion.div>

            {/* ── 6. BACK TO HOME CTA ── */}
            <motion.div variants={fadeUpVariants} className="text-center pt-2 pb-4">
              <Link
                href="/"
                className="
                  inline-flex items-center justify-center gap-2
                  px-8 py-3.5 rounded-2xl
                  bg-cb-blue/10 hover:bg-cb-blue/20 text-cb-blue
                  border border-cb-blue/30 hover:border-cb-blue/50
                  font-bold text-sm sm:text-base
                  transition-all duration-200
                  touch-target
                "
              >
                ← Back to Homepage
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-6 px-4">
        <p className="text-xs text-cb-text-subtle font-medium">
          Prize must be claimed within 30 days. Terms &amp; conditions apply.
        </p>
      </footer>
    </div>
  );
}

// ─── Suspense shell required by Next.js for useSearchParams ──────────
export default function WinPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-brand-gradient min-h-dvh flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-cb-blue/30 border-t-cb-blue animate-spin" />
        </div>
      }
    >
      <WinContent />
    </Suspense>
  );
}
