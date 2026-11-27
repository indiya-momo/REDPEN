/**
 * 표준국어대사전 링크 색인 로더 (public/data/stdict-link-index.json).
 *
 * - 성공한 결과만 메모리에 저장합니다.
 * - 실패(네트워크 오류·형식 오류)하면 저장하지 않아서, 다음 호출에서 다시 읽습니다.
 * - 실패 시 null을 돌려주므로 호출하는 쪽은 링크 없이 글자만 보여 주면 됩니다.
 */

const DATA_URL = '/data/stdict-link-index.json';

/** @type {Record<string, number[]> | null} */
let entriesCache = null;
/** @type {Promise<Record<string, number[]> | null> | null} */
let inflight = null;

/** 이미 읽힌 색인이 있으면 돌려주고, 없으면 null */
export function getStdictLinkIndex() {
  return entriesCache;
}

/**
 * @param {{ fetchImpl?: typeof fetch, dataUrl?: string }} [opts]
 * @returns {Promise<Record<string, number[]> | null>}
 */
export function ensureStdictLinkIndexLoaded(opts = {}) {
  if (entriesCache) return Promise.resolve(entriesCache);
  if (inflight) return inflight;

  const fetchFn = opts.fetchImpl ?? globalThis.fetch;
  const url = opts.dataUrl || DATA_URL;

  const loading = (async () => {
    if (typeof fetchFn !== 'function') return null;
    const res = await fetchFn(url);
    if (!res?.ok) return null;
    const json = await res.json();
    const entries = json?.entries;
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
      return null;
    }
    entriesCache = entries;
    return entriesCache;
  })()
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });

  inflight = loading;
  return loading;
}

/** 테스트 전용: 캐시를 비웁니다. */
export function clearStdictLinkIndexCache() {
  entriesCache = null;
  inflight = null;
}
