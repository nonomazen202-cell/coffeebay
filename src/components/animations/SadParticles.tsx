'use client';

import React, { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  scale: number;
  duration: number;
  delay: number;
  opacity: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -10 - Math.random() * 20,
    scale: 0.4 + Math.random() * 0.8, // Elegant small sizes
    duration: 6 + Math.random() * 4, // Very slow, moody fall
    delay: Math.random() * 5,
    opacity: 0.05 + Math.random() * 0.15, // Extremely subtle background integration
  }));
}

interface SadParticlesProps {
  count?: number;
  active?: boolean;
}

export function SadParticles({
  count = 30,
  active = true,
}: SadParticlesProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);
  }, []);

  useEffect(() => {
    if (active && !prefersReduced) {
      setParticles(generateParticles(count));
    }
  }, [active, count, prefersReduced]);

  if (!active || prefersReduced || particles.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden z-0"
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute select-none pointer-events-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            opacity: p.opacity,
            transform: `scale(${p.scale})`,
            animation: `sad-drop-fall ${p.duration}s ${p.delay}s linear infinite`,
          }}
        >
          {/* Minimalist SVG Droplet */}
          <svg
            width="10"
            height="15"
            viewBox="0 0 10 15"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-cb-brown-light"
          >
            <path
              d="M5 0C5 0 10 5.6 10 8.75C10 11.6 7.76 13.9 5 13.9C2.24 13.9 0 11.6 0 8.75C0 5.6 5 0 5 0Z"
              fill="currentColor"
            />
          </svg>
        </div>
      ))}
      <style>{`
        @keyframes sad-drop-fall {
          0%   { transform: translateY(0) scale(var(--scale, 1)); opacity: 0; }
          15%  { opacity: var(--opacity, 0.15); }
          85%  { opacity: var(--opacity, 0.15); }
          100% { transform: translateY(115vh) scale(var(--scale, 1)); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
