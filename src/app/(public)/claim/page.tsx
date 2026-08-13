"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Logo } from "../../../components/ui/Logo";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { FormField } from "../../../components/forms/FormField";
import { CodeInput } from "../../../components/forms/CodeInput";
import { TurnstileWidget } from "../../../components/forms/TurnstileWidget";

// Dynamically import Three.js component to prevent SSR compilation errors
const ThreeCup = dynamic(
  () =>
    import("../../../components/animations/ThreeCup").then(
      (mod) => mod.ThreeCup,
    ),
  { ssr: false },
);

// ─────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────

interface FormValues {
  name: string;
  phone: string;
  serialCode: string;
}

interface FormErrors {
  name?: string;
  phone?: string;
  serialCode?: string;
  general?: string;
}

type FormState = "idle" | "loading" | "error" | "rate-limited" | "otp_pending";

// ─────────────────────────────────────────────────────────────────────
//  Validation
// ─────────────────────────────────────────────────────────────────────

function validateForm(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (!values.name.trim()) {
    errors.name = "Please enter your full name.";
  } else if (values.name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters.";
  } else if (values.name.trim().length > 100) {
    errors.name = "Name is too long.";
  }

  if (!values.phone.trim()) {
    errors.phone = "Please enter your phone number.";
  } else if (!/^[\d\s\+\-\(\)]{8,20}$/.test(values.phone.trim())) {
    errors.phone = "Please enter a valid phone number.";
  }

  const codeClean = values.serialCode.replace(/-/g, "");
  if (!values.serialCode.trim()) {
    errors.serialCode = "Please enter your serial code.";
  } else if (codeClean.length < 8) {
    errors.serialCode = "Code format: XXXX-XXXX (8 characters).";
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────────────
//  Icons
// ─────────────────────────────────────────────────────────────────────

function PersonIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────────────────

export default function ClaimPage() {
  const router = useRouter();

  const [isHydrated, setIsHydrated] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [values, setValues] = useState<FormValues>({
    name: "",
    phone: "",
    serialCode: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formState, setFormState] = useState<FormState>("idle");
  const [retryAfter, setRetryAfter] = useState<number>(0);
  const [turnstileToken, setTurnstileToken] = useState<string>("");

  // OTP Verification States
  const [otpValue, setOtpValue] = useState<string>("");
  const [otpError, setOtpError] = useState<string>("");
  const [cooldown, setCooldown] = useState<number>(0);

  const honeypotRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Load state from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("coffeebay_otp_session");
      if (saved) {
        const session = JSON.parse(saved);

        // Check if the session is still valid (5 minutes validity)
        const now = Date.now();
        if (session.expiresAt && now < session.expiresAt) {
          setValues(session.values || { name: "", phone: "", serialCode: "" });
          setFormState(session.formState || "idle");
          setShowIntro(false); // Skip intro if restoring session

          // Calculate remaining cooldown dynamically
          if (session.otpRequestedAt) {
            const elapsedSeconds = Math.floor(
              (now - session.otpRequestedAt) / 1000,
            );
            const remainingCooldown = 60 - elapsedSeconds;
            if (remainingCooldown > 0) {
              setCooldown(remainingCooldown);
            }
          }
        } else {
          sessionStorage.removeItem("coffeebay_otp_session");
        }
      }
    } catch (e) {
      console.error("Failed to load session from sessionStorage", e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Save session to sessionStorage helper
  const saveSession = useCallback(
    (nextState: FormState, requestedAt: number) => {
      try {
        const session = {
          values,
          formState: nextState,
          otpRequestedAt: requestedAt,
          expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes validity
        };
        sessionStorage.setItem(
          "coffeebay_otp_session",
          JSON.stringify(session),
        );
      } catch (e) {
        console.error("Failed to save session to sessionStorage", e);
      }
    },
    [values],
  );

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Cooldown countdown timer effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const timerId = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timerId);
  }, [cooldown]);

  const handleIntroComplete = () => {
    setShowIntro(false);
  };

  const handleReplayIntro = () => {
    setShowIntro(true);
  };

  // ── Field change handler ──
  const handleChange = useCallback(
    (field: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field])
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
    },
    [errors],
  );

  // ── Submit handler (Initial code verification/redemption try) ──
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Client-side validation
      const validationErrors = validateForm(values);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        // Focus first error field
        const firstErrorKey = Object.keys(
          validationErrors,
        )[0] as keyof FormErrors;
        const el = formRef.current?.querySelector(
          `#${firstErrorKey === "serialCode" ? "serialCode" : firstErrorKey}`,
        ) as HTMLElement | null;
        el?.focus();
        return;
      }

      setFormState("loading");
      setErrors({});
      setOtpError("");

      try {
        // 1. Initial redeem check (checks if verified, processes if already verified)
        const response = await fetch("/api/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.name.trim(),
            phone: values.phone.trim(),
            serialCode: values.serialCode,
            turnstileToken: turnstileToken || undefined,
            honeyPot: honeypotRef.current?.value || "",
          }),
        });

        const data = await response.json();

        if (response.status === 429) {
          setFormState("rate-limited");
          setRetryAfter(data.retryAfterSeconds ?? 60);
          return;
        }

        // 2. If phone is unverified, trigger OTP generation
        if (!data.success && data.result === "UNVERIFIED") {
          const reqResponse = await fetch("/api/verification/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: values.phone.trim(),
              serialCode: values.serialCode,
            }),
          });

          const reqData = await reqResponse.json();

          if (reqResponse.status === 429 && reqData.result === "COOLDOWN") {
            setFormState("otp_pending");
            setCooldown(reqData.retryAfterSeconds ?? 60);
            saveSession(
              "otp_pending",
              Date.now() - (60 - (reqData.retryAfterSeconds ?? 60)) * 1000,
            );
            return;
          }

          if (!reqData.success) {
            setFormState("error");
            setErrors({
              general: reqData.error || "Failed to send verification code.",
            });
            return;
          }

          setFormState("otp_pending");
          setCooldown(60);
          setOtpValue("");
          saveSession("otp_pending", Date.now());
          return;
        }

        if (!data.success || !data.result) {
          setFormState("error");
          setErrors({
            general:
              data.errors?.[0] ?? "Something went wrong. Please try again.",
          });
          return;
        }

        // Route based on result
        switch (data.result) {
          case "WIN":
            try {
              sessionStorage.removeItem("coffeebay_otp_session");
            } catch {}
            router.push(
              `/win?code=${encodeURIComponent(data.verificationCode ?? "")}&prize=${encodeURIComponent(data.prizeName ?? "")}&image=${encodeURIComponent(data.prizeImageUrl ?? "")}`,
            );
            break;
          case "LOSE":
            try {
              sessionStorage.removeItem("coffeebay_otp_session");
            } catch {}
            router.push("/lose");
            break;
          case "INVALID":
            try {
              sessionStorage.removeItem("coffeebay_otp_session");
            } catch {}
            router.push("/invalid");
            break;
          case "ALREADY_USED":
            try {
              sessionStorage.removeItem("coffeebay_otp_session");
            } catch {}
            router.push("/used");
            break;
          default:
            setFormState("error");
            setErrors({ general: "Unexpected response from server." });
        }
      } catch {
        setFormState("error");
        setErrors({
          general:
            "Unable to connect. Please check your connection and try again.",
        });
      }
    },
    [values, turnstileToken, router, saveSession],
  );

  // ── OTP Confirm handler ──
  const handleConfirmOtp = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!otpValue || otpValue.trim().length < 6) {
        setOtpError("Please enter the 6-digit verification code.");
        return;
      }

      setFormState("loading");
      setOtpError("");

      try {
        // 1. Confirm OTP code
        const confirmResponse = await fetch("/api/verification/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: values.phone.trim(),
            otp: otpValue.trim(),
            name: values.name.trim(),
          }),
        });

        const confirmData = await confirmResponse.json();

        if (!confirmData.success) {
          setFormState("otp_pending");
          setOtpError(confirmData.error || "Invalid verification code.");
          return;
        }

        // 2. Verified successfully! Proceed to execute redeem
        const redeemResponse = await fetch("/api/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.name.trim(),
            phone: values.phone.trim(),
            serialCode: values.serialCode,
            turnstileToken: turnstileToken || undefined,
            honeyPot: honeypotRef.current?.value || "",
          }),
        });

        const data = await redeemResponse.json();

        if (!data.success || !data.result) {
          setFormState("error");
          setErrors({
            general:
              data.errors?.[0] ??
              "Verification succeeded, but claiming failed.",
          });
          return;
        }

        // Route based on result
        switch (data.result) {
          case "WIN":
            try {
              sessionStorage.removeItem("coffeebay_otp_session");
            } catch {}
            router.push(
              `/win?code=${encodeURIComponent(data.verificationCode ?? "")}&prize=${encodeURIComponent(data.prizeName ?? "")}&image=${encodeURIComponent(data.prizeImageUrl ?? "")}`,
            );
            break;
          case "LOSE":
            try {
              sessionStorage.removeItem("coffeebay_otp_session");
            } catch {}
            router.push("/lose");
            break;
          case "INVALID":
            try {
              sessionStorage.removeItem("coffeebay_otp_session");
            } catch {}
            router.push("/invalid");
            break;
          case "ALREADY_USED":
            try {
              sessionStorage.removeItem("coffeebay_otp_session");
            } catch {}
            router.push("/used");
            break;
          default:
            setFormState("error");
            setErrors({ general: "Unexpected response from server." });
        }
      } catch {
        setFormState("otp_pending");
        setOtpError("Connection error. Please try again.");
      }
    },
    [values, otpValue, turnstileToken, router],
  );

  // ── OTP Resend handler ──
  const handleResendOtp = useCallback(async () => {
    if (cooldown > 0) return;
    setOtpError("");

    try {
      const response = await fetch("/api/verification/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: values.phone.trim(),
          serialCode: values.serialCode,
        }),
      });

      const data = await response.json();

      if (response.status === 429 && data.result === "COOLDOWN") {
        setCooldown(data.retryAfterSeconds ?? 60);
        saveSession(
          "otp_pending",
          Date.now() - (60 - (data.retryAfterSeconds ?? 60)) * 1000,
        );
        return;
      }

      if (!data.success) {
        setOtpError(data.error || "Failed to resend code.");
        return;
      }

      setCooldown(60);
      setOtpValue("");
      saveSession("otp_pending", Date.now());
      console.log("[Verification] Verification code resent successfully.");
    } catch {
      setOtpError("Connection error. Failed to resend code.");
    }
  }, [values, cooldown, saveSession]);

  const isLoading = formState === "loading";

  if (!isHydrated) {
    return (
      <div className="bg-brand-gradient min-h-dvh flex flex-col items-center justify-center">
        <Logo width={120} height={48} className="animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-brand-gradient min-h-dvh flex flex-col relative overflow-x-hidden">
      {/* Background glows - premium floating glassmorphic orbs */}
      <div
        aria-hidden="true"
        className="fixed inset-0 overflow-hidden pointer-events-none z-0"
      >
        <div className="absolute top-[10%] left-[15%] w-[680px] h-[680px] rounded-full bg-cb-blue/20 blur-[130px] animate-float-orb" />
        <div className="absolute bottom-[5%] right-[15%] w-[480px] h-[480px] rounded-full bg-cb-brown/8 blur-[130px] animate-float-orb-r" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-center px-4 sm:px-6 pt-10 pb-5">
        <Link href="/" aria-label="Go to homepage">
          <Logo width={100} height={40} />
        </Link>
        {/* <Link
          href="/"
          className="text-sm text-cb-text-muted hover:text-cb-text transition-colors duration-200"
        >
          ← Back
        </Link> */}
      </nav>

      {/* Main */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-4">
        <AnimatePresence mode="wait">
          {showIntro ? (
            /* ── 3D CUP INTRO SEQUENCE ── */
            <motion.div
              key="intro-viewport"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center text-center space-y-6 w-full max-w-lg mx-auto"
            >
              {/* Three.js Canvas Container */}
              <div className="w-full h-[440px] flex items-center justify-center overflow-hidden">
                <ThreeCup onAnimationComplete={handleIntroComplete} />
              </div>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="space-y-1"
              >
                <h2 className="text-lg font-bold text-cb-text">
                  Brewing Your Luck...
                </h2>
                <p className="text-xs text-cb-text-subtle">
                  Preparing the 3D lucky cup
                </p>
              </motion.div>

              {/* Fast Skip button */}
              <button
                onClick={handleIntroComplete}
                className="text-xs text-cb-text-subtle hover:text-cb-blue transition-colors duration-200 mt-2 hover:underline"
              >
                Skip Intro
              </button>
            </motion.div>
          ) : (
            /* ── MAIN REDEMPTION FORM ── */
            <motion.div
              key="form-viewport"
              initial={{ opacity: 0, y: 35, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 120, damping: 18 }}
              className="w-full max-w-lg"
            >
              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full glass-blue text-cb-blue text-label">
                  <span className="w-2.5 h-2.5 rounded-full bg-cb-blue animate-pulse" />
                  <h1 className="font-bold text-lg">Enter Your Code</h1>
                  {/* Lucky Cup Redemption */}
                </div>
                {/* <h1 className="text-hero text-cb-text mb-3">Enter Your Code</h1> */}
                <p className="text-body text-cb-text-muted">
                  Your CoffeeBay cup features a serial code. Enter it below and
                  discover if fortune is on your side today.
                </p>
              </div>

              {/* Card */}
              <Card variant="glass" padding="lg">
                <form
                  ref={formRef}
                  onSubmit={
                    formState === "otp_pending"
                      ? handleConfirmOtp
                      : handleSubmit
                  }
                  noValidate
                  aria-label="Prize redemption form"
                >
                  {/* Honeypot — Anti-bot (do not remove) */}
                  <div className="cb-honeypot" aria-hidden="true">
                    <label htmlFor="cb-hp">Leave empty</label>
                    <input
                      ref={honeypotRef}
                      id="cb-hp"
                      name="honeyPot"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </div>

                  {formState === "otp_pending" ? (
                    <div className="space-y-5">
                      <div className="text-center space-y-2">
                        <p className="text-sm text-cb-text-muted">
                          We sent a 6-digit verification code via SMS (from &apos;Seashell&apos;) to your mobile
                          number:
                        </p>
                        <p className="text-base font-bold text-cb-blue tracking-wider">
                          {values.phone}
                        </p>
                      </div>

                      <FormField
                        id="otpCode"
                        label="Verification Code (OTP)"
                        required
                        error={otpError}
                        inputProps={{
                          type: "text",
                          value: otpValue,
                          onChange: (e) => {
                            setOtpValue(
                              e.target.value.replace(/\D/g, "").slice(0, 6),
                            );
                            if (otpError) setOtpError("");
                          },
                          placeholder: "123456",
                          inputMode: "numeric",
                          disabled: isLoading,
                          className:
                            "text-center tracking-[0.5em] text-xl font-bold placeholder:tracking-normal placeholder:font-normal",
                        }}
                      />

                      {/* Cooldown Timer and Resend Link */}
                      <div className="text-center text-sm pt-2">
                        {cooldown > 0 ? (
                          <p className="text-cb-text-subtle">
                            Resend code in{" "}
                            <span className="font-bold text-cb-blue">
                              {cooldown}s
                            </span>
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={handleResendOtp}
                            className="text-cb-blue hover:text-cb-blue/80 font-semibold underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-cb-blue focus:ring-offset-2 rounded"
                          >
                            Resend Verification Code
                          </button>
                        )}
                      </div>

                      <div className="flex gap-4 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          fullWidth
                          disabled={isLoading}
                          onClick={() => {
                            setFormState("idle");
                            setOtpValue("");
                            setOtpError("");
                            try {
                              sessionStorage.removeItem(
                                "coffeebay_otp_session",
                              );
                            } catch {}
                          }}
                          className="text-sm font-bold animate-pulse-subtle"
                        >
                          Back
                        </Button>
                        <Button
                          type="submit"
                          fullWidth
                          loading={isLoading}
                          loadingText="Verifying…"
                          className="text-sm font-bold"
                        >
                          Verify & Claim ✦
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Name */}
                      <FormField
                        id="name"
                        label="Full Name"
                        required
                        error={errors.name}
                        inputProps={{
                          type: "text",
                          value: values.name,
                          onChange: handleChange("name"),
                          placeholder: "Ahmed Ali",
                          inputMode: "text",
                          autoComplete: "name",
                          disabled: isLoading,
                          leftElement: <PersonIcon />,
                        }}
                      />

                      {/* Phone */}
                      <FormField
                        id="phone"
                        label="Phone Number"
                        required
                        error={errors.phone}
                        inputProps={{
                          type: "tel",
                          value: values.phone,
                          onChange: handleChange("phone"),
                          placeholder: "+966 50 000 0000",
                          inputMode: "tel",
                          autoComplete: "tel",
                          disabled: isLoading,
                          leftElement: <PhoneIcon />,
                        }}
                      />

                      {/* Serial Code */}
                      <div className="space-y-1.5">
                        <label
                          htmlFor="serialCode"
                          className="block text-sm font-semibold text-cb-text-muted tracking-wide"
                        >
                          Serial Code
                          <span
                            className="text-cb-blue ml-1"
                            aria-label="required"
                          >
                            *
                          </span>
                        </label>
                        <CodeInput
                          id="serialCode"
                          value={values.serialCode}
                          onChange={(v) => {
                            setValues((prev) => ({ ...prev, serialCode: v }));
                            if (errors.serialCode)
                              setErrors((prev) => {
                                const next = { ...prev };
                                delete next.serialCode;
                                return next;
                              });
                          }}
                          hasError={!!errors.serialCode}
                          disabled={isLoading}
                        />
                        <p
                          id="serialCode-format-hint"
                          className="text-xs text-cb-text-subtle mt-1"
                        >
                          Format: XXXX-XXXX &mdash; found on the back of your
                          cup
                        </p>
                        {errors.serialCode && (
                          <p
                            role="alert"
                            className="flex items-center gap-1.5 text-sm text-red-600"
                          >
                            <svg
                              aria-hidden="true"
                              className="w-3.5 h-3.5 flex-shrink-0"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {errors.serialCode}
                          </p>
                        )}
                      </div>

                      {/* Turnstile */}
                      {turnstileSiteKey && (
                        <div className="pt-2">
                          <TurnstileWidget
                            siteKey={turnstileSiteKey}
                            onVerify={setTurnstileToken}
                            onExpire={() => setTurnstileToken("")}
                          />
                        </div>
                      )}

                      {/* General error */}
                      <AnimatePresence>
                        {errors.general && (
                          <motion.div
                            key="general-error"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.25 }}
                            role="alert"
                            className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-700 text-sm"
                          >
                            <svg
                              aria-hidden="true"
                              className="w-4 h-4 mt-0.5 flex-shrink-0"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {errors.general}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Rate limited */}
                      <AnimatePresence>
                        {formState === "rate-limited" && (
                          <motion.div
                            key="rate-limit"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            role="alert"
                            className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-700 text-sm"
                          >
                            <svg
                              aria-hidden="true"
                              className="w-4 h-4 mt-0.5 flex-shrink-0"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span>
                              Too many requests. Please wait{" "}
                              <strong>{retryAfter} seconds</strong> before
                              trying again.
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Submit */}
                      <Button
                        type="submit"
                        size="xl"
                        fullWidth
                        loading={isLoading}
                        loadingText="Checking Your Luck…"
                        disabled={formState === "rate-limited"}
                        className="mt-2 text-base font-bold"
                      >
                        Try Your Luck ✦
                      </Button>

                      <p className="text-center text-xs text-cb-text-subtle mt-3">
                        By submitting you agree to our terms and conditions.
                        Your details are used only for prize delivery.
                      </p>
                    </div>
                  )}
                </form>
              </Card>

              {/* Security badges */}
              <div className="flex items-center justify-center gap-6 mt-6">
                {[
                  { label: "Secure Form" },
                  { label: "Privacy Protected" },
                  { label: "One-time Use" },
                ].map((badge) => (
                  <div
                    key={badge.label}
                    className="flex items-center gap-1.5 text-cb-text-subtle text-xs"
                  >
                    <svg
                      aria-hidden="true"
                      className="w-3.5 h-3.5 text-cb-blue"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 1l2.928 5.936 6.552.953-4.74 4.62 1.118 6.519L10 16.127l-5.858 3.081 1.118-6.519L.52 7.889l6.552-.953L10 1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {badge.label}
                  </div>
                ))}
              </div>

              {/* Reset cache button to replay intro */}
              <div className="mt-8 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={handleReplayIntro}
                  className="text-xs text-cb-blue hover:text-cb-blue-light transition-all duration-200 flex items-center gap-1.5"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18"
                    />
                  </svg>
                  Play 3D Intro Again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
