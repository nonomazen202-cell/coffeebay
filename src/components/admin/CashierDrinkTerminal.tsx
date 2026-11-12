"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import Link from "next/link";
import styles from "./CashierDrinkTerminal.module.css";

interface VoucherLookupData {
  id: number;
  voucherCode: string;
  customerName: string;
  phone?: string;
  maskedPhone?: string;
  status: "ISSUED" | "REDEEMED" | "EXPIRED" | "CANCELLED";
  campaignId: number;
  campaignTitle: string;
  expiresAt: string;
  isExpired: boolean;
  issuedAt: string;
  redeemedAt?: string | null;
  changeReason?: string | null;
  branchName?: string | null;
  cashierName?: string | null;
  selectedDrink: {
    id: number;
    name: string;
    categoryName?: string;
  };
  redeemedDrink?: {
    id: number;
    name: string;
  } | null;
  isBranchAllowed: boolean;
  branchRestrictionMessage?: string;
  allowedAlternativeDrinks: {
    id: number;
    name: string;
    categoryName?: string;
  }[];
}

interface RedemptionReceipt {
  voucherCode: string;
  customerName: string;
  servedDrinkName: string;
  branchName: string;
  cashierName: string;
  redeemedAt: string;
  wasSubstituted: boolean;
  changeReason?: string | null;
}

interface TerminalDashboardKpi {
  todayRedeemed: number;
  activeVouchers: number;
  totalRedeemed: number;
  totalSubstitutions: number;
  topDrinkToday: string;
}

interface RecentRedemptionItem {
  id: number;
  voucherCode: string;
  customerName: string;
  phone?: string;
  maskedPhone?: string;
  status: string;
  issuedAt: string;
  redeemedAt: string | null;
  changeReason: string | null;
  selectedDrinkName: string;
  servedDrinkName: string;
  wasSubstituted: boolean;
  branchName: string;
  cashierName: string;
}

interface CashierProfile {
  name: string;
  role: string;
  branchName: string;
  branchCode: string;
}

export interface CashierDrinkTerminalProps {
  initialData?: {
    cashier: CashierProfile;
    kpi: TerminalDashboardKpi;
    recentRedemptions: RecentRedemptionItem[];
  };
}

