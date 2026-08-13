'use client';

import React, { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
  rotation: number;
}

const COLORS = ['#2BA8E0', '#7B3B1B', '#5fc0ea', '#F5F0EB', '#a0522d'];

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -10 - Math.random() * 25,
    size: 4 + Math.random() * 7,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    duration: 5.5 + Math.random() * 4.5, // Slower, highly dramatic waterfall fall
    delay: Math.random() * 4.5,          // Spawn staggered up to 4.5 seconds
    rotation: Math.random() * 360,
  }));
}

interface CelebrationParticlesProps {
  count?: number;
  active?: boolean;
}

export function CelebrationParticles({
  count = 40,
  active = true,
}: CelebrationParticlesProps) {
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
      className="fixed inset-0 pointer-events-none overflow-hidden z-50"
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg)`,
            animation: `particle-fall ${p.duration}s ${p.delay}s ease-in infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes particle-fall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
