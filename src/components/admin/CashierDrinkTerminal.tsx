'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import styles from './CashierDrinkTerminal.module.css';

interface VoucherLookupData {
  id: number;
  voucherCode: string;
  customerName: string;
  phone?: string;
  maskedPhone?: string;
  status: 'ISSUED' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED';
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

export function CashierDrinkTerminal() {
  const [activeTab, setActiveTab] = useState<'POS' | 'QUEUE'>('POS');

  // Dashboard Data State
  const [cashier, setCashier] = useState<CashierProfile | null>(null);
  const [kpi, setKpi] = useState<TerminalDashboardKpi>({
    todayRedeemed: 0,
    activeVouchers: 0,
    totalRedeemed: 0,
    totalSubstitutions: 0,
    topDrinkToday: '—',
  });
  const [recentRedemptions, setRecentRedemptions] = useState<RecentRedemptionItem[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Cashier POS Lookup State
  const [codeInput, setCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [voucher, setVoucher] = useState<VoucherLookupData | null>(null);

  // Substitution state
  const [isSubstituting, setIsSubstituting] = useState(false);
  const [selectedSubstituteId, setSelectedSubstituteId] = useState<string | number>('');
  const [changeReason, setChangeReason] = useState('');

  // Success Receipt State
  const [receipt, setReceipt] = useState<RedemptionReceipt | null>(null);

  // ── Fetch Live Dashboard Metrics ─────────────────────────────────────
  const fetchDashboardData = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const res = await fetch('/api/drink-rewards/cashier/dashboard');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCashier(data.cashier);
          setKpi(data.kpi);
          setRecentRedemptions(data.recentRedemptions || []);
        }
      }
    } catch (err) {
      console.warn('[CashierDrinkTerminal] Failed to fetch dashboard data:', err);
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ── Lookup Voucher ───────────────────────────────────────────────────
  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!codeInput.trim()) return;

    setErrorMessage(null);
    setReceipt(null);
    setVoucher(null);
    setIsSubstituting(false);
    setSelectedSubstituteId('');
    setChangeReason('');
    setLoading(true);

    try {
      const res = await fetch('/api/drink-rewards/cashier/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucherCode: codeInput.trim().toUpperCase() }),
      });
      const data = await res.json();

      if (!res.ok || !data.found) {
        setErrorMessage(data.message || 'ملقيناش أي كوبون بالكود ده أو برقم الموبايل ده، اتأكد من الرقم وجرّب تاني');
        return;
      }

