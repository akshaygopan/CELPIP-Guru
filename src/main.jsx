import React from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import App from './App.jsx';
import './index.css';

// reducedMotion="user" turns big animations off for people who ask their OS for less motion.
createRoot(document.getElementById('root')).render(
  <MotionConfig reducedMotion="user"><App /></MotionConfig>
);
