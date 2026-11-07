"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { GlossyNeonButton } from "./GlossyNeonButton";
import { averta, recoleta, recoletaStyle } from "../../lib/fonts";

interface BranchItem {
  id: number | string;
  name: string;
  code?: string;
  address?: string;
}

interface RegistrationStepProps {
  customerName: string;
  setCustomerName: (val: string) => void;
  phone: string;
  setPhone: (val: string) => void;
  branches: BranchItem[];
  branchDisplayName: string;
  selectedBranchId: number | string | null;
  setSelectedBranchId: (val: number | string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  loading: boolean;
  errorMessage?: string | null;
}

/**
 * RegistrationStep
 *
 * 100% Exact Glassmorphic Design:
 * - Wider card presence (max-w-[500px] sm:max-w-[520px]).
 * - Completely transparent fields (NO blue fill - takes directly from the glass form and cosmic waves underneath).
 * - Full-pill focus glow: Entire capsule lights up on focus with zero browser rectangle outline.
 * - Only 3 essential fields: Phone, Name, Branch.
 * - Glowing electric cyan neon borders with authentic acrylic reflections.
 * - Circular glowing gift badge on top edge.
 * - Glossy royal-blue neon CTA button: "Claim My Reward →".
 */
export function RegistrationStep({
  customerName,
  setCustomerName,
  phone,
  setPhone,
  branches,
  branchDisplayName,
  selectedBranchId,
  setSelectedBranchId,
  onSubmit,
  onBack,
  loading,
  errorMessage,
}: RegistrationStepProps) {
  const [isBranchOpen, setIsBranchOpen] = useState(false);
  const branchDropdownRef = useRef<HTMLDivElement | null>(null);

  const activeBranch =
    branches.find((b) => String(b.id) === String(selectedBranchId)) ??
    branches[0] ??
    null;
  const currentBranchLabel = activeBranch ? activeBranch.name : branchDisplayName;

  useEffect(() => {
    if (!isBranchOpen) return;

    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      if (
        branchDropdownRef.current &&
        !branchDropdownRef.current.contains(e.target as Node)
      ) {
        setIsBranchOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsBranchOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDownOutside);
    document.addEventListener("touchstart", handlePointerDownOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
      document.removeEventListener("touchstart", handlePointerDownOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isBranchOpen]);

  // Kinetic shape + size morph on focus (pill -> sculpted squircle + slight expansion, ZERO annoying glow!)
  const inputWrapperClassName =
    "relative group transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-within:-translate-y-[1px] focus-within:scale-[1.02]";

  const inputCapsuleClassName =
    "relative overflow-hidden flex items-center h-[47px] xs:h-[49px] lg:h-[58px] " +
    "focus-within:h-[52px] xs:focus-within:h-[54px] lg:focus-within:h-[63px] " +
    "px-3.5 lg:px-4.5 focus-within:px-4 lg:focus-within:px-5 " +
    "rounded-[25px] lg:rounded-[29px] focus-within:rounded-[13px] lg:focus-within:rounded-[15px] " +
    "bg-[#011B58]/80 focus-within:bg-[#021344]/92 " +
    "border-[1.25px] border-[#ACD0FF]/70 hover:border-sky-200/90 focus-within:border-white/95 " +
    "shadow-[0_4px_12px_rgba(0,6,32,0.42),inset_0_1px_1.5px_rgba(225,240,255,0.24)] " +
    "focus-within:shadow-[0_12px_24px_-6px_rgba(0,4,20,0.82),inset_0_1px_1px_rgba(255,255,255,0.32)] " +
    "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]";

  const inputCapsuleStyle: React.CSSProperties = {
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  };

  return (
    <div className="relative w-full flex-1 min-h-[100dvh] lg:min-h-[calc(100dvh-65px)] flex flex-col justify-between items-center overflow-x-hidden select-none bg-[#030B24] pt-0 pb-2 lg:py-4">
      {/* ── 1. RESPONSIVE BACKGROUND (Phone Screen Blue Silk shifted up on mobile, Glossy Splash on desktop) ── */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Mobile: Dedicated portrait wallpaper shifted up ~10.5% so cup sits higher above raised form */}
        <div className="block lg:hidden absolute inset-0 overflow-hidden">
          {/* Seamless mirrored silk wave continuation for the bottom 10.5% behind the stepper */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-[89.4%] h-full scale-y-[-1]"
          >
            <Image
              src="/drink-rewards/phone-screen-blue-silk.png"
              alt=""
              fill
              className="object-cover object-center select-none"
            />
          </div>

          {/* Main pure portrait wallpaper shifted upward */}
          <div className="absolute inset-x-0 -top-[10.5%] h-full">
            <Image
              src="/drink-rewards/phone-screen-blue-silk.png"
              alt="Coffee Bay Blue Silk Mobile Background"
              fill
              priority
              className="object-cover object-center select-none"
            />
          </div>
        </div>

        {/* Desktop: Glossy Blue Wave Iced Coffee Splash */}
        <div className="hidden lg:block absolute inset-0">
          <Image
            src="/drink-rewards/glossy-blue-splash.png"
            alt="Coffee Bay Glossy Blue Wave & Coffee Splash"
            fill
            priority
            className="object-cover object-center select-none"
          />
        </div>
      </div>

      {/* ── 2. MOBILE TOP BRAND HEADER (Only left Back button is clickable) ── */}
      <header
        dir="ltr"
        className="relative z-30 flex lg:hidden w-full items-center justify-between px-4 pt-3.5 pb-1 flex-shrink-0 pointer-events-none"
      >
        {/* Left: Back Button (Only interactive element in mobile top bar) */}
        <button
          type="button"
          onClick={onBack}
          aria-label="رجوع للخطوة السابقة"
          className="pointer-events-auto w-9 h-9 flex items-center justify-center rounded-full text-white/95 hover:text-sky-300 hover:bg-white/10 active:scale-95 transition-all cursor-pointer drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
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

        {/* Right: Inert balancer spacer (keeps logo dead-center without bell icon) */}
        <div aria-hidden="true" className="w-9 h-9 pointer-events-none" />
      </header>

      {/* ── 3. FORM CARD CONTAINER (Slightly taller & gently lifted upward; clearance reserved for unified floating stepper) ── */}
      <div className="relative z-20 w-full max-w-7xl mx-auto px-3.5 sm:px-8 lg:px-14 xl:px-20 flex-1 flex flex-col justify-end lg:justify-center items-center lg:items-end mt-auto lg:my-auto pt-[22vh] lg:pt-3 pb-[74px] sm:pb-[86px] lg:pb-[92px]">
        <div className="w-full max-w-[365px] xs:max-w-[385px] sm:max-w-[420px] lg:max-w-[500px] pt-7 pb-2 lg:pt-11 lg:pb-5 flex flex-col items-center">
          {/* ── OUTER METALLIC ICE-WHITE & CYAN CRYSTAL RIM SHELL ── */}
          <div
            className="relative w-full rounded-[24px] sm:rounded-[28px] lg:rounded-[32px] p-[1.75px] lg:p-[2px] transition-all duration-300"
            style={{
              // Crisp white-ice & periwinkle-cyan conic rim matching the bright corners, top bar & lower-right edge
              background:
                "conic-gradient(from 0deg at 50% 50%, #FFFFFF 0deg, #EAF6FF 42deg, #FFFFFF 55deg, #B8DCFF 92deg, #FFFFFF 128deg, #E2F2FF 168deg, #FFFFFF 195deg, #CBE6FF 232deg, #9ECBFF 268deg, #FFFFFF 310deg, #F0F8FF 340deg, #FFFFFF 360deg)",
              boxShadow:
                "0 0 12px 1px rgba(185, 228, 255, 0.85), 0 0 34px 4px rgba(48, 148, 255, 0.48), 0 26px 60px -8px rgba(0, 5, 28, 0.82)",
            }}
          >
            {/* Pinpoint Outer Edge Star Glints (Top bar, Bottom-center-left & Lower-right rim) */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-[0.5px] inset-x-7 h-[2px] bg-gradient-to-r from-white via-sky-100 to-white blur-[0.3px] opacity-95 z-20"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-[0.5px] left-[22%] w-28 sm:w-36 h-[2.5px] bg-gradient-to-r from-transparent via-white to-transparent blur-[0.4px] opacity-95 z-20"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-[0.5px] bottom-8 w-[2px] h-24 sm:h-32 bg-gradient-to-b from-transparent via-white to-sky-100 blur-[0.3px] opacity-90 z-20"
            />

            {/* ── 3A. FLOATING DOUBLE-RING GIFT MEDALLION (Sibling z-30 so outer glass halo refracts top border!) ── */}
            <div className="absolute -top-7.5 lg:-top-12 left-1/2 -translate-x-1/2 z-30">
              {/* Ambient Cyan-Cobalt Bloom Behind Medallion */}
              <div className="absolute inset-0 rounded-full bg-sky-400/55 blur-xl scale-115 -z-10 pointer-events-none" />

              {/* Outer Concentric Frosted-Glass Halo Ring */}
              <div
                className="p-[5px] lg:p-[7px] rounded-full transition-transform hover:scale-105 duration-300"
                style={{
                  background:
                    "radial-gradient(circle, rgba(38, 128, 255, 0.24) 48%, rgba(205, 232, 255, 0.44) 100%)",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  border: "1.5px solid rgba(225, 244, 255, 0.88)",
                  boxShadow:
                    "0 0 22px rgba(56, 189, 248, 0.65), 0 8px 20px rgba(0, 8, 42, 0.65), inset 0 1px 2px rgba(255, 255, 255, 0.92)",
                }}
              >
                {/* Inner Deep Royal-Sapphire Sphere with Neon Cyan Rim & Bottom Crescent */}
                <div
                  className="w-12 h-12 lg:w-[76px] lg:h-[76px] rounded-full flex items-center justify-center"
                  style={{
                    background: [
                      "radial-gradient(circle at 50% 94%, rgba(150, 218, 255, 0.85) 0%, rgba(56, 152, 255, 0.32) 36%, transparent 62%)",
                      "radial-gradient(circle at 50% 24%, #1A62E6 0%, #052B96 48%, #011356 82%, #021C78 100%)",
                    ].join(", "),
                    border: "2px solid #A8ECFF",
                    boxShadow:
                      "0 0 16px rgba(56, 189, 248, 0.95), inset 0 2px 4px rgba(235, 248, 255, 0.92), inset 0 -3px 6px rgba(135, 214, 255, 0.92)",
                  }}
                >
                  {/* Crisp White Gift Icon with Ribbon */}
                  <svg
                    className="w-6.5 h-6.5 lg:w-10 lg:h-10 text-white drop-shadow-[0_2px_6px_rgba(0,6,35,0.75)]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {/* Gift Bow */}
                    <path d="M12 7.5c-1.5-2.5-4-2.5-4 0 0 1.5 2 2.5 4 2.5" />
                    <path d="M12 7.5c1.5-2.5 4-2.5 4 0 0 1.5-2 2.5-4 2.5" />
                    {/* Gift Box Lid */}
                    <rect x="4" y="10" width="16" height="3.5" rx="1" />
                    {/* Gift Box Body */}
                    <path d="M6 13.5v6.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-6.5" />
                    {/* Vertical Ribbon */}
                    <line x1="12" y1="10" x2="12" y2="21" />
                  </svg>
                </div>
              </div>
            </div>

            {/* ── SCULPTED SAPPHIRE-ICE CRYSTAL SLAB (Gently Lightened Frost & Clearer Sapphire Core) ── */}
            <div
              className="relative z-10 w-full rounded-[22.25px] sm:rounded-[26.25px] lg:rounded-[30px] pt-9 pb-6.5 px-4 xs:px-5 lg:pt-15 lg:pb-9.5 lg:px-8 text-white"
              style={{
                background: [
                  // 1. Top-Left Whisper-Soft Crystal-Ice Corner Frost
                  "radial-gradient(ellipse 36% 26% at 0% 0%, rgba(205, 226, 255, 0.36) 0%, rgba(118, 154, 228, 0.18) 38%, rgba(28, 60, 148, 0.05) 70%, transparent 100%)",
                  // 2. Top-Right Whisper-Soft Ice Glare
                  "radial-gradient(ellipse 36% 26% at 100% 0%, rgba(222, 238, 255, 0.42) 0%, rgba(126, 162, 236, 0.20) 36%, rgba(30, 66, 156, 0.05) 68%, transparent 100%)",
                  // 3. Bottom-Left Gentle Ice Cushion
                  "radial-gradient(ellipse 38% 26% at 0% 100%, rgba(198, 222, 255, 0.36) 0%, rgba(118, 156, 232, 0.18) 40%, rgba(26, 62, 152, 0.06) 72%, transparent 100%)",
                  // 4. Bottom-Right Gentle Ice Cushion
                  "radial-gradient(ellipse 40% 28% at 100% 100%, rgba(212, 232, 255, 0.40) 0%, rgba(132, 168, 238, 0.22) 42%, rgba(32, 70, 164, 0.08) 74%, transparent 100%)",
                  // 5. Delicate Bottom Ice Refraction Shelf Beneath Button
                  "linear-gradient(0deg, rgba(175, 206, 255, 0.25) 0%, rgba(88, 138, 235, 0.12) 8%, rgba(24, 58, 148, 0.05) 18%, transparent 26%)",
                  // 6. Left & Right Delicate Acrylic Side Wall Frost
                  "linear-gradient(90deg, rgba(168, 202, 255, 0.18) 0%, rgba(70, 112, 202, 0.06) 5%, transparent 12%, transparent 88%, rgba(78, 120, 212, 0.08) 95%, rgba(182, 212, 255, 0.22) 100%)",
                  // 7. Top-Center Electric Cobalt Light Pool Cast by Gift Badge (#043FA5)
                  "radial-gradient(ellipse 50% 26% at 50% 6%, rgba(24, 118, 255, 0.46) 0%, rgba(6, 68, 185, 0.24) 52%, transparent 100%)",
                  // 8. Clearer Translucent Royal-Sapphire Core Cavity
                  "linear-gradient(180deg, rgba(6, 36, 112, 0.64) 0%, rgba(0, 24, 84, 0.73) 28%, rgba(0, 24, 86, 0.75) 58%, rgba(4, 32, 104, 0.71) 82%, rgba(22, 62, 156, 0.65) 100%)",
                ].join(", "),
                backdropFilter: "blur(14px) saturate(145%)",
                WebkitBackdropFilter: "blur(14px) saturate(145%)",
                boxShadow:
                  "inset 0 1.5px 2.5px rgba(240, 248, 255, 0.72), inset 0 -1.5px 4px rgba(185, 218, 255, 0.42), inset 1.5px 0 5px rgba(165, 205, 255, 0.20), inset -1.5px 0 5px rgba(175, 212, 255, 0.22), inset 0 0 20px rgba(85, 148, 255, 0.15)",
              }}
            >
              {/* Double-Cut Inner Crystal Bevel Hairline */}
              <div className="absolute inset-[3px] lg:inset-[4px] rounded-[19.5px] sm:rounded-[23px] lg:rounded-[26px] border border-white/16 pointer-events-none" />

              {/* Soft Internal Corner Caustics (Clipped cleanly to slab) */}
              <div className="absolute inset-0 rounded-[22.25px] sm:rounded-[26.25px] lg:rounded-[30px] pointer-events-none overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 lg:w-44 lg:h-44 bg-sky-100/6 rounded-full blur-2xl" />
                <div className="absolute -bottom-10 -left-8 w-32 h-28 lg:w-44 lg:h-36 bg-sky-200/6 rounded-full blur-2xl" />
                <div className="absolute -bottom-10 -right-8 w-36 h-32 lg:w-48 lg:h-40 bg-sky-100/6 rounded-full blur-2xl" />
              </div>

              {/* ── 3B. CARD HEADLINE & SUBHEAD (Recoleta Heading + Averta Subtitle) ───── */}
              <div className="text-center mb-4 lg:mb-7.5 mt-0.5">
                <h2
                  style={recoletaStyle}
                  className={`${recoleta.className} text-[22px] xs:text-[24px] lg:text-[35px] font-bold text-white tracking-[-0.01em] leading-[1.15] drop-shadow-[0_2px_14px_rgba(0,0,0,0.9)]`}
                >
                  Claim Your Free Drink
                </h2>
                <p
                  className={`${averta.className} text-sky-100/90 text-[12px] xs:text-[12.5px] lg:text-[14.5px] font-medium tracking-wide mt-1 lg:mt-2 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]`}
                >
                  Fill in your details to get your reward
                </p>
              </div>

              {/* ── 3C. THE FORM (1. Name -> 2. Mobile -> 3. Branch, kinetic shape/size morph on focus) ───── */}
              <form
                onSubmit={onSubmit}
                className="space-y-3 xs:space-y-3.5 lg:space-y-4.5"
              >
                {/* 1. Full Name Input (First) */}
                <div className={inputWrapperClassName}>
                  <label
                    htmlFor="reward-name"
                    className={`${inputCapsuleClassName} cursor-text`}
                    style={inputCapsuleStyle}
                  >
                    {/* User / Person Icon (morphs into a crisp squircle badge on focus, zero glow) */}
                    <div className="relative z-10 w-7 h-7 lg:w-8.5 lg:h-8.5 rounded-[14px] flex items-center justify-center text-white bg-transparent group-focus-within:bg-white/14 group-focus-within:rounded-[9px] group-focus-within:scale-105 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] flex-shrink-0 mr-2 lg:mr-3 pointer-events-none drop-shadow-[0_1px_2px_rgba(0,6,35,0.75)]">
                      <svg
                        className="w-[18px] h-[18px] lg:w-[21px] lg:h-[21px]"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    </div>

                    {/* Input with strict outline elimination & Montserrat font */}
                    <input
                      id="reward-name"
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Your Full Name"
                      style={{ outline: "none", boxShadow: "none" }}
                      className={`relative z-10 w-full bg-transparent text-white caret-white placeholder:text-white/90 focus:placeholder:text-white/40 group-focus-within:translate-x-0.5 transition-all duration-300 text-[12.5px] xs:text-[13.5px] lg:text-[15.5px] font-medium border-0 ring-0 focus:ring-0 focus:outline-none tracking-wide drop-shadow-[0_1px_2px_rgba(0,6,35,0.85)] ${averta.className}`}
                    />
                  </label>
                </div>

                {/* 2. Mobile Phone Input (Second) */}
                <div className={inputWrapperClassName}>
                  <label
                    htmlFor="reward-phone"
                    className={`${inputCapsuleClassName} cursor-text`}
                    style={inputCapsuleStyle}
                  >
                    {/* Phone Handset Icon (morphs into a crisp squircle badge on focus, zero glow) */}
                    <div className="relative z-10 w-7 h-7 lg:w-8.5 lg:h-8.5 rounded-[14px] flex items-center justify-center text-white bg-transparent group-focus-within:bg-white/14 group-focus-within:rounded-[9px] group-focus-within:scale-105 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] flex-shrink-0 mr-2 lg:mr-3 pointer-events-none drop-shadow-[0_1px_2px_rgba(0,6,35,0.75)]">
                      <svg
                        className="w-[17px] h-[17px] lg:w-[20px] lg:h-[20px]"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.24 1.02l-2.21 2.2z" />
                      </svg>
                    </div>

                    {/* Input with strict outline elimination & Montserrat font */}
                    <input
                      id="reward-phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Your Mobile Number"
                      dir="ltr"
                      style={{ outline: "none", boxShadow: "none" }}
                      className={`relative z-10 w-full bg-transparent text-white caret-white placeholder:text-white/90 focus:placeholder:text-white/40 group-focus-within:translate-x-0.5 transition-all duration-300 text-[12.5px] xs:text-[13.5px] lg:text-[15.5px] font-medium border-0 ring-0 focus:ring-0 focus:outline-none tracking-wide drop-shadow-[0_1px_2px_rgba(0,6,35,0.85)] ${averta.className}`}
                    />
                  </label>
                </div>

                {/* 3. Branch Selection (Single-Click Custom Glassmorphic Dropdown) */}
                <div
                  ref={branchDropdownRef}
                  className={`relative z-40 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isBranchOpen ? "-translate-y-[1px] scale-[1.02]" : ""
                  }`}
                >
                  <button
                    id="reward-branch"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={isBranchOpen}
                    onClick={() => setIsBranchOpen((prev) => !prev)}
                    style={{
                      ...inputCapsuleStyle,
                      outline: "none",
                    }}
                    className={`w-full text-left cursor-pointer relative overflow-hidden flex items-center transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isBranchOpen
                        ? "h-[52px] xs:h-[54px] lg:h-[63px] px-4 lg:px-5 rounded-[13px] lg:rounded-[15px] bg-[#021344]/95 border-[1.5px] border-white shadow-[0_0_20px_rgba(125,211,252,0.42),0_12px_24px_-6px_rgba(0,4,20,0.88),inset_0_1px_1.5px_rgba(255,255,255,0.38)]"
                        : "h-[47px] xs:h-[49px] lg:h-[58px] px-3.5 lg:px-4.5 rounded-[25px] lg:rounded-[29px] bg-[#011B58]/80 hover:bg-[#021750]/88 border-[1.25px] border-[#ACD0FF]/70 hover:border-sky-200/95 shadow-[0_4px_12px_rgba(0,6,32,0.42),inset_0_1px_1.5px_rgba(225,240,255,0.24)]"
                    }`}
                  >
                    {/* Location Pin Icon (morphs into a crisp glowing squircle badge when open) */}
                    <div
                      className={`relative z-10 w-7 h-7 lg:w-8.5 lg:h-8.5 flex items-center justify-center text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] flex-shrink-0 mr-2 lg:mr-3 pointer-events-none drop-shadow-[0_1px_2px_rgba(0,6,35,0.75)] ${
                        isBranchOpen
                          ? "bg-sky-400/22 rounded-[9px] scale-105 border border-sky-200/45 shadow-[0_0_12px_rgba(56,189,248,0.45)]"
                          : "bg-transparent rounded-[14px]"
                      }`}
                    >
                      <svg
                        className="w-[18px] h-[18px] lg:w-[21px] lg:h-[21px]"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                      </svg>
                    </div>

                    {/* Selected Branch Label */}
                    <span
                      className={`relative z-10 w-full text-white text-[12.5px] xs:text-[13.5px] lg:text-[15.5px] font-medium tracking-wide truncate transition-transform duration-300 ${
                        isBranchOpen ? "translate-x-0.5" : ""
                      } drop-shadow-[0_1px_2px_rgba(0,6,35,0.85)] ${averta.className}`}
                    >
                      {currentBranchLabel}
                    </span>

                    {/* Animated Chevron Down */}
                    <div
                      className={`relative z-10 transition-all duration-300 pointer-events-none flex-shrink-0 ml-2 drop-shadow-[0_1px_3px_rgba(0,6,35,0.85)] ${
                        isBranchOpen
                          ? "rotate-180 text-sky-300 scale-110"
                          : "text-white"
                      }`}
                    >
                      <svg
                        className="w-4 h-4 lg:w-4.5 lg:h-4.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </button>

                  {/* ── CUSTOM GLASSMORPHIC DROPDOWN MENU ── */}
                  {isBranchOpen && branches.length > 0 && (
                    <div
                      role="listbox"
                      aria-label="Choose Coffee Bay Branch"
                      className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-[18px] lg:rounded-[20px] p-1.5 lg:p-2 overflow-hidden animate-fadeIn"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(5, 28, 98, 0.96) 0%, rgba(2, 16, 66, 0.98) 55%, rgba(4, 24, 88, 0.97) 100%)",
                        backdropFilter: "blur(24px) saturate(165%)",
                        WebkitBackdropFilter: "blur(24px) saturate(165%)",
                        border: "1.5px solid rgba(185, 228, 255, 0.88)",
                        boxShadow:
                          "0 22px 52px -8px rgba(0, 4, 22, 0.95), 0 0 28px rgba(56, 189, 248, 0.42), inset 0 1px 2px rgba(255, 255, 255, 0.65)",
                      }}
                    >
                      {/* Top Crystal Edge Star Glint */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute top-0 inset-x-6 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-90"
                      />

                      <div className="max-h-[210px] lg:max-h-[240px] overflow-y-auto space-y-1 pr-0.5">
                        {branches.map((b) => {
                          const isSelected =
                            String(b.id) ===
                            String(
                              selectedBranchId ??
                                (branches[0] ? branches[0].id : ""),
                            );

                          return (
                            <button
                              key={b.id}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                setSelectedBranchId(b.id);
                                setIsBranchOpen(false);
                              }}
                              className={`w-full text-left flex items-center justify-between gap-2.5 px-3 py-2.5 lg:px-3.5 lg:py-3 rounded-[13px] lg:rounded-[14px] transition-all duration-200 cursor-pointer ${
                                isSelected
                                  ? "bg-gradient-to-r from-[#0E4BCE]/95 via-[#1864F8]/90 to-[#0A379E]/95 border border-sky-200/80 text-white shadow-[0_6px_18px_rgba(14,116,244,0.48),inset_0_1px_1.5px_rgba(255,255,255,0.45)]"
                                  : "bg-white/[0.03] hover:bg-white/[0.11] border border-transparent hover:border-sky-300/35 text-sky-100/95 hover:text-white"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 lg:gap-3 min-w-0 flex-1">
                                {/* Branch Option Pin Badge */}
                                <div
                                  className={`w-7 h-7 lg:w-8 lg:h-8 rounded-[10px] flex items-center justify-center flex-shrink-0 transition-colors ${
                                    isSelected
                                      ? "bg-white/20 text-white shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                                      : "bg-sky-400/12 text-sky-300"
                                  }`}
                                >
                                  <svg
                                    className="w-4 h-4 lg:w-4.5 lg:h-4.5"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                  </svg>
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div
                                    className={`text-[12.5px] xs:text-[13.5px] lg:text-[15px] font-semibold tracking-wide truncate ${averta.className}`}
                                  >
                                    {b.name}
                                  </div>
                                  {b.address && (
                                    <div
                                      className={`text-[10.5px] lg:text-[11.5px] truncate mt-0.5 ${
                                        isSelected
                                          ? "text-sky-100/90"
                                          : "text-sky-200/65"
                                      } ${averta.className}`}
                                    >
                                      {b.address}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Glowing Checkmark Badge for Active Selection */}
                              {isSelected && (
                                <div className="w-5.5 h-5.5 lg:w-6 lg:h-6 rounded-full bg-white text-[#07349E] flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_rgba(255,255,255,0.8)]">
                                  <svg
                                    className="w-3.5 h-3.5 lg:w-4 lg:h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={3}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Inline Error Notice if needed */}
                {errorMessage && (
                  <p
                    dir="rtl"
                    className={`text-[11px] lg:text-xs text-rose-300 font-semibold text-center bg-rose-950/80 border border-rose-500/50 py-1 lg:py-1.5 px-3 rounded-xl ${averta.className}`}
                  >
                    {errorMessage}
                  </p>
                )}

                {/* ── 3D. SUBMIT BUTTON: GLOSSY NEON BUTTON WITH GIFT ICON ────────── */}
                <div className="pt-2 lg:pt-3.5">
                  <GlossyNeonButton
                    type="submit"
                    disabled={loading}
                    loading={loading}
                    loadingText="Sending Code..."
                    fullWidth
                    size="compact"
                    glowIntensity="vibrant"
                    showArrow={true}
                    className="w-full"
                  >
                    <span className="flex items-center justify-center gap-2.5 lg:gap-3">
                      {/* Gift Icon inside Button (proportioned to match reference badge) */}
                      <svg
                        className="w-[22px] h-[22px] xs:w-[24px] xs:h-[24px] lg:w-[27px] lg:h-[27px] text-white flex-shrink-0 drop-shadow-[0_1px_3px_rgba(0,6,35,0.75)]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.9}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 7.5c-1.5-2.5-4-2.5-4 0 0 1.5 2 2.5 4 2.5" />
                        <path d="M12 7.5c1.5-2.5 4-2.5 4 0 0 1.5-2 2.5-4 2.5" />
                        <rect x="4" y="10" width="16" height="3.5" rx="1" />
                        <path d="M6 13.5v6.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-6.5" />
                        <line x1="12" y1="10" x2="12" y2="21" />
                      </svg>
                      <span
                        className={`${averta.className} font-semibold text-[14px] xs:text-[15px] lg:text-[17.5px] tracking-[0.01em]`}
                      >
                        Claim My Reward
                      </span>
                    </span>
                  </GlossyNeonButton>
                </div>

                {/* Subtle disclaimer (Desktop only so mobile card stays sleek & compact) */}
                <p
                  className={`hidden lg:block ${averta.className} text-[11px] text-white/85 text-center tracking-wide pt-0.5 drop-shadow-[0_1px_2px_rgba(0,8,40,0.75)]`}
                >
                  Instant SMS verification code will be sent to your number
                </p>
              </form>
            </div>
          </div>

          {/* ── 3E. BACK BUTTON (Desktop beneath card; on mobile handled by top header) ── */}
          <div className="hidden lg:flex mt-5 justify-center w-full">
            <button
              type="button"
              onClick={onBack}
              className={`group inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#030C24]/85 hover:bg-[#071c48] border border-sky-400/40 text-sky-200 hover:text-white text-sm font-semibold backdrop-blur-xl transition-all duration-200 cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.6),0_0_12px_rgba(56,189,248,0.2)] hover:shadow-[0_4px_20px_rgba(56,189,248,0.35)] ${averta.className}`}
            >
              <svg
                className="w-4 h-4 transition-transform group-hover:-translate-x-0.5 text-sky-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              <span>Back</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
