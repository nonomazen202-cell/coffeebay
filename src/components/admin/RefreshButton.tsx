'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cooldown, setCooldown] = useState(false);

  const handleRefresh = () => {
    if (cooldown || isPending) return;

    startTransition(() => {
      router.refresh();
    });

    setCooldown(true);
    setTimeout(() => {
      setCooldown(false);
    }, 3000);
  };

  const isRefreshing = isPending || cooldown;

  return (
    <div className="futuristic-fab-container">
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className={`futuristic-fab ${isRefreshing ? 'refreshing' : ''} ${cooldown ? 'cooling-down' : ''}`}
      >
        <span className="icon-wrapper">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="sync-svg"
          >
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
        </span>
        <span className="fab-text">
          {isPending ? 'Syncing...' : ''}
        </span>
      </button>

      <style>{`
        .futuristic-fab-container {
          position: fixed;
          top: 2rem;
          right: 2rem;
          z-index: 99999;
          animation: float-bob 3s infinite alternate ease-in-out;
        }

        .futuristic-fab {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.95rem;
          background: #150958 !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
          border: 1px solid rgba(192, 192, 192, 0.45) !important;
          border-radius: 9999px !important;
          color: #FFFFFF !important;
          cursor: pointer;
          box-shadow: 0 6px 20px rgba(21, 9, 88, 0.25), inset 0 0 8px rgba(255, 255, 255, 0.08) !important;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
          outline: none;
        }

        .icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
        }

        .sync-svg {
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .fab-text {
          max-width: 0;
          opacity: 0;
          overflow: hidden;
          white-space: nowrap;
          font-size: 0.85rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          transition: max-width 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease, margin-left 0.4s !important;
        }

        /* Hover States - scale and glow only, no text expansion */
        .futuristic-fab:hover:not(:disabled) {
          color: #ffffff !important;
          border-color: #FFFFFF !important;
          background: #1E117A !important;
          box-shadow: 0 10px 28px rgba(21, 9, 88, 0.38) !important;
          transform: scale(1.05);
        }

        /* Active/Refreshing State - expands with text */
        .futuristic-fab.refreshing {
          background: #150958 !important;
          border-color: #C0C0C0 !important;
          color: #ffffff !important;
          padding: 0.95rem 1.6rem !important;
          box-shadow: 0 10px 30px rgba(21, 9, 88, 0.4) !important;
        }

        .futuristic-fab.refreshing .fab-text {
          max-width: 160px;
          opacity: 1;
          margin-left: 0.65rem;
        }

        .futuristic-fab.refreshing .sync-svg {
          animation: spin-animation 1s infinite linear;
        }

        /* Cooldown State - remains a compact circle */
        .futuristic-fab.cooling-down {
          background: #FFFFFF !important;
          border-color: #CBD5E1 !important;
          color: #150958 !important;
          cursor: not-allowed;
        }

        /* Keyframes */
        @keyframes float-bob {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-8px); }
        }

        @keyframes spin-animation {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
