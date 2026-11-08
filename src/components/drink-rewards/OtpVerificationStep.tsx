"use client";

import React from "react";
import Image from "next/image";
import { ArrowLeft, Clock, PhoneCall, RotateCw, ShieldCheck } from "lucide-react";
import { GlossyNeonButton } from "./GlossyNeonButton";
import { averta, recoleta, recoletaStyle } from "../../lib/fonts";

interface OtpVerificationStepProps {
  phone: string;
  otpDigits: string[];
  otpInputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  onOtpBoxChange: (index: number, value: string) => void;
  onOtpKeyDown: (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => void;
  onOtpPaste?: (
    index: number,
    e: React.ClipboardEvent<HTMLInputElement>,
  ) => void;
  otpExpirySeconds: number;
  cooldownSeconds: number;
  onResendOtp: () => void;
  onVerifyOtp: (e: React.FormEvent) => void;
  onEditPhoneOrName: () => void;
  loading: boolean;
}

export function OtpVerificationStep({
  phone,
  otpDigits,
  otpInputRefs,
  onOtpBoxChange,
  onOtpKeyDown,
  onOtpPaste,
  otpExpirySeconds,
  cooldownSeconds,
  onResendOtp,
  onVerifyOtp,
  onEditPhoneOrName,
  loading,
}: OtpVerificationStepProps) {
  const isCodeComplete = otpDigits.join("").length === 6;

  const formatMMSS = (totalSec: number) => {
    const mins = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const secs = String(totalSec % 60).padStart(2, "0");
    return `${mins}:${secs}`;
  };

  return (
    <div className="relative w-full flex-1 min-h-[100dvh] lg:min-h-[calc(100dvh-65px)] flex flex-col justify-between items-center overflow-hidden select-none bg-[#020B2A]">
      {/* ── 1. DEDICATED STUDIO BACKGROUNDS (Mobile 9:16 & Desktop 16:9 anchored to bottom chrome waves) ── */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {/* Mobile Portrait Silk + Bottom Chrome Wave */}
        <div className="block sm:hidden absolute inset-0">
          <Image
            src="/drink-rewards/verification-mobile-bg-4.png"
            alt="Coffee Bay Verification Background Mobile"
            fill
            priority
            unoptimized
            className="object-cover object-bottom select-none"
          />
        </div>

        {/* Desktop & Tablet Widescreen Silk + Bottom Chrome Wave */}
        <div className="hidden sm:block absolute inset-0">
          <Image
            src="/drink-rewards/verification-desktop-bg.png"
            alt="Coffee Bay Verification Background Desktop"
            fill
            priority
            unoptimized
            className="object-cover object-bottom select-none"
          />
        </div>
      </div>

      {/* ── 2. MOBILE TOP BRAND HEADER (Only left Back button is clickable) ── */}
      <header
        dir="ltr"
        className="relative z-30 flex lg:hidden w-full items-center justify-between px-4 pt-3.5 pb-1 flex-shrink-0 pointer-events-none"
      >
        {/* Left: Back Button to Edit Phone / Name */}
        <button
          type="button"
          onClick={onEditPhoneOrName}
          aria-label="العودة لتعديل البيانات"
          className="pointer-events-auto w-9 h-9 flex items-center justify-center rounded-full text-white/95 hover:text-sky-300 hover:bg-white/10 active:scale-95 transition-all cursor-pointer drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]"
        >
          <ArrowLeft className="w-6 h-6" strokeWidth={2.1} />
        </button>

        {/* Center: Official Coffee Bay White Logo (Non-clickable) */}
        <div className="relative w-36 xs:w-40 sm:w-44 h-8 xs:h-8.5 sm:h-9 pointer-events-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
          <Image
            src="/drink-rewards/coffeebay-white-logo.png"
            alt="Coffee Bay"
            fill
            priority
            className="object-contain"
          />
        </div>

        {/* Right: Inert spacer to keep logo dead-center */}
        <div aria-hidden="true" className="w-9 h-9 pointer-events-none" />
      </header>

      {/* ── 3. VERIFICATION CONTENT STAGE (Centered on mobile & desktop above bottom chrome waves) ── */}
      <div
        dir="ltr"
        className="relative z-20 w-full max-w-xl mx-auto px-3.5 sm:px-4 flex-1 flex flex-col items-center justify-center my-auto pt-2 sm:pt-4 pb-[96px] xs:pb-[104px] sm:pb-[145px] lg:pb-[155px] text-center animate-fadeIn"
      >
        {/* Crisp Razor-Sharp ShieldCheck Icon with True Neon Electric-Blue Glow Behind It */}
        <div className="relative w-[62px] h-[62px] xs:w-[66px] xs:h-[66px] sm:w-[72px] sm:h-[72px] flex items-center justify-center mb-4 sm:mb-4.5">
          {/* Soft Ambient Cobalt Aura */}
          <div
            aria-hidden="true"
            className="absolute -inset-3 rounded-full bg-[#0066FF]/40 blur-xl pointer-events-none"
          />
          {/* Outer Electric-Cobalt Shield Glow Clone */}
          <ShieldCheck
            aria-hidden="true"
            className="absolute inset-0 w-full h-full text-[#0066FF] blur-[9px] opacity-95 pointer-events-none"
            strokeWidth={3.4}
          />
          {/* Tight Cyan Neon Shield Glow Clone */}
          <ShieldCheck
            aria-hidden="true"
            className="absolute inset-0 w-full h-full text-[#38BDF8] blur-[3.5px] opacity-95 pointer-events-none"
            strokeWidth={2.5}
          />
          {/* Foreground Unblurred Razor-Sharp White ShieldCheck */}
          <ShieldCheck
            className="relative w-full h-full text-white"
            strokeWidth={1.45}
          />
        </div>

        {/* Recoleta-Style Editorial Serif Headline */}
        <h2
          style={recoletaStyle}
          className={`${recoleta.className} text-[31px] xs:text-[34px] sm:text-[42px] lg:text-[46px] font-bold text-white leading-[1.14] tracking-[-0.015em] drop-shadow-[0_4px_18px_rgba(0,4,24,0.85)]`}
        >
          One quick check,
          <br />
          then your treat is yours.
        </h2>

        {/* Subtitle & Dynamic Phone Row */}
        <p
          className={`${averta.className} text-[14.5px] xs:text-[15.5px] sm:text-[17px] text-sky-50/92 font-medium mt-4 sm:mt-4.5 drop-shadow-[0_1px_6px_rgba(0,4,24,0.8)]`}
        >
          Enter the 6-digit code sent to
        </p>

        <button
          type="button"
          onClick={onEditPhoneOrName}
          title="تعديل رقم الهاتف"
          className={`mt-1.5 inline-flex items-center justify-center gap-2.5 px-3.5 py-1 rounded-full hover:bg-white/[0.07] transition-colors cursor-pointer group ${averta.className}`}
        >
          <PhoneCall
            className="w-[18px] h-[18px] sm:w-[20px] sm:h-[20px] text-white flex-shrink-0 drop-shadow-[0_1px_4px_rgba(0,6,32,0.8)]"
            strokeWidth={1.9}
          />
          <span className="text-[17.5px] xs:text-[18.5px] sm:text-[21px] font-bold text-white tracking-[0.03em] drop-shadow-[0_2px_8px_rgba(0,4,24,0.85)] group-hover:text-sky-200 transition-colors">
            {phone}
          </span>
        </button>

        {/* OTP Form */}
        <form
          onSubmit={onVerifyOtp}
          className="w-full mt-6 sm:mt-7 flex flex-col items-center"
        >
          {/* 6 Glassmorphic Neon-Framed Digit Boxes with Bottom Dash */}
          <div className="flex items-center justify-center gap-2 sm:gap-3.5">
            {otpDigits.map((digit, idx) => (
              <div
                key={idx}
                className="relative group w-[48px] h-[60px] xs:w-[52px] xs:h-[65px] sm:w-[62px] sm:h-[74px] rounded-[13px] sm:rounded-[15px] border-[1.5px] border-[#78C2FF]/85 focus-within:border-white focus-within:-translate-y-0.5 focus-within:scale-[1.04] transition-all duration-200"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(6, 30, 96, 0.52) 0%, rgba(2, 12, 46, 0.72) 100%)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  boxShadow:
                    "0 0 12px rgba(56, 165, 255, 0.28), 0 6px 16px -4px rgba(0, 4, 24, 0.65), inset 0 1px 1px rgba(220, 242, 255, 0.35)",
                }}
              >
                <input
                  ref={(el) => {
                    otpInputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={idx === 0 ? "one-time-code" : "off"}
                  aria-label={`Digit ${idx + 1}`}
                  value={digit}
                  onChange={(e) => onOtpBoxChange(idx, e.target.value)}
                  onKeyDown={(e) => onOtpKeyDown(idx, e)}
                  onPaste={(e) => onOtpPaste?.(idx, e)}
                  style={{ outline: "none", boxShadow: "none" }}
                  className={`w-full h-full bg-transparent text-center text-white text-[24px] xs:text-[26px] sm:text-[30px] font-bold pb-1.5 caret-sky-300 border-0 ring-0 focus:ring-0 focus:outline-none select-text ${averta.className}`}
                />

                {/* Bottom Dash Indicator (Matches Reference Mockup) */}
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute bottom-2.5 sm:bottom-3 left-1/2 -translate-x-1/2 h-[2px] rounded-full transition-all duration-200 ${
                    digit
                      ? "w-4.5 bg-sky-300/65"
                      : "w-4 sm:w-4.5 bg-white/80 group-focus-within:w-5.5 group-focus-within:bg-sky-200"
                  }`}
                />
              </div>
            ))}
          </div>

          {/* Live Expiry Countdown & Resend Code Controls */}
          <div className="mt-5 sm:mt-5.5 flex flex-col items-center gap-2">
            {/* Live Expiry Countdown (Dynamic from Server Timestamp) */}
            {otpExpirySeconds > 0 ? (
              <div
                className={`inline-flex items-center gap-1.5 text-[13px] xs:text-[13.5px] sm:text-[14px] font-medium tracking-[0.01em] transition-colors ${averta.className} ${
                  otpExpirySeconds <= 60
                    ? "text-amber-300 drop-shadow-[0_1px_6px_rgba(251,191,36,0.35)]"
                    : "text-sky-200/90 drop-shadow-[0_1px_4px_rgba(0,4,24,0.7)]"
                }`}
              >
                <Clock
                  className={`w-3.5 h-3.5 flex-shrink-0 ${
                    otpExpirySeconds <= 60 ? "text-amber-300" : "text-sky-300"
                  }`}
                  strokeWidth={2}
                />
                <span>
                  Code expires in{" "}
                  <span className="font-bold tabular-nums">
                    {formatMMSS(otpExpirySeconds)}
                  </span>
                </span>
              </div>
            ) : (
              <span
                className={`${averta.className} text-[12.5px] sm:text-[13.5px] text-rose-300 font-semibold drop-shadow-[0_1px_6px_rgba(244,63,94,0.45)]`}
              >
                Code expired — please tap Resend Code
              </span>
            )}

            {/* Resend Code Button with Cooldown Countdown */}
            <button
              type="button"
              onClick={onResendOtp}
              disabled={cooldownSeconds > 0 || loading}
              className={`inline-flex items-center justify-center gap-2 text-[14px] xs:text-[14.5px] sm:text-[15px] font-medium transition-colors ${averta.className} ${
                cooldownSeconds > 0 || loading
                  ? "text-sky-100/60 cursor-default"
                  : "text-white hover:text-sky-300 cursor-pointer"
              }`}
            >
              <RotateCw
                className={`w-3.5 h-3.5 flex-shrink-0 ${
                  cooldownSeconds === 0 && !loading
                    ? "text-sky-300"
                    : "text-sky-100/60"
                }`}
                strokeWidth={2}
              />

              <span>
                {cooldownSeconds > 0
                  ? `Resend Code (${formatMMSS(cooldownSeconds)})`
                  : "Resend Code"}
              </span>
            </button>
          </div>

          {/* VERIFY & CONTINUE Glossy Sapphire Button (Disabled until all 6 digits are entered and code is not expired) */}
          <div className="w-full flex justify-center mt-6 sm:mt-7">
            <GlossyNeonButton
              type="submit"
              disabled={loading || !isCodeComplete || otpExpirySeconds === 0}
              loading={loading}
              loadingText="Verifying..."
              size="lg"
              glowIntensity={isCodeComplete && otpExpirySeconds > 0 ? "vibrant" : "normal"}
              showArrow={true}
              className="w-full max-w-[346px] xs:max-w-[366px] sm:max-w-[445px]"
            >
              <span
                className={`${averta.className} uppercase tracking-[0.06em] text-[14.5px] xs:text-[15.5px] sm:text-[16.5px] font-bold`}
              >
                VERIFY &amp; CONTINUE
              </span>
            </GlossyNeonButton>
          </div>
        </form>
      </div>
    </div>
  );
}
