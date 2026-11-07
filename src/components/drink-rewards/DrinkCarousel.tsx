"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Coffee } from "lucide-react";
import { averta } from "../../lib/fonts";

export interface DrinkItem {
  id: number | string;
  name: string;
  description?: string;
  imageUrl?: string | null;
  categoryId: number | string;
  categoryName: string;
}

export interface CategoryTab {
  id: number | string;
  name: string;
  slug: string;
}

export interface DrinkCarouselProps {
  drinks: DrinkItem[];
  categories?: CategoryTab[];
  selectedDrinkId: number | string | null;
  onSelectDrink: (drinkId: number | string) => void;
  disabled?: boolean;
}

/**
 * Computes the shortest signed circular offset from `activeIndex` to `index`
 * in the range [-floor(total/2), +floor(total/2)].
 */
function getCircularOffset(
  index: number,
  activeIndex: number,
  total: number,
): number {
  if (total <= 1) return 0;
  let diff = index - activeIndex;
  const half = Math.floor(total / 2);
  if (diff > half) diff -= total;
  if (diff < -half) diff += total;
  if (total % 2 === 0 && diff === -half) {
    diff = half;
  }
  return diff;
}

interface PyramidTransform {
  txPercent: number;
  tyPx: number;
  tzPx: number;
  scale: number;
  rotateYDeg: number;
  opacity: number;
  zIndex: number;
  pointerEvents: "auto" | "none";
}

function computePyramidTransform(
  offset: number,
  total: number,
  isMobile: boolean,
): PyramidTransform {
  // Single card: dead center apex
  if (total === 1) {
    return {
      txPercent: 0,
      tyPx: -4,
      tzPx: 0,
      scale: 1,
      rotateYDeg: 0,
      opacity: 1,
      zIndex: 30,
      pointerEvents: "auto",
    };
  }

  // Two cards: balanced front-apex + side-stepped pair
  if (total === 2) {
    if (offset === 0) {
      return {
        txPercent: isMobile ? -18 : -30,
        tyPx: -4,
        tzPx: 0,
        scale: 1,
        rotateYDeg: 4,
        opacity: 1,
        zIndex: 30,
        pointerEvents: "auto",
      };
    }
    return {
      txPercent: isMobile ? 48 : 52,
      tyPx: 14,
      tzPx: -50,
      scale: isMobile ? 0.86 : 0.84,
      rotateYDeg: -14,
      opacity: 0.9,
      zIndex: 20,
      pointerEvents: "auto",
    };
  }

  // For 3 or 4 drinks, show 3 symmetrical pyramid cards (-1, 0, +1).
  // For 5+ drinks, show 5 symmetrical pyramid cards (-2, -1, 0, +1, +2) on desktop, and 3 large close-up cards on mobile.
  const maxVisibleTier = total >= 5 && !isMobile ? 2 : 1;
  const absOffset = Math.abs(offset);

  if (offset === 0) {
    return {
      txPercent: 0,
      tyPx: isMobile ? -6 : -8,
      tzPx: 0,
      scale: 1,
      rotateYDeg: 0,
      opacity: 1,
      zIndex: 30,
      pointerEvents: "auto",
    };
  }

  if (absOffset === 1) {
    const sign = offset < 0 ? -1 : 1;
    return {
      txPercent: sign * (isMobile ? 64 : 88),
      tyPx: isMobile ? 14 : 14,
      tzPx: isMobile ? -45 : -55,
      scale: isMobile ? 0.86 : 0.87,
      rotateYDeg: -sign * 14,
      opacity: 0.92,
      zIndex: 20,
      pointerEvents: "auto",
    };
  }

  if (absOffset === 2 && maxVisibleTier >= 2) {
    const sign = offset < 0 ? -1 : 1;
    return {
      txPercent: sign * 164,
      tyPx: 28,
      tzPx: -115,
      scale: 0.75,
      rotateYDeg: -sign * 21,
      opacity: 0.76,
      zIndex: 10,
      pointerEvents: "auto",
    };
  }

  // Tucked cleanly behind the center pyramid apex
  const sign = offset < 0 ? -1 : 1;
  return {
    txPercent: sign * (isMobile ? 50 : 90),
    tyPx: 32,
    tzPx: -180,
    scale: 0.55,
    rotateYDeg: -sign * 25,
    opacity: 0,
    zIndex: 1,
    pointerEvents: "none",
  };
}

