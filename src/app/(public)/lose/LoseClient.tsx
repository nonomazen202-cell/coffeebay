"use client";

import React, { useEffect } from "react";
import { motion, type Variants } from "framer-motion";
import Link from "next/link";
import { Logo } from "../../../components/ui/Logo";
import { Card } from "../../../components/ui/Card";
import { Container } from "../../../components/layout/Container";
import { SadParticles } from "../../../components/animations/SadParticles";

// ─────────────────────────────────────────────────────────────────────
//  Animation Variants
// ─────────────────────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.18,
      delayChildren: 0.2,
    },
  },
};

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 35 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 80, damping: 15 },
  },
};

const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.88 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 90, damping: 14 },
  },
};

const cupVariants: Variants = {
  animate: {
    rotate: [-8, 8, -8],
    y: [0, -5, 0],
    transition: {
      duration: 4.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

const tearVariants: Variants = {
  animate: {
    y: [10, 75],
    opacity: [0, 0.8, 0],
    scale: [0.6, 1.1, 0.5],
    transition: {
      duration: 2.4,
      repeat: Infinity,
      ease: "easeIn",
      repeatDelay: 0.8,
    },
  },
};

const SleekSadCup = () => (
  <svg
    width="96"
    height="96"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-cb-brown mx-auto"
  >
    {/* Tilted cup rim */}
    <ellipse cx="11" cy="9" rx="6" ry="1.8" fill="rgba(123, 59, 27, 0.08)" />
    {/* Cup Body */}
    <path d="M5 9c0 0 .5 8 6 8s6-8 6-8" />
    {/* Tilted handle */}
    <path d="M17 10.5h1.2a1.2 1.2 0 0 1 1.2 1.2v1a1.2 1.2 0 0 1-1.2 1.2H17" />
    {/* Minimalist Sad Face on cup */}
    <circle cx="9" cy="12.5" r="0.6" fill="currentColor" />
    <circle cx="13" cy="12.5" r="0.6" fill="currentColor" />
    <path d="M10 15.2q1-1.1 2 0" /> {/* Sad mouth */}
  </svg>
);

const CoffeeTearSVG = () => (
  <svg
    width="10"
    height="14"
    viewBox="0 0 10 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="text-cb-brown"
  >
    <path
      d="M5 0C5 0 10 5.25 10 8.17C10 10.84 7.76 13 5 13C2.24 13 0 10.84 0 8.17C0 5.25 5 0 5 0Z"
      fill="currentColor"
    />
  </svg>
);

export function LoseClient() {
  useEffect(() => {
    let played = false;
    let audio: HTMLAudioElement | null = null;

    const playLoseSound = () => {
      if (played) return;
      try {
        audio = new Audio("/tuomas_data-game-over-39-199830.mp3");
        audio.volume = 0.45;
        audio
          .play()
          .then(() => {
            played = true;
            removeInteractionListeners();
          })
          .catch((err) => {
            console.warn("Autoplay blocked:", err);
          });
      } catch (err) {
        console.warn("Audio play failed:", err);
      }
    };

    const handleInteraction = () => {
      playLoseSound();
    };

    const removeInteractionListeners = () => {
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
    };

    // 1. Try to play automatically
    const timer = setTimeout(() => {
      playLoseSound();
      // If blocked by autoplay policy, add interaction fallbacks
      if (!played) {
        document.addEventListener("click", handleInteraction);
        document.addEventListener("touchstart", handleInteraction);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      removeInteractionListeners();
      if (audio) {
        audio.pause();
      }
    };
  }, []);

  return (
    <div className="bg-brand-gradient min-h-dvh flex flex-col relative overflow-x-hidden">
      {/* Background sad falling particles */}
      <SadParticles count={30} active={true} />

      {/* Background glows - premium floating glassmorphic orbs */}
      <div
        aria-hidden="true"
        className="fixed inset-0 overflow-hidden pointer-events-none z-0"
      >
        <div className="absolute top-[10%] left-[15%] w-[480px] h-[480px] rounded-full bg-cb-brown/10 blur-[130px] animate-float-orb" />
        <div className="absolute bottom-[5%] right-[15%] w-[680px] h-[680px] rounded-full bg-cb-blue/20 blur-[130px] animate-float-orb-r" />
      </div>

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
        <Container size="sm">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6 text-center"
          >
            {/* Sad Cup & Tear animation */}
            <motion.div
              variants={fadeUpVariants}
              className="relative inline-block w-24 h-24 mx-auto select-none"
            >
              <motion.div
                variants={cupVariants}
                animate="animate"
                className="cursor-pointer"
              >
                <SleekSadCup />
              </motion.div>

              {/* Dripping coffee tear */}
              <motion.div
                variants={tearVariants}
                animate="animate"
                className="absolute left-[44px] top-[68px] pointer-events-none"
              >
                <CoffeeTearSVG />
              </motion.div>
            </motion.div>

            {/* Label */}
            <motion.div variants={fadeUpVariants}>
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-cb-brown/10 border border-cb-brown/30 text-cb-brown text-label">
                Not This Time
              </div>
            </motion.div>

            {/* Headline */}
            <motion.div variants={fadeUpVariants} className="space-y-3">
              <h1 className="text-display text-cb-text">
                Keep the <span className="text-cb-brown">Faith</span>
              </h1>
              <p className="text-body text-cb-text-muted max-w-[34ch] mx-auto leading-relaxed">
                This cup wasn&apos;t the lucky one — but every sip brings you
                closer to a win. Fortune favors the persistent.
              </p>
            </motion.div>

            {/* Motivational card */}
            <motion.div variants={scaleInVariants}>
              <Card
                variant="glass"
                padding="md"
                className="text-left relative overflow-hidden border border-cb-brown/20 bg-cb-dark-card/50"
              >
                <h2 className="text-sm font-bold text-cb-text-muted tracking-widest uppercase mb-4">
                  Did You Know?
                </h2>
                <ul className="space-y-3" role="list">
                  {[
                    "New cups hit the counter every day.",
                    "The more you visit, the better your odds.",
                  ].map((fact, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-cb-text-muted text-sm"
                    >
                      <span
                        className="flex-shrink-0 w-5 h-5 rounded-full bg-cb-brown/10 text-cb-brown flex items-center justify-center text-xs font-bold mt-0.5"
                        aria-hidden="true"
                      >
                        {i + 1}
                      </span>
                      {fact}
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>

            {/* CTAs */}
            <motion.div
              variants={fadeUpVariants}
              className="flex flex-col sm:flex-row gap-3 justify-center pt-2"
            >
              <Link
                href="/claim"
                id="try-again-cta"
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
                Try Another Code
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
            </motion.div>
          </motion.div>
        </Container>
      </main>

      <footer className="relative z-10 text-center py-6 px-4">
        <p className="text-xs text-cb-text-subtle">
          CoffeeBay Lucky Cup &mdash; Every cup is a new beginning.
        </p>
      </footer>
    </div>
  );
}
