'use client';

import { motion, type MotionProps } from 'framer-motion';
import React from 'react';

interface FadeInProps extends MotionProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  /** If true, animation only plays when element enters viewport */
  onScroll?: boolean;
}

export function FadeIn({
  children,
  delay = 0,
  duration = 0.5,
  className = '',
  onScroll = false,
  ...motionProps
}: FadeInProps) {
  const viewportProps = onScroll
    ? { viewport: { once: true, margin: '-50px' } }
    : {};

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={onScroll ? undefined : { opacity: 1 }}
      whileInView={onScroll ? { opacity: 1 } : undefined}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
      {...viewportProps}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}
