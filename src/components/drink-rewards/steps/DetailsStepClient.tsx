"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicCampaignData } from "../../../services/drink-rewards/drink-campaign-service";
import type {
  IssuedVoucherSnapshot,
  ResolvedRewardJourneyState,
} from "../../../services/drink-rewards/drink-otp-service";
import {
  useDrinkRewardsJourney,
  type RootSubView,
} from "../CustomerDrinkRewardsFlow";
import { HeroStep } from "../HeroStep";
import { RegistrationStep } from "../RegistrationStep";

interface DetailsStepClientProps {
  serverCampaign?: PublicCampaignData;
  serverJourney: ResolvedRewardJourneyState;
  initialView: RootSubView;
}

interface OtpRequestApiResponse {
  success?: boolean;
  resumed?: boolean;
  nextStep?: "VERIFY" | "CHOOSE_DRINK" | "SUCCESS";
  reason?: string;
  message?: string;
  challengeId?: number | string;
  expiresAt?: string;
  resendAvailableAt?: string;
  serverNow?: string;
  voucher?: IssuedVoucherSnapshot;
}

export function DetailsStepClient({
  serverCampaign,
  serverJourney,
  initialView,
}: DetailsStepClientProps) {
  const router = useRouter();
  const {
    campaign,
    journey,
    rootSubView,
    setRootSubView,
    syncCampaignFromServer,
    syncJourneyFromServer,
    patchJourneyClient,
    errorMessage,
    setErrorMessage,
    setSuccessNotice,
  } = useDrinkRewardsJourney();

  useEffect(() => {
    if (serverCampaign) {
      syncCampaignFromServer(serverCampaign);
    }
  }, [serverCampaign, syncCampaignFromServer]);

  // Sync SSR journey snapshot when server provides fresher or equal state
  useEffect(() => {
    const serverTs = Date.parse(serverJourney.serverNow) || 0;
    const clientTs = Date.parse(journey.serverNow) || 0;
    if (serverTs >= clientTs) {
      syncJourneyFromServer(serverJourney);
    }
  }, [serverJourney, journey.serverNow, syncJourneyFromServer]);

  // Sync Hero vs Registration view on Step 01 route
  useEffect(() => {
    setRootSubView(initialView);
  }, [initialView, setRootSubView]);

  const activeJourney =
    (Date.parse(journey.serverNow) || 0) >
    (Date.parse(serverJourney.serverNow) || 0)
      ? journey
      : serverJourney;

  const resolveValidBranchId = (): number | string | null => {
    const savedBranchId = activeJourney.selectedBranchId;
    if (
      savedBranchId !== null &&
      campaign.branches.some((b) => String(b.id) === String(savedBranchId))
    ) {
      return savedBranchId;
    }
    return campaign.branches.length > 0 ? campaign.branches[0].id : null;
  };

  const [customerName, setCustomerName] = useState<string>(
    activeJourney.customerName || "",
  );
  const [phone, setPhone] = useState<string>(activeJourney.phone || "");
  const [selectedBranchId, setSelectedBranchId] = useState<
    number | string | null
  >(resolveValidBranchId);
  const [loading, setLoading] = useState<boolean>(false);

  // Keep form fields hydrated if restored session updates (without overwriting active user typing if already populated)
  useEffect(() => {
    if (activeJourney.customerName && !customerName) {
      setCustomerName(activeJourney.customerName);
    }
    if (activeJourney.phone && !phone) {
      setPhone(activeJourney.phone);
    }
    if (
      activeJourney.selectedBranchId !== null &&
      campaign.branches.some(
        (b) => String(b.id) === String(activeJourney.selectedBranchId),
      )
    ) {
      setSelectedBranchId(activeJourney.selectedBranchId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeJourney.customerName,
    activeJourney.phone,
    activeJourney.selectedBranchId,
    campaign.branches,
  ]);

  // Reconcile selectedBranchId whenever campaign.branches updates (branch added, renamed, or deactivated)
  useEffect(() => {
    if (campaign.branches.length === 0) {
      if (selectedBranchId !== null) {
        setSelectedBranchId(null);
      }
      return;
    }

    const stillExists =
      selectedBranchId !== null &&
      campaign.branches.some((b) => String(b.id) === String(selectedBranchId));

    if (!stillExists) {
      setSelectedBranchId(campaign.branches[0].id);
    }
  }, [campaign.branches, selectedBranchId]);

  const basePath = `/drink-rewards/${encodeURIComponent(campaign.slug)}`;

  const selectedBranchObj =
    campaign.branches.find((b) => String(b.id) === String(selectedBranchId)) ??
    campaign.branches[0];
  const branchDisplayName = selectedBranchObj ? selectedBranchObj.name : "";

  const handleHeroClaimClick = () => {
    setErrorMessage(null);

    if (activeJourney.stage === "CLAIMED" && activeJourney.voucher) {
      router.push(`${basePath}/success`);
      return;
    }

    if (activeJourney.stage === "VERIFIED") {
      router.push(`${basePath}/choose-drink`);
      return;
    }

    setRootSubView("REGISTER");
    router.push(`${basePath}?step=details`, { scroll: false });
  };

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    const trimmedName = customerName.trim();
    const trimmedPhone = phone.trim();
    const digitCount = trimmedPhone.replace(/\D/g, "").length;

    if (!trimmedPhone || digitCount < 7) {
      setErrorMessage("يرجى إدخال رقم هاتف صالح.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/drink-rewards/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: trimmedName || "Guest",
          phone: trimmedPhone,
          selectedBranchId,
          campaignSlug: campaign.slug,
          intent: "start",
        }),
      });

      const data = (await res.json()) as OtpRequestApiResponse;

      if (!res.ok || !data.success) {
        setErrorMessage(
          data.message || "تعذر إرسال رمز التحقق. يرجى مراجعة البيانات.",
        );
        setLoading(false);
        return;
      }

      const nowIso = data.serverNow || new Date().toISOString();

      if (data.nextStep === "SUCCESS" && data.voucher) {
        patchJourneyClient({
          stage: "CLAIMED",
          customerName: data.voucher.customerName,
          phone: data.voucher.phone,
          selectedBranchId,
          voucher: data.voucher,
          serverNow: nowIso,
        });
        router.replace(`${basePath}/success`);
        return;
      }

      if (data.nextStep === "CHOOSE_DRINK") {
        patchJourneyClient({
          stage: "VERIFIED",
          customerName: trimmedName,
          selectedBranchId,
          serverNow: nowIso,
        });
        router.push(`${basePath}/choose-drink`);
        return;
      }

      patchJourneyClient({
        stage: "PENDING_OTP",
        customerName: trimmedName,
        phone: trimmedPhone,
        selectedBranchId,
        challengeId: data.challengeId ?? activeJourney.challengeId,
        expiresAt: data.expiresAt ?? activeJourney.expiresAt,
        resendAvailableAt:
          data.resendAvailableAt ?? activeJourney.resendAvailableAt,
        serverNow: nowIso,
      });

      if (!data.resumed && data.message) {
        setSuccessNotice(data.message);
      }

      router.push(`${basePath}/verify`);
    } catch {
      setErrorMessage(
        "حدث خطأ في الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.",
      );
      setLoading(false);
    }
  };

  if (rootSubView === "HERO") {
    return <HeroStep onClaimClick={handleHeroClaimClick} />;
  }

  return (
    <RegistrationStep
      customerName={customerName}
      setCustomerName={setCustomerName}
      phone={phone}
      setPhone={setPhone}
      branches={campaign.branches}
      branchDisplayName={branchDisplayName}
      selectedBranchId={selectedBranchId}
      setSelectedBranchId={(val) => setSelectedBranchId(val)}
      onSubmit={handleSubmitDetails}
      onBack={() => {
        setErrorMessage(null);
        setRootSubView("HERO");
        router.push(`${basePath}?welcome=1`, { scroll: false });
      }}
      loading={loading}
      errorMessage={errorMessage}
    />
  );
}

