"use client";

import React from "react";
import type { PublicCampaignData } from "../../services/drink-rewards/drink-campaign-service";
import { VoucherCard } from "./VoucherCard";
import { averta, recoleta, recoletaStyle } from "../../lib/fonts";

interface VoucherDisplayStepProps {
  voucherData: {
    voucherCode: string;
    customerName: string;
    phone: string;
    drinkName: string;
    campaignTitle: string;
    status?: "ISSUED" | "REDEEMED" | "EXPIRED" | "CANCELLED";
    redeemedAt?: string | null;
    expiresAt: string;
  };
  drinkImageUrl?: string | null;
  companionDrinkUrls?: string[];
  selectedBranchName?: string | null;
  branches: PublicCampaignData["branches"];
}

export function VoucherDisplayStep({
  voucherData,
  drinkImageUrl,
  companionDrinkUrls,
  selectedBranchName,
  branches,
}: VoucherDisplayStepProps) {
  const status = voucherData.status || "ISSUED";
  const isRedeemed = status === "REDEEMED";
  const isExpired = status === "EXPIRED";
  const isCancelled = status === "CANCELLED";

  return (
    <div
      className={`w-full flex flex-col items-center justify-center px-3 sm:px-6 max-w-4xl mx-auto animate-fadeIn ${averta.className}`}
    >
      {/* ── CALM EDITORIAL HEADLINE (Raised up as page header on Desktop, with clear spacing below before voucher) ── */}
      <div className="text-center space-y-1.5 px-2 -mt-3 md:-mt-12 lg:-mt-16 pb-5 md:pb-10 lg:pb-12 flex flex-col items-center">
        <h2
          style={recoletaStyle}
          className={`${recoleta.className} text-xl xs:text-2xl sm:text-3xl font-bold text-white tracking-[0.03em] uppercase leading-tight drop-shadow-[0_4px_16px_rgba(2,8,35,0.85)]`}
        >
          {isRedeemed
            ? "VOUCHER REDEEMED — ENJOY YOUR DRINK!"
            : isExpired
              ? "THIS VOUCHER HAS EXPIRED"
              : isCancelled
                ? "THIS VOUCHER HAS BEEN CANCELLED"
                : "YOUR FREE DRINK IS READY!"}
        </h2>

        <p
          className={`${averta.className} text-xs sm:text-[13px] text-white/80 font-medium tracking-[0.01em]`}
        >
          {isRedeemed
            ? "This pass has been redeemed at the branch counter."
            : isExpired
              ? "This voucher's validity period has ended and it can no longer be redeemed."
              : isCancelled
                ? "This pass was administratively cancelled and is no longer valid for redemption."
                : "Present this printed pass to the barista at the counter."}
        </p>
      </div>

      <VoucherCard
        voucherCode={voucherData.voucherCode}
        customerName={voucherData.customerName}
        phone={voucherData.phone}
        drinkName={voucherData.drinkName}
        drinkImageUrl={drinkImageUrl}
        companionDrinkUrls={companionDrinkUrls}
        campaignTitle={voucherData.campaignTitle}
        status={status}
        redeemedAt={voucherData.redeemedAt}
        expiresAt={voucherData.expiresAt}
        selectedBranchName={selectedBranchName}
        branches={branches}
      />
    </div>
  );
}
