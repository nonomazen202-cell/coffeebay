"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicCampaignData } from "../../../services/drink-rewards/drink-campaign-service";
import type {
  IssuedVoucherSnapshot,
  ResolvedRewardJourneyState,
} from "../../../services/drink-rewards/drink-otp-service";
import { useDrinkRewardsJourney } from "../CustomerDrinkRewardsFlow";
import { OtpVerificationStep } from "../OtpVerificationStep";

interface VerifyStepClientProps {
  serverCampaign?: PublicCampaignData;
  serverJourney: ResolvedRewardJourneyState;
}

interface ResendOtpApiResponse {
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

interface VerifyOtpApiResponse {
  success?: boolean;
  reason?: string;
  message?: string;
  attemptsRemaining?: number;
  challengeId?: number | string;
  verifiedAt?: number;
}

function computeCalibratedOffsetMs(serverNowIso: string | undefined): number {
  if (!serverNowIso) return 0;
  const parsed = Date.parse(serverNowIso);
  if (!Number.isFinite(parsed)) return 0;
  const rawDelta = parsed - Date.now();
  // Only apply offset when client clock genuinely drifts from server by >5s
  return Math.abs(rawDelta) > 5_000 ? rawDelta : 0;
}

function computeRemainingSeconds(
  targetIso: string | null | undefined,
  clockOffsetMs: number,
): number {
  if (!targetIso) return 0;
  const targetMs = Date.parse(targetIso);
  if (!Number.isFinite(targetMs)) return 0;
  const calibratedNowMs = Date.now() + clockOffsetMs;
  return Math.max(0, Math.ceil((targetMs - calibratedNowMs) / 1000));
}

export function VerifyStepClient({
  serverCampaign,
  serverJourney,
}: VerifyStepClientProps) {
  const router = useRouter();
  const {
    campaign,
    journey,
    syncCampaignFromServer,
    syncJourneyFromServer,
    patchJourneyClient,
    setErrorMessage,
    setSuccessNotice,
  } = useDrinkRewardsJourney();

  useEffect(() => {
    if (serverCampaign) {
      syncCampaignFromServer(serverCampaign);
    }
  }, [serverCampaign, syncCampaignFromServer]);

  const lastCalibratedServerNowRef = useRef<number>(
    Date.parse(serverJourney.serverNow) || 0,
  );
  const clockOffsetRef = useRef<number>(
    computeCalibratedOffsetMs(serverJourney.serverNow),
  );

  // Sync SSR snapshot when fresh from server (e.g. direct URL load or F5 Refresh)
  useEffect(() => {
    const serverTs = Date.parse(serverJourney.serverNow) || 0;
    const clientTs = Date.parse(journey.serverNow) || 0;
    if (serverTs > lastCalibratedServerNowRef.current) {
      lastCalibratedServerNowRef.current = serverTs;
      clockOffsetRef.current = computeCalibratedOffsetMs(
        serverJourney.serverNow,
      );
    }
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

  // Client-side history guard (e.g. if user presses Back onto /verify after already verifying/claiming)
  useEffect(() => {
    if (activeJourney.stage === "CLAIMED" && activeJourney.voucher) {
      router.replace(`${basePath}/success`);
      return;
    }
    if (activeJourney.stage === "VERIFIED") {
      router.replace(`${basePath}/choose-drink`);
    }
  }, [activeJourney.stage, activeJourney.voucher, basePath, router]);

  const [otpDigits, setOtpDigits] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const [loading, setLoading] = useState<boolean>(false);

  const [otpExpirySeconds, setOtpExpirySeconds] = useState<number>(() =>
    computeRemainingSeconds(activeJourney.expiresAt, clockOffsetRef.current),
  );
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(() =>
    computeRemainingSeconds(
      activeJourney.resendAvailableAt,
      clockOffsetRef.current,
    ),
  );

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const syncCountdownDisplays = useCallback(() => {
    setOtpExpirySeconds(
      computeRemainingSeconds(activeJourney.expiresAt, clockOffsetRef.current),
    );
    setCooldownSeconds(
      computeRemainingSeconds(
        activeJourney.resendAvailableAt,
        clockOffsetRef.current,
      ),
    );
  }, [activeJourney.expiresAt, activeJourney.resendAvailableAt]);

  // Local 1-second display tick driven strictly by authoritative server timestamps (zero network polling)
  useEffect(() => {
    syncCountdownDisplays();
    const intervalId = setInterval(syncCountdownDisplays, 1000);
    return () => clearInterval(intervalId);
  }, [syncCountdownDisplays]);

  // Auto-focus first empty OTP digit box when entering Verify step with active challenge
  useEffect(() => {
    if (otpExpirySeconds <= 0) return;
    const focusTimer = setTimeout(() => {
      otpInputRefs.current[0]?.focus();
    }, 120);
    return () => clearTimeout(focusTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOtpBoxChange = (index: number, value: string) => {
    const cleanVal = value.replace(/\D/g, "");
    const nextDigits = [...otpDigits];

    if (cleanVal.length > 1) {
      const pastedChars = cleanVal.slice(0, 6).split("");
      pastedChars.forEach((ch, i) => {
        if (i < 6) nextDigits[i] = ch;
      });
      setOtpDigits(nextDigits);
      const nextIdx = Math.min(pastedChars.length, 5);
      otpInputRefs.current[nextIdx]?.focus();
      return;
    }

    nextDigits[index] = cleanVal;
    setOtpDigits(nextDigits);

    if (cleanVal && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleResendOtp = async () => {
    if (cooldownSeconds > 0 || loading) return;
    setErrorMessage(null);
    setSuccessNotice(null);
    setLoading(true);

    try {
      const res = await fetch("/api/drink-rewards/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: activeJourney.phone,
          customerName: activeJourney.customerName,
          selectedBranchId: activeJourney.selectedBranchId,
          campaignSlug: campaign.slug,
          intent: "resend",
        }),
      });

      const data = (await res.json()) as ResendOtpApiResponse;

      if (data.serverNow) {
        const parsedServerMs = Date.parse(data.serverNow);
        if (Number.isFinite(parsedServerMs)) {
          lastCalibratedServerNowRef.current = parsedServerMs;
          clockOffsetRef.current = computeCalibratedOffsetMs(data.serverNow);
        }
      }

      if (!res.ok || !data.success) {
        if (data.resendAvailableAt) {
          patchJourneyClient({
            resendAvailableAt: data.resendAvailableAt,
            ...(data.expiresAt ? { expiresAt: data.expiresAt } : {}),
            serverNow: data.serverNow || new Date().toISOString(),
          });
        }
        setErrorMessage(data.message || "تعذر إعادة إرسال رمز التحقق.");
        setLoading(false);
        return;
      }

      const updatedServerNow = data.serverNow || new Date().toISOString();

      if (data.nextStep === "SUCCESS" && data.voucher) {
        patchJourneyClient({
          stage: "CLAIMED",
          voucher: data.voucher,
          serverNow: updatedServerNow,
        });
        router.replace(`${basePath}/success`);
        return;
      }

      if (data.nextStep === "CHOOSE_DRINK") {
        patchJourneyClient({
          stage: "VERIFIED",
          challengeId: data.challengeId ?? activeJourney.challengeId,
          expiresAt: null,
          resendAvailableAt: null,
          serverNow: updatedServerNow,
        });
        router.replace(`${basePath}/choose-drink`);
        return;
      }

      patchJourneyClient({
        stage: "PENDING_OTP",
        challengeId: data.challengeId ?? activeJourney.challengeId,
        expiresAt: data.expiresAt ?? null,
        resendAvailableAt: data.resendAvailableAt ?? null,
        attemptsRemaining: 3,
        serverNow: updatedServerNow,
      });

      setOtpDigits(["", "", "", "", "", ""]);
      setSuccessNotice("تمت إعادة إرسال رمز التحقق الجديد بنجاح.");
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 80);
    } catch {
      setErrorMessage("حدث خطأ أثناء إعادة إرسال الرمز.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    const fullOtpCode = otpDigits.join("");
    if (fullOtpCode.length !== 6) {
      setErrorMessage("يرجى إدخال رمز التحقق المكون من 6 أرقام كاملاً.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/drink-rewards/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: activeJourney.phone,
          campaignSlug: campaign.slug,
          otpCode: fullOtpCode,
        }),
      });

      const data = (await res.json()) as VerifyOtpApiResponse;

      if (!res.ok || !data.success) {
        if (
          data.reason === "MAX_ATTEMPTS_EXCEEDED" ||
          data.reason === "EXPIRED_OR_NOT_FOUND" ||
          data.attemptsRemaining === 0
        ) {
          patchJourneyClient({
            stage: "EXPIRED_OTP",
            expiresAt: null,
            attemptsRemaining: 0,
            serverNow: new Date().toISOString(),
          });
          setOtpExpirySeconds(0);
        }
        setErrorMessage(
          data.message || "رمز التحقق غير صحيح أو انتهت صلاحيته.",
        );
        setLoading(false);
        return;
      }

      patchJourneyClient({
        stage: "VERIFIED",
        challengeId: data.challengeId ?? activeJourney.challengeId,
        expiresAt: null,
        resendAvailableAt: null,
        serverNow: new Date().toISOString(),
      });

      router.replace(`${basePath}/choose-drink`);
    } catch {
      setErrorMessage("حدث خطأ أثناء التحقق من الرمز.");
      setLoading(false);
    }
  };

  const handleEditDetails = () => {
    setErrorMessage(null);
    router.push(`${basePath}?step=details`);
  };

  return (
    <OtpVerificationStep
      phone={activeJourney.phone}
      otpDigits={otpDigits}
      otpInputRefs={otpInputRefs}
      onOtpBoxChange={handleOtpBoxChange}
      onOtpKeyDown={handleOtpKeyDown}
      otpExpirySeconds={otpExpirySeconds}
      cooldownSeconds={cooldownSeconds}
      onResendOtp={handleResendOtp}
      onVerifyOtp={handleVerifyOtp}
      onEditPhoneOrName={handleEditDetails}
      loading={loading}
    />
  );
}

