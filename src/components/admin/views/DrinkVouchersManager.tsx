'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from './DrinkVouchersManager.module.css';
import { AdminPagination } from '../AdminPagination';
import { bulkDeleteAction } from './actions';
import { toggleVoucherReclaimAllowed, bulkToggleReclaimAllowed } from './drink-actions';

export interface SerializedVoucher {
  id: number;
  voucherCode: string;
  customerName: string;
  phone: string;
  status: 'ISSUED' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED';
  campaignTitle: string;
  selectedDrinkName: string;
  redeemedDrinkName?: string | null;
  branchName?: string | null;
  cashierName?: string | null;
  changeReason?: string | null;
  issuedAt: string;
  redeemedAt?: string | null;
  expiresAt: string;
  reclaimAllowed?: boolean;
}

interface DrinkVouchersManagerProps {
  initialVouchers: SerializedVoucher[];
  currentPage: number;
  totalPages: number;
  totalDocs: number;
  totalCount: number;
  issuedCount: number;
  redeemedCount: number;
  expiredCount: number;
  initialSearch?: string;
  initialStatus?: string;
  userRole?: 'ADMIN' | 'STAFF';
}

export function DrinkVouchersManager({
  initialVouchers,
  currentPage,
  totalPages,
  totalCount,
  issuedCount,
  redeemedCount,
  expiredCount,
  initialSearch = '',
  initialStatus = 'ALL',
  userRole = 'STAFF',
}: DrinkVouchersManagerProps) {
  const isAdmin = userRole === 'ADMIN';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [vouchers, setVouchers] = useState<SerializedVoucher[]>(initialVouchers);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deletingSingleId, setDeletingSingleId] = useState<number | string | null>(null);
  const [togglingReclaimId, setTogglingReclaimId] = useState<number | string | null>(null);
  const [bulkReclaiming, setBulkReclaiming] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [searchInput, setSearchInput] = useState(initialSearch);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Synchronize state on incoming server updates
  useEffect(() => {
    setVouchers(initialVouchers);
  }, [initialVouchers]);

  // Reset selected items when changing pages, search, or filters
  useEffect(() => {
    setSelectedIds([]);
  }, [currentPage, initialStatus, initialSearch]);

  // Update URL Query Params cleanly
  const updateQuery = (newParams: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    Object.entries(newParams).forEach(([key, val]) => {
      if (val === undefined || val === '' || val === 'ALL') {
        params.delete(key);
      } else {
        params.set(key, String(val));
      }
    });

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  // Search Submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateQuery({ search: searchInput.trim(), page: 1 });
  };

  // Status Filter Tab Change
  const handleStatusChange = (status: string) => {
    updateQuery({ status, page: 1 });
  };

  // Page Change
  const handlePageChange = (newPage: number) => {
    updateQuery({ page: newPage });
  };

  // Copy Code Helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Selection Logic
  const allOnPageSelected = vouchers.length > 0 && vouchers.every((v) => selectedIds.includes(v.id));

  const handleToggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !vouchers.some((v) => v.id === id)));
    } else {
      const pageIds = vouchers.map((v) => v.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleToggleRow = (id: number | string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmMessage = `Are you sure you want to delete the ${selectedIds.length} selected voucher(s)?\nThis action cannot be undone.\n\nهل أنت متأكد من حذف ${selectedIds.length} كوبون محدد؟ لا يمكن التراجع عن هذا الإجراء.`;
    if (!window.confirm(confirmMessage)) return;

    setDeleting(true);
    setAlert(null);
    try {
      const res = await bulkDeleteAction('drink-entitlements', selectedIds);
      if (res.success) {
        setAlert({
          type: 'success',
          message: `Successfully deleted ${selectedIds.length} voucher(s) • تم حذف ${selectedIds.length} كوبون بنجاح`,
        });
        setVouchers((prev) => prev.filter((v) => !selectedIds.includes(v.id)));
        setSelectedIds([]);
        startTransition(() => {
          router.refresh();
        });
      } else {
        setAlert({
          type: 'error',
          message: res.error || 'Failed to delete selected vouchers / فشل حذف الكوبونات.',
        });
      }
    } catch (err) {
      console.error(err);
      setAlert({
        type: 'error',
        message: 'An error occurred during deletion / حدث خطأ أثناء عملية الحذف.',
      });
    } finally {
      setDeleting(false);
    }
  };

  // Single Row Delete
  const handleSingleDelete = async (voucher: SerializedVoucher) => {
    const confirmMessage = `Are you sure you want to delete voucher "${voucher.voucherCode}" for ${voucher.customerName}?\n\nهل أنت متأكد من حذف الكوبون "${voucher.voucherCode}" للعميل ${voucher.customerName}؟`;
    if (!window.confirm(confirmMessage)) return;

    setDeletingSingleId(voucher.id);
    setAlert(null);
    try {
      const res = await bulkDeleteAction('drink-entitlements', [voucher.id]);
      if (res.success) {
        setAlert({
          type: 'success',
          message: `Successfully deleted voucher ${voucher.voucherCode} • تم حذف الكوبون بنجاح`,
        });
        setVouchers((prev) => prev.filter((v) => v.id !== voucher.id));
        setSelectedIds((prev) => prev.filter((id) => id !== voucher.id));
        startTransition(() => {
          router.refresh();
        });
      } else {
        setAlert({
          type: 'error',
          message: res.error || 'Failed to delete voucher / فشل حذف الكوبون.',
        });
      }
    } catch (err) {
      console.error(err);
      setAlert({
        type: 'error',
        message: 'An error occurred during deletion / حدث خطأ أثناء عملية الحذف.',
      });
    } finally {
      setDeletingSingleId(null);
    }
  };

  // Toggle Re-claim Allowed for a single voucher
  const handleToggleReclaim = async (voucher: SerializedVoucher, allowed: boolean) => {
    setTogglingReclaimId(voucher.id);
    setAlert(null);
    try {
      const res = await toggleVoucherReclaimAllowed(voucher.id, allowed);
      if (res.success) {
        setAlert({
          type: 'success',
          message: allowed
            ? `Successfully granted extra claim for ${voucher.customerName} (${voucher.phone}) • تم منح إذن استلام مشروب إضافي للعميل بنجاح`
            : `Revoked extra claim exception for ${voucher.customerName} • تم إلغاء الاستثناء للعميل بنجاح`,
        });
        setVouchers((prev) =>
          prev.map((v) => (v.id === voucher.id ? { ...v, reclaimAllowed: allowed } : v)),
        );
        startTransition(() => {
          router.refresh();
        });
      } else {
        setAlert({
          type: 'error',
          message: res.error || 'Failed to update re-claim permission / فشل تعديل إذن المطالبة الإضافية.',
        });
      }
    } catch (err) {
      console.error(err);
      setAlert({
        type: 'error',
        message: 'An error occurred / حدث خطأ أثناء التعديل.',
      });
    } finally {
      setTogglingReclaimId(null);
    }
  };

  // Bulk Grant Re-claim for all selected vouchers
  const handleBulkGrantReclaim = async (allowed: boolean) => {
    if (selectedIds.length === 0) return;
    const confirmMsg = allowed
      ? `Grant extra claim eligibility to ${selectedIds.length} selected customer(s)?\n\nهل تريد منح إمكانية طلب مشروب إضافي لـ ${selectedIds.length} عميل محدد؟`
      : `Revoke extra claim eligibility from ${selectedIds.length} selected customer(s)?\n\nهل تريد إلغاء استثناء المشروب الإضافي لـ ${selectedIds.length} عميل محدد؟`;
    if (!window.confirm(confirmMsg)) return;

    setBulkReclaiming(true);
    setAlert(null);
    try {
      const res = await bulkToggleReclaimAllowed(selectedIds, allowed);
      if (res.success) {
        setAlert({
          type: 'success',
          message: allowed
            ? `Granted extra claim eligibility to ${res.count} voucher(s) • تم منح الاستثناء لـ ${res.count} كوبون بنجاح`
            : `Revoked extra claim eligibility from ${res.count} voucher(s) • تم إلغاء الاستثناء لـ ${res.count} كوبون بنجاح`,
        });
        setVouchers((prev) =>
          prev.map((v) => (selectedIds.includes(v.id) ? { ...v, reclaimAllowed: allowed } : v)),
        );
        setSelectedIds([]);
        startTransition(() => {
          router.refresh();
        });
      } else {
        setAlert({
          type: 'error',
          message: res.error || 'Failed to update selected vouchers / فشل التعديل للكوبونات المحددة.',
        });
      }
    } catch (err) {
      console.error(err);
      setAlert({
        type: 'error',
        message: 'An error occurred / حدث خطأ أثناء التعديل الجماعي.',
      });
    } finally {
      setBulkReclaiming(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* ── Header Ribbon ──────────────────────────────────────────────── */}
      <div className={styles.headerCard}>
        <div className={styles.headerWave} />
        <div className={styles.headerContent}>
          <div className={styles.headerBadge}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
            VOUCHERS & REDEMPTION REGISTRY / سجل كل القسائم والكوبونات
          </div>
          <h1 className={styles.headerTitle}>
            Drink Vouchers Registry <span style={{ fontSize: '1.15rem', fontWeight: 600, opacity: 0.85 }}>/ سجل كوبونات المشروبات</span>
          </h1>
          <p className={styles.headerSubtitle}>
            تابع كل الكوبونات الصادرة للزبائن ومين صرف ومين لسه مستني، مع توثيق الفروع والكاشيرات
          </p>
        </div>
      </div>

      {/* ── KPI Metric Cards ───────────────────────────────────────────── */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconTotal}`}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Total Vouchers Issued / كل الكوبونات الصادرة</span>
            <span className={styles.kpiValue}>{totalCount.toLocaleString()}</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconIssued}`}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Ready to Redeem / لسه متصرفتش ومستنية</span>
            <span className={styles.kpiValue} style={{ color: '#059669' }}>
              {issuedCount.toLocaleString()}
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconRedeemed}`}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Redeemed & Served / اتصرفت واتسلمت خلاص</span>
            <span className={styles.kpiValue} style={{ color: '#2563EB' }}>
              {redeemedCount.toLocaleString()}
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconExpired}`}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Expired / كوبونات خلص وقتها</span>
            <span className={styles.kpiValue} style={{ color: '#64748B' }}>
              {expiredCount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* ── Filters Card ───────────────────────────────────────────────── */}
      <div className={styles.filterCard}>
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className={styles.searchBox}>
          <svg width="16" height="16" className={styles.searchIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search code (CB- / DRK-), phone, or customer name... / ابحث بالكود أو برقم الهاتف أو اسم العميل"
            className={styles.searchInput}
          />
        </form>

        {/* Status Filter Tabs */}
        <div className={styles.statusTabs}>
          {[
            { key: 'ALL', label: 'All Statuses / كل الحالات' },
            { key: 'ISSUED', label: 'Ready to Redeem / لسه متصرفتش' },
            { key: 'REDEEMED', label: 'Redeemed / اتصرفت خلاص' },
            { key: 'EXPIRED', label: 'Expired / خلص وقتها' },
            { key: 'CANCELLED', label: 'Cancelled / اتلغت' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleStatusChange(tab.key)}
              className={`${styles.statusTab} ${initialStatus === tab.key ? styles.statusTabActive : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Alert Notification ────────────────────────────────────────── */}
      {alert && (
        <div className={`${styles.alertBox} ${alert.type === 'success' ? styles.alertSuccess : styles.alertError}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {alert.type === 'success' ? (
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span>{alert.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlert(null)}
            className={styles.alertDismiss}
            title="Dismiss / إغلاق"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Bulk Actions Floating Toolbar ─────────────────────────────── */}
      {isAdmin && selectedIds.length > 0 && (
        <div className={styles.bulkBar}>
          <div className={styles.bulkBarInfo}>
            <span className={styles.bulkBarBadge}>{selectedIds.length}</span>
            <span>
              Selected {selectedIds.length} voucher{selectedIds.length > 1 ? 's' : ''} • تم تحديد {selectedIds.length} كوبون
            </span>
          </div>
          <div className={styles.bulkBarActions}>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className={styles.deselectBtn}
            >
              Deselect All / إلغاء التحديد
            </button>
            <button
              type="button"
              onClick={() => handleBulkGrantReclaim(true)}
              disabled={bulkReclaiming || deleting}
              className={styles.bulkReclaimBtn}
              title="Grant extra claim eligibility for selected customers / منح مطالبة إضافية للمحددين"
            >
              {bulkReclaiming ? 'Granting... / جاري المنح...' : '🔄 Grant Re-claim / منح مشروب إضافي للمحددين'}
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={deleting || bulkReclaiming}
              className={styles.bulkDeleteBtn}
            >
              {deleting ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" strokeWidth="4" strokeDasharray="30" strokeLinecap="round" />
                  </svg>
                  Deleting... / جاري الحذف...
                </>
              ) : (
                <>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Selected / حذف المحدد
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Table Card ─────────────────────────────────────────────────── */}
      <div className={styles.tableCard}>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead className={styles.tableHead}>
              <tr>
                {isAdmin && (
                  <th className={styles.selectionTh}>
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={handleToggleSelectAll}
                      className={styles.checkbox}
                      title="Select all on this page / تحديد الكل"
                    />
                  </th>
                )}
                <th className={styles.tableTh}>Voucher Code / كود الكوبون</th>
                <th className={styles.tableTh}>Customer / العميل</th>
                <th className={styles.tableTh}>Beverage / المشروب المطلوب</th>
                <th className={styles.tableTh}>Status / حالة الكوبون</th>
                <th className={styles.tableTh}>Branch & Cashier / الفرع والكاشير</th>
                <th className={styles.tableTh}>Timeline / التواريخ</th>
                <th className={styles.tableTh} style={{ textAlign: 'center' }}>Actions / إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className={styles.emptyState}>
                    <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ margin: '0 auto 0.5rem auto' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className={styles.emptyTitle}>No vouchers matching search / مفيش ولا كوبون لايق على اللي كتبته</p>
                    <p className={styles.emptySubtitle}>Try changing status filter or clearing search box / جرب تشيل الفلاتر أو تنضف خانة البحث</p>
                  </td>
                </tr>
              ) : (
                vouchers.map((voucher) => {
                  const wasSubstituted = Boolean(
                    voucher.redeemedDrinkName &&
                    voucher.redeemedDrinkName !== voucher.selectedDrinkName
                  );
                  const isSelected = selectedIds.includes(voucher.id);

                  return (
                    <tr key={voucher.id} className={isSelected ? styles.selectedRow : styles.tableRow}>
                      {/* Selection Checkbox */}
                      {isAdmin && (
                        <td className={styles.selectionTd}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleRow(voucher.id)}
                            className={styles.checkbox}
                          />
                        </td>
                      )}

                      {/* Code */}
                      <td className={styles.tableTd}>
                        <div className={styles.voucherCodeBadge}>
                          <span>{voucher.voucherCode}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(voucher.voucherCode)}
                            className={styles.copyButton}
                            title="Copy Voucher Code / انسخ الكود"
                          >
                            {copiedCode === voucher.voucherCode ? (
                              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#059669">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <rect width="14" height="14" x="8" y="8" rx="2" strokeWidth={2} />
                                <path strokeWidth={2} d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className={styles.tableTd}>
                        <span className={styles.customerName}>{voucher.customerName}</span>
                        <span className={styles.customerPhone}>{voucher.phone}</span>

                        {voucher.reclaimAllowed ? (
                          <div className={styles.reclaimGrantedBadge} title="هذا العميل مؤهل للحصول على مشروب جديد">
                            <span>🟢 Re-claim Allowed / مؤهل لمشروب جديد</span>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleToggleReclaim(voucher, false)}
                                disabled={togglingReclaimId === voucher.id}
                                className={styles.revokeReclaimBtn}
                                title="Revoke exception / إلغاء الاستثناء"
                              >
                                إلغاء
                              </button>
                            )}
                          </div>
                        ) : isAdmin ? (
                          <div style={{ marginTop: '0.35rem' }}>
                            <button
                              type="button"
                              onClick={() => handleToggleReclaim(voucher, true)}
                              disabled={togglingReclaimId === voucher.id}
                              className={styles.reclaimActionBtn}
                              title="Allow this customer to claim an additional drink without deleting this record / منح هذا العميل مشروب إضافي"
                            >
                              {togglingReclaimId === voucher.id ? 'Granting...' : '🔄 Allow Re-claim / منح مشروب إضافي'}
                            </button>
                          </div>
                        ) : null}
                      </td>

                      {/* Drink */}
                      <td className={styles.tableTd}>
                        <div className={styles.drinkBadge}>
                          <span>{voucher.selectedDrinkName}</span>
                        </div>
                        {wasSubstituted && (
                          <div>
                            <span className={styles.substitutedBadge} title={`Substitution reason: ${voucher.changeReason || 'N/A'}`}>
                              اتبّدل بـ: {voucher.redeemedDrinkName}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className={styles.tableTd}>
                        {voucher.status === 'ISSUED' && (
                          <span className={`${styles.statusPill} ${styles.statusIssued}`}>
                            <span className={styles.pulseDot} />
                            Ready to Redeem / لسه متصرفتش 🟢
                          </span>
                        )}
                        {voucher.status === 'REDEEMED' && (
                          <span className={`${styles.statusPill} ${styles.statusRedeemed}`}>
                            Redeemed / اتصرفت خلاص ☕
                          </span>
                        )}
                        {voucher.status === 'EXPIRED' && (
                          <span className={`${styles.statusPill} ${styles.statusExpired}`}>
                            Expired / خلص وقتها ⏳
                          </span>
                        )}
                        {voucher.status === 'CANCELLED' && (
                          <span className={`${styles.statusPill} ${styles.statusCancelled}`}>
                            Cancelled / اتلغت 🚫
                          </span>
                        )}
                      </td>

                      {/* Branch & Cashier */}
                      <td className={styles.tableTd}>
                        {voucher.branchName ? (
                          <div>
                            <span style={{ fontWeight: 700, color: '#1E293B', display: 'block', fontSize: '0.8rem' }}>
                              {voucher.branchName}
                            </span>
                            {voucher.cashierName && (
                              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                                سلمها: {voucher.cashierName}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>

                      {/* Dates */}
                      <td className={styles.tableTd} style={{ fontSize: '0.75rem' }}>
                        {voucher.redeemedAt ? (
                          <div>
                            <span style={{ fontWeight: 700, color: '#059669', display: 'block' }}>
                              اتصرفت: {new Date(voucher.redeemedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span style={{ color: '#94A3B8' }}>
                              طلعت يوم: {new Date(voucher.issuedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span style={{ color: '#1E293B', display: 'block' }}>
                              طلعت يوم: {new Date(voucher.issuedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                            <span style={{ color: '#DC2626' }}>
                              آخرها يوم: {new Date(voucher.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className={styles.tableTd} style={{ textAlign: 'center' }}>
                        <div className={styles.actionsCell}>
                          <Link
                            href={`/admin/collections/drink-entitlements/${voucher.id}`}
                            className={styles.editActionLink}
                            title="View and edit details in Payload / تفاصيل الكوبون"
                          >
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View
                          </Link>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleSingleDelete(voucher)}
                              disabled={deletingSingleId === voucher.id || deleting}
                              className={styles.deleteActionBtn}
                              title="Delete voucher / حذف الكوبون"
                            >
                              {deletingSingleId === voucher.id ? (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ animation: 'spin 1s linear infinite' }}>
                                  <circle cx="12" cy="12" r="10" strokeWidth="4" strokeDasharray="30" strokeLinecap="round" />
                                </svg>
                              ) : (
                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ───────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #E2E8F0', background: '#FFFFFF' }}>
            <AdminPagination
              currentPage={currentPage}
              totalPages={totalPages}
              isPending={isPending}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
