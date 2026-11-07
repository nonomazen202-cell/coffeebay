"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";

interface DrinkRewardsNavbarProps {
  onHomeClick?: () => void;
  onMenuClick?: () => void;
}

export function DrinkRewardsNavbar({
  onHomeClick,
  onMenuClick,
}: DrinkRewardsNavbarProps) {
  return (
    <header
      dir="ltr"
      className="w-full bg-[#FFFFFF] border-b border-slate-200/90 px-4 sm:px-8 py-3 select-none shadow-sm flex items-center justify-between z-40 relative"
    >
      {/* Left: Home Button */}
      <div className="flex items-center gap-4 z-10">
        <Link
          href="/"
          onClick={(e) => {
            if (onHomeClick) {
              e.preventDefault();
              onHomeClick();
            }
          }}
          title="الرئيسية"
          className="text-[#150958] hover:text-sky-600 transition-colors p-1"
        >
          <svg
            className="w-5 h-5 sm:w-6 sm:h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        </Link>
      </div>

      {/* Absolute Dead-Center: Coffee Bay Dark Navy Logo */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-36 sm:w-48 h-8 sm:h-9 pointer-events-none">
        <Image
          src="/drink-rewards/coffeebay-dark-logo.png"
          alt="Coffee Bay"
          fill
          priority
          className="object-contain"
        />
      </div>

      {/* Right Side: Menu Button */}
      <div className="flex items-center gap-3 z-10">
        <button
          type="button"
          onClick={onMenuClick}
          title="القائمة"
          className="text-[#150958] hover:text-sky-600 transition-colors cursor-pointer p-1"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
