/**
 * 표준국어대사전에서 데가 들어간 단어 표제어만 뽑은 게이트 집합
 * (`public/data/stdict-de-headwords.json`).
 * 사전 JSON 날짜는 파일 meta.sourceDate (20261106).
 */

const DATA_URL = '/data/stdict-de-headwords.json';

/** @typedef {{ raw: string, surface: string, stem: string, poses: string, how?: string }} DeHeadwordEntry */

/** @type {DeHeadwordEntry[] | null} */
let entries = null;

/** @type {{ state: 'unloaded' | 'ready' | 'error', message: string, count: number }} */
let status = {
  state: 'unloaded',
  message: '데 표제어 게이트가 아직 로드되지 않았다.',
  count: 0,
};

function hangulSyllables(s) {
  let n = 0;
  for (const ch of String(s)) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xac00 && cp <= 0xd7a3) n += 1;
  }
  return n;
}

/**
 * @param {{
 *   meta?: { sourceDate?: string },
 *   entries?: { raw?: string, surface?: string, stem?: string, poses?: string }[],
 * } | null | undefined} data
 */
function applyData(data) {
  const list = Array.isArray(data?.entries) ? data.entries : [];
  /** @type {DeHeadwordEntry[]} */
  const cleaned = [];
  for (const e of list) {
    const surface = String(e?.surface ?? '');
    const stem = String(e?.stem ?? '') || surface;
    if (!stem) continue;
    if (hangulSyllables(stem) < 2) continue;
    cleaned.push({
      raw: String(e?.raw ?? ''),
      surface,
      stem,
      poses: String(e?.poses ?? ''),
    });
  }
  cleaned.sort(
    (a, b) =>
      b.stem.length - a.stem.length || a.surface.localeCompare(b.surface, 'ko'),
  );
  entries = cleaned;
  const date = data?.meta?.sourceDate ? ` (사전 JSON ${data.meta.sourceDate})` : '';
  status = {
    state: 'ready',
    message: `데 표제어 게이트 준비됨${date}`,
    count: cleaned.length,
  };
}

export function getDeHeadwordGateStatus() {
  return { ...status, ok: status.state === 'ready' };
}

export function clearDeHeadwordGate() {
  entries = null;
  status = {
    state: 'unloaded',
    message: '데 표제어 게이트가 아직 로드되지 않았다.',
    count: 0,
  };
}

/** @param {string} [message] */
export function setDeHeadwordGateError(message) {
  entries = null;
  status = {
    state: 'error',
    message: String(message || '데 표제어 게이트를 읽지 못했다.'),
    count: 0,
  };
}

/**
 * 테스트가 집합을 주입한다.
 * @param {{
 *   meta?: { sourceDate?: string },
 *   entries?: { raw?: string, surface?: string, stem?: string, poses?: string }[],
 * } | null | undefined} data
 */
export function setDeHeadwordsForTests(data) {
  applyData(data ?? { entries: [] });
}

/**
 * 어절 시작에서 어간 접두(또는 표면·어간 정확) 일치.
 * 게이트가 ready가 아니면 맞추지 않는다(실패는 status로 표시).
 * @param {string} eojeol
 * @returns {(DeHeadwordEntry & { how: '정확' | '접두' }) | null}
 */
export function matchDeHeadwordGate(eojeol) {
  if (status.state !== 'ready' || !entries) return null;
  const s = String(eojeol ?? '');
  if (!s) return null;
  /** @type {(DeHeadwordEntry & { how: '정확' | '접두' }) | null} */
  let prefix = null;
  for (const e of entries) {
    if (s === e.surface || s === e.stem) {
      return { ...e, how: '정확' };
    }
    if (e.stem && s.startsWith(e.stem)) {
      if (!prefix || e.stem.length > prefix.stem.length) {
        prefix = { ...e, how: '접두' };
      }
    }
  }
  return prefix;
}

/**
 * @param {{
 *   data?: Parameters<typeof setDeHeadwordsForTests>[0],
 *   fetchImpl?: typeof fetch,
 *   dataUrl?: string,
 * }} [opts]
 */
export async function ensureDeHeadwordsLoaded(opts = {}) {
  if (opts.data) {
    applyData(opts.data);
    return;
  }
  if (status.state === 'ready') return;
  const fetchFn = opts.fetchImpl ?? globalThis.fetch;
  const url = opts.dataUrl || DATA_URL;
  if (typeof fetchFn !== 'function') {
    setDeHeadwordGateError('데 표제어 게이트를 읽을 fetch가 없다.');
    return;
  }
  try {
    const res = await fetchFn(url);
    if (!res?.ok) {
      setDeHeadwordGateError(
        `데 표제어 게이트를 읽지 못했다 (${res?.status ?? 'no status'}).`,
      );
      return;
    }
    applyData(await res.json());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setDeHeadwordGateError(`데 표제어 게이트를 읽지 못했다: ${msg}`);
  }
}
