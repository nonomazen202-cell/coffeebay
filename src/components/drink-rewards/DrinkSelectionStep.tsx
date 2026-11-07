"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import type { PublicCampaignData } from "../../services/drink-rewards/drink-campaign-service";
import { DrinkCarousel } from "./DrinkCarousel";
import { averta, recoleta, recoletaStyle } from "../../lib/fonts";

interface DrinkSelectionStepProps {
  drinks: PublicCampaignData["drinks"];
  categories: PublicCampaignData["categories"];
  selectedDrinkId: number | string | null;
  onSelectDrink: (id: number | string) => void;
  selectedDrinkName: string;
  onClaimVoucher: () => void;
  loading: boolean;
}

export function DrinkSelectionStep({
  drinks,
  categories,
  selectedDrinkId,
  onSelectDrink,
  selectedDrinkName,
  onClaimVoucher,
  loading,
}: DrinkSelectionStepProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<string>("ALL");

  const categoriesWithCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const drink of drinks) {
      const key = String(drink.categoryId);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return categories
      .map((cat) => ({
        ...cat,
        count: counts.get(String(cat.id)) || 0,
      }))
      .filter((cat) => cat.count > 0);
  }, [categories, drinks]);

  useEffect(() => {
    if (
      activeCategoryId !== "ALL" &&
      !categoriesWithCounts.some((c) => String(c.id) === activeCategoryId)
    ) {
      setActiveCategoryId("ALL");
    }
  }, [activeCategoryId, categoriesWithCounts]);

  const filteredDrinks = useMemo(() => {
    if (activeCategoryId === "ALL") return drinks;
    return drinks.filter((d) => String(d.categoryId) === activeCategoryId);
  }, [activeCategoryId, drinks]);

  const selectedDrinkObj = useMemo(
    () => drinks.find((d) => String(d.id) === String(selectedDrinkId)) || null,
    [drinks, selectedDrinkId],
  );

  const handleCategoryClick = (categoryId: string) => {
    if (loading) return;
    setActiveCategoryId(categoryId);
    const nextList =
      categoryId === "ALL"
        ? drinks
        : drinks.filter((d) => String(d.categoryId) === categoryId);
    if (
      nextList.length > 0 &&
      !nextList.some((d) => String(d.id) === String(selectedDrinkId))
    ) {
      onSelectDrink(nextList[0].id);
    }
  };

  const handleQuickSwitchInDock = (delta: number) => {
    if (loading || filteredDrinks.length <= 1) return;
    const currentIdx = filteredDrinks.findIndex(
      (d) => String(d.id) === String(selectedDrinkId),
    );
    const baseIdx = currentIdx >= 0 ? currentIdx : 0;
    const nextIdx =
      (baseIdx + delta + filteredDrinks.length) % filteredDrinks.length;
    const nextDrink = filteredDrinks[nextIdx];
    if (nextDrink) {
      onSelectDrink(nextDrink.id);
    }
  };

  return (
    <div
      className={`w-full flex-1 sm:flex-initial max-w-7xl mx-auto px-2 sm:px-6 pt-0 pb-2 sm:py-3 flex flex-col items-center justify-between sm:justify-center animate-fadeIn ${averta.className}`}
    >
      {/* ── 1 & 2. TOP BLOCK: HEADER + CATEGORY TABS ── */}
      <div className="w-full flex flex-col items-center z-20 mt-9 xs:mt-10 sm:mt-2 md:mt-2 mb-4 xs:mb-5 sm:mb-7">
        <div
          className={`text-center space-y-1 ${
            categoriesWithCounts.length > 0 ? "mb-2.5 sm:mb-3" : "mb-0"
          } px-3`}
        >
          <h2
            style={recoletaStyle}
            className={`${recoleta.className} text-2xl xs:text-[26px] sm:text-3xl md:text-4xl font-bold text-white tracking-[0.03em] sm:tracking-[0.04em] uppercase leading-tight drop-shadow-[0_6px_26px_rgba(0,4,24,0.92)]`}
          >
            CHOOSE YOUR TREAT
          </h2>
          <p
            className={`${averta.className} text-xs sm:text-sm md:text-[15px] text-white/90 font-semibold tracking-[0.01em] drop-shadow-[0_2px_12px_rgba(0,4,24,0.92)]`}
          >
            Pick one from the available rewards.
          </p>
        </div>

        {categoriesWithCounts.length > 0 && (
          <div
            dir="ltr"
            className="w-full max-w-2xl mx-auto px-3 flex items-center justify-center flex-wrap gap-1.5 sm:gap-2"
          >
            {categoriesWithCounts.length > 1 && (
              <button
                type="button"
                disabled={loading}
                onClick={() => handleCategoryClick("ALL")}
                className={`${averta.className} px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold tracking-wide transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${
                  activeCategoryId === "ALL"
                    ? "bg-sky-500/30 text-white border border-[#38bdf8] shadow-[0_0_14px_rgba(56,189,248,0.55),inset_0_0_8px_rgba(56,189,248,0.3)]"
                    : "bg-[#05103A]/75 text-sky-200/80 border border-sky-400/25 hover:border-sky-300/60 hover:text-white"
                }`}
              >
                <span>All Categories</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-400/20 text-sky-200">
                  {drinks.length}
                </span>
              </button>
            )}

            {categoriesWithCounts.map((cat) => {
              const isActiveCat =
                categoriesWithCounts.length === 1 ||
                activeCategoryId === String(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    handleCategoryClick(
                      categoriesWithCounts.length === 1
                        ? "ALL"
                        : String(cat.id),
                    )
                  }
                  className={`${averta.className} px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold tracking-wide transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${
                    isActiveCat
                      ? "bg-sky-500/30 text-white border border-[#38bdf8] shadow-[0_0_14px_rgba(56,189,248,0.55),inset_0_0_8px_rgba(56,189,248,0.3)]"
                      : "bg-[#05103A]/75 text-sky-200/80 border border-sky-400/25 hover:border-sky-300/60 hover:text-white"
                  }`}
                >
                  <span dir="auto">{cat.name}</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-400/20 text-sky-200">
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 3. 3D FRONT-PYRAMID CARDS SLIDER (Centered with open breathing room) ── */}
      <div className="w-full z-20 my-auto sm:my-0">
        <DrinkCarousel
          drinks={filteredDrinks}
          categories={categories}
          selectedDrinkId={selectedDrinkId}
          onSelectDrink={onSelectDrink}
          disabled={loading}
        />
      </div>

      {/* ── 4. COMPACT SELECTED DRINK HUD & CONFIRMATION DOCK ── */}
      <div
        className={`w-full max-w-[330px] xs:max-w-[360px] sm:max-w-[410px] mx-auto mt-3 xs:mt-4 sm:mt-3 md:mt-3.5 mb-4 xs:mb-5 sm:mb-2 px-3 z-20 flex flex-col items-center gap-2 sm:gap-2.5 ${averta.className}`}
      >
        {/* Sleek, Compact Selected Drink Capsule (without redundant category badge) */}
        <div
          dir="ltr"
          className="w-full px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl sm:rounded-2xl bg-[#05103A]/80 border border-sky-400/30 shadow-[0_8px_24px_rgba(0,0,0,0.6),0_0_16px_rgba(56,189,248,0.14)] backdrop-blur-xl flex items-center justify-between gap-2"
        >
          {filteredDrinks.length > 1 ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickSwitchInDock(-1)}
              aria-label="Previous drink"
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center bg-sky-500/15 border border-sky-400/30 text-sky-200 hover:bg-sky-500/30 hover:text-white active:scale-95 transition-all cursor-pointer flex-shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-sky-400 flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          )}

          <div className="flex-1 min-w-0 text-center px-1">
            <div
              dir="auto"
              className={`${averta.className} font-bold text-white text-xs sm:text-[13.5px] truncate max-w-full leading-snug drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]`}
            >
              {selectedDrinkObj ? selectedDrinkObj.name : selectedDrinkName}
            </div>

            {selectedDrinkObj?.description && (
              <p
                dir="auto"
                className={`${averta.className} mt-0.5 text-[10.5px] sm:text-[11.5px] font-normal text-sky-100/75 line-clamp-1 leading-tight`}
              >
                {selectedDrinkObj.description}
              </p>
            )}
          </div>

          {filteredDrinks.length > 1 ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickSwitchInDock(1)}
              aria-label="Next drink"
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center bg-sky-500/15 border border-sky-400/30 text-sky-200 hover:bg-sky-500/30 hover:text-white active:scale-95 transition-all cursor-pointer flex-shrink-0"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="w-6 h-6 sm:w-7 sm:h-7 flex-shrink-0" />
          )}
        </div>

        {/* Iconic Metallic Neon Confirm Pill Button */}
        <button
          type="button"
          onClick={onClaimVoucher}
          disabled={loading || !selectedDrinkId}
          className={`
            w-full sm:w-auto sm:min-w-[300px] px-8 sm:px-12 py-3 sm:py-3.5
            rounded-full font-extrabold uppercase tracking-[0.14em] text-xs sm:text-sm
            text-white transition-all duration-300 cursor-pointer
            flex items-center justify-center gap-2.5
            bg-gradient-to-r from-[#040c2e] via-[#0a1e63] to-[#040c2e]
            border-2 border-[#38bdf8]
            shadow-[0_0_22px_rgba(56,189,248,0.8),0_8px_25px_rgba(0,0,0,0.75),inset_0_0_14px_rgba(56,189,248,0.45)]
            hover:shadow-[0_0_32px_rgba(56,189,248,1),0_10px_30px_rgba(0,0,0,0.85),inset_0_0_18px_rgba(56,189,248,0.65)]
            hover:scale-[1.02] active:scale-[0.98]
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100
          `}
        >
          {loading ? (
            <>
              <svg
                className="animate-spin w-4 h-4 text-sky-300"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span>جاري تأكيد مشروبك...</span>
            </>
          ) : (
            <>
              <span>CONFIRM MY DRINK</span>
              <span className="text-sky-300 text-base sm:text-lg leading-none font-black">
                →
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
