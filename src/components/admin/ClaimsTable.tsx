"use client";

import React, { useState } from "react";
import type { PrizeClaim, Entry, Participant, Prize, Code } from "@/payload-types";

interface ClaimsTableProps {
  initialClaims: PrizeClaim[];
}

export function ClaimsTable({ initialClaims }: ClaimsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "PENDING" | "DELIVERED" | "CANCELLED"
  >("ALL");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const ITEMS_PER_PAGE = 10;

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode(null);
    }, 1500);
  };

  // Client-side filtering logic
  const filteredClaims = initialClaims.filter((claim) => {
    const entry = claim.entry && typeof claim.entry === "object" ? (claim.entry as Entry) : undefined;
    const participant = entry?.participant && typeof entry.participant === "object" ? (entry.participant as Participant) : undefined;
    const code = entry?.code && typeof entry.code === "object" ? (entry.code as Code) : undefined;
    const prize = code?.prize_id && typeof code.prize_id === "object" ? (code.prize_id as Prize) : undefined;

    // Check virtual properties from read hook, fallback to populated fields
    const participantName =
      claim.participant_name || participant?.name || "Unknown";
    const participantPhone =
      claim.participant_phone || participant?.phone || "";
    const prizeName = prize?.name || "Coupon";
    const verificationCode = claim.verification_code || "";

    const matchesSearch =
      participantName.toLowerCase().includes(search.toLowerCase()) ||
      participantPhone.toLowerCase().includes(search.toLowerCase()) ||
      prizeName.toLowerCase().includes(search.toLowerCase()) ||
      verificationCode.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || claim.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredClaims.length / ITEMS_PER_PAGE);
  const displayedClaims = filteredClaims.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredClaims.length);

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "1rem",
        padding: "1.75rem",
        marginTop: "1.5rem",
        marginBottom: "3.5rem",
        boxShadow: "0 4px 16px rgba(21, 9, 88, 0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: "700",
              color: "#150958",
              margin: 0,
            }}
          >
            Recent Prize Claims
          </h2>
          <p
            style={{
              fontSize: "0.85rem",
              color: "#64748B",
              margin: "0.25rem 0 0 0",
            }}
          >
            Showing {filteredClaims.length > 0 ? `${startIndex + 1}-${endIndex}` : "0"} of {filteredClaims.length} total
            prize claims registered.
          </p>
        </div>

        {/* Filter and Search controls */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
            alignItems: "center",
            width: "100%",
            maxWidth: "500px",
          }}
        >
          {/* Smart Search Input with Icons */}
          <div style={{ position: "relative", flex: "1", minWidth: "220px" }}>
            <span
              style={{
                position: "absolute",
                left: "0.85rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#64748B",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search winner, phone, email, code..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: "100%",
                backgroundColor: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: "9999px",
                padding: "0.55rem 2.25rem 0.55rem 2.35rem",
                fontSize: "0.875rem",
                color: "#1E293B",
                outline: "none",
                transition: "all 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#150958")}
              onBlur={(e) => (e.target.style.borderColor = "#CBD5E1")}
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setCurrentPage(1);
                }}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#64748B",
                  cursor: "pointer",
                  padding: "0.125rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#150958")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#64748B")}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <select
            value={statusFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setStatusFilter(e.target.value as "ALL" | "PENDING" | "DELIVERED" | "CANCELLED");
              setCurrentPage(1);
            }}
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #CBD5E1",
              borderRadius: "9999px",
              padding: "0.55rem 2rem 0.55rem 1rem",
              fontSize: "0.875rem",
              color: "#150958",
              fontWeight: "600",
              outline: "none",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#150958")}
            onBlur={(e) => (e.target.style.borderColor = "#CBD5E1")}
          >
            <option value="ALL" style={{ backgroundColor: "#FFFFFF", color: "#1E293B" }}>
              All Statuses
            </option>
            <option value="PENDING" style={{ backgroundColor: "#FFFFFF", color: "#1E293B" }}>
              PENDING
            </option>
            <option value="DELIVERED" style={{ backgroundColor: "#FFFFFF", color: "#1E293B" }}>
              DELIVERED
            </option>
            <option value="CANCELLED" style={{ backgroundColor: "#FFFFFF", color: "#1E293B" }}>
              CANCELLED
            </option>
          </select>
        </div>
      </div>

      {filteredClaims.length === 0 ? (
        <div
          style={{
            padding: "3rem 2rem",
            textAlign: "center",
            color: "#64748B",
            fontSize: "0.875rem",
            border: "1px dashed #CBD5E1",
            borderRadius: "0.75rem",
            backgroundColor: "#F8FAFC",
          }}
        >
          No matching prize claims found.
        </div>
      ) : (
        /* Scrollable container */
        <div
          style={{
            maxHeight: "450px",
            overflowY: "auto",
            border: "1px solid #E2E8F0",
            borderRadius: "0.75rem",
            backgroundColor: "#FFFFFF",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.875rem",
              color: "#1E293B",
              textAlign: "left",
            }}
          >
            <thead
              style={{
                position: "sticky",
                top: 0,
                backgroundColor: "#150958",
                zIndex: 1,
              }}
            >
              <tr style={{ color: "#FFFFFF", fontWeight: "700" }}>
                <th style={{ padding: "0.875rem 1rem" }}>Winner Details</th>
                <th style={{ padding: "0.875rem 1rem" }}>Verification Code</th>
                <th style={{ padding: "0.875rem 1rem" }}>Prize Item</th>
                <th style={{ padding: "0.875rem 1rem" }}>Status</th>
                <th style={{ padding: "0.875rem 1rem", textAlign: "right" }}>
                  Claimed Date
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedClaims.map((claim: PrizeClaim) => {
                const entry = claim.entry && typeof claim.entry === "object" ? (claim.entry as Entry) : undefined;
                const participant = entry?.participant && typeof entry.participant === "object" ? (entry.participant as Participant) : undefined;
                const code = entry?.code && typeof entry.code === "object" ? (entry.code as Code) : undefined;
                const prize = code?.prize_id && typeof code.prize_id === "object" ? (code.prize_id as Prize) : undefined;

                const participantName =
                  claim.participant_name ||
                  participant?.name ||
                  "Unknown";
                const participantPhone =
                  claim.participant_phone || participant?.phone || "";
                const prizeName = prize?.name || "Coupon";

                return (
                  <tr
                    key={claim.id}
                    style={{
                      borderBottom: "1px solid #EEF2F6",
                      transition: "background-color 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        "#F8FAFC";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        "transparent";
                    }}
                  >
                    {/* Winner Info Column with details */}
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <div style={{ fontWeight: "700", color: "#1E293B" }}>
                        {participantName}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.25rem",
                          marginTop: "0.35rem",
                        }}
                      >

                        {participantPhone && (
                          <span
                            style={{
                              fontSize: "0.8rem",
                              color: "#64748B",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.35rem",
                            }}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ opacity: 0.7 }}
                            >
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                            {participantPhone}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Verification Code with interactive Copy Button */}
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <code
                          style={{
                            backgroundColor: "#EEF2FF",
                            padding: "0.25rem 0.6rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #C7D2FE",
                            color: "#150958",
                            fontFamily: "monospace",
                            fontWeight: "700",
                            fontSize: "0.85rem",
                          }}
                        >
                          {claim.verification_code}
                        </code>
                        <button
                          onClick={() => handleCopy(claim.verification_code)}
                          title="Copy Verification Code"
                          style={{
                            background: "none",
                            border: "none",
                            color:
                              copiedCode === claim.verification_code
                                ? "#150958"
                                : "#64748B",
                            cursor: "pointer",
                            padding: "0.25rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "0.25rem",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            if (copiedCode !== claim.verification_code) {
                              e.currentTarget.style.color = "#150958";
                              e.currentTarget.style.backgroundColor =
                                "#EEF2FF";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (copiedCode !== claim.verification_code) {
                              e.currentTarget.style.color = "#64748B";
                            }
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                          }}
                        >
                          {copiedCode === claim.verification_code ? (
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
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect
                                width="14"
                                height="14"
                                x="8"
                                y="8"
                                rx="2"
                                ry="2"
                              />
                              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Prize Item Name (Primary Deep Blue Highlight) */}
                    <td
                      style={{
                        padding: "0.875rem 1rem",
                        color: "#150958",
                        fontWeight: "700",
                      }}
                    >
                      {prizeName}
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: "700",
                          padding: "0.2rem 0.65rem",
                          borderRadius: "9999px",
                          backgroundColor:
                            claim.status === "DELIVERED"
                              ? "#DCFCE7"
                              : claim.status === "CANCELLED"
                                ? "#F1F5F9"
                                : "#FEF3C7",
                          color:
                            claim.status === "DELIVERED"
                              ? "#15803D"
                              : claim.status === "CANCELLED"
                                ? "#64748B"
                                : "#92400E",
                        }}
                      >
                        {claim.status}
                      </span>
                    </td>

                    {/* Claim Date */}
                    <td
                      style={{
                        padding: "0.875rem 1rem",
                        textAlign: "right",
                        color: "#64748B",
                        fontSize: "0.8rem",
                      }}
                    >
                      <div>{new Date(claim.createdAt).toLocaleString()}</div>
                      {claim.status === "DELIVERED" && claim.verified_at && (
                        <div style={{ color: "#15803D", marginTop: "0.25rem", fontSize: "0.75rem", fontWeight: "700" }}>
                          Delivered: {new Date(claim.verified_at).toLocaleString()}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Client-side Pagination Controls */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "1.25rem",
            paddingTop: "1rem",
            borderTop: "1px solid #E2E8F0",
          }}
        >
          <span style={{ fontSize: "0.85rem", color: "#64748B", fontWeight: "500" }}>
            Page <strong style={{ color: "#150958" }}>{currentPage}</strong> of <strong style={{ color: "#150958" }}>{totalPages}</strong>
          </span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              style={{
                padding: "0.45rem 0.95rem",
                borderRadius: "9999px",
                fontSize: "0.8rem",
                fontWeight: "700",
                backgroundColor: currentPage === 1 ? "#F8FAFC" : "#FFFFFF",
                color: currentPage === 1 ? "#94A3B8" : "#150958",
                border: `1px solid ${currentPage === 1 ? "#E2E8F0" : "#CBD5E1"}`,
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              style={{
                padding: "0.45rem 0.95rem",
                borderRadius: "9999px",
                fontSize: "0.8rem",
                fontWeight: "700",
                backgroundColor: currentPage === totalPages ? "#F8FAFC" : "#FFFFFF",
                color: currentPage === totalPages ? "#94A3B8" : "#150958",
                border: `1px solid ${currentPage === totalPages ? "#E2E8F0" : "#CBD5E1"}`,
                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