export function DrinkCarousel({
  drinks,
  selectedDrinkId,
  onSelectDrink,
  disabled = false,
}: DrinkCarouselProps) {
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  const total = drinks.length;
  const rawActiveIndex = drinks.findIndex(
    (d) => String(d.id) === String(selectedDrinkId),
  );
  const activeIndex = rawActiveIndex >= 0 ? rawActiveIndex : 0;

  const selectByStep = useCallback(
    (delta: number) => {
      if (disabled || total <= 1) return;
      const nextIndex = (activeIndex + delta + total) % total;
      const nextDrink = drinks[nextIndex];
      if (nextDrink) {
        onSelectDrink(nextDrink.id);
      }
    },
    [activeIndex, disabled, drinks, onSelectDrink, total],
  );

  // Keyboard Left/Right navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled || total <= 1) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        selectByStep(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        selectByStep(1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, selectByStep, total]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || total <= 1) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (
      disabled ||
      total <= 1 ||
      touchStartXRef.current === null ||
      touchStartYRef.current === null
    ) {
      return;
    }
    const dx = e.changedTouches[0].clientX - touchStartXRef.current;
    const dy = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (Math.abs(dx) > 32 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0) {
        selectByStep(1);
      } else {
        selectByStep(-1);
      }
    }
  };

  if (total === 0) {
    return (
      <div className="py-8 px-6 text-center bg-[#07113A]/75 border border-sky-400/30 rounded-3xl backdrop-blur-xl max-w-md mx-auto shadow-[0_0_30px_rgba(56,189,248,0.15)]">
        <p className="text-white font-bold text-sm">
          لم يتم تفعيل أصناف مشروبات متاحة في هذا التصنيف حالياً.
        </p>
      </div>
    );
  }

  return (
    <div
      dir="ltr"
      className="relative w-full flex flex-col items-center justify-center select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── 3D FRONT-PYRAMID STAGE ── */}
      <div className="relative w-full max-w-[1180px] mx-auto flex items-center justify-center overflow-visible">
        {/* Left Navigation Arrow (Hidden on mobile, visible on sm+) */}
        {total > 1 && (
          <button
            type="button"
            onClick={() => selectByStep(-1)}
            disabled={disabled}
            aria-label="Previous drink"
            className="
              hidden sm:flex
              absolute sm:left-2 md:left-3 lg:left-4 z-40
              sm:w-11 sm:h-11 rounded-full
              items-center justify-center
              bg-[#05103A]/90 border border-sky-400/60 text-sky-200
              shadow-[0_0_16px_rgba(56,189,248,0.45),inset_0_0_8px_rgba(56,189,248,0.25)]
              hover:bg-sky-500/25 hover:text-white hover:scale-110 active:scale-95
              transition-all duration-300 cursor-pointer disabled:opacity-40
            "
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.4} />
          </button>
        )}

        {/* 3D Perspective Viewport (Larger on mobile & scaled up prominently on desktop) */}
        <div
          className="relative w-full h-[340px] xs:h-[356px] sm:h-[350px] md:h-[385px] lg:h-[410px] overflow-visible"
          style={{ perspective: "1200px" }}
        >
          {drinks.map((drink, index) => {
            const offset = getCircularOffset(index, activeIndex, total);
            const isSelected = offset === 0;
            const t = computePyramidTransform(offset, total, isMobile);

            return (
              <div
                key={drink.id}
                role="button"
                tabIndex={t.opacity > 0 ? 0 : -1}
                aria-pressed={isSelected}
                aria-label={drink.name}
                onClick={() => {
                  if (!disabled && t.pointerEvents === "auto") {
                    onSelectDrink(drink.id);
                  }
                }}
                onKeyDown={(e) => {
                  if (
                    !disabled &&
                    t.pointerEvents === "auto" &&
                    (e.key === "Enter" || e.key === " ")
                  ) {
                    e.preventDefault();
                    onSelectDrink(drink.id);
                  }
                }}
                className={`
                  group absolute
                  w-[210px] xs:w-[222px] sm:w-[205px] md:w-[228px] lg:w-[244px]
                  h-[322px] xs:h-[338px] sm:h-[320px] md:h-[355px] lg:h-[378px]
                  rounded-[24px] sm:rounded-[26px] lg:rounded-[28px] overflow-hidden
                  cursor-pointer select-none
                  transition-[transform,opacity,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]
                  ${
                    isSelected
                      ? "border-2 border-[#38bdf8] shadow-[0_0_16px_rgba(56,189,248,0.65),0_0_30px_rgba(14,165,233,0.32),inset_0_0_12px_rgba(56,189,248,0.22)] ring-1 ring-sky-200/35"
                      : "border border-sky-300/30 shadow-[0_14px_30px_rgba(2,8,35,0.85)] hover:border-sky-300/70"
                  }
                  ${disabled ? "cursor-not-allowed" : ""}
                `}
                style={{
                  left: "50%",
                  top: "50%",
                  zIndex: t.zIndex,
                  opacity: disabled ? t.opacity * 0.65 : t.opacity,
                  pointerEvents: t.pointerEvents,
                  transform: `translate3d(calc(-50% + ${t.txPercent}%), calc(-50% + ${t.tyPx}px), ${t.tzPx}px) scale(${t.scale}) rotateY(${t.rotateYDeg}deg)`,
                  backgroundImage: "url('/drink-rewards/drink-card-bg.png')",
                  backgroundSize: "cover",
                  backgroundPosition: "center bottom",
                  transformStyle: "preserve-3d",
                  willChange: "transform, opacity",
                }}
              >
                {/* Top Metallic Specular Highlight on Selected Apex Card */}
                {isSelected && (
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-sky-300/15 via-sky-400/5 to-transparent z-10" />
                )}

                {/* Radio / Checkmark Indicator in Top-Right Corner */}
                <div className="absolute top-3 right-3 sm:top-3.5 sm:right-3.5 z-20">
                  {isSelected ? (
                    <div className="w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-full bg-[#0ea5e9] text-white flex items-center justify-center shadow-[0_0_12px_#38bdf8] border border-white/90">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full border-2 border-sky-200/45 bg-black/25 transition-colors group-hover:border-sky-300" />
                  )}
                </div>

                {/* Real Drink PNG from Payload CMS standing on the circular stage */}
                <div className="absolute inset-x-0 bottom-12 top-6 sm:bottom-14 sm:top-7 flex items-center justify-center px-2 pointer-events-none z-10">
                  <div className="relative w-full h-full max-h-[228px] xs:max-h-[240px] sm:max-h-[222px] md:max-h-[250px] lg:max-h-[268px] flex items-center justify-center">
                    {drink.imageUrl ? (
                      <Image
                        src={drink.imageUrl}
                        alt={drink.name}
                        fill
                        priority={isSelected || Math.abs(offset) === 1}
                        sizes="(max-width: 640px) 222px, (max-width: 1024px) 228px, 244px"
                        className={`object-contain drop-shadow-[0_16px_14px_rgba(0,0,0,0.85)] transition-transform duration-500 ${
                          isSelected
                            ? "scale-110 -translate-y-1"
                            : "scale-95 group-hover:scale-100"
                        }`}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-sky-400/60 p-2 text-center">
                        <Coffee className="w-10 h-10 mb-1 text-sky-300/70" />
                        <span className="text-[10px] font-bold text-sky-200">
                          Coffee Bay
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Drink Name */}
                <div className="absolute inset-x-0 bottom-0 pt-5 pb-3 sm:pb-3.5 px-2.5 z-20 text-center bg-gradient-to-t from-[#020824]/95 via-[#020824]/55 to-transparent">
                  <h4
                    dir="auto"
                    className={`${averta.className} font-semibold text-xs xs:text-[13px] sm:text-sm md:text-[15px] leading-tight tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] line-clamp-2 ${
                      isSelected ? "text-white" : "text-sky-100/85"
                    }`}
                  >
                    {drink.name}
                  </h4>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Navigation Arrow (Hidden on mobile, visible on sm+) */}
        {total > 1 && (
          <button
            type="button"
            onClick={() => selectByStep(1)}
            disabled={disabled}
            aria-label="Next drink"
            className="
              hidden sm:flex
              absolute sm:right-2 md:right-3 lg:right-4 z-40
              sm:w-11 sm:h-11 rounded-full
              items-center justify-center
              bg-[#05103A]/90 border border-sky-400/60 text-sky-200
              shadow-[0_0_16px_rgba(56,189,248,0.45),inset_0_0_8px_rgba(56,189,248,0.25)]
              hover:bg-sky-500/25 hover:text-white hover:scale-110 active:scale-95
              transition-all duration-300 cursor-pointer disabled:opacity-40
            "
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.4} />
          </button>
        )}
      </div>

      {/* ── PAGINATION DOTS ── */}
      {total > 1 && (
        <div className="mt-1.5 sm:mt-1.5 flex items-center justify-center gap-1.5 z-30">
          {drinks.map((drink, idx) => {
            const isCurrent = idx === activeIndex;
            return (
              <button
                key={drink.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelectDrink(drink.id)}
                aria-label={`Select ${drink.name}`}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  isCurrent
                    ? "w-6 bg-[#38bdf8] shadow-[0_0_10px_#38bdf8]"
                    : "w-1.5 bg-sky-300/35 hover:bg-sky-300/70"
                }`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
