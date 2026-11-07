"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { PublicCampaignData } from "../../services/drink-rewards/drink-campaign-service";
import type { ResolvedRewardJourneyState } from "../../services/drink-rewards/drink-otp-service";
import { DrinkRewardsNavbar } from "./DrinkRewardsNavbar";
import {
  DrinkRewardsStepper,
  type DrinkRewardFlowStep,
} from "./DrinkRewardsStepper";

export type RootSubView = "HERO" | "REGISTER";

export interface RefreshCampaignOptions {
  force?: boolean;
  bypassCache?: boolean;
}

interface CampaignApiResponse {
  success?: boolean;
  campaign?: PublicCampaignData;
  data?: PublicCampaignData;
}

interface DrinkRewardsJourneyContextValue {
  campaign: PublicCampaignData;
  journey: ResolvedRewardJourneyState;
  rootSubView: RootSubView;
  setRootSubView: (view: RootSubView) => void;
  syncCampaignFromServer: (freshCampaign: PublicCampaignData) => void;
  refreshCampaignFromServer: (options?: RefreshCampaignOptions) => Promise<void>;
  syncJourneyFromServer: (serverState: ResolvedRewardJourneyState) => void;
  patchJourneyClient: (partial: Partial<ResolvedRewardJourneyState>) => void;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;
  successNotice: string | null;
  setSuccessNotice: (msg: string | null) => void;
  navigateToStep: (targetStep: DrinkRewardFlowStep) => void;
}

const DrinkRewardsJourneyContext =
  createContext<DrinkRewardsJourneyContextValue | null>(null);

export function useDrinkRewardsJourney(): DrinkRewardsJourneyContextValue {
  const ctx = useContext(DrinkRewardsJourneyContext);
  if (!ctx) {
    throw new Error(
      "useDrinkRewardsJourney must be used within DrinkRewardsJourneyShell",
    );
  }
  return ctx;
}

interface DrinkRewardsJourneyShellProps {
  campaign: PublicCampaignData;
  initialJourney: ResolvedRewardJourneyState;
  children: React.ReactNode;
}

function resolveFlowStepFromPathname(
  pathname: string,
  rootSubView: RootSubView,
): DrinkRewardFlowStep {
  const clean = pathname.replace(/\/+$/, "");
  if (clean.endsWith("/verify")) return "OTP";
  if (clean.endsWith("/choose-drink")) return "SELECT_DRINK";
  if (clean.endsWith("/success")) return "VOUCHER";
  return rootSubView === "REGISTER" ? "REGISTER" : "HERO";
}

