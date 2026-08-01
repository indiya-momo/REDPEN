import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { stdictDevProxyPlugin } from './scripts/stdictDevProxyPlugin.js';
import { kiwiDevModelsPlugin } from './scripts/kiwiDevModelsPlugin.js';
import { kiwiAnalyzeDevPlugin } from './scripts/kiwiAnalyzeDevPlugin.js';

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
  const josaSlmProxyTarget =
    buildEnv.JOSA_SLM_PROXY_TARGET?.trim() || 'http://127.0.0.1:8000';
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
  plugins: [
    react(),
    stdictDevProxyPlugin({
      getKey: () =>
        buildEnv.STDICT_API_KEY || buildEnv.VITE_STDICT_API_KEY || '',
    }),
    // 로컬만: tmp/kiwi-models + wasm. 배포 번들에 모델 미포함.
    kiwiDevModelsPlugin(),
    // 시나리오 C: POST /api/kiwi/analyze (Node Kiwi, 브라우저에 wasm 미전송)
    kiwiAnalyzeDevPlugin(),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'src/**/*.test.jsx'],
  },
  server: {
    // localhost(IPv6 ::1) + 127.0.0.1 + LAN — Windows 연결 거부 방지
    host: true,
    port: devPort,
    strictPort: true,
    open: '/',
    // 국립국어원 어문 규범 Open API — 브라우저 CORS 회피
    proxy: {
      '/api/kornorms': {
        target: 'https://korean.go.kr',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api\/kornorms/, '/kornorms'),
      },
      // 조사·어간 2차 SLM — 로컬 vLLM (:8000). 스케치 §13
      '/api/josa-slm': {
        target: josaSlmProxyTarget,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/josa-slm/, ''),
      },
    },
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
