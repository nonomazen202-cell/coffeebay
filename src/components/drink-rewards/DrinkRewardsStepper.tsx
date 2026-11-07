"use client";

import React from "react";
import { averta } from "../../lib/fonts";

export type DrinkRewardFlowStep =
  | "HERO"
  | "REGISTER"
  | "OTP"
  | "SELECT_DRINK"
  | "VOUCHER";

interface DrinkRewardsStepperProps {
  flowStep: DrinkRewardFlowStep;
  canAccessVerifyStep: boolean;
  canAccessDrinkStep: boolean;
  canAccessVoucherStep: boolean;
  onNavigate?: (targetStep: DrinkRewardFlowStep) => void;
}

interface StepItemConfig {
  id: 1 | 2 | 3 | 4;
  label: string;
  shortLabel: string;
  status: "completed" | "active" | "upcoming";
  clickable: boolean;
  targetStep: DrinkRewardFlowStep;
}

export function DrinkRewardsStepper({
  flowStep,
  canAccessVerifyStep,
  canAccessDrinkStep,
  canAccessVoucherStep,
  onNavigate,
}: DrinkRewardsStepperProps) {
  const isStep1Active = flowStep === "HERO" || flowStep === "REGISTER";
  const isStep1Done =
    !isStep1Active &&
    (flowStep === "OTP" ||
      flowStep === "SELECT_DRINK" ||
      flowStep === "VOUCHER" ||
      canAccessVerifyStep ||
      canAccessDrinkStep ||
      canAccessVoucherStep);

  const isStep2Active = flowStep === "OTP";
  const isStep2Done =
    flowStep === "SELECT_DRINK" ||
    flowStep === "VOUCHER" ||
    canAccessDrinkStep ||
    canAccessVoucherStep;

  const isStep3Active = flowStep === "SELECT_DRINK";
  const isStep3Done = flowStep === "VOUCHER" || canAccessVoucherStep;

  const isStep4Active = flowStep === "VOUCHER";

  // Live sub-step progress (0..1) animated purely via GPU transform: scaleX()
  const connector1Progress =
    flowStep === "OTP" ||
    flowStep === "SELECT_DRINK" ||
    flowStep === "VOUCHER" ||
    canAccessVerifyStep ||
    canAccessDrinkStep ||
    canAccessVoucherStep
      ? 1
      : flowStep === "REGISTER"
        ? 0.45
        : 0;

  const connector2Progress =
    flowStep === "SELECT_DRINK" ||
    flowStep === "VOUCHER" ||
    canAccessDrinkStep ||
    canAccessVoucherStep
      ? 1
      : flowStep === "OTP"
        ? 0.45
        : 0;

  const connector3Progress =
    flowStep === "VOUCHER" || canAccessVoucherStep
      ? 1
      : flowStep === "SELECT_DRINK"
        ? 0.45
        : 0;

  const steps: StepItemConfig[] = [
    {
      id: 1,
      label: "Your details",
      shortLabel: "Details",
      status: isStep1Active ? "active" : isStep1Done ? "completed" : "upcoming",
      clickable:
        !canAccessVoucherStep &&
        (flowStep === "HERO" ||
          flowStep === "OTP" ||
          flowStep === "SELECT_DRINK"),
      targetStep: "REGISTER",
    },
    {
      id: 2,
      label: "Verify phone",
      shortLabel: "Verify",
      status: isStep2Active ? "active" : isStep2Done ? "completed" : "upcoming",
      clickable:
        canAccessVerifyStep &&
        !canAccessDrinkStep &&
        !canAccessVoucherStep &&
        flowStep !== "OTP",
      targetStep: "OTP",
    },
    {
      id: 3,
      label: "Choose drink",
      shortLabel: "Drink",
      status: isStep3Active ? "active" : isStep3Done ? "completed" : "upcoming",
      clickable:
        canAccessDrinkStep &&
        !canAccessVoucherStep &&
        flowStep !== "SELECT_DRINK",
      targetStep: "SELECT_DRINK",
    },
    {
      id: 4,
      label: "Enjoy",
      shortLabel: "Enjoy",
      status: isStep4Active ? "active" : "upcoming",
      clickable: canAccessVoucherStep && flowStep !== "VOUCHER",
      targetStep: "VOUCHER",
    },
  ];

  const connectors = [
    connector1Progress,
    connector2Progress,
    connector3Progress,
  ];

  return (
    <nav
      aria-label="Reward claim progress"
      dir="ltr"
      className={`pointer-events-auto inline-flex items-center rounded-full p-1 sm:p-1.5 border border-sky-200/30 backdrop-blur-sm select-none transition-transform duration-300 max-w-full ${averta.className}`}
      style={{
        background:
          "linear-gradient(180deg, rgba(8, 24, 66, 0.88) 0%, rgba(3, 11, 36, 0.94) 100%)",
        boxShadow:
          "0 12px 28px -6px rgba(0, 4, 22, 0.78), 0 2px 8px rgba(0, 8, 32, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
      }}
    >
      <ol className="flex items-center gap-0.5 xs:gap-1 sm:gap-1.5">
        {steps.map((item, idx) => {
          const isActive = item.status === "active";
          const isCompleted = item.status === "completed";
          const isRewardReady = item.id === 4 && isActive;

          return (
            <React.Fragment key={item.id}>
              <li className="flex items-center">
                <button
                  type="button"
                  disabled={!item.clickable}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`Step ${item.id}: ${item.label}`}
                  onClick={() => {
                    if (item.clickable && onNavigate) {
                      onNavigate(item.targetStep);
                    }
                  }}
                  className={`group flex items-center gap-1.5 sm:gap-2 rounded-full transition-colors duration-200 ${
                    isActive
                      ? "px-2.5 sm:px-3.5 py-1 sm:py-1.5 bg-sky-400/18 border border-sky-300/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] cursor-default"
                      : isCompleted
                        ? `px-1.5 xs:px-2 sm:px-3 py-1 sm:py-1.5 border border-transparent ${
                            item.clickable
                              ? "hover:bg-white/[0.08] hover:border-white/15 active:scale-95 cursor-pointer"
                              : "cursor-default"
                          }`
                        : `px-1.5 xs:px-2 sm:px-3 py-1 sm:py-1.5 border border-transparent ${
                            item.clickable
                              ? "hover:bg-white/[0.08] hover:border-white/15 active:scale-95 cursor-pointer"
                              : "opacity-65 cursor-default"
                          }`
                  }`}
                >
                  {/* Step Badge Circle */}
                  <span
                    className={`w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 rounded-full flex items-center justify-center text-[10.5px] sm:text-xs font-extrabold flex-shrink-0 transition-transform duration-300 ${
                      isRewardReady
                        ? "bg-gradient-to-b from-emerald-300 to-teal-400 text-[#022C22] shadow-[0_2px_6px_rgba(16,185,129,0.4)]"
                        : isActive
                          ? "bg-gradient-to-b from-[#A5ECFF] via-[#38BDF8] to-[#0284C7] text-[#02153D] shadow-[0_2px_6px_rgba(2,132,199,0.45)]"
                          : isCompleted
                            ? "bg-sky-400/22 border border-sky-300/60 text-sky-200"
                            : "bg-white/[0.06] border border-white/20 text-sky-100/75"
                    }`}
                  >
                    {isCompleted || isRewardReady ? (
                      <svg
                        className="w-3 h-3 sm:w-3.5 sm:h-3.5"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4.5 10.5l3.5 3.5 7.5-8" />
                      </svg>
                    ) : (
                      item.id
                    )}
                  </span>

                  {/* Step Label (Active step shows full label on mobile; inactive show short on >=390px and full on sm+) */}
                  <span
                    className={`whitespace-nowrap leading-none tracking-wide ${
                      isActive
                        ? "text-[11px] sm:text-xs font-bold text-white"
                        : isCompleted
                          ? "text-[10px] sm:text-xs font-semibold text-sky-100/95"
                          : "text-[10px] sm:text-xs font-medium text-sky-100/75"
                    }`}
                  >
                    <span className={isActive ? "inline" : "hidden sm:inline"}>
                      {item.label}
                    </span>
                    {!isActive && (
                      <span className="hidden min-[390px]:inline sm:hidden">
                        {item.shortLabel}
                      </span>
                    )}
                  </span>
                </button>
              </li>

              {/* GPU-Composited Progress Track Between Steps */}
              {idx < connectors.length && (
                <li
                  aria-hidden="true"
                  className="w-2.5 xs:w-4 sm:w-7 md:w-9 h-[2px] rounded-full bg-white/14 overflow-hidden flex-shrink-0"
                >
                  <div
                    className="h-full w-full origin-left rounded-full bg-gradient-to-r from-sky-300 to-sky-400 transition-transform duration-500 ease-out"
                    style={{ transform: `scaleX(${connectors[idx]})` }}
                  />
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
