"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { PublicCampaignData } from "../../../services/drink-rewards/drink-campaign-service";
import type { ResolvedRewardJourneyState } from "../../../services/drink-rewards/drink-otp-service";
import { useDrinkRewardsJourney } from "../CustomerDrinkRewardsFlow";
import { VoucherDisplayStep } from "../VoucherDisplayStep";
import { averta } from "../../../lib/fonts";

interface SuccessStepClientProps {
  serverCampaign?: PublicCampaignData;
  serverJourney: ResolvedRewardJourneyState;
}

export function SuccessStepClient({
  serverCampaign,
  serverJourney,
}: SuccessStepClientProps) {
  const router = useRouter();
  const {
    campaign,
    journey,
    syncCampaignFromServer,
    syncJourneyFromServer,
    setErrorMessage,
  } = useDrinkRewardsJourney();
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (serverCampaign) {
      syncCampaignFromServer(serverCampaign);
    }
  }, [serverCampaign, syncCampaignFromServer]);

  useEffect(() => {
    const serverTs = Date.parse(serverJourney.serverNow) || 0;
    const clientTs = Date.parse(journey.serverNow) || 0;
    if (serverTs >= clientTs) {
      syncJourneyFromServer(serverJourney);
    }
  }, [serverJourney, journey.serverNow, syncJourneyFromServer]);

  const activeJourney = useMemo(() => {
    const serverTs = Date.parse(serverJourney.serverNow) || 0;
    const clientTs = Date.parse(journey.serverNow) || 0;
    if (journey.voucher && clientTs >= serverTs) {
      return journey;
    }
    return serverJourney.voucher !== null ? serverJourney : journey;
  }, [journey, serverJourney]);

  const lastStatusCheckRef = useRef<number>(Date.now());
  const isCheckingStatusRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const hasIssuedVoucher =
    activeJourney.voucher !== null &&
    (activeJourney.voucher.status ?? "ISSUED") === "ISSUED";

  const refreshVoucherStatus = useCallback(
    async (minIntervalMs = 15_000) => {
      if (!hasIssuedVoucher) {
        return; // No voucher or terminal state reached (REDEEMED / EXPIRED / CANCELLED) -> never query
      }
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return; // Never query while tab is hidden or phone screen is locked
      }
      if (isCheckingStatusRef.current) {
        return; // Strictly block overlapping requests if a previous request takes > 15s
      }
      const now = Date.now();
      if (now - lastStatusCheckRef.current < minIntervalMs) {
        return;
      }
      lastStatusCheckRef.current = now;
      isCheckingStatusRef.current = true;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch(
          `/api/drink-rewards/session?campaignSlug=${encodeURIComponent(campaign.slug)}`,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
            signal: controller.signal,
          },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          success?: boolean;
          journey?: ResolvedRewardJourneyState;
        };
        if (data.success && data.journey?.voucher) {
          syncJourneyFromServer(data.journey);
        }
      } catch {
        // Non-fatal network error or AbortError on cleanup ignored
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        isCheckingStatusRef.current = false;
      }
    },
    [hasIssuedVoucher, campaign.slug, syncJourneyFromServer],
  );

  // Visibility-aware 15-second periodic polling + immediate check on tab return/unlock:
  // - Runs every 15s ONLY while an actual voucher exists AND status === "ISSUED" AND document.visibilityState === "visible"
  // - Pauses immediately when tab goes to background / phone screen locks
  // - Cleans up interval + aborts in-flight fetch on unmount or when status becomes REDEEMED / EXPIRED / CANCELLED
  useEffect(() => {
    if (!hasIssuedVoucher) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPollingIfVisible = () => {
      if (document.visibilityState === "visible" && intervalId === null) {
        intervalId = setInterval(() => {
          if (document.visibilityState === "visible") {
            void refreshVoucherStatus(14_000);
          }
        }, 15_000);
      }
    };

    const stopPolling = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshVoucherStatus(3_000);
        startPollingIfVisible();
      } else {
        stopPolling();
      }
    };

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        void refreshVoucherStatus(3_000);
        startPollingIfVisible();
      }
    };

    startPollingIfVisible();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopPolling();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      isCheckingStatusRef.current = false;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [hasIssuedVoucher, refreshVoucherStatus]);

  const basePath = `/drink-rewards/${encodeURIComponent(campaign.slug)}`;

  // Resolve the won drink's image URL: prioritize the authoritative DB snapshot on voucher, then fallback to menu
  const wonDrinkImageUrl = useMemo(() => {
    if (!activeJourney.voucher) return null;
    if (activeJourney.voucher.drinkImageUrl) {
      return activeJourney.voucher.drinkImageUrl;
    }
    if (activeJourney.selectedDrinkId !== null) {
      const byId = campaign.drinks.find(
        (d) => String(d.id) === String(activeJourney.selectedDrinkId),
      );
      if (byId?.imageUrl) return byId.imageUrl;
    }
    const byName = campaign.drinks.find(
      (d) =>
        d.name.trim().toLowerCase() ===
        activeJourney.voucher?.drinkName.trim().toLowerCase(),
    );
    return byName?.imageUrl ?? null;
  }, [activeJourney.selectedDrinkId, activeJourney.voucher, campaign.drinks]);

  // Resolve up to 2 companion drink URLs to create the celebratory multi-drink visual identity
  const companionDrinkUrls = useMemo(() => {
    const urls: string[] = [];
    for (const d of campaign.drinks) {
      if (d.imageUrl && d.imageUrl !== wonDrinkImageUrl) {
        urls.push(d.imageUrl);
      }
      if (urls.length >= 2) break;
    }
    return urls;
  }, [campaign.drinks, wonDrinkImageUrl]);

  // Resolve the customer's selected branch name: prioritize live branch name from campaign.branches (so branch renames reflect immediately), then fallback to DB snapshot on voucher
  const selectedBranchName = useMemo(() => {
    const targetBranchId =
      activeJourney.voucher?.branchId ?? activeJourney.selectedBranchId;
    if (targetBranchId !== null && targetBranchId !== undefined) {
      const found = campaign.branches.find(
        (b) => String(b.id) === String(targetBranchId),
      );
      if (found?.name) {
        return found.name;
      }
    }
    return activeJourney.voucher?.branchName ?? null;
  }, [
    activeJourney.selectedBranchId,
    activeJourney.voucher,
    campaign.branches,
  ]);

  const handleStartNewPhone = async () => {
    if (resetting) return;
    setResetting(true);
    setErrorMessage(null);
    try {
      await fetch(
        `/api/drink-rewards/session?campaignSlug=${encodeURIComponent(campaign.slug)}`,
        { method: "DELETE" },
      );
      syncJourneyFromServer({
        stage: "UNINITIALIZED",
        campaignSlug: campaign.slug,
        customerName: "",
        phone: "",
        selectedBranchId: null,
        selectedDrinkId: null,
        challengeId: null,
        expiresAt: null,
        resendAvailableAt: null,
        verifiedExpiresAt: null,
        attemptsRemaining: null,
        voucher: null,
        serverNow: new Date().toISOString(),
      });
      router.replace(`${basePath}?step=details`);
    } catch {
      setResetting(false);
    }
  };

  if (!activeJourney.voucher) {
    return null;
  }

  return (
    <main className="relative w-full flex-1 min-h-[100dvh] lg:min-h-[calc(100dvh-65px)] flex flex-col justify-between items-center overflow-x-hidden select-none bg-[#020B2A] pb-16 sm:pb-20">
      {/* ── 1. CLEAN STUDIO BACKGROUNDS (Desktop: verification-desktop-bg.png | Mobile: cropped portrait version) ── */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {/* Mobile Portrait Background (Cleanly cropped & composed from verification-desktop-bg.png) */}
        <div className="block sm:hidden absolute inset-0">
          <Image
            src="/drink-rewards/success-mobile-bg.png"
            alt="Coffee Bay Background Mobile"
            fill
            priority
            unoptimized
            className="object-cover object-bottom select-none"
          />
        </div>

        {/* Desktop & Tablet Widescreen Background */}
        <div className="hidden sm:block absolute inset-0">
          <Image
            src="/drink-rewards/verification-desktop-bg.png"
            alt="Coffee Bay Background Desktop"
            fill
            priority
            unoptimized
            className="object-cover object-bottom select-none"
          />
        </div>
      </div>

      {/* ── 2. MOBILE TOP BRAND HEADER (Centered Official Coffee Bay White Logo) ── */}
      <header
        dir="ltr"
        className="relative z-30 flex lg:hidden w-full items-center justify-center px-4 pt-3.5 pb-1 flex-shrink-0 pointer-events-none"
      >
        <div className="relative w-36 xs:w-40 sm:w-44 h-8 xs:h-8.5 sm:h-9 pointer-events-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
          <Image
            src="/drink-rewards/coffeebay-white-logo.png"
            alt="Coffee Bay"
            fill
            priority
            className="object-contain"
          />
        </div>
      </header>

      {/* ── 3. MAIN REWARD PASS CONTENT ── */}
      <div className="relative z-10 w-full flex-1 flex flex-col justify-center items-center my-auto pt-0.5 pb-2.5 md:-mt-6 lg:-mt-8">
        <VoucherDisplayStep
          voucherData={activeJourney.voucher}
          drinkImageUrl={wonDrinkImageUrl}
          companionDrinkUrls={companionDrinkUrls}
          selectedBranchName={selectedBranchName}
          branches={campaign.branches}
        />

        <div className="mt-3.5 text-center">
          <button
            type="button"
            disabled={resetting}
            onClick={handleStartNewPhone}
            className={`px-3.5 py-1 rounded-full bg-[#150958]/80 border border-[#C0C0C0]/45 text-xs text-white/90 hover:text-white hover:border-white transition-all cursor-pointer shadow-md backdrop-blur-md ${averta.className}`}
          >
            {resetting
              ? "Opening form..."
              : "Register with another phone number"}
          </button>
        </div>
      </div>
    </main>
  );
}
