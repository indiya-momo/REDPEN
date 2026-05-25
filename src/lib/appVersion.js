import packageJson from '../../package.json';

export const APP_VERSION = packageJson.version;

/**
 * 화면에서 바로 확인하는 기능 표식 — UI를 바꿀 때마다 올리면 됩니다.
 * (Pages·dev 공통. 최신이면 대문·메인 하단에 이 문자열이 보입니다.)
 */
export const UI_FEATURE_MARK = 'no-aux-upload';

/** CI 빌드 시 VITE_UI_BUILD_ID(커밋 SHA), 로컬 dev는 dev-local */
const RAW_BUILD_ID = import.meta.env.VITE_UI_BUILD_ID || 'dev-local';

export const UI_BUILD_ID =
  RAW_BUILD_ID.length > 7 ? RAW_BUILD_ID.slice(0, 7) : RAW_BUILD_ID;

const RAW_BUILD_TIME = import.meta.env.VITE_BUILD_TIME || '';

/**
 * @param {string} iso
 * @returns {string}
 */
export function formatBuildTimeKST(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}

/** 빌드(또는 dev에서는 현재) 시각 — KST 날짜·시간 */
export function buildTimeLabel() {
  if (import.meta.env.DEV) {
    return formatBuildTimeKST(new Date().toISOString());
  }
  if (!RAW_BUILD_TIME) return '';
  return formatBuildTimeKST(RAW_BUILD_TIME);
}

export function versionLabel() {
  const mode = import.meta.env.DEV ? 'dev' : 'pages';
  const time = buildTimeLabel();
  const parts = [`v${APP_VERSION}`];
  if (time) parts.push(time);
  if (!import.meta.env.DEV && UI_BUILD_ID !== 'dev-local') {
    parts.push(UI_BUILD_ID);
  }
  parts.push(UI_FEATURE_MARK, mode);
  return parts.join(' · ');
}
