'use client';

import React, { useState, useEffect, useCallback } from 'react';
import styles from './DrinkRewardsReports.module.css';

interface ReportKpi {
  total_issued: number;
  total_redeemed: number;
  total_unredeemed: number;
  total_expired: number;
  total_cancelled: number;
  total_substitutions: number;
}

interface DrinkDispensedRow {
  drink_name: string;
  category_name: string;
  count: number;
}

interface BranchDispensedRow {
  branch_name: string;
  branch_code: string;
  count: number;
}

interface CashierDispensedRow {
  cashier_name: string;
  count: number;
}

interface SubstitutionRow {
  voucher_code: string;
  phone: string;
  customer_name: string;
  selected_drink_name: string;
  redeemed_drink_name: string;
  change_reason: string;
  branch_name: string;
  cashier_name: string;
  redeemed_at: string;
}

interface FilterOptions {
  campaigns: { id: number; title: string }[];
  branches: { id: number; name: string; code: string }[];
  cashiers: { id: number; name: string; email: string }[];
}

export function DrinkRewardsReports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [selectedCampaign, setSelectedCampaign] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedCashier, setSelectedCashier] = useState('all');

  // Report Data
  const [kpi, setKpi] = useState<ReportKpi>({
    total_issued: 0,
    total_redeemed: 0,
    total_unredeemed: 0,
    total_expired: 0,
    total_cancelled: 0,
    total_substitutions: 0,
  });
  const [dispensedDrinks, setDispensedDrinks] = useState<DrinkDispensedRow[]>([]);
  const [dispensedBranches, setDispensedBranches] = useState<BranchDispensedRow[]>([]);
  const [dispensedCashiers, setDispensedCashiers] = useState<CashierDispensedRow[]>([]);
  const [substitutions, setSubstitutions] = useState<SubstitutionRow[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    campaigns: [],
    branches: [],
    cashiers: [],
  });

  const [activeTab, setActiveTab] = useState<'drinks' | 'branches' | 'cashiers' | 'substitutions'>('drinks');

  // Quick Preset Date Helper
  const applyDatePreset = (preset: 'all' | 'today' | '7days' | '30days') => {
    setDatePreset(preset);
    const now = new Date();
    const toYMD = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'today') {
      const todayStr = toYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setStartDate(toYMD(past));
      setEndDate(toYMD(now));
    } else if (preset === '30days') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setStartDate(toYMD(past));
      setEndDate(toYMD(now));
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (selectedCampaign !== 'all') params.set('campaignId', selectedCampaign);
      if (selectedBranch !== 'all') params.set('branchId', selectedBranch);
      if (selectedCashier !== 'all') params.set('cashierId', selectedCashier);

      const res = await fetch(`/api/drink-rewards/reports?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch reports. Admin access required / فشل جلب التقارير.');
      }
      const data = await res.json();
      setKpi(data.kpi);
      setDispensedDrinks(data.dispensedDrinks || []);
      setDispensedBranches(data.dispensedBranches || []);
      setDispensedCashiers(data.dispensedCashiers || []);
      setSubstitutions(data.substitutions || []);
      if (data.filters) {
        setFilterOptions(data.filters);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading reports data');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedCampaign, selectedBranch, selectedCashier]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleResetFilters = () => {
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setSelectedCampaign('all');
    setSelectedBranch('all');
    setSelectedCashier('all');
  };

  // Export CSV
  const handleExportCSV = () => {
    let csvRows: string[][] = [];
    let filename = 'drink-rewards-report.csv';

    if (activeTab === 'drinks') {
      csvRows.push(['Beverage', 'Category', 'Dispensed Count']);
      dispensedDrinks.forEach((d) => csvRows.push([d.drink_name, d.category_name, String(d.count)]));
      filename = 'drinks-dispensed.csv';
    } else if (activeTab === 'branches') {
      csvRows.push(['Branch Name', 'Branch Code', 'Dispensed Count']);
      dispensedBranches.forEach((b) => csvRows.push([b.branch_name, b.branch_code, String(b.count)]));
      filename = 'branches-dispensed.csv';
    } else if (activeTab === 'cashiers') {
      csvRows.push(['Cashier Name', 'Operations Count']);
      dispensedCashiers.forEach((c) => csvRows.push([c.cashier_name, String(c.count)]));
      filename = 'cashiers-performance.csv';
    } else {
      csvRows.push(['Voucher Code', 'Customer', 'Phone', 'Selected Drink', 'Served Drink', 'Reason', 'Branch', 'Cashier', 'Redeemed At']);
      substitutions.forEach((s) =>
        csvRows.push([
          s.voucher_code,
          s.customer_name,
          s.phone,
          s.selected_drink_name,
          s.redeemed_drink_name,
          s.change_reason,
          s.branch_name,
          s.cashier_name,
          s.redeemed_at,
        ])
      );
      filename = 'substitutions-audit.csv';
    }

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      csvRows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const redemptionRate =
    kpi.total_issued > 0
      ? ((kpi.total_redeemed / kpi.total_issued) * 100).toFixed(1)
      : '0.0';

  const maxDrinkCount = Math.max(1, ...dispensedDrinks.map((d) => d.count));
  const maxBranchCount = Math.max(1, ...dispensedBranches.map((b) => b.count));

  return (
    <div className={styles.reportsContainer}>
      {/* ── Header Ribbon ──────────────────────────────────────────────── */}
      <div className={styles.headerCard}>
        <div className={styles.headerWave} />

        <div className={styles.headerContent}>
          <div className={styles.badgeRow}>
            <span className={styles.auditBadge}>ADMIN AUDIT & ANALYTICS</span>
            <span className={styles.auditSubtitle}>إحصائيات وتقارير المشروبات</span>
          </div>
          <h1 className={styles.title}>
            Drink Rewards Reports & Audit <span style={{ fontSize: '1.2rem', fontWeight: 600, opacity: 0.85 }}>/ تقارير حركة صرف المشروبات</span>
          </h1>
          <p className={styles.subtitle}>
            اعرف الفروع بتصرف إيه، وشغل الكاشيرات ماشي إزاي، وإحصائيات المشروبات اللي اتبدلت
          </p>
        </div>

        <div className={styles.headerActions}>
          <button type="button" onClick={handleExportCSV} className={styles.exportBtn}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export to CSV / نزّل شيت إكسيل
          </button>
        </div>
      </div>

      {/* ── Filter Bar Card ────────────────────────────────────────────── */}
      <div className={styles.filterCard}>
        {/* Quick Date Presets */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div className={styles.presetDatesRow}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#150958', marginRight: '0.35rem' }}>
              Timeframe / الفترة:
            </span>
            <button
              type="button"
              onClick={() => applyDatePreset('all')}
              className={`${styles.presetBtn} ${datePreset === 'all' ? styles.presetBtnActive : ''}`}
            >
              All Time / من أول ما بدأنا
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('today')}
              className={`${styles.presetBtn} ${datePreset === 'today' ? styles.presetBtnActive : ''}`}
            >
              Today / النهاردة بس
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('7days')}
              className={`${styles.presetBtn} ${datePreset === '7days' ? styles.presetBtnActive : ''}`}
            >
              Last 7 Days / آخر 7 أيام
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('30days')}
              className={`${styles.presetBtn} ${datePreset === '30days' ? styles.presetBtnActive : ''}`}
            >
              Last 30 Days / آخر 30 يوم
            </button>
          </div>

          {(startDate || endDate || selectedCampaign !== 'all' || selectedBranch !== 'all' || selectedCashier !== 'all') && (
            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                fontSize: '0.75rem',
                color: '#DC2626',
                background: 'none',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Reset Filters / ارجع للأول (تصفير)
            </button>
          )}
        </div>

        {/* Filter Dropdowns Grid */}
        <div className={styles.filterInputsGrid}>
          {/* Start Date */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>From Date / من تاريخ:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setDatePreset('all');
                setStartDate(e.target.value);
              }}
              className={styles.filterInput}
            />
          </div>

          {/* End Date */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>To Date / لحد تاريخ:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setDatePreset('all');
                setEndDate(e.target.value);
              }}
              className={styles.filterInput}
            />
          </div>

          {/* Campaign */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Campaign / اسم الحملة:</label>
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Campaigns ({filterOptions.campaigns.length}) / كل الحملات</option>
              {filterOptions.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Branch */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Branch / الفرع:</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Branches ({filterOptions.branches.length}) / كل الفروع</option>
              {filterOptions.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* Cashier */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Cashier / الكاشير:</label>
            <select
              value={selectedCashier}
              onChange={(e) => setSelectedCashier(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Cashiers ({filterOptions.cashiers.length}) / كل الكاشيرات</option>
              {filterOptions.cashiers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '1rem', borderRadius: '12px', color: '#B91C1C', fontWeight: 700 }}>
          {error}
        </div>
      )}

      {/* ── KPI Metric Cards Ribbon ────────────────────────────────────── */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Vouchers Issued / إجمالي الكوبونات الصادرة</span>
          <span className={styles.kpiValue}>{kpi.total_issued.toLocaleString()}</span>
          <span className={styles.kpiSubtext}>100% of participants / كل اللي سجلوا</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Redeemed & Handed Over / اتصرفت واتسلمت</span>
          <span className={styles.kpiValue} style={{ color: '#059669' }}>
            {kpi.total_redeemed.toLocaleString()}
          </span>
          <span className={styles.kpiSubtext} style={{ color: '#059669', fontWeight: 800 }}>
            {redemptionRate}% نسبة الصرف الكلية
          </span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Unredeemed (Active) / لسه مستنية زباينها</span>
          <span className={styles.kpiValue} style={{ color: '#2563EB' }}>
            {kpi.total_unredeemed.toLocaleString()}
          </span>
          <span className={styles.kpiSubtext}>جاهزة للاستلام في أي فرع</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Expired / زباينها ماجوش (منتهية)</span>
          <span className={styles.kpiValue} style={{ color: '#64748B' }}>
            {kpi.total_expired.toLocaleString()}
          </span>
          <span className={styles.kpiSubtext}>كوبونات عدى ميعادها</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Cancelled / اتلغت من الإدارة</span>
          <span className={styles.kpiValue} style={{ color: '#DC2626' }}>
            {kpi.total_cancelled.toLocaleString()}
          </span>
          <span className={styles.kpiSubtext}>استبعاد رقابي</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Substituted Items / اتبدلت بمشروب تاني</span>
          <span className={styles.kpiValue} style={{ color: '#D97706' }}>
            {kpi.total_substitutions.toLocaleString()}
          </span>
          <span className={styles.kpiSubtext} style={{ color: '#D97706', fontWeight: 700 }}>
            بموافقة الكاشير والفرع
          </span>
        </div>
      </div>

      {/* ── Tabbed View Switcher ────────────────────────────────────────── */}
      <div className={styles.tabsBar}>
        <button
          type="button"
          onClick={() => setActiveTab('drinks')}
          className={`${styles.tabButton} ${activeTab === 'drinks' ? styles.tabButtonActive : ''}`}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
          </svg>
          Dispensed Beverages ({dispensedDrinks.length}) / المشروبات اللي اتطلبت
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('branches')}
          className={`${styles.tabButton} ${activeTab === 'branches' ? styles.tabButtonActive : ''}`}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Branch Performance ({dispensedBranches.length}) / شغل الفروع
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cashiers')}
          className={`${styles.tabButton} ${activeTab === 'cashiers' ? styles.tabButtonActive : ''}`}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Cashier Shifts ({dispensedCashiers.length}) / حركة الكاشيرات
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('substitutions')}
          className={`${styles.tabButton} ${activeTab === 'substitutions' ? styles.tabButtonActive : ''}`}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Substitution Audit ({substitutions.length}) / سجل المشروبات اللي اتبدلت
        </button>
      </div>

      {/* ── Table Card ─────────────────────────────────────────────────── */}
      <div className={styles.tableCard}>
        {/* TAB 1: DRINKS BREAKDOWN */}
        {activeTab === 'drinks' && (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Beverage / المشروب</th>
                  <th className={styles.th}>Category / القسم</th>
                  <th className={styles.th}>Dispensed Count / الكمية اللي اتسلمت</th>
                  <th className={styles.th}>Relative Share / النسبة من الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {dispensedDrinks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.emptyState}>
                      No dispensed beverages found for selected filters / مفيش مشروبات اتصرفت في الفترة المحددة دي
                    </td>
                  </tr>
                ) : (
                  dispensedDrinks.map((d, idx) => {
                    const percentage = Math.round((d.count / maxDrinkCount) * 100);
                    return (
                      <tr key={idx} className={styles.tr}>
                        <td className={styles.td} style={{ fontWeight: 800, color: '#150958' }}>
                          {d.drink_name}
                        </td>
                        <td className={styles.td}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '9999px', background: '#EEF2FF', color: '#150958' }}>
                            {d.category_name}
                          </span>
                        </td>
                        <td className={styles.td} style={{ fontWeight: 900, fontSize: '1rem', color: '#059669' }}>
                          {d.count.toLocaleString()}
                        </td>
                        <td className={styles.td}>
                          <div className={styles.progressBarTrack}>
                            <div className={styles.progressBarFill} style={{ width: `${percentage}%` }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>
                            {percentage}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: BRANCHES BREAKDOWN */}
        {activeTab === 'branches' && (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Branch Name / اسم الفرع</th>
                  <th className={styles.th}>Branch Code / كود الفرع</th>
                  <th className={styles.th}>Dispensed Count / عدد المشروبات</th>
                  <th className={styles.th}>Relative Share / نصيب الفرع من الصرف</th>
                </tr>
              </thead>
              <tbody>
                {dispensedBranches.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.emptyState}>
                      No branch activity recorded for selected filters / مفيش عمليات اتسجلت في الفروع في الفترة دي
                    </td>
                  </tr>
                ) : (
                  dispensedBranches.map((b, idx) => {
                    const percentage = Math.round((b.count / maxBranchCount) * 100);
                    return (
                      <tr key={idx} className={styles.tr}>
                        <td className={styles.td} style={{ fontWeight: 800, color: '#150958' }}>
                          {b.branch_name}
                        </td>
                        <td className={styles.td} style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                          {b.branch_code}
                        </td>
                        <td className={styles.td} style={{ fontWeight: 900, fontSize: '1rem', color: '#2563EB' }}>
                          {b.count.toLocaleString()}
                        </td>
                        <td className={styles.td}>
                          <div className={styles.progressBarTrack}>
                            <div className={styles.progressBarFill} style={{ width: `${percentage}%` }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>
                            {percentage}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: CASHIERS BREAKDOWN */}
        {activeTab === 'cashiers' && (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Staff Cashier / اسم الكاشير</th>
                  <th className={styles.th}>Handed Over Count / كمية المشروبات اللي سلمها</th>
                </tr>
              </thead>
              <tbody>
                {dispensedCashiers.length === 0 ? (
                  <tr>
                    <td colSpan={2} className={styles.emptyState}>
                      No cashier activity recorded for selected filters / مفيش عمليات اتسجلت للكاشيرات في الفترة دي
                    </td>
                  </tr>
                ) : (
                  dispensedCashiers.map((c, idx) => (
                    <tr key={idx} className={styles.tr}>
                      <td className={styles.td} style={{ fontWeight: 800, color: '#150958' }}>
                        {c.cashier_name}
                      </td>
                      <td className={styles.td} style={{ fontWeight: 900, fontSize: '1rem', color: '#059669' }}>
                        {c.count.toLocaleString()} مشروب
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: SUBSTITUTION AUDIT */}
        {activeTab === 'substitutions' && (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Voucher Code / كود الكوبون</th>
                  <th className={styles.th}>Customer / الزبون</th>
                  <th className={styles.th}>Original Choice / كان طالب إيه</th>
                  <th className={styles.th}>Served Beverage / أخد إيه بداله</th>
                  <th className={styles.th}>Substitution Reason / السبب إيه</th>
                  <th className={styles.th}>Branch & Cashier / الفرع والكاشير</th>
                  <th className={styles.th}>Timestamp / اتسلمت إمتى</th>
                </tr>
              </thead>
              <tbody>
                {substitutions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={styles.emptyState}>
                      Great! No beverage substitutions recorded (all customers got what they ordered) / مفيش ولا مشروب اتبدل، كل الزباين أخدت طلبها بالظبط! 👏
                    </td>
                  </tr>
                ) : (
                  substitutions.map((sub, idx) => (
                    <tr key={idx} className={styles.tr}>
                      <td className={styles.td} style={{ fontFamily: 'monospace', fontWeight: 800, color: '#150958' }}>
                        {sub.voucher_code}
                      </td>
                      <td className={styles.td}>
                        <div style={{ fontWeight: 700, color: '#1E293B' }}>{sub.customer_name}</div>
                        <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#64748B' }}>{sub.phone}</div>
                      </td>
                      <td className={styles.td} style={{ textDecoration: 'line-through', color: '#94A3B8' }}>
                        {sub.selected_drink_name}
                      </td>
                      <td className={styles.td} style={{ fontWeight: 800, color: '#D97706' }}>
                        {sub.redeemed_drink_name}
                      </td>
                      <td className={styles.td} style={{ fontSize: '0.8rem', color: '#78350F', background: '#FEF3C7', padding: '0.35rem 0.65rem', borderRadius: '6px' }}>
                        {sub.change_reason}
                      </td>
                      <td className={styles.td} style={{ fontSize: '0.8rem' }}>
                        <div style={{ fontWeight: 700, color: '#1E293B' }}>{sub.branch_name}</div>
                        <div style={{ color: '#64748B' }}>{sub.cashier_name}</div>
                      </td>
                      <td className={styles.td} style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        {sub.redeemed_at ? new Date(sub.redeemed_at).toLocaleString('en-US') : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
