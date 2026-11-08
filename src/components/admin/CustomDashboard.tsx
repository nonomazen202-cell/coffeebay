import React from "react";
import Link from "next/link";
import { getPayload } from "payload";
import config from "@payload-config";
import { getAuthUser } from "@/lib/security/auth-helper";
import { Gutter } from "@payloadcms/ui";
import { VerifyWidget } from "./VerifyWidget";
import { ClaimsTable } from "./ClaimsTable";
import { RefreshButton } from "./RefreshButton";
import type { User } from "@/payload-types";

export async function CustomDashboard(props: { user?: User | null }) {
  // 1. Get current logged-in user
  const user = props.user || (await getAuthUser());
  const isAdmin = user?.role === "ADMIN";

  // 2. Fetch statistics from PostgreSQL via Payload Local API
  const payload = await getPayload({ config });

  // Query all statistics in parallel for speed
  const [
    totalCodesResult,
    claimedCodesResult,
    remainingCodesResult,
    totalWinnersResult,
    unclaimedWinnersResult,
    claimedWinnersResult,
    totalClaimsResult,
    pendingClaimsResult,
    deliveredClaimsResult,
    totalEntriesResult,
    totalParticipantsResult,
    recentClaimsResult,
  ] = await Promise.all([
    // Group 1: Codes
    payload.count({ collection: "codes" }),
    payload.count({
      collection: "codes",
      where: { claimed: { equals: true } },
    }),
    payload.count({
      collection: "codes",
      where: { claimed: { equals: false } },
    }),
    // Group 2: Winners
    payload.count({
      collection: "codes",
      where: { is_winner: { equals: true } },
    }),
    payload.count({
      collection: "codes",
      where: {
        and: [{ is_winner: { equals: true } }, { claimed: { equals: false } }],
      },
    }),
    payload.count({
      collection: "codes",
      where: {
        and: [{ is_winner: { equals: true } }, { claimed: { equals: true } }],
      },
    }),
    // Group 3: Claims Pipeline
    payload.count({ collection: "prize-claims" }),
    payload.count({
      collection: "prize-claims",
      where: { status: { equals: "PENDING" } },
    }),
    payload.count({
      collection: "prize-claims",
      where: { status: { equals: "DELIVERED" } },
    }),
    // Group 4: Users and Scans
    payload.count({ collection: "entries" }),
    payload.count({ collection: "participants" }),
    // Recent claims data for the table
    payload.find({
      collection: "prize-claims",
      limit: 50,
      sort: "-createdAt",
      depth: 3,
    }),
  ]);

  const totalCodes = totalCodesResult.totalDocs;
  const claimedCodes = claimedCodesResult.totalDocs;
  const remainingCodes = remainingCodesResult.totalDocs;

  const totalWinners = totalWinnersResult.totalDocs;
  const unclaimedWinners = unclaimedWinnersResult.totalDocs;
  const claimedWinners = claimedWinnersResult.totalDocs;

  const totalClaims = totalClaimsResult.totalDocs;
  const pendingClaims = pendingClaimsResult.totalDocs;
  const deliveredClaims = deliveredClaimsResult.totalDocs;

  const totalEntries = totalEntriesResult.totalDocs;
  const totalParticipants = totalParticipantsResult.totalDocs;
  const recentClaims = recentClaimsResult.docs;

  // Calculate percentage progress of codes claimed
  const progressPercent =
    totalCodes > 0 ? Math.round((claimedCodes / totalCodes) * 100) : 0;

  return (
    <Gutter className="dashboard">
      <style>{`
        .dashboard {
          padding-top: 2.5rem !important;
        }
        .dashboard-header-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, #150958 0%, #0C0536 100%);
          border: 1px solid rgba(192, 192, 192, 0.25);
          border-radius: 1rem;
          padding: 1.75rem 2rem;
          margin-bottom: 2.5rem;
          box-shadow: 0 12px 32px rgba(21, 9, 88, 0.16);
          position: relative;
          overflow: hidden;
        }
        .dashboard-header-container::after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          right: 0;
          height: 100%;
          width: 45%;
          min-width: 280px;
          max-width: 440px;
          background-image: url('/drink-rewards/paateern-bg-wave-divider-forCards-edg.png');
          background-repeat: no-repeat;
          background-position: right bottom;
          background-size: auto 100%;
          opacity: 1;
          pointer-events: none;
        }
        .dashboard-section {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 1rem;
          padding: 1.75rem;
          margin-bottom: 2.5rem;
          box-shadow: 0 4px 16px rgba(21, 9, 88, 0.05);
        }
        .dashboard-section-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #150958;
          margin-bottom: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #E2E8F0;
        }
        .dashboard-section-title-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .dashboard-section-title-right {
          font-size: 0.95rem;
          color: #150958;
          font-weight: 700;
        }
        .grid-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 1.5rem;
        }
        .glassy-card {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 0.875rem;
          padding: 1.5rem 1.75rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
          transition: all 0.22s ease;
          min-height: 130px;
          box-shadow: 0 4px 14px rgba(21, 9, 88, 0.04);
        }
        .glassy-card::before {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          width: 4px;
          background: #150958;
          transition: all 0.22s ease;
          border-top-left-radius: 0.875rem;
          border-bottom-left-radius: 0.875rem;
        }
        .glassy-card::after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          right: 0;
          height: 100%;
          width: 260px;
          max-width: 50%;
          background-image: url('/drink-rewards/paateern-bg-wave-divider-forCards-edg.png');
          background-repeat: no-repeat;
          background-position: right bottom;
          background-size: auto 100%;
          opacity: 0.95;
          pointer-events: none;
          z-index: 0;
        }
        .glassy-card:hover {
          background: #FFFFFF;
          border-color: #CBD5E1;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(21, 9, 88, 0.09);
        }
        .glassy-card.card-blue::before {
          background: #150958;
        }
        .glassy-card.card-brown::before {
          background: #94A3B8;
        }
        .glassy-card.card-muted::before {
          background: #CBD5E1;
        }
        
        .kpi-title {
          font-size: 0.825rem;
          font-weight: 700;
          color: #150958;
          margin-bottom: 0.15rem;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        .kpi-subtitle {
          font-size: 0.75rem;
          font-weight: 500;
          color: #64748B;
          margin-bottom: 1rem;
        }
        .kpi-value {
          font-size: 2.25rem;
          font-weight: 800;
          color: #150958;
          line-height: 1;
          margin: 0;
          position: relative;
          z-index: 1;
        }
        .card-blue .kpi-value {
          color: #150958;
        }
        .card-brown .kpi-value {
          color: #150958;
        }
        .kpi-footer {
          font-size: 0.825rem;
          color: #64748B;
          margin-top: auto;
        }
      `}</style>

      {/* Header with Deep Blue Brand Identity */}
      <div className="dashboard-header-container">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1.25rem",
            flexWrap: "wrap",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Brand Logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              paddingRight: "0.5rem",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/drink-rewards/coffeebay-white-logo.png"
              alt="Coffee Bay"
              style={{
                height: "36px",
                width: "auto",
                objectFit: "contain",
              }}
            />
          </div>
          <div>
            <h1
              style={{
                fontSize: "1.65rem",
                fontWeight: "700",
                letterSpacing: "-0.02em",
                color: "#FFFFFF",
                marginBottom: "0.2rem",
              }}
            >
              {isAdmin ? "CoffeeBay Operations & Campaign System" : "CoffeeBay Branch Portal / بوابة موظفي الفرع"}
            </h1>
            <p style={{ color: "#C0C0C0", fontSize: "0.875rem", margin: 0 }}>
              Welcome back,{" "}
              <strong style={{ color: "#FFFFFF" }}>
                {user?.name || "Staff Member"}
              </strong>{" "}
              • Role:{" "}
              <span
                style={{
                  textTransform: "uppercase",
                  fontWeight: "700",
                  color: "#FFFFFF",
                  backgroundColor: "rgba(255, 255, 255, 0.14)",
                  padding: "0.15rem 0.55rem",
                  borderRadius: "9999px",
                  fontSize: "0.75rem",
                }}
              >
                {user?.role || "STAFF"}
              </span>
            </p>
          </div>
        </div>
        <RefreshButton />
      </div>

      {/* Section 1: Campaign Serials (Visible to Admin Only) */}
      {isAdmin && (
        <div className="dashboard-section">
          <h2 className="dashboard-section-title">
            <span className="dashboard-section-title-left">
              <span
                style={{
                  color: "#150958",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                  <path d="m3.3 7 8.7 5 8.7-5" />
                  <path d="M12 22V12" />
                </svg>
              </span>
              Campaign Codes Management
            </span>
            <span className="dashboard-section-title-right">
              متابعة وإدارة أكواد الحملة
            </span>
          </h2>
          <div className="grid-container">
            <div className="glassy-card card-blue">
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span className="kpi-title">Total Seeded Codes</span>
                <span className="kpi-subtitle">إجمالي الأكواد بالمنظومة</span>
              </div>
              <div className="kpi-value">{totalCodes.toLocaleString()}</div>
            </div>
            <div className="glassy-card card-blue">
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span className="kpi-title">Scanned / Claimed Serials</span>
                <span className="kpi-subtitle">
                  الأكواد الممسوحة والمستخدمة
                </span>
              </div>
              <div className="kpi-value">{claimedCodes.toLocaleString()}</div>
            </div>
            <div className="glassy-card card-brown">
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span className="kpi-title">Remaining Active Serials</span>
                <span className="kpi-subtitle">
                  الأكواد النشطة المتبقية بالسوق
                </span>
              </div>
              <div className="kpi-value">{remainingCodes.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Section 2: Winning Cups Info (Admin Only) */}
      {isAdmin ? (
        <>
          <div className="dashboard-section">
            <h2 className="dashboard-section-title">
              <span className="dashboard-section-title-left">
                <span
                  style={{
                    color: "#150958",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                    <path d="M4 22h16" />
                    <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
                    <path d="M12 2a6 6 0 0 1 6 6v3.58a6 6 0 0 1-1.92 4.41L12 19l-4.08-3a6 6 0 0 1-1.92-4.41V8a6 6 0 0 1 6-6Z" />
                  </svg>
                </span>
                Winning Serials
              </span>
              <span className="dashboard-section-title-right">
                أكواب الفوز اللي اتوزعت في الحملة
              </span>
            </h2>
            <div className="grid-container">
              <div className="glassy-card card-blue">
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span className="kpi-title">Total Winning Serials</span>
                  <span className="kpi-subtitle">
                    إجمالي الأكواب الكسبانة بالمنظومة
                  </span>
                </div>
                <div className="kpi-value">{totalWinners.toLocaleString()}</div>
              </div>
              <div className="glassy-card card-blue">
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span className="kpi-title">Scanned Winners</span>
                  <span className="kpi-subtitle">الكسبانين المسجلين بالسيستم</span>
                </div>
                <div className="kpi-value">{claimedWinners.toLocaleString()}</div>
              </div>
              <div className="glassy-card card-brown">
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span className="kpi-title">Unclaimed Winning Cups</span>
                  <span className="kpi-subtitle">أكواب الفوز المتبقية بالسوق</span>
                </div>
                <div className="kpi-value">{unclaimedWinners.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Section 3: Staff Delivery Pipeline */}
          <div className="dashboard-section">
            <h2 className="dashboard-section-title">
              <span className="dashboard-section-title-left">
                <span
                  style={{
                    color: "#150958",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <path d="M9 12h6" />
                    <path d="M9 16h6" />
                  </svg>
                </span>
                Prize Delivery Pipeline
              </span>
              <span className="dashboard-section-title-right">
                مراحل تسليم الجوائز للزبائن
              </span>
            </h2>
            <div className="grid-container">
              <div className="glassy-card card-blue">
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span className="kpi-title">Total Registered Claims</span>
                  <span className="kpi-subtitle">إجمالي طلبات الجوائز المسجلة</span>
                </div>
                <div className="kpi-value">{totalClaims.toLocaleString()}</div>
              </div>
              <div className="glassy-card card-brown">
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span className="kpi-title">Pending Delivery</span>
                  <span className="kpi-subtitle">الجوائز قيد التسليم للزبائن</span>
                </div>
                <div className="kpi-value">{pendingClaims.toLocaleString()}</div>
              </div>
              <div className="glassy-card card-blue">
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span className="kpi-title">Delivered Prizes</span>
                  <span className="kpi-subtitle">الجوائز المسلّمة بالكامل</span>
                </div>
                <div className="kpi-value">{deliveredClaims.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Section 4: Participation & Engagement */}
          <div className="dashboard-section">
            <h2 className="dashboard-section-title">
              <span className="dashboard-section-title-left">
                <span
                  style={{
                    color: "#150958",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                User Engagement
              </span>
              <span className="dashboard-section-title-right">
                نشاط وحركة الزبائن على السيستم
              </span>
            </h2>
            <div className="grid-container">
              <div className="glassy-card card-blue">
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span className="kpi-title">Total Scan Entries</span>
                  <span className="kpi-subtitle">إجمالي محاولات إدخال الرموز</span>
                </div>
                <div className="kpi-value">{totalEntries.toLocaleString()}</div>
              </div>
              <div className="glassy-card card-blue">
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span className="kpi-title">Registered Participants</span>
                  <span className="kpi-subtitle">الزبائن المسجلين والمشاركين</span>
                </div>
                <div className="kpi-value">
                  {totalParticipants.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Verification and Cashier Widget */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "2rem",
              alignItems: "start",
            }}
          >
            <VerifyWidget />
            <ClaimsTable initialClaims={recentClaims} />
          </div>
        </>
      ) : (
        /* ── Staff Operations Portal ─────────────────────────────────────── */
        <div className="dashboard-section">
          <h2 className="dashboard-section-title">
            <span className="dashboard-section-title-left">
              <span
                style={{
                  color: "#150958",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
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
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </span>
              Branch Operations & Drink Rewards
            </span>
            <span className="dashboard-section-title-right">
              بوابة عمليات الفرع والكاشير
            </span>
          </h2>

          <div
            className="grid-container"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {/* Terminal Card */}
            <Link
              href="/admin/drink-redemption"
              className="glassy-card card-blue"
              style={{ textDecoration: "none", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
            >
              <div>
                <span className="kpi-title" style={{ fontSize: "1rem", color: "#150958", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  ☕ Drink Redemption Terminal
                </span>
                <span className="kpi-subtitle" style={{ display: "block", marginTop: "0.4rem", lineHeight: 1.5 }}>
                  شاشة الكاشير اليومية: ابحث برقم هاتف العميل أو كود الكوبون لصرف المشروب فورياً وتسجيل العملية باسمك والفرع.
                </span>
              </div>
              <div style={{ marginTop: "1.25rem", fontWeight: 700, color: "#150958", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span>فتح شاشة الصرف</span>
                <span>←</span>
              </div>
            </Link>

            {/* Drinks Menu Card */}
            <Link
              href="/admin/collections/drinks"
              className="glassy-card card-blue"
              style={{ textDecoration: "none", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
            >
              <div>
                <span className="kpi-title" style={{ fontSize: "1rem", color: "#150958", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  📋 Drinks Menu Manager
                </span>
                <span className="kpi-subtitle" style={{ display: "block", marginTop: "0.4rem", lineHeight: 1.5 }}>
                  إدارة قائمة المشروبات: إضافة مشروبات جديدة، إيقاف الأصناف غير المتوفرة مؤقتاً، وتعديل المتاح في الهدايا.
                </span>
              </div>
              <div style={{ marginTop: "1.25rem", fontWeight: 700, color: "#150958", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span>إدارة قائمة المشروبات</span>
                <span>←</span>
              </div>
            </Link>

            {/* Vouchers List Card */}
            <Link
              href="/admin/collections/drink-entitlements"
              className="glassy-card card-brown"
              style={{ textDecoration: "none", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
            >
              <div>
                <span className="kpi-title" style={{ fontSize: "1rem", color: "#150958", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  🎫 Vouchers & Entitlements
                </span>
                <span className="kpi-subtitle" style={{ display: "block", marginTop: "0.4rem", lineHeight: 1.5 }}>
                  استعراض الكوبونات: البحث برقم التليفون أو الكود للتحقق من حالة الكوبون وموعد وتاريخ صرفه.
                </span>
              </div>
              <div style={{ marginTop: "1.25rem", fontWeight: 700, color: "#64748B", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span>استعراض الكوبونات</span>
                <span>←</span>
              </div>
            </Link>
          </div>
        </div>
      )}
    </Gutter>
  );
}