export function CashierDrinkTerminal({
  initialData,
}: CashierDrinkTerminalProps = {}) {
  const [activeTab, setActiveTab] = useState<"POS" | "QUEUE">("POS");

  // Dashboard Data State (Hydrated from Server Component)
  const [cashier, setCashier] = useState<CashierProfile | null>(
    initialData?.cashier || null,
  );
  const [kpi, setKpi] = useState<TerminalDashboardKpi>(
    initialData?.kpi || {
      todayRedeemed: 0,
      activeVouchers: 0,
      totalRedeemed: 0,
      totalSubstitutions: 0,
      topDrinkToday: "—",
    },
  );
  const [recentRedemptions, setRecentRedemptions] = useState<
    RecentRedemptionItem[]
  >(initialData?.recentRedemptions || []);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Cashier POS Lookup State & Dedicated Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [codeInput, setCodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [voucher, setVoucher] = useState<VoucherLookupData | null>(null);
  const [lookupTrigger, setLookupTrigger] = useState<number>(0);

  // Scalable Substitution state (handles dozens/hundreds of drinks smoothly)
  const [isSubstituting, setIsSubstituting] = useState(false);
  const [selectedSubstituteId, setSelectedSubstituteId] = useState<
    string | number
  >("");
  const [changeReason, setChangeReason] = useState("");
  const [drinkSearch, setDrinkSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  // Success Receipt State
  const [receipt, setReceipt] = useState<RedemptionReceipt | null>(null);

  // Auto-scroll strictly to top of verification result container upon lookup completion
  useEffect(() => {
    if (!lookupTrigger) return;
    if (resultRef.current) {
      requestAnimationFrame(() => {
        if (!resultRef.current) return;
        const prefersReducedMotion =
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        resultRef.current.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "start",
        });
      });
    }
  }, [lookupTrigger]);

  // Available categories & filtered drinks for instantaneous one-tap selection
  const availableCategories = useMemo(() => {
    if (!voucher?.allowedAlternativeDrinks) return [];
    const set = new Set<string>();
    voucher.allowedAlternativeDrinks.forEach((d) => {
      if (d.categoryName) set.add(d.categoryName);
    });
    return Array.from(set);
  }, [voucher]);

  const filteredDrinks = useMemo(() => {
    if (!voucher?.allowedAlternativeDrinks) return [];
    return voucher.allowedAlternativeDrinks.filter((alt) => {
      const matchesCat =
        categoryFilter === "ALL" || alt.categoryName === categoryFilter;
      const query = drinkSearch.toLowerCase().trim();
      const matchesSearch =
        !query ||
        alt.name.toLowerCase().includes(query) ||
        (alt.categoryName && alt.categoryName.toLowerCase().includes(query));
      return matchesCat && matchesSearch;
    });
  }, [voucher, categoryFilter, drinkSearch]);

  // ── Fetch Live Dashboard Metrics ─────────────────────────────────────
  const fetchDashboardData = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const res = await fetch("/api/drink-rewards/cashier/dashboard");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCashier(data.cashier);
          setKpi(data.kpi);
          setRecentRedemptions(data.recentRedemptions || []);
        }
      }
    } catch (err) {
      console.warn(
        "[CashierDrinkTerminal] Failed to fetch dashboard data:",
        err,
      );
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch from client if initialData was not provided by the Server Component
    if (!initialData) {
      fetchDashboardData();
    }
  }, [initialData, fetchDashboardData]);

  // ── Lookup Voucher ───────────────────────────────────────────────────
  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!codeInput.trim()) return;

    setErrorMessage(null);
    setReceipt(null);
    setVoucher(null);
    setIsSubstituting(false);
    setSelectedSubstituteId("");
    setChangeReason("");
    setLoading(true);

    try {
      const res = await fetch("/api/drink-rewards/cashier/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voucherCode: codeInput.trim().toUpperCase() }),
      });
      const data = await res.json();

      if (!res.ok || !data.found) {
        setErrorMessage(
          data.message ||
            "لم يتم العثور على أي كوبون بهذا الكود أو برقم الهاتف، يُرجى التأكد من البيانات والمحاولة مجدداً",
        );
        return;
      }

      setVoucher(data.voucher);
    } catch {
      setErrorMessage(
        "تعذر الاتصال بالخادم، يُرجى التأكد من الاتصال بالإنترنت والمحاولة مجدداً",
      );
    } finally {
      setLoading(false);
      setLookupTrigger(Date.now());
    }
  };

  // ── Dispense / Redeem Voucher ────────────────────────────────────────
  const handleRedeem = async (substituteId?: string | number) => {
    if (!voucher) return;
    setErrorMessage(null);

    const isSub = !!substituteId;
    if (isSub && (!changeReason || changeReason.trim().length < 3)) {
      setErrorMessage(
        "يرجى توضيح سبب استبدال المشروب (3 أحرف على الأقل لأغراض الجرد والمحاسبة)",
      );
      return;
    }

    setRedeeming(true);
    try {
      const res = await fetch("/api/drink-rewards/cashier/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voucherCode: voucher.voucherCode,
          servedDrinkId: substituteId || voucher.selectedDrink.id,
          changeReason: isSub ? changeReason.trim() : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(
          data.message || "تعذر إتمام عملية الصرف، يُرجى المحاولة مرة أخرى",
        );
        return;
      }

      const serverRedemption = data.redemption;
      setReceipt(serverRedemption);
      setVoucher(null);
      setCodeInput("");

      // Authoritative instantaneous UI update using server-confirmed redemption result
      // Completely eliminates secondary full-dashboard HTTP request waterfall
      setKpi((prev) => ({
        ...prev,
        todayRedeemed: prev.todayRedeemed + 1,
        activeVouchers: Math.max(0, prev.activeVouchers - 1),
        totalRedeemed: prev.totalRedeemed + 1,
        totalSubstitutions: serverRedemption?.wasSubstituted
          ? prev.totalSubstitutions + 1
          : prev.totalSubstitutions,
      }));

      if (serverRedemption) {
        setRecentRedemptions((prev) => {
          const newItem: RecentRedemptionItem = {
            id: serverRedemption.id || Date.now(),
            voucherCode: serverRedemption.voucherCode,
            customerName: serverRedemption.customerName || "",
            phone: serverRedemption.phone || "",
            maskedPhone: serverRedemption.phone || "",
            status: "REDEEMED",
            issuedAt: serverRedemption.issuedAt || new Date().toISOString(),
            redeemedAt: serverRedemption.redeemedAt,
            changeReason: serverRedemption.changeReason || null,
            selectedDrinkName:
              serverRedemption.selectedDrinkName ||
              serverRedemption.servedDrinkName,
            servedDrinkName: serverRedemption.servedDrinkName,
            wasSubstituted: Boolean(serverRedemption.wasSubstituted),
            branchName: serverRedemption.branchName,
            cashierName: serverRedemption.cashierName,
          };
          const deduped = prev.filter(
            (r) => r.voucherCode !== newItem.voucherCode && r.id !== newItem.id,
          );
          return [newItem, ...deduped].slice(0, 25);
        });
      }
    } catch {
      setErrorMessage("حدث خطأ تقني أثناء تسجيل الصرف، يُرجى إعادة المحاولة");
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className={styles.terminalWrapper}>
      {/* ── Top Navigation Bar / Breadcrumb ───────────────────────────── */}
      <div className={styles.topBar}>
        <Link href="/admin" className={styles.backButton}>
          <svg
            width="20"
            height="20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          <span>العودة للوحة التحكم الرئيسية / Back to Dashboard</span>
        </Link>
        <div className={styles.topBarMeta}>
          <span className={styles.topBarBadge}>
            Coffee Bay Branch Operations • Drink Rewards Terminal
          </span>
        </div>
      </div>

      {/* ── Terminal & Dashboard Banner ───────────────────────────────── */}
      <div className={styles.headerCard}>
        <div className={styles.headerWave} />

        <div className={styles.headerTopRow}>
          <div className={styles.headerTitleBox}>
            {/* <div className={styles.terminalBadge}>
              <svg
                width="14"
                height="14"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              DRINK REWARDS POS & LIVE TERMINAL / سيستم تسليم المشروبات
            </div> */}
            <h1 className={styles.terminalTitle}>
              Cashier Drink Redemption Terminal{" "}
              <span
                style={{ fontSize: "1.15rem", fontWeight: 600, opacity: 0.85 }}
              >
                / شاشة الكاشير وتسليم المشروبات
              </span>
            </h1>
            {/* <p className={styles.terminalSubtitle}>
              فحص الكوبونات وتسجيل عمليات تسليم المشروبات ومتابعة حركة الصرف
              بالفرع لحظة بلحظة
            </p> */}
          </div>

          {/* Cashier Identity Profile */}
          {cashier && (
            <div className={styles.cashierBadge}>
              <div className={styles.cashierAvatar}>
                {cashier.name.charAt(0).toUpperCase()}
              </div>
              <div className={styles.cashierMeta}>
                <span className={styles.cashierName}>{cashier.name}</span>
                <span className={styles.cashierBranch}>
                  {cashier.branchName} •{" "}
                  {cashier.role === "SUPER_ADMIN"
                    ? "مدير عام المنظومة"
                    : cashier.role === "PROMOTIONS_ADMIN" ||
                        cashier.role === "ADMIN"
                      ? "مدير الحملات (Promotions Admin)"
                      : "كاشير  (Promotions Staff)"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* View Switcher Tabs */}
        <div className={styles.modeTabs}>
          <button
            type="button"
            onClick={() => setActiveTab("POS")}
            className={`${styles.modeTabBtn} ${activeTab === "POS" ? styles.modeTabBtnActive : ""}`}
          >
            <svg
              width="16"
              height="16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <rect width="18" height="12" x="3" y="6" rx="2" strokeWidth={2} />
              <line
                x1="8"
                y1="12"
                x2="8"
                y2="12"
                strokeWidth={3}
                strokeLinecap="round"
              />
              <line
                x1="12"
                y1="12"
                x2="16"
                y2="12"
                strokeWidth={2}
                strokeLinecap="round"
              />
            </svg>
            POS Terminal / شاشة الصرف السريع
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("QUEUE")}
            className={`${styles.modeTabBtn} ${activeTab === "QUEUE" ? styles.modeTabBtnActive : ""}`}
          >
            <svg
              width="16"
              height="16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />
            </svg>
            Live Operations Feed ({recentRedemptions.length}) / حركة الصرف الحية
          </button>
        </div>
      </div>

      {/* ── Top KPI Metrics Strip (Luxury Deck) ───────────────────────── */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconToday}`}>
            <svg
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.2}
                d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4ZM9 12l2 2 4-4"
              />
            </svg>
          </div>
          <div className={styles.kpiMeta}>
            <span className={styles.kpiLabel}>
              Today&apos;s Handed Over / اتسلم النهاردة
            </span>
            <span className={styles.kpiValue} style={{ color: "#059669" }}>
              {kpi.todayRedeemed.toLocaleString()}{" "}
              <span
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "#64748B",
                }}
              >
                مشروب
              </span>
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconActive}`}>
            <svg
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.2}
                d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2ZM13 5v2M13 17v2M13 11v2"
              />
            </svg>
          </div>
          <div className={styles.kpiMeta}>
            <span className={styles.kpiLabel}>
              Active Unredeemed / قسائم بانتظار الصرف
            </span>
            <span className={styles.kpiValue}>
              {kpi.activeVouchers.toLocaleString()}
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconTotal}`}>
            <svg
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.2}
                d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM9 12l2 2 4-4"
              />
            </svg>
          </div>
          <div className={styles.kpiMeta}>
            <span className={styles.kpiLabel}>
              Total Redeemed / إجمالي المصروف
            </span>
            <span className={styles.kpiValue} style={{ color: "#2563EB" }}>
              {kpi.totalRedeemed.toLocaleString()}
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconTop}`}>
            <svg
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.2}
                d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34M12 2a6 6 0 0 1 6 6v3.58a6 6 0 0 1-1.92 4.41L12 19l-4.08-3a6 6 0 0 1-1.92-4.41V8a6 6 0 0 1 6-6Z"
              />
            </svg>
          </div>
          <div className={styles.kpiMeta}>
            <span className={styles.kpiLabel}>
              Top Drink Today / المشروب المكتسح
            </span>
            <span className={styles.kpiSubValue} title={kpi.topDrinkToday}>
              {kpi.topDrinkToday}
            </span>
          </div>
        </div>
      </div>

      {/* ── View 1: POS Station ───────────────────────────────────────── */}
      {activeTab === "POS" && (
        <>
          {/* Quick Lookup Form Card (High-Tech POS Terminal) */}
          <div className={styles.lookupCard}>
            <div className={styles.stationBadge}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              POS BARCODE & PHONE SCANNER • محطة فحص الكوبونات
            </div>
            <h2 className={styles.lookupTitle}>
              Verify Voucher & Dispense Drink{" "}
              <span
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: "#64748B",
                }}
              >
                / دوّر على الكوبون وسلّم المشروب
              </span>
            </h2>
            <p className={styles.lookupSubtitle}>
              اكتب كود الكوبون المكون من 5 أرقام (مثل 58392 أو CB-58392) أو رقم
              هاتف العميل (01XXXXXXXXX) للتحقق الفوري
            </p>

            <form onSubmit={handleLookup} className={styles.searchForm}>
              <div className={styles.inputWrapper}>
                <svg
                  className={styles.inputIcon}
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  required
                  autoFocus
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. 58392, CB-58392 or 01XXXXXXXXX"
                  className={styles.searchInput}
                />
                {codeInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setCodeInput("");
                      inputRef.current?.focus();
                    }}
                    className={styles.inputClearBtn}
                    title="مسح الحقل"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !codeInput.trim()}
                className={styles.searchButton}
              >
                {loading ? (
                  <>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      style={{ animation: "spin 1s linear infinite" }}
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        strokeWidth="4"
                        strokeDasharray="30"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>Searching... / جاري الفحص...</span>
                  </>
                ) : (
                  <>
                    <svg
                      width="20"
                      height="20"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <span>Verify / افحص الكوبون أو الرقم</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Dedicated Ref Anchor at the Top of Verification Results (Scroll Target) */}
          <div ref={resultRef} className={styles.resultAnchor} />

          {/* Global Alert Messages */}
          {errorMessage && (
            <div className={styles.errorAlert}>
              <svg
                width="22"
                height="22"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                style={{ flexShrink: 0 }}
              >
                <circle cx="12" cy="12" r="10" strokeWidth={2} />
                <line
                  x1="12"
                  y1="8"
                  x2="12"
                  y2="12"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
                <circle cx="12" cy="16" r="1" fill="currentColor" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ── Success Redemption Receipt ────────────────────────────── */}
          {receipt && (
            <div className={styles.receiptCard}>
              <div className={styles.receiptIconCircle}>
                <svg
                  width="36"
                  height="36"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h2 className={styles.receiptTitle}>
                  Drink Dispensed Successfully!{" "}
                  <span style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                    / تم تأكيد تسليم المشروب بنجاح
                  </span>
                </h2>
                <p className={styles.receiptSubtitle}>
                  تم توثيق عملية الصرف في النظام وربطها بالفرع وحساب الكاشير
                </p>
              </div>

              <div className={styles.receiptDetailsBox}>
                <div className={styles.receiptRow}>
                  <span className={styles.receiptRowLabel}>
                    Voucher Code / كود الكوبون:
                  </span>
                  <span
                    className={styles.receiptRowValue}
                    style={{ fontFamily: "monospace", letterSpacing: "0.08em" }}
                  >
                    {receipt.voucherCode}
                  </span>
                </div>
                <div className={styles.receiptRow}>
                  <span className={styles.receiptRowLabel}>
                    Customer / اسم العميل:
                  </span>
                  <span className={styles.receiptRowValue}>
                    {receipt.customerName}
                  </span>
                </div>
                <div className={styles.receiptRow}>
                  <span className={styles.receiptRowLabel}>
                    Served Drink / المشروب المُسلَّم:
                  </span>
                  <span className={styles.receiptDrinkValue}>
                    {receipt.servedDrinkName}
                  </span>
                </div>
                {receipt.wasSubstituted && (
                  <div
                    className={styles.receiptRow}
                    style={{ color: "#150958", fontWeight: 700 }}
                  >
                    <span className={styles.receiptRowLabel}>
                      Substituted Item / صنف بديل:
                    </span>
                    <span>{receipt.changeReason}</span>
                  </div>
                )}
                <div className={styles.receiptRow}>
                  <span className={styles.receiptRowLabel}>
                    Redemption Branch / الفرع:
                  </span>
                  <span className={styles.receiptRowValue}>
                    {receipt.branchName}
                  </span>
                </div>
                <div className={styles.receiptRow}>
                  <span className={styles.receiptRowLabel}>
                    Staff Cashier / الكاشير:
                  </span>
                  <span className={styles.receiptRowValue}>
                    {receipt.cashierName}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setReceipt(null);
                  setCodeInput("");
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className={styles.receiptResetButton}
              >
                Next Voucher / التحقق من كوبون جديد
              </button>
            </div>
          )}

          {/* ── Voucher Verification Details Card (Luxury Ticket) ──────── */}
          {voucher && (
            <div className={styles.voucherCard}>
              {/* Header: Code with Copy & High-End Status */}
              <div className={styles.voucherHeader}>
                <div className={styles.voucherCodeContainer}>
                  <div className={styles.voucherCodeMeta}>
                    <span className={styles.voucherCodeTag}>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                      </svg>
                      VOUCHER CODE / كود الكوبون
                    </span>
                    <span className={styles.voucherCodeValue}>
                      {voucher.voucherCode}
                    </span>
                  </div>
                </div>

                <div>
                  {voucher.status === "ISSUED" && (
                    <span
                      className={`${styles.statusPill} ${styles.statusIssued}`}
                    >
                      <span className={styles.statusPulseDot} />
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Ready to Redeem / جاهز للصرف حالاً
                    </span>
                  )}
                  {voucher.status === "REDEEMED" && (
                    <span
                      className={`${styles.statusPill} ${styles.statusRedeemed}`}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                      </svg>
                      Already Redeemed / تم الصرف مسبقاً
                    </span>
                  )}
                  {voucher.status === "EXPIRED" && (
                    <span
                      className={`${styles.statusPill} ${styles.statusExpired}`}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      Expired / منتهي الصلاحية
                    </span>
                  )}
                  {voucher.status === "CANCELLED" && (
                    <span
                      className={`${styles.statusPill} ${styles.statusCancelled}`}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                      </svg>
                      Cancelled / ملغي من الإدارة
                    </span>
                  )}
                </div>
              </div>

              {/* Modern Top Status Hero Banner (Matches High-End VIP Pass) */}
              {voucher.status === "ISSUED" && (
                <div className={styles.statusHeroBannerValid}>
                  <div className={styles.statusHeroLeft}>
                    <div className={styles.statusHeroCheckCircle}>
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div className={styles.statusHeroText}>
                      <div className={styles.statusHeroTitle}>
                        Voucher Valid / القسيمة صالحة وجاهزة للصرف
                      </div>
                      <div className={styles.statusHeroSubtitle}>
                        The coupon is valid and ready for redemption
                      </div>
                    </div>
                  </div>
                  <div className={styles.statusHeroWatermark}>
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </div>
              )}

              {voucher.status === "REDEEMED" && (
                <div className={styles.statusHeroBannerRedeemed}>
                  <div className={styles.statusHeroLeft}>
                    <div className={styles.statusHeroRedeemedCircle}>
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                      </svg>
                    </div>
                    <div className={styles.statusHeroText}>
                      <div className={styles.statusHeroTitleRedeemed}>
                        ⛔ Voucher Redeemed / تم صرف القسيمة مسبقاً
                      </div>
                      <div className={styles.statusHeroSubtitleRedeemed}>
                        This voucher has already been redeemed and recorded in the audit log • لا يجوز صرف هذا الكوبون مرة أخرى
                      </div>
                    </div>
                  </div>
                  <div className={styles.statusHeroWatermarkRedeemed}>
                    <svg
                      width="52"
                      height="52"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Branch Restriction Warning */}
              {!voucher.isBranchAllowed && (
                <div className={styles.branchWarning}>
                  <svg
                    width="22"
                    height="22"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    style={{ flexShrink: 0 }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span>{voucher.branchRestrictionMessage}</span>
                </div>
              )}

              {/* Customer & Campaign Grid (4 VIP Modular Tiles) */}
              <div className={styles.infoGrid}>
                <div className={styles.infoTile}>
                  <span className={styles.infoItemLabel}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Customer Name / اسم العميل:
                  </span>
                  <span className={styles.infoItemValue}>
                    {voucher.customerName}
                  </span>
                </div>
                <div className={styles.infoTile}>
                  <span className={styles.infoItemLabel}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    Phone Number / رقم الهاتف:
                  </span>
                  <span
                    className={styles.infoItemValue}
                    style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
                  >
                    {voucher.phone || voucher.maskedPhone}
                  </span>
                </div>
                <div className={styles.infoTile}>
                  <span className={styles.infoItemLabel}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Campaign / اسم الحملة:
                  </span>
                  <span className={styles.infoItemValue}>
                    {voucher.campaignTitle}
                  </span>
                </div>
                <div className={styles.infoTile}>
                  <span className={styles.infoItemLabel}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Expires At / تاريخ الصلاحية:
                  </span>
                  <span className={styles.infoItemValue}>
                    {new Date(voucher.expiresAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              {/* Beverage Choice Box - Modern Spotlight Hero Card */}
              <div className={styles.selectedDrinkBox}>
                <div className={styles.selectedDrinkHeroWrapper}>
                  <div className={styles.selectedDrinkIconBadge}>
                    <svg
                      width="54"
                      height="54"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={styles.selectedDrinkCupSvg}
                    >
                      <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
                      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
                      <line x1="6" y1="2" x2="6" y2="4" />
                      <line x1="10" y1="2" x2="10" y2="4" />
                      <line x1="14" y1="2" x2="14" y2="4" />
                    </svg>
                  </div>
                </div>

                <div className={styles.selectedDrinkDivider} />

                <div className={styles.selectedDrinkContent}>
                  <div className={styles.selectedDrinkMetaHeader}>
                    <span className={styles.selectedDrinkLabel}>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
                        <path d="M3 8h14v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                        <line x1="6" y1="1" x2="6" y2="4" />
                        <line x1="10" y1="1" x2="10" y2="4" />
                        <line x1="14" y1="1" x2="14" y2="4" />
                      </svg>
                      CUSTOMER CHOICE / المشروب المختار في الكوبون:
                    </span>
                    {voucher.selectedDrink.categoryName && (
                      <span className={styles.drinkCategoryBadge}>
                        {voucher.selectedDrink.categoryName}
                      </span>
                    )}
                  </div>
                  <div className={styles.selectedDrinkName}>
                    {voucher.selectedDrink.name}
                  </div>
                  <div className={styles.selectedDrinkSubtitle}>
                    {voucher.selectedDrink.categoryName
                      ? `${voucher.selectedDrink.categoryName} • `
                      : "• "}
                  </div>
                </div>
              </div>

              {/* Audit info if already redeemed - Structured Operational Card */}
              {voucher.status === "REDEEMED" && (
                <div className={styles.auditCardContainer}>
                  <div className={styles.auditCardHeader}>
                    <div className={styles.auditHeaderLeft}>
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={styles.auditClockIcon}
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span className={styles.auditHeaderTitle}>
                        Redemption Audit Log / سجل الصرف السابق
                      </span>
                    </div>
                    <span className={styles.auditLastBadge}>
                      Last Redemption
                    </span>
                  </div>

                  <div className={styles.auditSplitRow}>
                    {/* 1. Delivered Drink */}
                    <div className={styles.auditSplitCol}>
                      <div className={styles.auditColIconWrapper}>
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={styles.auditCupIcon}
                        >
                          <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
                          <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
                          <line x1="6" y1="2" x2="6" y2="4" />
                          <line x1="10" y1="2" x2="10" y2="4" />
                          <line x1="14" y1="2" x2="14" y2="4" />
                        </svg>
                      </div>
                      <div className={styles.auditDrinkNameWrapper}>
                        <span className={styles.auditDrinkNameText}>
                          {voucher.redeemedDrink?.name ||
                            voucher.selectedDrink.name}
                        </span>
                        <span className={styles.auditDeliveredPill}>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Delivered / تم التسليم مسبقاً
                        </span>
                      </div>
                    </div>

                    <div className={styles.auditColDivider} />

                    {/* 2. Date & Time */}
                    <div className={styles.auditSplitCol}>
                      <div className={styles.auditColIconWrapper}>
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            x="3"
                            y="4"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2"
                          />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </div>
                      <div className={styles.auditDateTimeWrapper}>
                        <span className={styles.auditDateText}>
                          {voucher.redeemedAt
                            ? new Date(voucher.redeemedAt).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                },
                              )
                            : "N/A"}
                        </span>
                        <span className={styles.auditTimeText}>
                          {voucher.redeemedAt
                            ? new Date(voucher.redeemedAt).toLocaleTimeString(
                                "en-US",
                                {
                                  hour: "numeric",
                                  minute: "2-digit",
                                  second: "2-digit",
                                  hour12: true,
                                },
                              )
                            : ""}
                        </span>
                      </div>
                    </div>

                    <div className={styles.auditColDivider} />

                    {/* 3. Branch */}
                    <div className={styles.auditSplitCol}>
                      <div className={styles.auditColIconWrapper}>
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      </div>
                      <div className={styles.auditBranchWrapper}>
                        <span className={styles.auditBranchTitle}>
                          {voucher.branchName || "فرع معتمد"}
                        </span>
                        <span className={styles.auditBranchSubtitle}>
                          فرع الصرف المسجل بالنظام
                        </span>
                      </div>
                    </div>

                    <div className={styles.auditColDivider} />

                    {/* 4. Cashier */}
                    <div className={styles.auditSplitCol}>
                      <div className={styles.auditColIconWrapper}>
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <div className={styles.auditCashierWrapper}>
                        <span className={styles.auditCashierName}>
                          {voucher.cashierName || "كاشير النظام"}
                        </span>
                        <span className={styles.auditCashierRole}>
                          Cashier / موظف التسليم
                        </span>
                      </div>
                    </div>
                  </div>

                  {voucher.changeReason && (
                    <div className={styles.auditReasonBanner}>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      <span>
                        <strong>سبب الاستبدال المسجل بالجرد:</strong>{" "}
                        {voucher.changeReason}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Dispense Actions (Only when ISSUED & allowed) */}
              {voucher.status === "ISSUED" && voucher.isBranchAllowed && (
                <div>
                  {!isSubstituting ? (
                    <div className={styles.actionRow}>
                      <button
                        type="button"
                        onClick={() => handleRedeem()}
                        disabled={redeeming}
                        className={styles.redeemCapsuleButton}
                      >
                        {redeeming ? (
                          <>
                            <div className={styles.btnIconSpinner}>
                              <svg
                                width="22"
                                height="22"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                style={{ animation: "spin 1s linear infinite" }}
                              >
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  strokeWidth="4"
                                  strokeDasharray="30"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </div>
                            <div className={styles.btnTextStack}>
                              <span className={styles.btnPrimaryText}>
                                Processing Redemption...
                              </span>
                              <span className={styles.btnSecondaryText}>
                                جاري الصرف والتسجيل...
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className={styles.btnCheckIconBadge}>
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                            <div className={styles.btnTextStack}>
                              <span className={styles.btnPrimaryText}>
                                Dispense Beverage ({voucher.selectedDrink.name})
                              </span>
                              <span className={styles.btnSecondaryText}>
                                تأكيد تسليم المشروب
                              </span>
                            </div>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsSubstituting(true);
                          if (!selectedSubstituteId) {
                            setSelectedSubstituteId(
                              String(voucher.selectedDrink.id),
                            );
                          }
                        }}
                        disabled={redeeming}
                        className={styles.substituteCapsuleButton}
                      >
                        <div className={styles.btnRefreshIconBadge}>
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                            <path d="M16 21h5v-5" />
                          </svg>
                        </div>
                        <div className={styles.btnTextStack}>
                          <span className={styles.btnPrimaryTextNavy}>
                            Change Beverage
                          </span>
                          <span className={styles.btnSecondaryTextNavy}>
                            تغيير المشروب
                          </span>
                        </div>
                      </button>
                    </div>
                  ) : (
                    /* Substitution Mode */
                    <div className={styles.substituteBox}>
                      <div className={styles.substituteHeader}>
                        <div className={styles.substituteTitleBox}>
                          <div className={styles.substituteIconBadge}>
                            <svg
                              width="22"
                              height="22"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                              <path d="M3 3v5h5" />
                              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                              <path d="M16 21h5v-5" />
                            </svg>
                          </div>
                          <div>
                            <span className={styles.substituteTitle}>
                              Dispense Alternative Beverage / صرف مشروب بديل
                            </span>
                            <span className={styles.substituteSubtitle}>
                              تعديل الصنف المسلَّم للعميل وتوثيق سبب التغيير
                              لأغراض الجرد والمحاسبة
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsSubstituting(false)}
                          className={styles.substituteCancelBtn}
                        >
                          <svg
                            width="18"
                            height="18"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                          <span>إلغاء وتراجع / Cancel</span>
                        </button>
                      </div>

                      {/* 1. Fast Visual Drink Selection Grid with Smart Search */}
                      <div>
                        <label className={styles.subFieldLabel}>
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
                            <path d="M3 8h14v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                          </svg>
                          1. اختار المشروب البديل / Select Alternative Beverage:
                        </label>

                        {/* Search and Category Filter for Scale (Handles hundreds of items cleanly) */}
                        <div className={styles.drinkSearchFilterRow}>
                          <div className={styles.drinkSearchBox}>
                            <svg
                              className={styles.drinkSearchIcon}
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="11" cy="11" r="8" />
                              <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                              type="text"
                              placeholder="ابحث عن مشروب بالاسم... / Filter drinks by name..."
                              value={drinkSearch}
                              onChange={(e) => setDrinkSearch(e.target.value)}
                              className={styles.drinkSearchInput}
                            />
                            {drinkSearch && (
                              <button
                                type="button"
                                onClick={() => setDrinkSearch("")}
                                className={styles.drinkSearchClearBtn}
                                title="مسح البحث"
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            )}
                          </div>

                          {/* Category Tabs if categories exist */}
                          {availableCategories.length > 1 && (
                            <div className={styles.drinkCategoryTabs}>
                              <button
                                type="button"
                                onClick={() => setCategoryFilter("ALL")}
                                className={`${styles.drinkCategoryTabBtn} ${categoryFilter === "ALL" ? styles.drinkCategoryTabBtnActive : ""}`}
                              >
                                All Drinks / جميع المشروبات (
                                {voucher.allowedAlternativeDrinks.length})
                              </button>
                              {availableCategories.map((cat) => (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() => setCategoryFilter(cat)}
                                  className={`${styles.drinkCategoryTabBtn} ${categoryFilter === cat ? styles.drinkCategoryTabBtnActive : ""}`}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Filtered Drink Grid */}
                        <div className={styles.drinkGrid}>
                          {filteredDrinks.length === 0 ? (
                            <div
                              style={{
                                padding: "2rem",
                                textAlign: "center",
                                color: "#64748B",
                                gridColumn: "1 / -1",
                              }}
                            >
                              لا توجد مشروبات مطابقة للبحث
                            </div>
                          ) : (
                            filteredDrinks.map((alt) => {
                              const isCurrentSelected =
                                String(alt.id) === String(selectedSubstituteId);
                              const isOriginal =
                                alt.id === voucher.selectedDrink.id;
                              return (
                                <button
                                  key={alt.id}
                                  type="button"
                                  onClick={() =>
                                    setSelectedSubstituteId(String(alt.id))
                                  }
                                  className={`${styles.drinkCardBtn} ${isCurrentSelected ? styles.drinkCardBtnActive : ""}`}
                                >
                                  <div className={styles.drinkCardName}>
                                    <span>{alt.name}</span>
                                    {isCurrentSelected && (
                                      <div
                                        className={styles.drinkCardCheckCircle}
                                      >
                                        <svg
                                          width="14"
                                          height="14"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="#FFFFFF"
                                          strokeWidth="3.5"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                  <div className={styles.drinkCardMetaRow}>
                                    {alt.categoryName && (
                                      <span className={styles.drinkCardCat}>
                                        {alt.categoryName}
                                      </span>
                                    )}
                                    {isOriginal && (
                                      <span className={styles.originalBadge}>
                                        المشروب الأصلي
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* 2. Substitution Reason with One-Touch Preset Chips */}
                      <div>
                        <label className={styles.subFieldLabel}>
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                          </svg>
                          2. سبب الاستبدال / Substitution Reason (مطلوب لأغراض
                          الجرد والمحاسبة):
                        </label>

                        {/* Quick Reason Chips */}
                        <div className={styles.reasonChipsRow}>
                          {[
                            "رغبة العميل في صنف آخر",
                            "الصنف غير متوفر حالياً",
                            "نفاد الحليب / المكونات",
                            "عطل مؤقت في ماكينة المشروب",
                          ].map((presetReason) => {
                            const isActive = changeReason === presetReason;
                            return (
                              <button
                                key={presetReason}
                                type="button"
                                onClick={() => setChangeReason(presetReason)}
                                className={`${styles.reasonChip} ${isActive ? styles.reasonChipActive : ""}`}
                              >
                                {isActive && (
                                  <svg
                                    width="13"
                                    height="13"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="#FFFFFF"
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                                <span>{presetReason}</span>
                              </button>
                            );
                          })}
                        </div>

                        <div className={styles.subInputWrapper}>
                          <svg
                            className={styles.subInputIcon}
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                          <input
                            type="text"
                            required
                            value={changeReason}
                            onChange={(e) => setChangeReason(e.target.value)}
                            placeholder="أو اكتب سبب الاستبدال هنا بالتفصيل..."
                            className={styles.subInput}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRedeem(selectedSubstituteId)}
                        disabled={
                          redeeming ||
                          !selectedSubstituteId ||
                          !changeReason.trim()
                        }
                        className={styles.subConfirmButton}
                      >
                        {redeeming ? (
                          <>
                            <svg
                              width="22"
                              height="22"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              style={{ animation: "spin 1s linear infinite" }}
                            >
                              <circle
                                cx="12"
                                cy="12"
                                r="10"
                                strokeWidth="4"
                                strokeDasharray="30"
                                strokeLinecap="round"
                              />
                            </svg>
                            <span>جاري تأكيد الصرف والتسجيل...</span>
                          </>
                        ) : (
                          <>
                            <svg
                              width="22"
                              height="22"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            <span>
                              Confirm Alternative Handover / تأكيد صرف المشروب
                              البديل
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── View 2: Live Queue & Operations Log ───────────────────────── */}
      {activeTab === "QUEUE" && (
        <div className={styles.queueCard}>
          <div className={styles.queueHeader}>
            <h2 className={styles.queueTitle}>
              <svg
                width="20"
                height="20"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Live Operations Feed / حركة الصرف اللي تمت النهاردة
            </h2>
            <button
              type="button"
              onClick={() => fetchDashboardData()}
              disabled={loadingDashboard}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.45rem 1rem",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "#150958",
                cursor: "pointer",
              }}
            >
              <svg
                width="14"
                height="14"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                style={{
                  animation: loadingDashboard
                    ? "spin 1s linear infinite"
                    : "none",
                }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh Feed / حدّث الحركة
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className={styles.queueTable}>
              <thead>
                <tr>
                  <th className={styles.queueTh}>Voucher Code / الكود</th>
                  <th className={styles.queueTh}>Customer / العميل</th>
                  <th className={styles.queueTh}>Served Drink / المشروب</th>
                  <th className={styles.queueTh}>Branch / الفرع</th>
                  <th className={styles.queueTh}>Cashier / الكاشير</th>
                  <th className={styles.queueTh}>Redeemed At / وقت الصرف</th>
                  <th className={styles.queueTh}>Status / الحالة</th>
                </tr>
              </thead>
              <tbody>
                {recentRedemptions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        textAlign: "center",
                        padding: "3rem",
                        color: "#64748B",
                      }}
                    >
                      No redemptions logged yet today / لم تُسجَّل عمليات صرف
                      اليوم حتى الآن
                    </td>
                  </tr>
                ) : (
                  recentRedemptions.map((r) => (
                    <tr key={r.id} className={styles.queueRow}>
                      <td
                        className={styles.queueTd}
                        style={{
                          fontFamily: "monospace",
                          fontWeight: 800,
                          color: "#150958",
                        }}
                      >
                        {r.voucherCode}
                      </td>
                      <td className={styles.queueTd}>
                        <div style={{ fontWeight: 700, color: "#1E293B" }}>
                          {r.customerName}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            fontFamily: "monospace",
                            color: "#64748B",
                          }}
                        >
                          {r.phone || r.maskedPhone}
                        </div>
                      </td>
                      <td className={styles.queueTd}>
                        <div style={{ fontWeight: 800, color: "#150958" }}>
                          {r.servedDrinkName}
                        </div>
                        {r.wasSubstituted && (
                          <span
                            style={{
                              fontSize: "0.65rem",
                              background: "#EEF2FF",
                              color: "#150958",
                              padding: "0.15rem 0.5rem",
                              borderRadius: "4px",
                              fontWeight: 700,
                              border: "1px solid #C7D2FE",
                            }}
                          >
                            استبدال عن: {r.selectedDrinkName}
                          </span>
                        )}
                      </td>
                      <td
                        className={styles.queueTd}
                        style={{ fontWeight: 700, fontSize: "0.8rem" }}
                      >
                        {r.branchName}
                      </td>
                      <td
                        className={styles.queueTd}
                        style={{ fontSize: "0.8rem", color: "#64748B" }}
                      >
                        {r.cashierName}
                      </td>
                      <td
                        className={styles.queueTd}
                        style={{
                          fontSize: "0.75rem",
                          color: "#059669",
                          fontWeight: 700,
                        }}
                      >
                        {r.redeemedAt
                          ? new Date(r.redeemedAt).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className={styles.queueTd}>
                        <span
                          className={`${styles.statusPill} ${styles.statusRedeemed}`}
                        >
                          Redeemed / اتصرف خلاص
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
