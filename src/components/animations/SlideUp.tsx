'use client';

import { motion, type MotionProps } from 'framer-motion';
import React from 'react';

interface SlideUpProps extends MotionProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  distance?: number;
  className?: string;
  onScroll?: boolean;
}

export function SlideUp({
  children,
  delay = 0,
  duration = 0.6,
  distance = 24,
  className = '',
  onScroll = false,
  ...motionProps
}: SlideUpProps) {
  const initial = { opacity: 0, y: distance };
  const animate = { opacity: 1, y: 0 };
  const transition = { duration, delay, ease: [0.16, 1, 0.3, 1] as const };

  const viewportProps = onScroll
    ? { viewport: { once: true, margin: '-50px' } }
    : {};

  return (
    <motion.div
      initial={initial}
      animate={onScroll ? undefined : animate}
      whileInView={onScroll ? animate : undefined}
      transition={transition}
      className={className}
      {...viewportProps}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}
