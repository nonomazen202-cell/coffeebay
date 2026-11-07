"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@payloadcms/ui";

export function CustomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin" || pathname === "/admin/";
    }
    return pathname?.startsWith(href);
  };

  const nameInitial = user?.name ? user.name.charAt(0).toUpperCase() : "U";
  const displayRole = user?.role || "STAFF";

  return (
    <div className="custom-sidebar">
      {/* Brand Header */}
      <div className="custom-sidebar-header">
        <div className="custom-sidebar-header-main">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/drink-rewards/coffeebay-white-logo.png"
            alt="Coffee Bay"
            className="custom-sidebar-logo-img"
          />
          <div className="custom-sidebar-brand-info">
            <span className="custom-sidebar-brand-sub">
              MORE THAN A COFFEE.
              <br />
              IT&apos;S A GOOD TIME.
            </span>
            <svg
              width="68"
              height="12"
              viewBox="0 0 68 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ marginTop: "0.45rem", opacity: 0.85 }}
            >
              <path
                d="M2 7.5C12 1.5 24 1.5 34 6.5C44 11.5 56 11.5 66 4.5"
                stroke="url(#sidebarWaveGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="sidebarWaveGrad" x1="0" y1="0" x2="68" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#C0C0C0" stopOpacity="0.3" />
                  <stop offset="50%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#C0C0C0" stopOpacity="0.3" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>

      {/* Nav List */}
      <nav className="custom-sidebar-nav" style={{ gap: "1rem" }}>
        {/* Main Section */}
        <div className="custom-sidebar-group">
          <Link
            href="/admin"
            className={`custom-sidebar-link ${isActive("/admin") ? "active" : ""}`}
          >
            {/* Dashboard Icon */}
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
              <rect width="7" height="9" x="3" y="3" rx="1" />
              <rect width="7" height="5" x="14" y="3" rx="1" />
              <rect width="7" height="9" x="14" y="12" rx="1" />
              <rect width="7" height="5" x="3" y="16" rx="1" />
            </svg>
            Dashboard Overview
          </Link>

          <Link
            href="/admin/collections/prize-claims"
            className={`custom-sidebar-link ${isActive("/admin/collections/prize-claims") ? "active" : ""}`}
          >
            {/* Prize Claims Icon */}
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
              <rect width="20" height="12" x="2" y="6" rx="2" />
              <path d="M12 12h.01" />
              <path d="M17 12h.01" />
              <path d="M7 12h.01" />
            </svg>
            Prize Claims Pipeline
          </Link>
        </div>

        <div
          style={{
            height: "1px",
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            margin: "0.25rem 0.5rem",
          }}
        />

        {/* Campaign Assets */}
        <div className="custom-sidebar-group">
          <Link
            href="/admin/collections/prizes"
            className={`custom-sidebar-link ${isActive("/admin/collections/prizes") ? "active" : ""}`}
          >
            {/* Prizes Icon */}
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
              <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
              <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
              <line x1="6" x2="6" y1="2" y2="4" />
              <line x1="10" x2="10" y1="2" y2="4" />
              <line x1="14" x2="14" y1="2" y2="4" />
            </svg>
            Prizes Catalog
          </Link>

          <Link
            href="/admin/collections/codes"
            className={`custom-sidebar-link ${isActive("/admin/collections/codes") ? "active" : ""}`}
          >
            {/* Codes Icon */}
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
              <path d="M3 5v14" />
              <path d="M21 5v14" />
              <path d="M7 5v14" />
              <path d="M11 5v14" />
              <path d="M17 5v14" />
              <path d="M14 5v14" />
            </svg>
            Seeded Serial Codes
          </Link>
        </div>

        <div
          style={{
            height: "1px",
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            margin: "0.25rem 0.5rem",
          }}
        />

        {/* Customer Data */}
        <div className="custom-sidebar-group">
          <Link
            href="/admin/collections/participants"
            className={`custom-sidebar-link ${isActive("/admin/collections/participants") ? "active" : ""}`}
          >
            {/* Customers Icon */}
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
            Registered Customers
          </Link>

          <Link
            href="/admin/collections/entries"
            className={`custom-sidebar-link ${isActive("/admin/collections/entries") ? "active" : ""}`}
          >
            {/* Entries Icon */}
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
              <path d="M12 20h9" />
              <path d="M3 20v-8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v8" />
              <path d="M3 12V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6" />
              <path d="M14 12V8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4" />
            </svg>
            Scan Activity Log
          </Link>

          {user?.role === "ADMIN" && (
            <Link
              href="/admin/collections/otp-verifications"
              className={`custom-sidebar-link ${isActive("/admin/collections/otp-verifications") ? "active" : ""}`}
            >
              {/* Key/Shield Icon */}
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
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
              OTP Verifications
            </Link>
          )}
        </div>

        <div
          style={{
            height: "1px",
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            margin: "0.25rem 0.5rem",
          }}
        />

        {/* Drink Rewards Module */}
        <div className="custom-sidebar-group">
          <div className="custom-sidebar-group-title">
            DRINK REWARDS
          </div>

          <Link
            href="/admin/drink-redemption"
            className={`custom-sidebar-link ${isActive("/admin/drink-redemption") ? "active" : ""}`}
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
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Drink Redemption Terminal
          </Link>

          {user?.role === "ADMIN" && (
            <Link
              href="/admin/drink-reports"
              className={`custom-sidebar-link ${isActive("/admin/drink-reports") ? "active" : ""}`}
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
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Drink Reports & Audit
            </Link>
          )}

          <Link
            href="/admin/collections/drink-campaigns"
            className={`custom-sidebar-link ${isActive("/admin/collections/drink-campaigns") ? "active" : ""}`}
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
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
            Drink Campaigns
          </Link>

          <Link
            href="/admin/collections/drink-entitlements"
            className={`custom-sidebar-link ${isActive("/admin/collections/drink-entitlements") ? "active" : ""}`}
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
              <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
              <path d="M13 5v2" />
              <path d="M13 17v2" />
              <path d="M13 11v2" />
            </svg>
            Vouchers & Entitlements
          </Link>

          <Link
            href="/admin/collections/drinks"
            className={`custom-sidebar-link ${isActive("/admin/collections/drinks") ? "active" : ""}`}
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
              <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
              <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
              <line x1="6" y1="2" x2="6" y2="4" />
              <line x1="10" y1="2" x2="10" y2="4" />
              <line x1="14" y1="2" x2="14" y2="4" />
            </svg>
            Drinks Menu
          </Link>

          <Link
            href="/admin/collections/drink-categories"
            className={`custom-sidebar-link ${isActive("/admin/collections/drink-categories") ? "active" : ""}`}
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
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
            </svg>
            Drink Categories
          </Link>

          <Link
            href="/admin/collections/branches"
            className={`custom-sidebar-link ${isActive("/admin/collections/branches") ? "active" : ""}`}
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
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Branches
          </Link>

          <Link
            href="/admin/collections/drink-cashier-assignments"
            className={`custom-sidebar-link ${isActive("/admin/collections/drink-cashier-assignments") ? "active" : ""}`}
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
              <polyline points="16 11 18 13 22 9" />
            </svg>
            Cashier Assignments
          </Link>

          {user?.role === "ADMIN" && (
            <Link
              href="/admin/collections/drink-otp-challenges"
              className={`custom-sidebar-link ${isActive("/admin/collections/drink-otp-challenges") ? "active" : ""}`}
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
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              Drink OTP Challenges
            </Link>
          )}
        </div>

        <div
          style={{
            height: "1px",
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            margin: "0.25rem 0.5rem",
          }}
        />
        <Link
          href="/admin/collections/notifications"
          className={`custom-sidebar-link ${isActive("/admin/collections/notifications") ? "active" : ""}`}
        >
          {/* WhatsApp Icon */}
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
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Notifications Queue
        </Link>
        {/* System Administration */}
        <div className="custom-sidebar-group">
          <Link
            href="/admin/collections/media"
            className={`custom-sidebar-link ${isActive("/admin/collections/media") ? "active" : ""}`}
          >
            {/* Media Icon */}
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
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            Media Library
          </Link>

          <Link
            href="/admin/collections/users"
            className={`custom-sidebar-link ${isActive("/admin/collections/users") ? "active" : ""}`}
          >
            {/* Users Icon */}
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
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Admin & Staff Users
          </Link>

          {user?.role === "ADMIN" && (
            <Link
              href="/admin/globals/settings"
              className={`custom-sidebar-link ${isActive("/admin/globals/settings") ? "active" : ""}`}
            >
              {/* Settings Cog Icon */}
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
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Campaign Settings
            </Link>
          )}
        </div>
      </nav>

      {/* Footer Profile & Logout */}
      <div className="custom-sidebar-footer">
        {user && (
          <div className="custom-sidebar-user">
            <div className="custom-sidebar-avatar">{nameInitial}</div>
            <div className="custom-sidebar-user-info">
              <span className="custom-sidebar-user-name">
                {user.name || "Admin"}
              </span>
              <span className="custom-sidebar-user-role">
                {user.email || displayRole}
              </span>
            </div>
          </div>
        )}
        <Link href="/admin/logout" className="custom-sidebar-logout">
          {/* Logout Icon */}
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
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
          </svg>
          Logout / الخروج
        </Link>
      </div>
    </div>
  );
}
