import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

for (const name of ['pdf-empty.png', 'pdf-momo.png', 'pdf-full.png']) {
  const fromPublic = path.resolve('public/momo', name);
  if (fs.existsSync(fromPublic)) {
    fs.copyFileSync(fromPublic, path.resolve('src/assets/momo', name));
  }
}

const welcomeLibraryPublic = path.resolve('public/welcome/welcome_library_16.png');
if (fs.existsSync(welcomeLibraryPublic)) {
  fs.copyFileSync(
    welcomeLibraryPublic,
    path.resolve('src/assets/welcome/welcome_library_16.png'),
  );
}

if (!process.env.VITE_UI_BUILD_ID) {
  process.env.VITE_UI_BUILD_ID = 'dev-local';
}

if (!process.env.VITE_BUILD_TIME) {
  process.env.VITE_BUILD_TIME = new Date().toISOString();
}

const pdfjsCmapsSrc = path.resolve('node_modules/pdfjs-dist/cmaps');
const pdfjsCmapsDest = path.resolve('public/pdfjs/cmaps');
if (fs.existsSync(pdfjsCmapsSrc)) {
  fs.mkdirSync(path.dirname(pdfjsCmapsDest), { recursive: true });
  fs.cpSync(pdfjsCmapsSrc, pdfjsCmapsDest, { recursive: true });
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devPort = Number(env.DEV_PORT) || 5173;
  const deployTarget = process.env.VERCEL
    ? 'vercel'
    : process.env.VITE_DEPLOY_TARGET?.trim() || '';

  return {
  base: process.env.VITE_BASE || '/',
  envPrefix: ['VITE_', 'NEXT_PUBLIC_POSTHOG'],
  define: {
    'import.meta.env.VITE_DEPLOY_TARGET': JSON.stringify(deployTarget),
  },
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
  server: {
    // localhost(IPv6 ::1) + 127.0.0.1 + LAN — Windows 연결 거부 방지
    // 워크트리별 구분: .env.local 에 DEV_PORT=5180 등 (gitignore *.local)
    host: true,
    port: devPort,
    strictPort: Boolean(env.DEV_PORT),
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
};
});
