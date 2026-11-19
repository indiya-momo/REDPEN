/**
 * 표준국어대사전 품사 exact 색인 (`public/data/stdict-pos-index.json`).
 * 번들에 넣지 않고 `/data/`에서 한 번 불러 bareKey → { word, pos }[] 맵을 만든다.
 * API 폴백 없음.
 */

/**
 * @typedef {{ word: string, pos: string }} StdictPosHit
 * @typedef {{
 *   meta?: Record<string, unknown>,
 *   index?: Record<string, StdictPosHit[]>,
 * }} StdictPosIndexData
 */

/** @type {Map<string, StdictPosHit[]> | null} */
let posByBare = null;
/** @type {string | null} */
let loadError = null;
/** @type {Promise<void> | null} */
let loadPromise = null;

const DATA_URL = '/data/stdict-pos-index.json';

/**
 * @param {StdictPosIndexData | null | undefined} data
 */
function applyData(data) {
  /** @type {Map<string, StdictPosHit[]>} */
  const map = new Map();
  const raw = data?.index && typeof data.index === 'object' ? data.index : {};
  for (const [bare, hits] of Object.entries(raw)) {
    const key = String(bare ?? '').trim();
    if (!key || !Array.isArray(hits)) continue;
    /** @type {StdictPosHit[]} */
    const list = [];
    const seen = new Set();
    for (const h of hits) {
      if (!h || typeof h !== 'object') continue;
      const word = String(/** @type {StdictPosHit} */ (h).word ?? '').trim();
      const pos = String(/** @type {StdictPosHit} */ (h).pos ?? '').trim();
      const dedupe = `${word}|${pos}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      list.push({ word: word || '?', pos });
    }
    if (list.length) map.set(key, list);
  }
  posByBare = map;
  loadError = map.size === 0 ? 'STDICT_INDEX_EMPTY' : null;
}

export function clearStdictPosIndexCache() {
  posByBare = null;
  loadError = null;
  loadPromise = null;
}

/**
 * 테스트·스파이크용. fetch 없이 색인을 채운다.
 * @param {StdictPosIndexData | null | undefined} data
 */
export function setStdictPosIndexForTests(data) {
  loadPromise = null;
  applyData(data ?? { index: {} });
}

/**
 * @param {{
 *   posIndex?: StdictPosIndexData,
 *   fetchImpl?: typeof fetch,
 *   dataUrl?: string,
 * }} [opts]
 */
export async function ensureStdictPosIndexLoaded(opts = {}) {
  if (opts.posIndex) {
    applyData(opts.posIndex);
    return;
  }
  if (posByBare) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      const fetchFn = opts.fetchImpl ?? globalThis.fetch;
      if (typeof fetchFn !== 'function') {
        posByBare = new Map();
        loadError = 'STDICT_INDEX_LOAD_FAILED';
        return;
      }
      const url = opts.dataUrl || DATA_URL;
      const res = await fetchFn(url);
      if (!res?.ok) {
        posByBare = new Map();
        loadError = 'STDICT_INDEX_LOAD_FAILED';
        return;
      }
      const json = await res.json();
      applyData(json);
    })().catch(() => {
      posByBare = new Map();
      loadError = 'STDICT_INDEX_LOAD_FAILED';
    });
  }
  await loadPromise;
}

/** @returns {string | null} */
export function stdictPosIndexLoadError() {
  return loadError;
}

export function stdictPosIndexBareKeyCount() {
  return posByBare?.size ?? 0;
}

/**
 * @param {string} bareKey hangulOnlyKey 결과
 * @returns {StdictPosHit[]}
 */
export function lookupStdictPosHits(bareKey) {
  const q = String(bareKey ?? '').trim();
  if (!q || !posByBare) return [];
  return posByBare.get(q) ?? [];
}