export function DrinkRewardsJourneyShell({
  campaign,
  initialJourney,
  children,
}: DrinkRewardsJourneyShellProps) {
  const router = useRouter();
  const pathname = usePathname() || `/drink-rewards/${campaign.slug}`;

  const [campaignState, setCampaignState] =
    useState<PublicCampaignData>(campaign);
  const [journey, setJourney] =
    useState<ResolvedRewardJourneyState>(initialJourney);
  const [rootSubView, setRootSubView] = useState<RootSubView>(
    initialJourney.stage === "UNINITIALIZED" ? "HERO" : "REGISTER",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    setCampaignState(campaign);
  }, [campaign]);

  const syncCampaignFromServer = useCallback(
    (freshCampaign: PublicCampaignData) => {
      setCampaignState(freshCampaign);
    },
    [],
  );

  const lastCampaignSyncAtRef = useRef<number>(0);
  const isRefreshingCampaignRef = useRef<boolean>(false);
  const hasMountedStepRef = useRef<boolean>(false);

  const refreshCampaignFromServer = useCallback(
    async (options?: RefreshCampaignOptions) => {
      if (isRefreshingCampaignRef.current) {
        return;
      }
      const now = Date.now();
      if (!options?.force && now - lastCampaignSyncAtRef.current < 1200) {
        return;
      }
      lastCampaignSyncAtRef.current = now;
      isRefreshingCampaignRef.current = true;

      try {
        const query = options?.bypassCache ? "?fresh=1" : "";
        const res = await fetch(
          `/api/drink-rewards/campaign/${encodeURIComponent(campaignState.slug)}${query}`,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          },
        );
        if (!res.ok) return;
        const payload = (await res.json()) as CampaignApiResponse;
        const nextCampaign = payload.campaign ?? payload.data;
        if (payload.success && nextCampaign) {
          setCampaignState(nextCampaign);
        }
      } catch {
        // Non-fatal network hiccup
      } finally {
        isRefreshingCampaignRef.current = false;
      }
    },
    [campaignState.slug],
  );

  const syncJourneyFromServer = useCallback(
    (serverState: ResolvedRewardJourneyState) => {
      setJourney(serverState);
    },
    [],
  );

  const patchJourneyClient = useCallback(
    (partial: Partial<ResolvedRewardJourneyState>) => {
      setJourney((prev) => ({ ...prev, ...partial }));
    },
    [],
  );

  // Clear transient error banners when navigating between URL stages
  useEffect(() => {
    setErrorMessage(null);
  }, [pathname]);

  // Auto-dismiss transient success toast after 4 seconds
  useEffect(() => {
    if (!successNotice) return;
    const timer = setTimeout(() => {
      setSuccessNotice(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [successNotice]);

  const basePath = `/drink-rewards/${encodeURIComponent(campaignState.slug)}`;
  const activeFlowStep = resolveFlowStepFromPathname(pathname, rootSubView);

  // Unified client-side cache synchronization across all flow steps:
  // 1. Syncs from the server's zero-TTL in-memory cache whenever the user transitions between steps
  //    (bypassing Next.js Client Router Cache with 0 DB queries when nothing changed).
  // 2. Syncs when the user returns focus to the tab or restores from browser bfcache.
  useEffect(() => {
    if (!hasMountedStepRef.current) {
      hasMountedStepRef.current = true;
      return;
    }
    void refreshCampaignFromServer({ force: true });
  }, [activeFlowStep, refreshCampaignFromServer]);

  useEffect(() => {
    const handleFocus = () => {
      void refreshCampaignFromServer();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshCampaignFromServer();
      }
    };
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        void refreshCampaignFromServer({ force: true });
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshCampaignFromServer]);

  const canAccessVerifyStep =
    journey.stage === "PENDING_OTP" || journey.stage === "EXPIRED_OTP";
  const canAccessDrinkStep = journey.stage === "VERIFIED";
  const canAccessVoucherStep =
    journey.stage === "CLAIMED" && Boolean(journey.voucher);

  const navigateToStep = useCallback(
    (targetStep: DrinkRewardFlowStep) => {
      setErrorMessage(null);
      if (targetStep === "HERO") {
        setRootSubView("HERO");
        router.push(`${basePath}?welcome=1`, { scroll: false });
        return;
      }
      if (targetStep === "REGISTER") {
        setRootSubView("REGISTER");
        router.push(`${basePath}?step=details`, { scroll: false });
        return;
      }
      if (targetStep === "OTP") {
        router.push(`${basePath}/verify`);
        return;
      }
      if (targetStep === "SELECT_DRINK") {
        router.push(`${basePath}/choose-drink`);
        return;
      }
      if (targetStep === "VOUCHER") {
        router.push(`${basePath}/success`);
      }
    },
    [basePath, router],
  );

  const contextValue = useMemo<DrinkRewardsJourneyContextValue>(
    () => ({
      campaign: campaignState,
      journey,
      rootSubView,
      setRootSubView,
      syncCampaignFromServer,
      refreshCampaignFromServer,
      syncJourneyFromServer,
      patchJourneyClient,
      errorMessage,
      setErrorMessage,
      successNotice,
      setSuccessNotice,
      navigateToStep,
    }),
    [
      campaignState,
      journey,
      rootSubView,
      syncCampaignFromServer,
      refreshCampaignFromServer,
      syncJourneyFromServer,
      patchJourneyClient,
      errorMessage,
      successNotice,
      navigateToStep,
    ],
  );

  return (
    <DrinkRewardsJourneyContext.Provider value={contextValue}>
      <div className="relative w-full min-h-[100dvh] flex flex-col justify-between bg-[#04081E] text-slate-100 selection:bg-sky-500/30 selection:text-white overflow-x-hidden">
        {/* ── 1. GLOBAL TOP WEBSITE HEADER (Hidden on mobile during inner flow steps so full-bleed silk header shines) ── */}
        <div
          className={
            activeFlowStep === "REGISTER" ||
            activeFlowStep === "OTP" ||
            activeFlowStep === "SELECT_DRINK" ||
            activeFlowStep === "VOUCHER"
              ? "hidden lg:block w-full"
              : "w-full"
          }
        >
          <DrinkRewardsNavbar
            onHomeClick={() => {
              navigateToStep("HERO");
            }}
          />
        </div>

        {/* ── 2. GLOBAL FEEDBACK ALERTS ────────────────────────────────────────── */}
        {errorMessage && (
          <div
            dir="rtl"
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] p-4 rounded-2xl bg-rose-950/95 border border-rose-500 text-rose-200 text-sm flex items-center gap-3 backdrop-blur-xl shadow-2xl animate-fadeIn"
          >
            <svg
              className="w-5 h-5 flex-shrink-0 text-rose-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-semibold">{errorMessage}</span>
          </div>
        )}

        {successNotice && (
          <div
            dir="rtl"
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] p-4 rounded-2xl bg-sky-950/95 border border-sky-500 text-sky-200 text-sm flex items-center gap-3 backdrop-blur-xl shadow-2xl animate-fadeIn"
          >
            <svg
              className="w-5 h-5 flex-shrink-0 text-sky-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="font-semibold">{successNotice}</span>
          </div>
        )}

        {/* ── 3. STAGE ROUTE BODY ──────────────────────────────────────────────── */}
        {children}

        {/* ── 4. UNIFIED PERSISTENT FLOATING STEPPER DOCK ─────────────────────── */}
        <div className="fixed bottom-2.5 sm:bottom-4 inset-x-0 z-40 flex justify-center px-2.5 sm:px-3 pointer-events-none transition-all duration-300 [@media(max-height:500px)]:translate-y-20 [@media(max-height:500px)]:opacity-0">
          <DrinkRewardsStepper
            flowStep={activeFlowStep}
            canAccessVerifyStep={canAccessVerifyStep}
            canAccessDrinkStep={canAccessDrinkStep}
            canAccessVoucherStep={canAccessVoucherStep}
            onNavigate={navigateToStep}
          />
        </div>
      </div>
    </DrinkRewardsJourneyContext.Provider>
  );
}
