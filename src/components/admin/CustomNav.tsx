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
          {/* Embedded Vector Brand Logo */}
          <div
            style={{
              width: "42px",
              height: "36px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg
              id="Layer_1"
              data-name="Layer 1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 110.08 94.26"
              style={{ width: "100%", height: "100%" }}
            >
              <defs>
                <style>{`
                  .logo-cls-nav-1{fill:#7b3b1b;}
                  .logo-cls-nav-2{fill:#ffffff;}
                  .logo-cls-nav-3{fill:#2ba8e0;}
                `}</style>
              </defs>
              <path
                className="logo-cls-nav-1"
                d="M93.66,83.84a20,20,0,0,0,4.42,7.4,17.33,17.33,0,0,0,3.3,2.56,22.19,22.19,0,0,1-3.26-11.89,23.65,23.65,0,0,1,1.23-7.63c-5.75-4.67-12.82-5.8-17.13-2.69a19.79,19.79,0,0,1,6.66,4.31A21.58,21.58,0,0,1,93.66,83.84Z"
                transform="translate(-45.71 -52.29)"
              />
              <path
                className="logo-cls-nav-1"
                d="M92.15,84.45a20,20,0,0,0-4.42-7.4,18.47,18.47,0,0,0-6.86-4.23c-4.12,4.65-2.49,13.29,3.79,19.57,6,6,14.17,7.76,18.93,4.31a19.74,19.74,0,0,1-6.66-4.31A21.66,21.66,0,0,1,92.15,84.45Z"
                transform="translate(-45.71 -52.29)"
              />
              <path
                className="logo-cls-nav-1"
                d="M112.56,65.48a19.66,19.66,0,0,1,1.66,7.75,21.58,21.58,0,0,1-2.23,9,20.06,20.06,0,0,0-2.11,8.37,18.36,18.36,0,0,0,1.86,7.84c6.2-.37,11.16-7.64,11.16-16.52C122.9,73.42,118.37,66.41,112.56,65.48Z"
                transform="translate(-45.71 -52.29)"
              />
              <path
                className="logo-cls-nav-1"
                d="M110.49,81.59a20,20,0,0,0,2.1-8.36,18.35,18.35,0,0,0-1.85-7.84c-6.2.37-11.16,7.64-11.16,16.52,0,8.49,4.53,15.5,10.34,16.43a19.66,19.66,0,0,1-1.66-7.75A21.63,21.63,0,0,1,110.49,81.59Z"
                transform="translate(-45.71 -52.29)"
              />
              <path
                className="logo-cls-nav-3"
                d="M116.46,59h.38l1.11.07.38,0,.43,0,1,.1,1.12.18.31.05.31.06.65.14a27.8,27.8,0,0,1,6.2,2.14c.57.26,1.14.59,1.73.91l.88.53c.3.17.59.38.89.57a28.27,28.27,0,0,1,3.49,2.81,26.87,26.87,0,0,1,5.91,8.14,26.31,26.31,0,0,1,1.9,17A26.78,26.78,0,0,1,141,97.65a25.86,25.86,0,0,1-8.46,9.84,21.23,21.23,0,0,1-5.73,2.87,20.45,20.45,0,0,1-6.14.94,42.45,42.45,0,0,1-12.77-2.38c-4.2-1.34-8.27-2.93-12.22-4.3-2-.69-3.92-1.32-5.83-1.88s-3.8-1-5.63-1.34l-1.37-.23L81.54,101l-1.29-.16c-.42-.06-.84-.07-1.26-.11l-1.22-.09-.6,0h-.59c-.78,0-1.53,0-2.26,0l-2.11.07-.5,0-.49,0-1,.09c-1.25.08-2.37.28-3.38.42-.25,0-.49.07-.73.12l-.68.13-1.24.25c-.39.07-.73.18-1,.25l-.87.22c-.52.14-.91.23-1.17.32l-.39.12.41,0c.26,0,.67-.07,1.2-.13l.88-.08c.33,0,.68-.07,1.07-.08l1.24-.06.69,0c.24,0,.48,0,.73,0,1,0,2.11,0,3.32,0l.93,0,.47,0,.49,0,2,.19a60.68,60.68,0,0,1,9.29,1.9c1.68.5,3.41,1.11,5.18,1.81s3.58,1.49,5.45,2.33c3.74,1.67,7.69,3.58,12,5.28a57.85,57.85,0,0,0,6.85,2.25,35.08,35.08,0,0,0,7.57,1.13,25.3,25.3,0,0,0,8-1,26.14,26.14,0,0,0,7.47-3.64,29.42,29.42,0,0,0,6.07-5.59,31,31,0,0,0,4.21-6.8,30.55,30.55,0,0,0,2.26-7.35,29.58,29.58,0,0,0-3.67-20,28.82,28.82,0,0,0-11.86-11.12c-.35-.17-.69-.35-1-.5l-1-.44c-.69-.26-1.34-.53-2-.72a26.61,26.61,0,0,0-6.79-1.28l-.68,0h-1.81l-1,.06-.43,0-.39,0-1.1.13-.28,0Z"
                transform="translate(-45.71 -52.29)"
              />
              <path
                className="logo-cls-nav-3"
                d="M137.07,73.14l.29.65c.11.2.21.46.34.77.06.16.13.32.21.5l.2.57a26,26,0,0,1,.9,3,24.48,24.48,0,0,1,.61,3.92,24,24,0,0,1-.12,4.68,23.25,23.25,0,0,1-1.19,5.06,24.66,24.66,0,0,1-2.5,5.08,25.57,25.57,0,0,1-3.86,4.57l-.57.5-.28.25-.3.23-.58.47-.6.42-.6.42c-.2.12-.4.24-.59.37-.39.27-.79.44-1.18.66a15.47,15.47,0,0,1-4.76,1.6,22.48,22.48,0,0,1-5.22.25,43.18,43.18,0,0,1-5.29-.7c-1.71-.32-3.3-.68-4.74-1s-2.71-.68-3.76-.94l-2.44-.62-.87-.21s1.06.65,3,1.72c.95.54,2.1,1.18,3.43,1.87s2.85,1.44,4.53,2.16a39.19,39.19,0,0,0,5.52,1.91,23.8,23.8,0,0,0,6.34.77,18.16,18.16,0,0,0,6.76-1.41,22.87,22.87,0,0,0,6.43-4.16,24.57,24.57,0,0,0,6.43-4.16,24.57,24.57,0,0,0,4.76-6.1,24.17,24.17,0,0,0,2.44-6.74,22.91,22.91,0,0,0,.39-6.36,21.82,21.82,0,0,0-1.09-5.35,20.28,20.28,0,0,0-1.82-4A19.55,19.55,0,0,0,139,75.15l-.4-.49-.37-.4q-.35-.39-.6-.63Z"
                transform="translate(-45.71 -52.29)"
              />
              <path
                className="logo-cls-nav-3"
                d="M147.31,65.58l.24.39c.15.26.39.63.68,1.14a40.06,40.06,0,0,1,2.2,4.59,37,37,0,0,1,2.11,7.65l.09.58c0,.19.05.39.08.59,0,.39.09.79.14,1.2.05.82.13,1.65.13,2.52s0,1.75,0,2.66c0,.45-.07.91-.1,1.38l-.06.7c0,.24-.07.47-.1.71a35.22,35.22,0,0,1-12.42,22.48l-.71.58c-.24.19-.49.36-.74.55-.5.36-1,.74-1.53,1.06l-.79.5c-.27.17-.53.35-.81.49-.57.31-1.12.62-1.7.92a28.58,28.58,0,0,1-7.51,2.49,30.74,30.74,0,0,1-8.07.31,45.8,45.8,0,0,1-7.86-1.47c-2.56-.7-5-1.53-7.34-2.39s-4.59-1.76-6.78-2.61A95,95,0,0,0,84,108.46c-1-.23-1.93-.41-2.89-.56l-1.45-.2-.71-.1-.71-.06-1.41-.12c-.23,0-.47,0-.7,0l-.69,0-1.36,0-1.33,0a42.62,42.62,0,0,0-9.65,1.35,50.33,50.33,0,0,0-13,5.51c-1.44.88-2.54,1.58-3.27,2.1l-1.12.78,1.25-.54c.81-.38,2-.87,3.56-1.47a55.88,55.88,0,0,1,13.13-3.35,44.82,44.82,0,0,1,9-.17l1.21.1,1.23.16.62.08.62.1,1.26.23.63.11.64.15,1.29.29.32.07.31.09.61.17c.41.1.84.25,1.27.37,3.43,1.08,7.28,2.73,11.57,4.58,2.16.93,4.43,1.9,6.87,2.85a82.33,82.33,0,0,0,7.87,2.64,48.15,48.15,0,0,0,9,1.59,34.84,34.84,0,0,0,9.68-.59,32.49,32.49,0,0,0,9-3.33c.66-.38,1.31-.77,2-1.16.32-.19.62-.41.92-.62l.9-.63c.6-.42,1.16-.88,1.72-1.33.27-.23.56-.45.82-.68l.79-.72a37.47,37.47,0,0,0,12.06-26.15c0-.26,0-.51,0-.77s0-.51,0-.77c0-.51,0-1,0-1.5-.07-1-.13-1.93-.27-2.84s-.28-1.81-.43-2.66c-.1-.43-.2-.85-.29-1.26l-.15-.61c-.06-.19-.11-.39-.17-.59a35.23,35.23,0,0,0-3.14-7.65A37.38,37.38,0,0,0,148.45,67c-.36-.46-.66-.8-.85-1Z"
                transform="translate(-45.71 -52.29)"
              />
              <path
                className="logo-cls-nav-3"
                d="M92.93,66l1.27-1.25a37.2,37.2,0,0,1,3.94-3.18c.45-.31.94-.61,1.45-.94s1.07-.63,1.64-1c.29-.16.59-.3.9-.46s.61-.32,1-.46c.65-.29,1.32-.61,2-.86a31,31,0,0,1,4.68-1.41l1.28-.26c.43-.08.88-.13,1.32-.2.23,0,.45-.07.68-.09l.69-.07c.46,0,.92-.09,1.4-.1a32.1,32.1,0,0,1,12.06,1.72,30.66,30.66,0,0,1,6.09,2.88,31.68,31.68,0,0,1,5.57,4.34,31.09,31.09,0,0,1,7.85,12.69,30.9,30.9,0,0,1-2,23.47,31.91,31.91,0,0,1-4.46,6.51,30.06,30.06,0,0,1-5.76,5,25.75,25.75,0,0,1-6.65,3.24,26,26,0,0,1-7,1.17,34.88,34.88,0,0,1-6.69-.46,75.39,75.39,0,0,1-11.53-3c-3.44-1.13-6.49-2.22-9.17-3.09s-5-1.53-6.83-2c-.47-.12-.91-.2-1.32-.29l-.6-.13-.56-.11-1-.17-.82-.12c-.48-.06-.85-.12-1.11-.14l-.38,0,.37.1c.25.06.6.18,1.06.33l.78.25.94.33.52.19.57.22c.39.16.8.3,1.24.49,1.75.71,3.89,1.67,6.4,2.87s5.41,2.62,8.77,4.14c1.69.75,3.48,1.53,5.44,2.26a56.49,56.49,0,0,0,6.38,2,37.64,37.64,0,0,0,7.51,1.07,29.83,29.83,0,0,0,8.43-.91,30.29,30.29,0,0,0,8.25-3.52,34.3,34.3,0,0,0,7.09-5.76,35.91,35.91,0,0,0,5.52-7.68,34.89,34.89,0,0,0,3.34-9.15c.09-.41.18-.81.26-1.22l.18-1.22c.14-.81.19-1.63.27-2.45,0-.41,0-.81.06-1.22l0-1.23c0-.4,0-.8,0-1.21s0-.8-.06-1.2l-.1-1.2c0-.4-.1-.8-.15-1.19-.09-.8-.25-1.58-.4-2.35a35.17,35.17,0,0,0-3.09-8.78c-.35-.68-.7-1.35-1.1-2-.2-.32-.38-.65-.59-1l-.62-.93c-.2-.32-.43-.61-.65-.91s-.43-.59-.66-.88l-.7-.86-.35-.42-.36-.4-.73-.8L144,62.3c-.5-.52-1-1-1.56-1.46a34.5,34.5,0,0,0-6.78-4.65,33.89,33.89,0,0,0-7.19-2.79,34.53,34.53,0,0,0-7.07-1.07c-1.14-.06-2.26,0-3.34,0l-1.61.12c-.53,0-1.05.13-1.57.2s-1,.17-1.51.26l-.74.14-.73.17-1.41.37-1.35.42a33.3,33.3,0,0,0-4.8,2,32.13,32.13,0,0,0-6.78,4.71A33.61,33.61,0,0,0,94,64.54Z"
                transform="translate(-45.71 -52.29)"
              />
            </svg>
          </div>
          <div className="custom-sidebar-brand-info">
            <span className="custom-sidebar-brand-name">CoffeeBay</span>
            <span className="custom-sidebar-brand-sub">LUCKY CUP SYSTEM</span>
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
                {user.name || "Staff Member"}
              </span>
              <span className="custom-sidebar-user-role">{displayRole}</span>
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
