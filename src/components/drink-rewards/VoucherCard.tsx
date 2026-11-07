"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Check,
  Coffee,
  Copy,
  MapPin,
  Calendar,
  User,
  Phone,
  Scissors,
} from "lucide-react";
import { averta, recoleta, recoletaStyle } from "../../lib/fonts";

export interface VoucherCardProps {
  voucherCode: string;
  customerName: string;
  phone: string;
  drinkName: string;
  drinkImageUrl?: string | null;
  companionDrinkUrls?: string[];
  campaignTitle: string;
  status?: "ISSUED" | "REDEEMED" | "EXPIRED" | "CANCELLED";
  redeemedAt?: string | null;
  expiresAt: string;
  issuedAt?: string;
  selectedBranchName?: string | null;
  branches?: { id: number | string; name: string }[];
}

export function VoucherCard({
  voucherCode,
  customerName,
  phone,
  drinkName,
  drinkImageUrl,
  campaignTitle,
  status = "ISSUED",
  redeemedAt,
  expiresAt,
  selectedBranchName,
  branches,
}: VoucherCardProps) {
  const [copied, setCopied] = useState(false);

  const isRedeemed = status === "REDEEMED";
  const isExpired = status === "EXPIRED";
  const isCancelled = status === "CANCELLED";
  const isInactive = isRedeemed || isExpired || isCancelled;

  const handleCopyCode = async () => {
    if (isInactive) return;
    try {
      await navigator.clipboard.writeText(voucherCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const formattedExpiry = (() => {
    const d = new Date(expiresAt);
    if (Number.isNaN(d.getTime())) return expiresAt;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  })();

  const formattedRedeemedAt = (() => {
    if (!redeemedAt) return null;
    const d = new Date(redeemedAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  })();

  const branchDisplay =
    selectedBranchName ||
    (branches && branches.length > 0
      ? branches.map((b) => b.name).join(" • ")
      : "All Participating Coffee Bay Branches");

  return (
    <div
      dir="ltr"
      className={`w-full max-w-[362px] xs:max-w-[386px] md:max-w-[780px] lg:max-w-[830px] mx-auto ${averta.className}`}
    >
      {/* ── SCOPED CSS FOR TRUE DIE-CUT PERFORATED NOTCHES & 3D ROLLED PAPER CORNER ── */}
      <style jsx>{`
        /* Mobile (< 768px): Vertical Ticket (Top Silver, Bottom Deep Blue) */
        @media (max-width: 767px) {
          .cb-silver-half {
            border-radius: 22px 22px 0 0;
            -webkit-mask-image:
              radial-gradient(
                circle 13px at 0px 100%,
                transparent 13px,
                #000 13.5px
              ),
              radial-gradient(
                circle 13px at 100% 100%,
                transparent 13px,
                #000 13.5px
              );
            -webkit-mask-composite: destination-in;
            mask-image:
              radial-gradient(
                circle 13px at 0px 100%,
                transparent 13px,
                #000 13.5px
              ),
              radial-gradient(
                circle 13px at 100% 100%,
                transparent 13px,
                #000 13.5px
              );
            mask-composite: intersect;
          }
          .cb-blue-half {
            border-radius: 0 0 22px 22px;
            /* Punches top-left & top-right notches + bottom-right 26px bevel for the rolled paper curl */
            -webkit-mask-image:
              radial-gradient(
                circle 13px at 0px 0px,
                transparent 13px,
                #000 13.5px
              ),
              radial-gradient(
                circle 13px at 100% 0px,
                transparent 13px,
                #000 13.5px
              ),
              linear-gradient(
                135deg,
                #000 calc(100% - 26px),
                transparent calc(100% - 25px)
              );
            -webkit-mask-composite: destination-in;
            mask-image:
              radial-gradient(
                circle 13px at 0px 0px,
                transparent 13px,
                #000 13.5px
              ),
              radial-gradient(
                circle 13px at 100% 0px,
                transparent 13px,
                #000 13.5px
              ),
              linear-gradient(
                135deg,
                #000 calc(100% - 26px),
                transparent calc(100% - 25px)
              );
            mask-composite: intersect;
          }
        }

        /* Desktop (>= 768px): Horizontal Boarding-Pass Ticket (Left Silver, Right Deep Blue) */
        @media (min-width: 768px) {
          .cb-silver-half {
            border-radius: 24px 0 0 24px;
            -webkit-mask-image:
              radial-gradient(
                circle 15px at 100% 0px,
                transparent 15px,
                #000 15.5px
              ),
              radial-gradient(
                circle 15px at 100% 100%,
                transparent 15px,
                #000 15.5px
              );
            -webkit-mask-composite: destination-in;
            mask-image:
              radial-gradient(
                circle 15px at 100% 0px,
                transparent 15px,
                #000 15.5px
              ),
              radial-gradient(
                circle 15px at 100% 100%,
                transparent 15px,
                #000 15.5px
              );
            mask-composite: intersect;
          }
          .cb-blue-half {
            border-radius: 0 24px 24px 0;
            /* Punches top-left & bottom-left notches + bottom-right 30px bevel for the rolled paper curl */
            -webkit-mask-image:
              radial-gradient(
                circle 15px at 0px 0px,
                transparent 15px,
                #000 15.5px
              ),
              radial-gradient(
                circle 15px at 0px 100%,
                transparent 15px,
                #000 15.5px
              ),
              linear-gradient(
                135deg,
                #000 calc(100% - 30px),
                transparent calc(100% - 29px)
              );
            -webkit-mask-composite: destination-in;
            mask-image:
              radial-gradient(
                circle 15px at 0px 0px,
                transparent 15px,
                #000 15.5px
              ),
              radial-gradient(
                circle 15px at 0px 100%,
                transparent 15px,
                #000 15.5px
              ),
              linear-gradient(
                135deg,
                #000 calc(100% - 30px),
                transparent calc(100% - 29px)
              );
            mask-composite: intersect;
          }
        }
      `}</style>

      {/* ── PHYSICAL PAPER MOCKUP CONTAINER (With Lifted Corner Shadows & Slight Tactile Tilt) ── */}
      <div className="relative group">
        {/* 3D Lifted Paper Corner Cast Shadows underneath the voucher (Left & Right lifted curl shadows) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-3 left-4 w-[42%] h-7 bg-black/75 blur-xl rounded-full -rotate-3 skew-x-[-10deg] z-0"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-3.5 right-5 w-[44%] h-8 bg-black/80 blur-xl rounded-full rotate-3 skew-x-[12deg] z-0"
        />

        {/* Drop-Shadow Wrapper that hugs the die-cut masks and beveled paper curl */}
        <div
          className="relative z-10 flex flex-col md:flex-row items-stretch"
          style={{
            filter:
              "drop-shadow(0 20px 38px rgba(1, 5, 24, 0.72)) drop-shadow(0 3px 8px rgba(1, 5, 24, 0.45))",
          }}
        >
          {/* ════════════════════════════════════════════════════════════════════════
              HALF 1: METALLIC SILVER & PEARL PRINTED PAPER STOCK
              - Mobile: Top Half (Taller Portrait proportions)
              - Desktop: Left Wing (~43% width, Wide Horizontal Pass)
             ════════════════════════════════════════════════════════════════════════ */}
          <div
            className="cb-silver-half relative md:w-[43%] px-4 pt-5 pb-6 sm:px-5 md:px-6 md:py-6 flex flex-col justify-between text-[#150958] overflow-hidden"
            style={{
              background:
                "linear-gradient(155deg, #FFFFFF 0%, #F3F6FA 38%, #DCE2EC 75%, #C0C0C0 100%)",
            }}
          >
            {/* Tactile Paper Crease & Brushed Foil Sheen */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-45"
              style={{
                background:
                  "linear-gradient(125deg, rgba(255,255,255,0.85) 0%, transparent 38%, rgba(21,9,88,0.04) 52%, transparent 68%, rgba(255,255,255,0.6) 100%)",
              }}
            />

            {/* Engraved Inner Paper Border Frame */}
            <div className="pointer-events-none absolute inset-[8px] bottom-[3px] md:bottom-[8px] md:right-[3px] rounded-t-[15px] md:rounded-t-none md:rounded-l-[17px] border border-[#150958]/[0.14]" />

            {/* ── 1A. SILVER HEADER: Official Dark Logo + Free Drink Stamp ── */}
            <div className="relative z-10 flex items-center justify-between gap-2 pb-3 md:pb-2.5 border-b border-[#150958]/[0.12]">
              <div className="relative w-24 xs:w-28 md:w-28 h-6">
                <Image
                  src="/drink-rewards/coffeebay-dark-logo.png"
                  alt="Coffee Bay"
                  fill
                  sizes="120px"
                  className="object-contain object-left"
                />
              </div>

              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] sm:text-[9.5px] font-extrabold uppercase tracking-[0.14em] shadow-sm ${
                  isRedeemed
                    ? "bg-emerald-700 text-white"
                    : isCancelled
                      ? "bg-amber-800 text-amber-100"
                      : isExpired
                        ? "bg-rose-800 text-rose-100"
                        : "bg-[#150958] text-white"
                }`}
              >
                {isRedeemed
                  ? "REDEEMED ✓"
                  : isExpired
                    ? "EXPIRED"
                    : isCancelled
                      ? "CANCELLED ✕"
                      : "1ST DRINK FREE"}
              </span>
            </div>

            {/* ── 1B. BEVERAGE SHOWCASE (Taller on Mobile, Centered Wing on Desktop) ── */}
            <div className="relative z-10 my-auto py-5 md:py-4 flex flex-row md:flex-col items-center md:justify-center gap-4 md:gap-2.5 text-left md:text-center">
              {/* Floating Drink Studio Render */}
              <div className="relative w-[96px] h-[112px] xs:w-[104px] xs:h-[122px] md:w-[118px] md:h-[132px] shrink-0 flex items-center justify-center">
                <div
                  className="absolute bottom-1 w-16 md:w-20 h-2.5 rounded-full blur-[5px]"
                  style={{ background: "rgba(21, 9, 88, 0.22)" }}
                />
                {drinkImageUrl ? (
                  <div className="relative w-full h-full">
                    <Image
                      src={drinkImageUrl}
                      alt={drinkName}
                      fill
                      sizes="(max-width: 768px) 104px, 118px"
                      className="object-contain drop-shadow-[0_10px_16px_rgba(21,9,88,0.24)]"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-[#150958]/[0.08] border border-[#150958]/20 flex items-center justify-center">
                    <Coffee className="w-8 h-8 text-[#150958]" />
                  </div>
                )}
              </div>

              {/* Drink Title & Campaign Subtitle */}
              <div className="flex-1 md:flex-initial min-w-0">
                <div className="text-[9px] sm:text-[9.5px] font-extrabold uppercase tracking-[0.18em] text-[#150958]/60 mb-1 md:mb-0.5">
                  COMPLIMENTARY BEVERAGE
                </div>
                <h3
                  dir="auto"
                  style={recoletaStyle}
                  className={`${recoleta.className} text-lg xs:text-xl md:text-[21px] font-bold text-[#150958] leading-snug break-words`}
                >
                  {drinkName}
                </h3>
                {campaignTitle && (
                  <p
                    dir="auto"
                    className="mt-1 md:mt-0.5 text-[11px] font-bold text-[#150958]/70 truncate"
                  >
                    {campaignTitle}
                  </p>
                )}
              </div>
            </div>

            {/* ── 1C. SILVER FOOTER STAMP ── */}
            <div className="relative z-10 pt-2.5 md:pt-2 border-t border-[#150958]/[0.10] flex items-center justify-between text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#150958]/65">
              <span>OFFICIAL VOUCHER</span>
              <span>ADMIT ONE DRINK</span>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════════════
              HALF 2: ROYAL DEEP BLUE (#150958) PRINTED PAPER STOCK
              - Mobile: Bottom Half (Taller Portrait proportions)
              - Desktop: Right Wing (~57% width, Wide Horizontal Pass)
              - Includes 3D Rolled / Lifted Paper Curl at Bottom-Right Corner
             ════════════════════════════════════════════════════════════════════════ */}
          <div
            className="cb-blue-half relative md:w-[57%] px-4 pt-4 pb-6 sm:px-5 md:px-6 md:py-6 flex flex-col justify-between text-white overflow-hidden"
            style={{
              background:
                "linear-gradient(150deg, #1A0C68 0%, #150958 52%, #0D053B 100%)",
            }}
          >
            {/* Subtle Paper Fiber Highlight & Fold Sheen on Deep Blue Stock */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                background:
                  "radial-gradient(circle at 85% 15%, rgba(192, 192, 192, 0.18) 0%, transparent 55%), linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 45%, rgba(0,0,0,0.2) 100%)",
              }}
            />

            {/* Mobile Horizontal Perforated Tear Line (Top of Blue Half) */}
            <div className="flex md:hidden items-center -mt-4 mb-3.5 mx-3">
              <Scissors className="w-3 h-3 text-[#C0C0C0]/60 -rotate-90 shrink-0 mr-1" />
              <div className="w-full border-t-[1.5px] border-dashed border-[#C0C0C0]/40" />
            </div>

            {/* Desktop Vertical Perforated Tear Line (Left Edge of Blue Half) */}
            <div
              aria-hidden="true"
              className="hidden md:flex flex-col items-center absolute left-0 top-4 bottom-4 z-20"
            >
              <Scissors className="w-3.5 h-3.5 text-[#C0C0C0]/65 rotate-0 shrink-0 mb-1 -ml-[7px]" />
              <div className="h-full border-l-[1.5px] border-dashed border-[#C0C0C0]/40" />
            </div>

            {/* Engraved Inner Metallic Silver Border Frame */}
            <div className="pointer-events-none absolute inset-[8px] top-[4px] md:top-[8px] md:left-[4px] rounded-b-[15px] md:rounded-b-none md:rounded-r-[17px] border border-[#C0C0C0]/[0.22]" />

            {/* ── 2A. TOP HEADER OF BLUE WING ── */}
            <div className="relative z-10 flex items-center justify-between gap-2 pb-3 md:pb-2.5 border-b border-[#C0C0C0]/20">
              <span className="text-[9.5px] sm:text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#C0C0C0]">
                REDEMPTION PASS DETAILS
              </span>
              <span
                className={`text-[9.5px] font-bold uppercase tracking-[0.14em] ${
                  isRedeemed
                    ? "text-emerald-300"
                    : isCancelled
                      ? "text-amber-300"
                      : isExpired
                        ? "text-rose-300"
                        : "text-white/75"
                }`}
              >
                {isRedeemed
                  ? "USED PASS ✓"
                  : isExpired
                    ? "EXPIRED PASS"
                    : isCancelled
                      ? "CANCELLED PASS"
                      : "VERIFIED GUEST"}
              </span>
            </div>

            {/* ── 2B. ORGANIZED GUEST LEDGER (Clean Printed Rows & Columns) ── */}
            <div className="relative z-10 py-4 md:py-3 border-b border-[#C0C0C0]/20 space-y-3.5 md:space-y-2.5">
              <div className="grid grid-cols-3 divide-x divide-[#C0C0C0]/20">
                {/* Guest Name */}
                <div className="pr-2.5 min-w-0">
                  <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#C0C0C0]/80 mb-1 md:mb-0.5">
                    <User className="w-2.5 h-2.5 text-[#C0C0C0] shrink-0" />
                    <span>GUEST</span>
                  </div>
                  <p
                    dir="auto"
                    className="text-xs sm:text-[13px] font-extrabold text-white truncate"
                    title={customerName}
                  >
                    {customerName}
                  </p>
                </div>

                {/* Phone */}
                <div className="px-2.5 min-w-0">
                  <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#C0C0C0]/80 mb-1 md:mb-0.5">
                    <Phone className="w-2.5 h-2.5 text-[#C0C0C0] shrink-0" />
                    <span>PHONE</span>
                  </div>
                  <p className="text-xs sm:text-[13px] font-extrabold text-white font-mono tracking-tight truncate">
                    {phone}
                  </p>
                </div>

                {/* Valid Until */}
                <div className="pl-2.5 min-w-0">
                  <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#C0C0C0]/80 mb-1 md:mb-0.5">
                    <Calendar className="w-2.5 h-2.5 text-[#C0C0C0] shrink-0" />
                    <span>EXPIRES</span>
                  </div>
                  <p className="text-xs sm:text-[13px] font-extrabold text-[#E2E8F0] truncate">
                    {formattedExpiry}
                  </p>
                </div>
              </div>

              {/* Branch Row */}
              <div className="pt-2.5 md:pt-2 border-t border-[#C0C0C0]/15 flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1 text-[9px] sm:text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#C0C0C0]/80 shrink-0">
                  <MapPin className="w-3 h-3 text-[#C0C0C0] shrink-0" />
                  BRANCH
                </span>
                <span
                  dir="auto"
                  className="font-bold text-white truncate text-right text-[11.5px] sm:text-xs"
                  title={branchDisplay}
                >
                  {branchDisplay}
                </span>
              </div>
            </div>

            {/* ── 2C. FULL-WIDTH SERIAL VOUCHER CODE STUB (No QR Code) ── */}
            <div className="relative z-10 pt-4 md:pt-3 pr-2">
              {/* Diagonal Printed Rubber Stamp Overlay when Redeemed, Expired, or Cancelled */}
              {isInactive && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-6 right-6 z-30 -rotate-12 select-none"
                >
                  <div
                    className={`px-3 py-1 rounded-md border-2 font-black text-xs sm:text-sm uppercase tracking-[0.22em] shadow-md backdrop-blur-[1px] ${
                      isRedeemed
                        ? "border-emerald-400/80 text-emerald-300 bg-emerald-950/60"
                        : isCancelled
                          ? "border-amber-400/80 text-amber-300 bg-amber-950/70"
                          : "border-rose-400/80 text-rose-300 bg-rose-950/60"
                    }`}
                  >
                    {isRedeemed
                      ? "REDEEMED • USED"
                      : isExpired
                        ? "EXPIRED PASS"
                        : "CANCELLED • VOID"}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span
                  className={`text-[9.5px] sm:text-[10px] font-extrabold uppercase tracking-[0.16em] ${
                    isRedeemed
                      ? "text-emerald-300"
                      : isCancelled
                        ? "text-amber-300"
                        : isExpired
                          ? "text-rose-300"
                          : "text-[#C0C0C0]"
                  }`}
                >
                  {isRedeemed
                    ? "VOUCHER USED ✓"
                    : isExpired
                      ? "VOUCHER EXPIRED"
                      : isCancelled
                        ? "VOUCHER CANCELLED ✕"
                        : "VOUCHER SERIAL CODE"}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#C0C0C0]/75">
                  {isRedeemed
                    ? formattedRedeemedAt
                      ? `REDEEMED ${formattedRedeemedAt}`
                      : "COPY DISABLED"
                    : isInactive
                      ? "COPY DISABLED"
                      : "SINGLE USE"}
                </span>
              </div>

              {/* Full-Width Metallic Silver Bordered Code Box */}
              <div
                className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] ${
                  isInactive
                    ? "bg-[#090325]/70 border border-[#C0C0C0]/25"
                    : "bg-[#0B0430]/90 border border-[#C0C0C0]/45"
                }`}
              >
                <span
                  className={`font-mono text-base xs:text-lg sm:text-xl font-black tracking-[0.16em] truncate ${
                    isInactive
                      ? "text-white/45 line-through decoration-2 decoration-[#C0C0C0]/80 select-none"
                      : "text-white select-all"
                  }`}
                >
                  {voucherCode}
                </span>

                {isInactive ? (
                  <span
                    aria-disabled="true"
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-extrabold tracking-wider uppercase shrink-0 select-none cursor-not-allowed ${
                      isRedeemed
                        ? "bg-emerald-500/20 border border-emerald-400/50 text-emerald-200"
                        : isCancelled
                          ? "bg-amber-500/20 border border-amber-400/50 text-amber-200"
                          : "bg-rose-500/20 border border-rose-400/50 text-rose-200"
                    }`}
                  >
                    {isRedeemed ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>USED</span>
                      </>
                    ) : (
                      <span>{isExpired ? "EXPIRED" : "CANCELLED"}</span>
                    )}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    aria-label="Copy voucher code"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[#150958] text-[10.5px] font-extrabold tracking-wider uppercase transition-all cursor-pointer shrink-0 active:scale-95"
                    style={{
                      background:
                        "linear-gradient(135deg, #FFFFFF 0%, #D8DEE8 55%, #C0C0C0 100%)",
                    }}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#150958]" />
                        <span>COPIED</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#150958]" />
                        <span>COPY</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Printed Silver Barcode Strip & Cashier / Redemption Status Instruction */}
              <div className="mt-3 md:mt-2.5 flex items-center justify-between gap-3 pr-4">
                <div
                  aria-hidden="true"
                  className={`h-3.5 w-24 sm:w-32 shrink-0 ${
                    isInactive ? "opacity-20" : "opacity-55"
                  }`}
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, #C0C0C0 0px, #C0C0C0 2px, transparent 2px, transparent 4px, #FFFFFF 4px, #FFFFFF 5px, transparent 5px, transparent 8px, #C0C0C0 8px, #C0C0C0 11px, transparent 11px, transparent 13px)",
                  }}
                />
                <span
                  dir="auto"
                  className="text-[10.5px] text-[#C0C0C0] font-semibold truncate"
                  title={
                    isRedeemed
                      ? `Redeemed${formattedRedeemedAt ? ` (${formattedRedeemedAt})` : ""} • ${branchDisplay}`
                      : undefined
                  }
                >
                  {isRedeemed
                    ? `Redeemed${formattedRedeemedAt ? ` (${formattedRedeemedAt})` : ""} • ${branchDisplay}`
                    : isExpired
                      ? "Voucher validity period ended"
                      : isCancelled
                        ? "Administratively cancelled — not valid"
                        : "Present code to the cashier"}
                </span>
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════════
                3D ROLLED / LIFTED PAPER CORNER CURL (Bottom-Right Corner Roll)
                Reveals the Metallic Silver paper backing rolled over the Deep Blue front
               ════════════════════════════════════════════════════════════════════ */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 right-0 w-[38px] h-[38px] md:w-[44px] md:h-[44px] z-30"
            >
              {/* Cast Shadow of the Rolled Flap onto the Deep Blue Paper */}
              <div
                className="absolute inset-0 -left-2 -top-2 rounded-tl-2xl"
                style={{
                  background:
                    "radial-gradient(circle at 100% 100%, rgba(0, 0, 0, 0.65) 10%, rgba(0, 0, 0, 0.25) 55%, transparent 72%)",
                }}
              />
              {/* 3D Cylindrical Silver Paper Roll Flap */}
              <div
                className="absolute bottom-0 right-0 w-full h-full rounded-tl-[16px]"
                style={{
                  background:
                    "linear-gradient(135deg, #FFFFFF 0%, #E8ECF4 28%, #C0C0C0 52%, #7D8799 78%, #3B4458 100%)",
                  clipPath: "polygon(0 100%, 100% 0, 0 0)",
                  boxShadow:
                    "-3px -3px 8px rgba(0, 0, 0, 0.45), inset 1px 1px 2px rgba(255, 255, 255, 0.9)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
