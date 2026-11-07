"use client";

import React from "react";
import Image from "next/image";
import { GlossyNeonButton } from "./GlossyNeonButton";
import { averta, recoleta, recoletaStyle } from "../../lib/fonts";

interface HeroStepProps {
  onClaimClick: () => void;
}

export function HeroStep({ onClaimClick }: HeroStepProps) {
  return (
    <div className="relative w-full flex-1 min-h-[calc(100dvh-65px)] flex flex-col justify-between overflow-hidden select-none bg-[#04081E]">
      {/* Dedicated Vertical Mobile Background (9:16 native portrait of the new image, zero CSS crop) */}
      <div className="block sm:hidden absolute inset-0 pointer-events-none">
        <Image
          src="/drink-rewards/mobile-first-page-hero-5.png?v=5"
          alt="Coffee Bay Drink Rewards Mobile"
          fill
          priority
          unoptimized
          className="object-cover object-center select-none"
        />
      </div>

      {/* Dedicated Desktop & Tablet Widescreen Background (16:9 aspect ratio) */}
      <div className="hidden sm:block absolute inset-0 pointer-events-none">
        <Image
          src="/drink-rewards/first-page-hero.png"
          alt="Coffee Bay Drink Rewards"
          fill
          priority
          unoptimized
          className="object-cover object-center select-none"
        />
      </div>

      {/* Middle: Editorial Recoleta Heading + Signature Modern "on us" Highlight */}
      <div
        dir="ltr"
        className="relative z-20 w-full max-w-7xl mx-auto px-3.5 sm:px-12 lg:px-20 flex-1 flex flex-col justify-start pt-24 xs:pt-28 sm:pt-0 sm:pb-24 lg:pb-32 sm:justify-center items-center sm:items-start text-center sm:text-left pointer-events-none"
      >
        <style>{`
          @keyframes cbSheenSweep {
            0%, 18% { transform: translateX(-135%) skewX(-18deg); }
            48%, 100% { transform: translateX(235%) skewX(-18deg); }
          }
          @keyframes cbBrushDraw {
            from { stroke-dashoffset: 180; opacity: 0.2; }
            to { stroke-dashoffset: 0; opacity: 1; }
          }
        `}</style>

        <div className="pointer-events-auto w-full max-w-md sm:max-w-xl lg:max-w-2xl select-text space-y-2.5 sm:space-y-4">
          {/* Main Recoleta-Style Display Headline */}
          <h1
            style={recoletaStyle}
            className={`${recoleta.className} text-white text-[34px] xs:text-[38px] sm:text-[46px] md:text-[54px] lg:text-[64px] xl:text-[70px] font-bold tracking-[-0.015em] sm:tracking-[-0.02em] leading-[1.11] sm:leading-[1.08] drop-shadow-[0_6px_26px_rgba(0,4,24,0.92)]`}
          >
            We’re Happy
            <br />
            to Have You Here!
          </h1>

          {/* Signature Modern Statement: "Your first coffee is [✦ on us]" */}
          <div
            className={`flex flex-col items-center sm:items-start space-y-2 pt-1 sm:pt-1.5 ${averta.className}`}
          >
            <button
              type="button"
              onClick={onClaimClick}
              className="group/tag inline-flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1 cursor-pointer focus:outline-none"
            >
              {/* Phrase Part 1 with Self-Drawing Hand-Crafted Underline */}
              <span className="relative inline-block text-white/95 text-[18px] xs:text-[19.5px] sm:text-[23px] lg:text-[27px] font-semibold tracking-[0.01em] leading-snug drop-shadow-[0_2px_12px_rgba(0,4,24,0.92)]">
                Your first coffee is
                <svg
                  aria-hidden="true"
                  className="absolute -bottom-1.5 left-0 w-full h-2.5 text-sky-300/90 pointer-events-none"
                  viewBox="0 0 175 10"
                  fill="none"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M3 6.8C42 2.2 88 8.2 132 4.2C149 2.7 162 4.1 172 3.4"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    style={{
                      strokeDasharray: 180,
                      animation:
                        "cbBrushDraw 0.95s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both",
                    }}
                  />
                </svg>
              </span>

              {/* Phrase Part 2: Tilted Pearl-Ice Voucher Stamp Badge with GPU Light-Sheen */}
              <span
                className="relative overflow-hidden inline-flex items-center gap-1.5 px-3 xs:px-3.5 sm:px-4 py-0.5 sm:py-1 rounded-full -rotate-2 group-hover/tag:rotate-0 group-hover/tag:scale-105 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] border border-white/90"
                style={{
                  background:
                    "linear-gradient(135deg, #FFFFFF 0%, #E2F4FF 52%, #BAE6FD 100%)",
                  boxShadow:
                    "0 8px 20px -4px rgba(0, 6, 32, 0.65), inset 0 1px 0 #FFFFFF",
                }}
              >
                {/* Periodic GPU Specular Shimmer Sweep */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white/95 to-transparent"
                  style={{
                    animation: "cbSheenSweep 4.6s ease-in-out infinite",
                  }}
                />

                {/* Crisp Sparkle Star */}
                <svg
                  aria-hidden="true"
                  className="relative z-10 w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#0248D2] flex-shrink-0 transition-transform duration-300 group-hover/tag:rotate-45"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M10 1.5L11.9 7.4L17.8 9.3L11.9 11.2L10 17.1L8.1 11.2L2.2 9.3L8.1 7.4L10 1.5Z" />
                </svg>

                <span
                  style={recoletaStyle}
                  className={`relative z-10 ${recoleta.className} text-[#01195E] text-[18px] xs:text-[19.5px] sm:text-[23px] lg:text-[26px] font-extrabold tracking-[-0.01em] leading-none pb-[1px]`}
                >
                  on us!
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Lifted on mobile only + Wider CTA Button with Reward Drink Icon */}
      <div className="relative z-30 w-full flex-shrink-0 flex flex-col items-center pb-[104px] xs:pb-[110px] sm:pb-[88px] px-3.5 sm:px-4">
        <div className="w-full flex justify-center flex-shrink-0">
          <GlossyNeonButton
            onClick={onClaimClick}
            size="lg"
            glowIntensity="vibrant"
            className="w-[92%] max-w-[362px] sm:w-auto sm:max-w-none sm:min-w-[405px] lg:min-w-[455px] flex-shrink-0"
          >
            <span className="flex items-center justify-center gap-2 sm:gap-2.5">
              {/* Iced Drink + Reward Sparkle Icon */}
              <svg
                className="w-[21px] h-[21px] sm:w-[24px] sm:h-[24px] text-white flex-shrink-0 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105 drop-shadow-[0_1px_3px_rgba(0,6,35,0.8)]"
                viewBox="0 0 24 24"
                fill="none"
              >
                {/* Bent Straw */}
                <path
                  d="M12.2 6.5L13.8 2.8H15.7"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Dome Lid */}
                <path
                  d="M6.2 10.5C6.2 7.9 8.5 6.5 11.5 6.5C14.5 6.5 16.8 7.9 16.8 10.5"
                  stroke="currentColor"
                  strokeWidth={1.95}
                  strokeLinecap="round"
                />
                {/* Lid Rim */}
                <path
                  d="M5.3 10.5H17.7"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                {/* Tapered Iced Cup Body */}
                <path
                  d="M6.6 10.5L7.9 19.6C8.02 20.4 8.7 21 9.5 21H13.5C14.3 21 14.98 20.4 15.1 19.6L16.4 10.5"
                  stroke="currentColor"
                  strokeWidth={1.95}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Coffee Wave Inside Cup */}
                <path
                  d="M7.4 15.3C9.3 14.2 11.4 16.3 15.6 14.8"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                />
                {/* Twinkling Reward Star */}
                <path
                  d="M19.6 3.3L20.3 5.3L22.3 6L20.3 6.7L19.6 8.7L18.9 6.7L16.9 6L18.9 5.3L19.6 3.3Z"
                  fill="#BAE6FD"
                />
              </svg>

              <span className="uppercase tracking-[0.09em] sm:tracking-[0.12em]">
                CLAIM MY FREE DRINK
              </span>
            </span>
          </GlossyNeonButton>
        </div>
      </div>
    </div>
  );
}