      setVoucher(data.voucher);
    } catch {
      setErrorMessage('النت فاصل أو في مشكلة في السيرفر، جرّب تاني');
    } finally {
      setLoading(false);
    }
  };

  // ── Dispense / Redeem Voucher ────────────────────────────────────────
  const handleRedeem = async (substituteId?: string | number) => {
    if (!voucher) return;
    setErrorMessage(null);

    const isSub = !!substituteId;
    if (isSub && (!changeReason || changeReason.trim().length < 3)) {
      setErrorMessage('يرجى توضيح سبب استبدال المشروب (3 أحرف على الأقل لأغراض الجرد والمحاسبة)');
      return;
    }

    setRedeeming(true);
    try {
      const res = await fetch('/api/drink-rewards/cashier/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherCode: voucher.voucherCode,
          servedDrinkId: substituteId || voucher.selectedDrink.id,
          changeReason: isSub ? changeReason.trim() : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'مقدرناش نصرف الكوبون دلوقتي، جرّب تاني');
        return;
      }

      setReceipt(data.redemption);
      setVoucher(null);
      setCodeInput('');
      fetchDashboardData();
    } catch {
      setErrorMessage('حصل خطأ في السيستم أثناء تسجيل الصرف، جرّب كمان مرة');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className={styles.terminalWrapper}>
      {/* ── Top Navigation Bar / Breadcrumb ───────────────────────────── */}
      <div className={styles.topBar}>
        <Link href="/admin" className={styles.backButton}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>العودة للوحة التحكم الرئيسية / Back to Dashboard</span>
        </Link>
        <div className={styles.topBarMeta}>
          <span className={styles.topBarBadge}>Coffee Bay Branch Operations • Drink Rewards Terminal</span>
        </div>
      </div>

      {/* ── Terminal & Dashboard Banner ───────────────────────────────── */}
      <div className={styles.headerCard}>
        <div className={styles.headerWave} />

        <div className={styles.headerTopRow}>
          <div className={styles.headerTitleBox}>
            <div className={styles.terminalBadge}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              DRINK REWARDS POS & LIVE TERMINAL / سيستم تسليم المشروبات
            </div>
            <h1 className={styles.terminalTitle}>
              Cashier Drink Redemption Terminal <span style={{ fontSize: '1.15rem', fontWeight: 600, opacity: 0.85 }}>/ شاشة الكاشير وتسليم المشروبات</span>
            </h1>
            <p className={styles.terminalSubtitle}>
              فحص الكوبونات وتسجيل عمليات تسليم المشروبات ومتابعة حركة الصرف بالفرع لحظة بلحظة
            </p>
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
                  {cashier.branchName} • {cashier.role === 'ADMIN' ? 'مدير السيستم (أدمن)' : 'كاشير معتمد'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* View Switcher Tabs */}
        <div className={styles.modeTabs}>
          <button
            type="button"
            onClick={() => setActiveTab('POS')}
            className={`${styles.modeTabBtn} ${activeTab === 'POS' ? styles.modeTabBtnActive : ''}`}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <rect width="18" height="12" x="3" y="6" rx="2" strokeWidth={2} />
              <line x1="8" y1="12" x2="8" y2="12" strokeWidth={3} strokeLinecap="round" />
              <line x1="12" y1="12" x2="16" y2="12" strokeWidth={2} strokeLinecap="round" />
            </svg>
            POS Terminal / شاشة الصرف السريع
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('QUEUE')}
            className={`${styles.modeTabBtn} ${activeTab === 'QUEUE' ? styles.modeTabBtnActive : ''}`}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Live Operations Feed ({recentRedemptions.length}) / حركة الصرف الحية
          </button>
        </div>
      </div>

      {/* ── Top KPI Metrics Strip ─────────────────────────────────────── */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconToday}`}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className={styles.kpiMeta}>
            <span className={styles.kpiLabel}>Today&apos;s Handed Over / اتسلم النهاردة</span>
            <span className={styles.kpiValue} style={{ color: '#059669' }}>
              {kpi.todayRedeemed.toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>مشروب</span>
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconActive}`}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className={styles.kpiMeta}>
            <span className={styles.kpiLabel}>Active Unredeemed / قسائم مستنية زباينها</span>
            <span className={styles.kpiValue}>{kpi.activeVouchers.toLocaleString()}</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconTotal}`}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className={styles.kpiMeta}>
            <span className={styles.kpiLabel}>Total Redeemed / إجمالي اللي اتصرف</span>
            <span className={styles.kpiValue} style={{ color: '#2563EB' }}>
              {kpi.totalRedeemed.toLocaleString()}
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconTop}`}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
            </svg>
          </div>
          <div className={styles.kpiMeta}>
            <span className={styles.kpiLabel}>Top Drink Today / المشروب المكتسح</span>
            <span className={styles.kpiSubValue} title={kpi.topDrinkToday}>
              {kpi.topDrinkToday}
            </span>
          </div>
        </div>
      </div>

      {/* ── View 1: POS Station ───────────────────────────────────────── */}
      {activeTab === 'POS' && (
        <>
          {/* Quick Lookup Form Card */}
          <div className={styles.lookupCard}>
            <h2 className={styles.lookupTitle}>
              Verify Voucher & Dispense Drink <span style={{ fontSize: '1rem', fontWeight: 600, color: '#64748B' }}>/ دوّر على الكوبون وسلّم المشروب</span>
            </h2>
            <p className={styles.lookupSubtitle}>
              اكتب كود الكوبون (مثل 58392 أو CB-58392) أو رقم هاتف العميل (01XXXXXXXXX) للتحقق الفوري
            </p>

            <form onSubmit={handleLookup} className={styles.searchForm}>
              <div className={styles.inputContainer}>
                <input
                  type="text"
                  required
                  autoFocus
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. 58392, CB-58392 or 01XXXXXXXXX"
                  className={styles.searchInput}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !codeInput.trim()}
                className={styles.searchButton}
              >
                {loading ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" strokeWidth="4" strokeDasharray="30" strokeLinecap="round" />
                    </svg>
                    Searching... / بنبحث...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Verify / افحص الكوبون أو الرقم
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Global Alert Messages */}
          {errorMessage && (
            <div className={styles.errorAlert}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ── Success Redemption Receipt ────────────────────────────── */}
          {receipt && (
            <div className={styles.receiptCard}>
              <div className={styles.receiptIconCircle}>
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className={styles.receiptTitle}>
                  Drink Dispensed Successfully! <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>/ تم تأكيد تسليم المشروب بنجاح</span>
                </h2>
                <p className={styles.receiptSubtitle}>
                  تم توثيق عملية الصرف في النظام وربطها بالفرع وحساب الكاشير
                </p>
              </div>

              <div className={styles.receiptDetailsBox}>
                <div className={styles.receiptRow}>
                  <span className={styles.receiptRowLabel}>Voucher Code / كود الكوبون:</span>
                  <span className={styles.receiptRowValue} style={{ fontFamily: 'monospace' }}>{receipt.voucherCode}</span>
                </div>
                <div className={styles.receiptRow}>
                  <span className={styles.receiptRowLabel}>Customer / اسم العميل:</span>
                  <span className={styles.receiptRowValue}>{receipt.customerName}</span>
                </div>
                <div className={styles.receiptRow}>
                  <span className={styles.receiptRowLabel}>Served Drink / المشروب المُسلَّم:</span>
                  <span className={styles.receiptDrinkValue}>{receipt.servedDrinkName}</span>
                </div>
                {receipt.wasSubstituted && (
                  <div className={styles.receiptRow} style={{ color: '#D97706' }}>
                    <span className={styles.receiptRowLabel}>Substituted Item / صنف بديل:</span>
                    <span>{receipt.changeReason}</span>
                  </div>
                )}
                <div className={styles.receiptRow}>
                  <span className={styles.receiptRowLabel}>Redemption Branch / الفرع:</span>
                  <span className={styles.receiptRowValue}>{receipt.branchName}</span>
                </div>
                <div className={styles.receiptRow}>
                  <span className={styles.receiptRowLabel}>Staff Cashier / الكاشير:</span>
                  <span className={styles.receiptRowValue}>{receipt.cashierName}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setReceipt(null);
                  setCodeInput('');
                }}
                className={styles.receiptResetButton}
              >
                Next Voucher / التحقق من كوبون جديد
              </button>
            </div>
          )}

          {/* ── Voucher Verification Details Card ─────────────────────── */}
          {voucher && (
            <div className={styles.voucherCard}>
              {/* Header: Code & Status */}
              <div className={styles.voucherHeader}>
                <div>
                  <span className={styles.voucherCodeLabel}>Voucher Code / كود الكوبون:</span>
                  <span className={styles.voucherCodeValue}>{voucher.voucherCode}</span>
                </div>

                <div>
                  {voucher.status === 'ISSUED' && (
                    <span className={`${styles.statusPill} ${styles.statusIssued}`}>
                      <span className={styles.statusPulseDot} />
                      Ready to Redeem / جاهز للصرف حالاً 🟢
                    </span>
                  )}
                  {voucher.status === 'REDEEMED' && (
                    <span className={`${styles.statusPill} ${styles.statusRedeemed}`}>
                      Already Redeemed / اتصرف خلاص ☕
                    </span>
                  )}
                  {voucher.status === 'EXPIRED' && (
                    <span className={`${styles.statusPill} ${styles.statusExpired}`}>
                      Expired / وقته خلص (منتهي) ⏳
                    </span>
                  )}
                  {voucher.status === 'CANCELLED' && (
                    <span className={`${styles.statusPill} ${styles.statusCancelled}`}>
                      Cancelled / ملغي من الإدارة 🚫
                    </span>
                  )}
                </div>
              </div>

              {/* Branch Restriction Warning */}
              {!voucher.isBranchAllowed && (
                <div className={styles.branchWarning}>
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{voucher.branchRestrictionMessage}</span>
                </div>
              )}

              {/* Customer & Campaign Grid */}
              <div className={styles.infoGrid}>
                <div>
                  <span className={styles.infoItemLabel}>Customer Name / اسم العميل:</span>
                  <span className={styles.infoItemValue}>{voucher.customerName}</span>
                </div>
                <div>
                  <span className={styles.infoItemLabel}>Phone Number / رقم الهاتف:</span>
                  <span className={styles.infoItemValue} style={{ fontFamily: 'monospace' }}>{voucher.phone || voucher.maskedPhone}</span>
                </div>
                <div>
                  <span className={styles.infoItemLabel}>Campaign / اسم الحملة:</span>
                  <span className={styles.infoItemValue} style={{ color: '#150958' }}>{voucher.campaignTitle}</span>
                </div>
                <div>
                  <span className={styles.infoItemLabel}>Expires At / تاريخ الانتهاء:</span>
                  <span className={styles.infoItemValue}>
                    {new Date(voucher.expiresAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              {/* Beverage Choice Box */}
              <div className={styles.selectedDrinkBox}>
                <div>
                  <span className={styles.selectedDrinkLabel}>Customer Choice / المشروب المختار في الكوبون:</span>
                  <div className={styles.selectedDrinkName}>{voucher.selectedDrink.name}</div>
                </div>
                {voucher.selectedDrink.categoryName && (
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#4338CA', background: '#FFFFFF', padding: '0.25rem 0.65rem', borderRadius: '9999px', border: '1px solid #C7D2FE' }}>
                    {voucher.selectedDrink.categoryName}
                  </span>
                )}
              </div>

              {/* Audit info if already redeemed */}
              {voucher.status === 'REDEEMED' && (
                <div className={styles.auditBox}>
                  <p className={styles.auditTitle}>Redemption Audit Log / اتصرف قبل كده:</p>
                  <p>تاريخ الصرف: {voucher.redeemedAt ? new Date(voucher.redeemedAt).toLocaleString('en-US') : 'N/A'}</p>
                  {voucher.branchName && <p>الفرع: {voucher.branchName}</p>}
                  {voucher.cashierName && <p>الكاشير اللي سلمه: {voucher.cashierName}</p>}
                  {voucher.redeemedDrink && <p>المشروب اللي أخدوا: {voucher.redeemedDrink.name}</p>}
                  {voucher.changeReason && <p style={{ color: '#D97706' }}>سبب التغيير: {voucher.changeReason}</p>}
                </div>
              )}

              {/* Dispense Actions (Only when ISSUED & allowed) */}
              {voucher.status === 'ISSUED' && voucher.isBranchAllowed && (
                <div>
                  {!isSubstituting ? (
                    <div className={styles.actionRow}>
                      <button
                        type="button"
                        onClick={() => handleRedeem()}
                        disabled={redeeming}
                        className={styles.redeemPrimaryButton}
                      >
                        {redeeming ? (
                          'جاري الصرف والتسجيل...'
                        ) : (
                          <>
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            Dispense Beverage ({voucher.selectedDrink.name}) / تأكيد تسليم المشروب
                          </>
                        )}
                      </button>

                      {voucher.allowedAlternativeDrinks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setIsSubstituting(true)}
                          disabled={redeeming}
                          className={styles.substituteButton}
                        >
                          Substitute Drink... / اختار مشروب بديل
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Substitution Mode */
                    <div className={styles.substituteBox}>
                      <div className={styles.substituteHeader}>
                        <span className={styles.substituteTitle}>
                          Dispense Alternative / صرف مشروب بديل معتمد
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsSubstituting(false)}
                          className={styles.substituteCancelLink}
                        >
                          Cancel / تراجع
                        </button>
                      </div>

                      <div>
                        <label className={styles.subFieldLabel}>Alternative Beverage / المشروب البديل المتاح:</label>
                        <select
                          value={selectedSubstituteId}
                          onChange={(e) => setSelectedSubstituteId(e.target.value)}
                          className={styles.subSelect}
                        >
                          <option value="">اختار المشروب البديل من القائمة المعتمدة...</option>
                          {voucher.allowedAlternativeDrinks.map((alt) => (
                            <option key={alt.id} value={alt.id}>
                              {alt.name} {alt.id === voucher.selectedDrink.id ? '(المشروب الأصلي)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className={styles.subFieldLabel}>Substitution Reason / سبب الاستبدال (مطلوب لأغراض الجرد والمحاسبة):</label>
                        <input
                          type="text"
                          required
                          value={changeReason}
                          onChange={(e) => setChangeReason(e.target.value)}
                          placeholder="مثال: الصنف غير متوفر حالياً / رغبة العميل في صنف بديل"
                          className={styles.subInput}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRedeem(selectedSubstituteId)}
                        disabled={redeeming || !selectedSubstituteId || !changeReason.trim()}
                        className={styles.subConfirmButton}
                      >
                        {redeeming ? 'جاري التأكيد...' : 'Confirm Alternative Handover / أكّد صرف المشروب البديل'}
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
      {activeTab === 'QUEUE' && (
        <div className={styles.queueCard}>
          <div className={styles.queueHeader}>
            <h2 className={styles.queueTitle}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Live Operations Feed / حركة الصرف اللي تمت النهاردة
            </h2>
            <button
              type="button"
              onClick={() => fetchDashboardData()}
              disabled={loadingDashboard}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#150958',
                cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ animation: loadingDashboard ? 'spin 1s linear infinite' : 'none' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Feed / حدّث الحركة
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
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
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>
                      No redemptions logged yet today / لم تُسجَّل عمليات صرف اليوم حتى الآن
                    </td>
                  </tr>
                ) : (
                  recentRedemptions.map((r) => (
                    <tr key={r.id} className={styles.queueRow}>
                      <td className={styles.queueTd} style={{ fontFamily: 'monospace', fontWeight: 800, color: '#150958' }}>
                        {r.voucherCode}
                      </td>
                      <td className={styles.queueTd}>
                        <div style={{ fontWeight: 700, color: '#1E293B' }}>{r.customerName}</div>
                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#64748B' }}>{r.phone || r.maskedPhone}</div>
                      </td>
                      <td className={styles.queueTd}>
                        <div style={{ fontWeight: 800, color: '#150958' }}>{r.servedDrinkName}</div>
                        {r.wasSubstituted && (
                          <span style={{ fontSize: '0.65rem', background: '#FEF3C7', color: '#92400E', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                            اتبّدل بدل: {r.selectedDrinkName}
                          </span>
                        )}
                      </td>
                      <td className={styles.queueTd} style={{ fontWeight: 700, fontSize: '0.8rem' }}>
                        {r.branchName}
                      </td>
                      <td className={styles.queueTd} style={{ fontSize: '0.8rem', color: '#64748B' }}>
                        {r.cashierName}
                      </td>
                      <td className={styles.queueTd} style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>
                        {r.redeemedAt
                          ? new Date(r.redeemedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td className={styles.queueTd}>
                        <span className={`${styles.statusPill} ${styles.statusRedeemed}`}>
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
