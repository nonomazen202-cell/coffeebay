'use client';

import React, { useMemo } from 'react';

/**
 * Lightweight, zero-dependency QR Code generator in pure TypeScript/SVG.
 * Generates standards-compliant Version 2 (25x25) QR codes for voucher codes.
 */

// Galois Field GF(256) tables for Reed-Solomon error correction
const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = x;
    GF256_EXP[i + 255] = x;
    GF256_LOG[x] = i;
    x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF256_EXP[GF256_LOG[x] + GF256_LOG[y]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const factor = new Uint8Array([1, GF256_EXP[i]]);
    const nextPoly = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      nextPoly[j] ^= gfMul(poly[j], factor[0]);
      nextPoly[j + 1] ^= gfMul(poly[j], factor[1]);
    }
    poly = nextPoly;
  }
  return poly;
}

function rsCalculateEC(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGeneratorPoly(ecCount);
  const remainder = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    for (let j = 0; j < ecCount - 1; j++) {
      remainder[j] = remainder[j + 1] ^ gfMul(gen[j + 1], factor);
    }
    remainder[ecCount - 1] = gfMul(gen[ecCount], factor);
  }
  return remainder;
}

export interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
  bgColor?: string;
  fgColor?: string;
}

export function QrCode({
  value,
  size = 180,
  className = '',
  bgColor = '#FFFFFF',
  fgColor = '#211206',
}: QrCodeProps) {
  const matrix = useMemo(() => {
    // QR Version 2 (25x25) - Capacity: up to 28 bytes in Medium EC
    const dim = 25;
    const grid: number[][] = Array.from({ length: dim }, () => Array(dim).fill(-1));

    // Finder Patterns
    const placeFinder = (startX: number, startY: number) => {
      for (let y = -1; y <= 7; y++) {
        for (let x = -1; x <= 7; x++) {
          const px = startX + x;
          const py = startY + y;
          if (px >= 0 && px < dim && py >= 0 && py < dim) {
            if (
              (x >= 0 && x <= 6 && (y === 0 || y === 6)) ||
              (y >= 0 && y <= 6 && (x === 0 || x === 6)) ||
              (x >= 2 && x <= 4 && y >= 2 && y <= 4)
            ) {
              grid[py][px] = 1;
            } else {
              grid[py][px] = 0;
            }
          }
        }
      }
    };
    placeFinder(0, 0);
    placeFinder(dim - 7, 0);
    placeFinder(0, dim - 7);

    // Alignment Pattern at (18, 18) for Version 2
    for (let y = -2; y <= 2; y++) {
      for (let x = -2; x <= 2; x++) {
        const px = 18 + x;
        const py = 18 + y;
        if (x === -2 || x === 2 || y === -2 || y === 2 || (x === 0 && y === 0)) {
          grid[py][px] = 1;
        } else {
          grid[py][px] = 0;
        }
      }
    }

    // Timing Patterns
    for (let i = 8; i < dim - 8; i++) {
      grid[6][i] = i % 2 === 0 ? 1 : 0;
      grid[i][6] = i % 2 === 0 ? 1 : 0;
    }
    grid[dim - 8][8] = 1; // Dark Module

    // Reserve Format Info
    for (let i = 0; i < 9; i++) {
      if (grid[8][i] === -1) grid[8][i] = 0;
      if (grid[i][8] === -1) grid[i][8] = 0;
    }
    for (let i = dim - 8; i < dim; i++) {
      if (grid[8][i] === -1) grid[8][i] = 0;
      if (grid[i][8] === -1) grid[i][8] = 0;
    }

    // Prepare Data & Error Correction (Byte Mode)
    const rawBytes = new TextEncoder().encode(value);
    const dataLen = rawBytes.length;
    // Version 2-M has 28 data bytes, 16 EC bytes
    const bitBuffer: number[] = [];
    // Mode indicator: Byte mode (0100)
    bitBuffer.push(0, 1, 0, 0);
    // Character count indicator: 8 bits for Version 2
    for (let i = 7; i >= 0; i--) bitBuffer.push((dataLen >> i) & 1);
    // Data bytes
    for (let i = 0; i < dataLen; i++) {
      for (let b = 7; b >= 0; b--) bitBuffer.push((rawBytes[i] >> b) & 1);
    }
    // Terminator (up to 4 zeroes)
    while (bitBuffer.length < 28 * 8 && bitBuffer.length % 8 !== 0) bitBuffer.push(0);
    while (bitBuffer.length < 28 * 8 && bitBuffer.length < (dataLen + 2) * 8 + 4) bitBuffer.push(0);
    // Pad to byte
    while (bitBuffer.length % 8 !== 0) bitBuffer.push(0);
    // Pad bytes 0xEC, 0x11
    let padToggle = true;
    while (bitBuffer.length < 28 * 8) {
      const pad = padToggle ? 0xec : 0x11;
      padToggle = !padToggle;
      for (let b = 7; b >= 0; b--) bitBuffer.push((pad >> b) & 1);
    }

    const dataCodewords = new Uint8Array(28);
    for (let i = 0; i < 28; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bitBuffer[i * 8 + j];
      dataCodewords[i] = b;
    }

    const ecCodewords = rsCalculateEC(dataCodewords, 16);
    const allCodewords = new Uint8Array(44);
    allCodewords.set(dataCodewords, 0);
    allCodewords.set(ecCodewords, 28);

    // Place Bits in Matrix
    let byteIdx = 0;
    let bitIdx = 7;
    let upward = true;

    for (let right = dim - 1; right > 0; right -= 2) {
      if (right === 6) right--; // Skip vertical timing column
      const colPairs = [right, right - 1];

      for (let count = 0; count < dim; count++) {
        const y = upward ? dim - 1 - count : count;
        for (const x of colPairs) {
          if (grid[y][x] === -1) {
            let bit = 0;
            if (byteIdx < allCodewords.length) {
              bit = (allCodewords[byteIdx] >> bitIdx) & 1;
              bitIdx--;
              if (bitIdx < 0) {
                bitIdx = 7;
                byteIdx++;
              }
            }
            // Apply standard Mask 0: (row + col) % 2 === 0
            const mask = (y + x) % 2 === 0;
            grid[y][x] = mask ? bit ^ 1 : bit;
          }
        }
      }
      upward = !upward;
    }

    // Set Format Information for Medium EC (00) + Mask 0 (000) -> 00000 -> 0x5412 XOR -> 101010000010010
    const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
    const formatCoords = [
      [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
      [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
    ];
    for (let i = 0; i < 15; i++) {
      grid[formatCoords[i][0]][formatCoords[i][1]] = formatBits[i];
    }
    // Mirror format bits
    for (let i = 0; i < 8; i++) {
      grid[dim - 1 - i][8] = formatBits[i];
    }
    for (let i = 0; i < 7; i++) {
      grid[8][dim - 7 + i] = formatBits[8 + i];
    }

    return grid;
  }, [value]);

  const dim = matrix.length;
  const cellSize = 10;
  const quietZone = 2 * cellSize;
  const totalSize = dim * cellSize + 2 * quietZone;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${totalSize} ${totalSize}`}
      className={`rounded-xl shadow-inner ${className}`}
      style={{ backgroundColor: bgColor }}
    >
      <rect width={totalSize} height={totalSize} fill={bgColor} />
      {matrix.map((row, y) =>
        row.map((cell, x) =>
          cell === 1 ? (
            <rect
              key={`${x}-${y}`}
              x={quietZone + x * cellSize}
              y={quietZone + y * cellSize}
              width={cellSize}
              height={cellSize}
              fill={fgColor}
              rx={1.5}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
