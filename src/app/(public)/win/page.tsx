"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { Logo } from "../../../components/ui/Logo";
import { Card } from "../../../components/ui/Card";
// Button not needed — using plain styled Link for nav

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
  visible: { transition: { staggerChildren: 0.15, delayChildren: 0.3 } },
};

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE_OUT_EXPO },
  },
};

const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.65, ease: EASE_OUT_EXPO },
  },
};

const glowPulse: Variants = {
  animate: {
    boxShadow: [
      "0 0 40px rgba(43, 168, 224, 0.3)",
      "0 0 80px rgba(43, 168, 224, 0.6)",
      "0 0 40px rgba(43, 168, 224, 0.3)",
    ],
    transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
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
      // Fallback for older browsers
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
        text-cb-blue text-sm font-semibold
        border border-cb-blue/25 hover:border-cb-blue/50
        transition-all duration-200
        touch-target
      "
    >
      {copied ? (
        <>
          <svg
            aria-hidden="true"
            className="w-4 h-4"
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
          Copied!
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
          Copy Code
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
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2BA8E0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
    title: "Check your SMS",
    desc: "A confirmation with your prize details has been sent via SMS (from 'Seashell').",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2BA8E0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    title: "Visit CoffeeBay",
    desc: "Bring your verification code to any CoffeeBay branch to claim your prize.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2BA8E0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
        <path d="M12 18h.01" />
      </svg>
    ),
    title: "Show SMS message",
    desc: "Show the confirmation SMS you received to our branch staff to hand over your prize.",
  },
];

// ─────────────────────────────────────────────────────────────────────
//  Page
// ─────────────────────────────────────────────────────────────────────

// ─── Inner component that reads search params ───────────────────────
function WinContent() {
  const params = useSearchParams();
  const verificationCode = params.get("code") ?? "";
  const prizeName = params.get("prize") ?? "Your Prize";
  const prizeImageUrl = params.get("image") ?? "";
  const [showParticles, setShowParticles] = useState(false);

  // Fire particles after initial animation settles
  useEffect(() => {
    const t = setTimeout(() => setShowParticles(true), 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="bg-brand-gradient min-h-dvh flex flex-col overflow-x-hidden">
      {/* Background glows - premium floating glassmorphic orbs */}
      <div
        aria-hidden="true"
        className="fixed inset-0 overflow-hidden pointer-events-none z-0"
      >
        <div className="absolute top-[10%] left-[15%] w-[680px] h-[680px] rounded-full bg-cb-blue/20 blur-[130px] animate-float-orb" />
        <div className="absolute bottom-[5%] right-[15%] w-[480px] h-[480px] rounded-full bg-emerald-500/8 blur-[130px] animate-float-orb-r" />
      </div>

      {/* Celebration particles */}
      <CelebrationParticles active={showParticles} count={125} />

      {/* Nav */}
      <nav className="relative z-10 flex justify-center px-4 py-5">
        <Link href="/">
          <Logo width={130} height={40} />
        </Link>
      </nav>

      {/* Main */}
      <main
        id="main-content"
        className="relative z-10 flex-1 flex items-center justify-center px-4 py-8"
      >
        <div className="w-full max-w-lg">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {/* ── WIN BADGE ── */}
            <motion.div variants={fadeUpVariants} className="text-center">
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 text-label">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Congratulations!
              </div>
            </motion.div>

            {/* ── HEADLINE ── */}
            <motion.div variants={fadeUpVariants} className="text-center">
              <h1 className="text-display text-cb-text mb-3">
                You{" "}
                <motion.span
                  className="text-cb-blue text-glow-blue inline-block font-extrabold"
                  animate={{
                    scale: [1, 1.06, 1],
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
              <p className="text-body text-cb-text-muted">
                Your CoffeeBay cup was one of the lucky ones. Here is your
                prize:
              </p>
            </motion.div>

            {/* ── PRIZE CARD ── */}
            <motion.div variants={scaleInVariants}>
              <motion.div
                variants={glowPulse}
                animate="animate"
                className="rounded-2xl bg-cb-dark-card border border-cb-blue/30 p-8 text-center relative overflow-hidden"
              >
                {/* Holographic Shimmer Sweep */}
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(115deg, transparent 35%, rgba(43, 168, 224, 0.06) 48%, rgba(43, 168, 224, 0.16) 50%, rgba(43, 168, 224, 0.06) 52%, transparent 65%)",
                    backgroundSize: "200% 100%",
                  }}
                  animate={{
                    backgroundPosition: ["150% 0%", "-50% 0%"],
                  }}
                  transition={{
                    duration: 3.5,
                    repeat: Infinity,
                    ease: "linear",
                    repeatDelay: 1.2,
                  }}
                />

                {/* Floating sparkles */}
                <motion.span
                  className="absolute right-4 top-4 text-xl select-none"
                  animate={{
                    scale: [0.8, 1.2, 0.8],
                    opacity: [0.4, 1, 0.4],
                    rotate: [0, 45, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2BA8E0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block' }}>
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  </svg>
                </motion.span>
                <motion.span
                  className="absolute left-4 bottom-4 text-xl select-none"
                  animate={{
                    scale: [1.2, 0.8, 1.2],
                    opacity: [0.3, 0.8, 0.3],
                    rotate: [0, -45, 0],
                  }}
                  transition={{
                    duration: 3.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2BA8E0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block' }}>
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  </svg>
                </motion.span>

                <p className="text-label text-cb-blue mb-4 relative z-10">
                  Your Prize
                </p>
                <p className="text-display text-cb-text leading-tight mb-2 relative z-10">
                  {prizeName}
                </p>
                {prizeImageUrl && (
                  <div className="my-6 relative z-10 flex justify-center">
                    <Image
                      src={prizeImageUrl}
                      alt={prizeName}
                      width={200}
                      height={200}
                      className="max-w-[200px] h-auto object-contain rounded-xl drop-shadow-[0_0_30px_rgba(43,168,224,0.3)] animate-float-slow"
                    />
                  </div>
                )}
                <p className="text-cb-text-muted text-sm mt-2 relative z-10">
                  Present your verification code at any CoffeeBay branch.
                </p>
              </motion.div>
            </motion.div>

            {/* ── VERIFICATION CODE ── */}
            {verificationCode && (
              <motion.div variants={fadeUpVariants}>
                <Card variant="glass" padding="md">
                  <div className="text-center">
                    <p className="text-label text-cb-text-muted mb-3">
                      Verification Code
                    </p>
                    <p
                      className="verification-code mb-4"
                      aria-label={`Verification code: ${verificationCode}`}
                    >
                      {verificationCode}
                    </p>
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                      <CopyButton text={verificationCode} />
                      <p className="text-xs text-cb-text-subtle">
                        Also sent via SMS (from &apos;Seashell&apos;)
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ── NEXT STEPS ── */}
            <motion.div variants={fadeUpVariants}>
              <Card variant="default" padding="md">
                <h2 className="text-sm font-bold text-cb-text-muted tracking-widest uppercase mb-5">
                  Next Steps
                </h2>
                <ol
                  className="space-y-4"
                  aria-label="Steps to claim your prize"
                >
                  {NEXT_STEPS.map((step, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <span
                        className="flex-shrink-0 w-9 h-9 rounded-xl bg-cb-dark-surface flex items-center justify-center text-lg"
                        aria-hidden="true"
                      >
                        {step.icon}
                      </span>
                      <div>
                        <p className="text-cb-text font-semibold text-sm">
                          {step.title}
                        </p>
                        <p className="text-cb-text-muted text-sm leading-relaxed mt-0.5">
                          {step.desc}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
            </motion.div>

            {/* ── SHARE / HOME CTA ── */}
            <motion.div variants={fadeUpVariants} className="text-center">
              <Link
                href="/"
                className="
                  inline-flex items-center justify-center gap-2
                  px-6 py-3 rounded-xl
                  bg-transparent text-cb-blue font-semibold
                  hover:bg-cb-blue/10
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

      {/* Footer note */}
      <footer className="relative z-10 text-center py-6 px-4">
        <p className="text-xs text-cb-text-subtle">
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
