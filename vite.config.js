import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
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
    include: ['pdfjs-dist'],
  },
});
