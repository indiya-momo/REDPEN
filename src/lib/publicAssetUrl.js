import { UI_BUILD_ID } from './appVersion.js';

const RAW_BUILD_TIME = import.meta.env.VITE_BUILD_TIME || '';

/** CSS/JS 해시 없는 public PNG 등 — ?v= 로 캐시 무효화 */
export function publicAssetCacheBust() {
  if (RAW_BUILD_TIME) {
    const ms = new Date(RAW_BUILD_TIME).getTime();
    if (!Number.isNaN(ms)) return `${UI_BUILD_ID}-${ms}`;
  }
  return UI_BUILD_ID;
}

/**
 * public/ 아래 정적 파일 URL (GitHub Pages base 경로 포함)
 * @param {string} path
 * @param {{ cacheBust?: boolean | string }} [options]
 */
export function publicAssetUrl(path, options = {}) {
  const base = import.meta.env.BASE_URL || '/';
  const normalized = path.replace(/^\//, '');
  let url = `${base}${normalized}`;

  const bust = options.cacheBust;
  if (bust) {
    const token = typeof bust === 'string' ? bust : publicAssetCacheBust();
    url += `${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(token)}`;
  }

  return url;
}
