/**
 * 표준국어대사전 용언 추출본 (`public/data/stdict-verb-forms.json`).
 * 번들에 넣지 않고 `/data/`에서 한 번 불러 기본형·활용형 집합을 만든다.
 *
 * 「띄움 필수」= 3음절 이상 활용형이고 후보 기본형이 전부 복합어인 경우.
 * 본용언+보조 2차 등재 판정은 기본형 키 소속으로 본다.
 */

/**
 * @typedef {{ meta?: Record<string, unknown>, lemmas?: Record<string, string[]> }} StdictVerbFormsData
 */

/** @type {Set<string> | null} */
let lemmaSet = null;
/** @type {Map<string, string[]> | null} */
let formToLemmas = null;
/** @type {Promise<void> | null} */
let loadPromise = null;

const DATA_URL = '/data/stdict-verb-forms.json';

/**
 * @param {StdictVerbFormsData | null | undefined} data
 */
function applyData(data) {
  /** @type {Set<string>} */
  const lemmas = new Set();
  /** @type {Map<string, string[]>} */
  const byForm = new Map();
  const rows = data?.lemmas && typeof data.lemmas === 'object' ? data.lemmas : {};
  for (const [lemma, forms] of Object.entries(rows)) {
    const key = String(lemma ?? '').trim();
    if (!key) continue;
    lemmas.add(key);
    if (!Array.isArray(forms)) continue;
    for (const form of forms) {
      const surface = String(form ?? '').trim();
      if (!surface) continue;
      const list = byForm.get(surface);
      if (list) {
        if (!list.includes(key)) list.push(key);
      } else {
        byForm.set(surface, [key]);
      }
    }
  }
  lemmaSet = lemmas;
  formToLemmas = byForm;
}

export function clearStdictVerbFormsCache() {
  lemmaSet = null;
  formToLemmas = null;
  loadPromise = null;
}

/**
 * 테스트·스파이크용. fetch 없이 인덱스를 채운다.
 * @param {StdictVerbFormsData | null | undefined} data
 */
export function setStdictVerbFormsForTests(data) {
  loadPromise = null;
  applyData(data ?? { lemmas: {} });
}

/**
 * @param {{
 *   verbForms?: StdictVerbFormsData,
 *   fetchImpl?: typeof fetch,
 *   dataUrl?: string,
 * }} [opts]
 */
export async function ensureStdictVerbFormsLoaded(opts = {}) {
  if (opts.verbForms) {
    applyData(opts.verbForms);
    return;
  }
  if (lemmaSet) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      const fetchFn = opts.fetchImpl ?? globalThis.fetch;
      if (typeof fetchFn !== 'function') {
        applyData({ lemmas: {} });
        return;
      }
      const url = opts.dataUrl || DATA_URL;
      const res = await fetchFn(url);
      if (!res?.ok) {
        applyData({ lemmas: {} });
        return;
      }
      const json = await res.json();
      applyData(json);
    })().catch(() => {
      applyData({ lemmas: {} });
    });
  }
  await loadPromise;
}

/** @param {string} lemma */
export function isSpaceRequiredCompoundLemma(lemma) {
  const q = String(lemma ?? '').trim();
  if (!q || !lemmaSet) return false;
  return lemmaSet.has(q);
}

/** @param {string} form */
export function isSpaceRequiredVerbForm(form) {
  const q = String(form ?? '').trim();
  if (!q || !formToLemmas) return false;
  return formToLemmas.has(q);
}

/** @param {string} form */
export function lemmasForSpaceRequiredForm(form) {
  const q = String(form ?? '').trim();
  if (!q || !formToLemmas) return [];
  return formToLemmas.get(q) ?? [];
}

export function stdictVerbFormsLemmaCount() {
  return lemmaSet?.size ?? 0;
}
