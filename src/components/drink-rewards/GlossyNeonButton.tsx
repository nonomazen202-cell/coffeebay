"use client";

import React from "react";
import { averta } from "../../lib/fonts";

export interface GlossyNeonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  size?: "compact" | "sm" | "md" | "lg";
  showArrow?: boolean;
  arrowIcon?: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  glowIntensity?: "normal" | "vibrant";
  fullWidth?: boolean;
  className?: string;
}

/**
 * Premium Deep Royal-Cobalt & Midnight-Indigo Neon Button
 *
 * Colorimetrically matched to the official Coffee Bay reference button:
 * - Razor-thin luminous ice-cyan wire border (#E2F6FF -> #68B6FF -> #92D3FF) with pinpoint corner star glints.
 * - Pure saturated electric-cobalt outer neon aura (R=0, zero milky/grey fog).
 * - Smooth vertical gradient from rich Electric Cobalt (#0038C8) at top into deep velvety Midnight Indigo (#011047 -> #00155E) at bottom.
 */
export function GlossyNeonButton({
  children,
  size = "lg",
  showArrow = true,
  arrowIcon,
  loading = false,
  loadingText,
  glowIntensity = "vibrant",
  fullWidth = false,
  className = "",
  disabled,
  onClick,
  type = "button",
  ...rest
}: GlossyNeonButtonProps) {
  const sizeStyles = {
    compact:
      "min-h-[46px] h-[46px] xs:min-h-[48px] xs:h-[48px] lg:min-h-[58px] lg:h-[58px] px-5 lg:px-11 text-xs lg:text-sm",
    sm: "min-h-[44px] h-[44px] sm:min-h-[48px] sm:h-[48px] px-5 sm:px-8 text-xs",
    md: "min-h-[52px] h-[52px] sm:min-h-[58px] sm:h-[58px] px-6 sm:px-11 text-xs sm:text-sm",
    lg: "min-h-[58px] h-[58px] sm:min-h-[68px] sm:h-[68px] lg:min-h-[72px] lg:h-[72px] px-5 xs:px-7 sm:px-14 lg:px-16 text-xs sm:text-sm lg:text-base",
  }[size];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      {...rest}
      className={`group relative rounded-full p-[1.4px] sm:p-[1.5px] transition-all duration-300 select-none cursor-pointer flex-shrink-0 ${
        fullWidth ? "w-full" : "inline-flex"
      } ${
        disabled || loading
          ? "opacity-60 cursor-not-allowed"
          : "hover:-translate-y-0.5 active:translate-y-0.5 active:scale-[0.985]"
      } ${className}`}
      style={{
        // ── 1. RAZOR-THIN LUMINOUS CYAN-ICE WIRE BORDER WITH HOTSPOT SPECULAR ACCENTS ──
        background: [
          "radial-gradient(circle 16px at 4% 20%, #FFFFFF 0%, transparent 100%)",
          "radial-gradient(circle 16px at 96% 20%, #FFFFFF 0%, transparent 100%)",
          "radial-gradient(ellipse 15% 30% at 37% 0%, #FFFFFF 0%, transparent 100%)",
          "radial-gradient(ellipse 12% 30% at 48% 100%, #E6F6FF 0%, transparent 100%)",
          "radial-gradient(ellipse 10% 30% at 72% 100%, #DCF2FF 0%, transparent 100%)",
          "linear-gradient(180deg, #E4F7FF 0%, #98D6FF 38%, #68B6FF 68%, #94D4FF 100%)",
        ].join(", "),
        // Pure Saturated Electric-Cobalt Neon Glow (Zero white/chalky haze)
        boxShadow:
          glowIntensity === "vibrant"
            ? "0 0 4px 0px rgba(45, 168, 255, 0.72), 0 0 13px 1px rgba(0, 96, 255, 0.56), 0 0 28px 2px rgba(0, 62, 215, 0.34), 0 8px 20px -6px rgba(0, 6, 32, 0.82)"
            : "0 0 3px 0px rgba(45, 168, 255, 0.52), 0 0 10px 0px rgba(0, 96, 255, 0.38), 0 0 20px 1px rgba(0, 62, 215, 0.22), 0 6px 16px -4px rgba(0, 6, 32, 0.72)",
      }}
    >
      {/* Pinpoint Star Glints on Upper-Left & Upper-Right Curves + Top 37% Gleam */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-[14%] left-[1.8%] sm:left-[1.4%] w-1.5 h-1.5 rounded-full bg-white blur-[0.6px] shadow-[0_0_6px_2px_rgba(56,189,248,0.95)] z-20"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-[14%] right-[1.8%] sm:right-[1.4%] w-1.5 h-1.5 rounded-full bg-white blur-[0.6px] shadow-[0_0_6px_2px_rgba(56,189,248,0.95)] z-20"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-[0.5px] left-[30%] w-12 sm:w-16 h-[2px] bg-gradient-to-r from-transparent via-white to-transparent blur-[0.4px] opacity-90 z-20"
      />

      {/* ── 2. DEEP ELECTRIC-COBALT TO VELVETY MIDNIGHT-INDIGO INTERIOR ── */}
      <span
        className={`w-full h-full rounded-full relative overflow-hidden flex items-center justify-center gap-2.5 sm:gap-3 ${sizeStyles} transition-all duration-300`}
        style={{
          background: [
            // Localized electric-blue inward bloom beneath top 37% border glint
            "radial-gradient(ellipse 22% 28% at 37% 0%, rgba(0, 128, 255, 0.50) 0%, rgba(0, 82, 230, 0.16) 58%, transparent 100%)",
            // Subtle upper-curve inward glints matching the two corner stars
            "radial-gradient(circle 16px at 3% 18%, rgba(96, 198, 255, 0.36) 0%, transparent 100%)",
            "radial-gradient(circle 16px at 97% 18%, rgba(96, 198, 255, 0.34) 0%, transparent 100%)",
            // Exact measured vertical gradient: Rich Electric Cobalt (#0038C8) -> Deep Midnight Indigo (#011047 -> #00155E)
            "linear-gradient(180deg, #0038C8 0%, #0030B2 10%, #00279A 20%, #001F82 32%, #00176A 45%, #011252 58%, #011047 74%, #01114C 88%, #00155E 100%)",
          ].join(", "),
          boxShadow:
            "inset 0 1px 1px rgba(85, 182, 255, 0.28), inset 0 -1px 2px rgba(0, 68, 215, 0.32)",
        }}
      >
        {/* Subtle Hover Electric-Cobalt Lift */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background:
              "linear-gradient(180deg, rgba(30, 144, 255, 0.22) 0%, rgba(0, 82, 235, 0.08) 45%, transparent 100%)",
          }}
        />

        {/* ── 3. CONTENT: CRISP WHITE AVERTA TYPOGRAPHY + VECTOR ARROW / SPINNER ── */}
        <span
          className={`relative z-10 flex items-center justify-center gap-2 sm:gap-2.5 ${averta.className} font-bold text-white tracking-[0.02em] drop-shadow-[0_1px_2px_rgba(0,4,24,0.75)] whitespace-nowrap`}
        >
          {loading ? (
            <>
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-white flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span>{loadingText || "جاري التحميل..."}</span>
            </>
          ) : (
            <>
              <span>{children}</span>
              {showArrow &&
                (arrowIcon || (
                  <svg
                    className="w-4 h-4 sm:w-[19px] sm:h-[19px] text-white flex-shrink-0 transition-transform duration-300 group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.2}
                      d="M4.5 12h15m0 0l-5.5-5.5m5.5 5.5l-5.5 5.5"
                    />
                  </svg>
                ))}
            </>
          )}
        </span>
      </span>
    </button>
  );
}
