'use client';

import { motion, AnimatePresence } from 'framer-motion';
import React from 'react';

type RevealState = 'idle' | 'revealing' | 'win' | 'lose' | 'invalid' | 'used';

interface RevealCardProps {
  state: RevealState;
  children: React.ReactNode;
  className?: string;
}

const variants = {
  hidden:   { opacity: 0, scale: 0.9, y: 20 },
  visible:  { opacity: 1, scale: 1,   y: 0  },
  exit:     { opacity: 0, scale: 0.95, y: -10 },
};

export function RevealCard({ state, children, className = '' }: RevealCardProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state}
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={variants}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
