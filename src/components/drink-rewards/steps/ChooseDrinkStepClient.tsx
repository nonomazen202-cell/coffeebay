"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { PublicCampaignData } from "../../../services/drink-rewards/drink-campaign-service";
import type {
  IssuedVoucherSnapshot,
  ResolvedRewardJourneyState,
} from "../../../services/drink-rewards/drink-otp-service";
import { useDrinkRewardsJourney } from "../CustomerDrinkRewardsFlow";
import { DrinkSelectionStep } from "../DrinkSelectionStep";

interface ChooseDrinkStepClientProps {
  serverCampaign?: PublicCampaignData;
  serverJourney: ResolvedRewardJourneyState;
}

interface ClaimApiResponse {
  success?: boolean;
  reason?: string;
  message?: string;
  voucher?: IssuedVoucherSnapshot;
}

export function ChooseDrinkStepClient({
  serverCampaign,
  serverJourney,
}: ChooseDrinkStepClientProps) {
  const router = useRouter();
  const {
    campaign,
    journey,
    syncCampaignFromServer,
    refreshCampaignFromServer,
    syncJourneyFromServer,
    patchJourneyClient,
    setErrorMessage,
    setSuccessNotice,
  } = useDrinkRewardsJourney();

  // Sync SSR campaign snapshot when navigating to /choose-drink
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

  const activeJourney =
    (Date.parse(journey.serverNow) || 0) >
    (Date.parse(serverJourney.serverNow) || 0)
      ? journey
      : serverJourney;

  const basePath = `/drink-rewards/${encodeURIComponent(campaign.slug)}`;

  // Resolve initial drink from persisted session or default to first eligible drink
  const resolveInitialDrinkId = (): number | string | null => {
    const savedId = activeJourney.selectedDrinkId;
    if (
      savedId !== null &&
      campaign.drinks.some((d) => String(d.id) === String(savedId))
    ) {
      return savedId;
    }
    return campaign.drinks.length > 0 ? campaign.drinks[0].id : null;
  };

  const [selectedDrinkId, setSelectedDrinkId] = useState<
    number | string | null
  >(resolveInitialDrinkId);
  const [loading, setLoading] = useState<boolean>(false);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedDrinkIdRef = useRef<number | string | null>(selectedDrinkId);
  const claimInFlightRef = useRef<boolean>(false);

  // Prefetch /success route on mount so transition after claiming is instantaneous
  useEffect(() => {
    router.prefetch(`${basePath}/success`);
  }, [basePath, router]);

  useEffect(() => {
    selectedDrinkIdRef.current = selectedDrinkId;
  }, [selectedDrinkId]);

  const persistSelectedDrinkToCookie = useCallback(
    (drinkId: number | string) => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
      persistTimeoutRef.current = setTimeout(() => {
        fetch("/api/drink-rewards/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignSlug: campaign.slug,
            selectedDrinkId: drinkId,
          }),
        }).catch(() => {});
      }, 250);
    },
    [campaign.slug],
  );

  // Ensure selectedDrinkId remains valid whenever campaign.drinks updates
  useEffect(() => {
    if (campaign.drinks.length === 0) {
      if (selectedDrinkId !== null) {
        setSelectedDrinkId(null);
      }
      return;
    }

    const stillExists =
      selectedDrinkId !== null &&
      campaign.drinks.some((d) => String(d.id) === String(selectedDrinkId));

    if (!stillExists) {
      const fallbackId = campaign.drinks[0].id;
      const hadPreviousSelection = selectedDrinkId !== null;
      setSelectedDrinkId(fallbackId);
      patchJourneyClient({ selectedDrinkId: fallbackId });
      persistSelectedDrinkToCookie(fallbackId);

      if (hadPreviousSelection) {
        setSuccessNotice(
          "تم تحديث قائمة المشروبات المتاحة للتو من الإدارة، يرجى تأكيد مشروبك من القائمة المحدثة.",
        );
      }
    }
  }, [
    campaign.drinks,
    patchJourneyClient,
    persistSelectedDrinkToCookie,
    selectedDrinkId,
    setSuccessNotice,
  ]);

  // Guard against history Back after already claiming
  useEffect(() => {
    if (activeJourney.stage === "CLAIMED" && activeJourney.voucher) {
      router.replace(`${basePath}/success`);
    }
  }, [activeJourney.stage, activeJourney.voucher, basePath, router]);

  useEffect(() => {
    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
    };
  }, []);

  const handleSelectDrink = (drinkId: number | string) => {
    setSelectedDrinkId(drinkId);
    patchJourneyClient({ selectedDrinkId: drinkId });
    persistSelectedDrinkToCookie(drinkId);
  };

  const handleClaimVoucher = async () => {
    if (claimInFlightRef.current || loading) {
      return;
    }
    if (!selectedDrinkId) {
      setErrorMessage("يرجى اختيار مشروبك المفضل أولاً.");
      return;
    }

    claimInFlightRef.current = true;
    setErrorMessage(null);
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    try {
      const res = await fetch("/api/drink-rewards/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          customerName: activeJourney.customerName,
          selectedDrinkId,
          selectedBranchId: activeJourney.selectedBranchId,
          campaignSlug: campaign.slug,
        }),
      });
      clearTimeout(timeoutId);

      const data = (await res.json()) as ClaimApiResponse;

      if (!res.ok || !data.success || !data.voucher) {
        if (data.reason === "INVALID_DRINK") {
          await refreshCampaignFromServer({ force: true, bypassCache: true });
          setErrorMessage(
            "تم تعديل أو إخفاء هذا المشروب للتو من قبل الإدارة. تم تحديث القائمة أمامك، يرجى اختيار مشروب آخر وتأكيده.",
          );
          claimInFlightRef.current = false;
          setLoading(false);
          return;
        }

        setErrorMessage(data.message || "تعذر إصدار القسيمة.");
        if (data.reason === "INVALID_SESSION") {
          patchJourneyClient({
            stage: "EXPIRED_OTP",
            serverNow: new Date().toISOString(),
          });
          claimInFlightRef.current = false;
          router.replace(`${basePath}/verify`);
          return;
        }
        claimInFlightRef.current = false;
        setLoading(false);
        return;
      }

      patchJourneyClient({
        stage: "CLAIMED",
        selectedDrinkId,
        voucher: data.voucher,
        serverNow: new Date().toISOString(),
      });

      router.replace(`${basePath}/success`);
    } catch {
      clearTimeout(timeoutId);
      claimInFlightRef.current = false;
      setErrorMessage(
        "حدث بطء أو انقطاع في الاتصال أثناء إصدار القسيمة. يرجى الضغط على تأكيد مرة أخرى (حقك محفوظ بالكامل).",
      );
      setLoading(false);
    }
  };

  const selectedDrinkObj = campaign.drinks.find(
    (d) => String(d.id) === String(selectedDrinkId),
  );

  return (
    <main className="relative w-full flex-1 min-h-[100dvh] lg:min-h-[calc(100dvh-65px)] flex flex-col justify-between items-center overflow-x-hidden select-none bg-[#020B2A] pb-16 sm:pb-20">
      {/* ── 1. DEDICATED STUDIO BACKGROUNDS (Identical to OTP Verification Step) ── */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {/* Mobile Portrait Silk + Bottom Chrome Wave */}
        <div className="block sm:hidden absolute inset-0">
          <Image
            src="/drink-rewards/verification-mobile-bg-4.png"
            alt="Coffee Bay Menu Background Mobile"
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
            alt="Coffee Bay Menu Background Desktop"
            fill
            priority
            unoptimized
            className="object-cover object-bottom select-none"
          />
        </div>
      </div>

      {/* ── 2. MOBILE TOP BRAND HEADER (Left Back Button & Centered Logo, matching Verify step) ── */}
      <header
        dir="ltr"
        className="relative z-30 flex lg:hidden w-full items-center justify-between px-4 pt-3.5 pb-1 flex-shrink-0 pointer-events-none"
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="الرجوع"
          className="pointer-events-auto w-9 h-9 flex items-center justify-center rounded-full text-white/95 hover:text-sky-300 hover:bg-white/10 active:scale-95 transition-all cursor-pointer drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]"
        >
          <ArrowLeft className="w-6 h-6" strokeWidth={2.1} />
        </button>

        {/* Center: Official Coffee Bay White Logo */}
        <div className="relative w-36 xs:w-40 sm:w-44 h-8 xs:h-8.5 sm:h-9 pointer-events-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
          <Image
            src="/drink-rewards/coffeebay-white-logo.png"
            alt="Coffee Bay"
            fill
            priority
            className="object-contain"
          />
        </div>

        {/* Right: Inert balancer spacer to keep logo dead-center */}
        <div aria-hidden="true" className="w-9 h-9 pointer-events-none" />
      </header>

      {/* ── 3. MAIN MENU CONTENT (Full vertical spread on mobile, centered on desktop) ── */}
      <div className="relative z-10 w-full flex-1 flex flex-col justify-between sm:justify-center items-center sm:my-auto">
        <DrinkSelectionStep
          drinks={campaign.drinks}
          categories={campaign.categories}
          selectedDrinkId={selectedDrinkId}
          onSelectDrink={handleSelectDrink}
          selectedDrinkName={
            selectedDrinkObj ? selectedDrinkObj.name : "يرجى اختيار مشروب"
          }
          onClaimVoucher={handleClaimVoucher}
          loading={loading}
        />
      </div>
    </main>
  );
}
