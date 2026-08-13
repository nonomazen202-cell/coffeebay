import React from "react";
import Image from "next/image";

interface LogoProps {
  /** Controls rendered width in px */
  width?: number;
  /** Controls rendered height in px */
  height?: number;
  className?: string;
}

export function Logo({ width = 200, height = 60, className = "" }: LogoProps) {
  return (
    <Image
      src="/Coffee-bay-logo-cup.svg"
      alt="CoffeeBay Lucky Cup"
      width={width}
      height={height}
      priority
      className={className}
    />
  );
}
