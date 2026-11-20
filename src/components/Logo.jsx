import React from 'react';
import { motion } from 'framer-motion';

export function Logo({ size = 34 }) {
  return (
    <motion.svg width={size} height={size} viewBox="0 0 64 64" whileHover={{ rotate: -8, scale: 1.06 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }}>
      <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6366f1" /><stop offset="1" stopColor="#06b6d4" /></linearGradient></defs>
      <rect width="64" height="64" rx="16" fill="url(#lg)" />
      <motion.path d="M16 42 L26 26 L36 38 L48 20" stroke="white" strokeWidth="5.5" fill="none" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: 'easeInOut' }} />
      <circle cx="48" cy="20" r="4.5" fill="white" />
    </motion.svg>
  );
}
