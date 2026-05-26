import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

for (const name of ['pdf-empty.png', 'pdf-momo.png', 'pdf-full.png']) {
  const fromPublic = path.resolve('public/momo', name);
  if (fs.existsSync(fromPublic)) {
    fs.copyFileSync(fromPublic, path.resolve('src/assets/momo', name));
  }
}

if (!process.env.VITE_UI_BUILD_ID) {
  process.env.VITE_UI_BUILD_ID = 'dev-local';
}

if (!process.env.VITE_BUILD_TIME) {
  process.env.VITE_BUILD_TIME = new Date().toISOString();
}

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
  server: {
    // localhost(IPv6 ::1) + 127.0.0.1 + LAN — Windows 연결 거부 방지
    host: true,
    port: 5173,
    strictPort: false,
    open: '/',
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: false,
  },
  optimizeDeps: {
    include: ['pdfjs-dist/legacy/build/pdf.mjs'],
  },
});
