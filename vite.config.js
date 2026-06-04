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

/** Vercel Marketplace · .env.local PostHog 변수 → 빌드 시 클라이언트에 고정 */
function pickPostHogBuildEnv(raw = {}) {
  const key = String(
    raw.VITE_PUBLIC_POSTHOG_KEY ||
      raw.VITE_POSTHOG_PROJECT_TOKEN ||
      raw.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ||
      '',
  ).trim();
  const host = String(
    raw.VITE_PUBLIC_POSTHOG_HOST ||
      raw.VITE_POSTHOG_HOST ||
      raw.NEXT_PUBLIC_POSTHOG_HOST ||
      'https://eu.i.posthog.com',
  ).trim();
  return { key, host };
}

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '');
  const buildEnv = { ...fileEnv, ...process.env };
  const devPort = Number(buildEnv.DEV_PORT) || 5173;
  const deployTarget = buildEnv.VERCEL
    ? 'vercel'
    : buildEnv.VITE_DEPLOY_TARGET?.trim() || '';
  const posthog = pickPostHogBuildEnv(buildEnv);

  return {
  base: process.env.VITE_BASE || '/',
  envPrefix: ['VITE_', 'NEXT_PUBLIC_POSTHOG'],
  define: {
    'import.meta.env.VITE_DEPLOY_TARGET': JSON.stringify(deployTarget),
    'import.meta.env.VITE_PUBLIC_POSTHOG_KEY': JSON.stringify(posthog.key),
    'import.meta.env.VITE_PUBLIC_POSTHOG_HOST': JSON.stringify(posthog.host),
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
    strictPort: Boolean(buildEnv.DEV_PORT),
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
