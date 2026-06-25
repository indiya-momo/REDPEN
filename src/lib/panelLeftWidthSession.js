const SESSION_KEY = 'pdf-proofread-panel-left-width-session-v1';
const MIN_WIDTH = 400;
const MAX_WIDTH = 720;

/** @deprecated localStorage — 로그아웃 시 500px 정책 */
const LEGACY_LOCAL_KEYS = [
  'pdf-proofread-panel-left-width-v1',
  'pdf-proofread-panel-left-width-by-user-v1',
  'panel-left-width',
];

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function normalizeWidth(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < MIN_WIDTH || n > MAX_WIDTH) return null;
  return n;
}

function readSessionMap() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeSessionMap(map) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

export function clearLegacyPanelLeftWidthLocalStorage() {
  try {
    for (const key of LEGACY_LOCAL_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

/**
 * 로그인 세션 동안만 유지 (F5·대문 왕복). 없으면 null → 500px.
 * @param {string} [uid]
 */
export function readSessionPanelLeftWidth(uid = '') {
  const id = String(uid ?? '').trim();
  if (!id) return null;
  return normalizeWidth(readSessionMap()[id]);
}

/**
 * @param {string} [uid]
 * @param {number} width
 */
export function persistSessionPanelLeftWidth(uid, width) {
  const id = String(uid ?? '').trim();
  if (!id) return;
  const clamped = normalizeWidth(width);
  if (clamped == null) return;
  const map = readSessionMap();
  map[id] = clamped;
  writeSessionMap(map);
}

/**
 * 로그아웃 시 호출 — 다음 로그인은 500px.
 * @param {string} [uid]
 */
export function clearSessionPanelLeftWidth(uid = '') {
  const id = String(uid ?? '').trim();
  if (!id) return;
  const map = readSessionMap();
  if (!(id in map)) return;
  delete map[id];
  writeSessionMap(map);
}
