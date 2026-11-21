import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Strict Content-Security-Policy for the production build (GitHub Pages cannot send headers, so it goes in a <meta>).
// Only our own scripts may run; network access is limited to the two AI providers the user can choose.
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' https://generativelanguage.googleapis.com https://api.groq.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  'upgrade-insecure-requests'
].join('; ');

const securityHeaders = () => ({
  name: 'celpip-guru-security-meta',
  apply: 'build',
  transformIndexHtml: html => html.replace('<head>', `<head>\n  <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n  <meta name="referrer" content="strict-origin-when-cross-origin" />`)
});

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), securityHeaders()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 900, sourcemap: false }
});
