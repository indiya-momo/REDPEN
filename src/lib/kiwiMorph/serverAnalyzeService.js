/**
 * Node 전용 Kiwi analyze 서비스 (Vite DEV 플러그인 · api/ 핸들러 공유).
 * 브라우저 번들에 넣지 말 것.
 */
import { analyzeLine, clearKiwiAnalyzeCache } from './analyze.js';
import { loadKiwiNode, resolveKiwiNodePaths } from './loadNode.js';
import { parseAnalyzeRequestBody } from './serverContract.js';
import { shouldAnalyzeWithKiwi } from './shouldAnalyze.js';

/** @type {Promise<import('kiwi-nlp').Kiwi | null> | null} */
let loadPromise = null;

/**
 * @param {{ rootDir?: string }} [opts]
 * @returns {Promise<import('kiwi-nlp').Kiwi | null>}
 */
export async function ensureKiwiServerInstance(opts = {}) {
  if (!loadPromise) {
    loadPromise = (async () => {
      const { ready } = resolveKiwiNodePaths(opts.rootDir);
      if (!ready) return null;
      return loadKiwiNode({ rootDir: opts.rootDir, register: true });
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }
  return loadPromise;
}

export function resetKiwiServerInstanceForTests() {
  loadPromise = null;
  clearKiwiAnalyzeCache();
}

/**
 * @returns {{ ready: boolean, reason?: string }}
 */
export function getKiwiServerStatus(rootDir) {
  const { ready, wasmPath, modelDir } = resolveKiwiNodePaths(rootDir);
  if (!ready) {
    return {
      ready: false,
      reason: `models or wasm missing (wasm=${wasmPath}, modelDir=${modelDir})`,
    };
  }
  return { ready: true };
}

/**
 * @param {string} text
 * @param {import('kiwi-nlp').Kiwi | null} kiwi
 * @returns {import('./serverContract.js').KiwiAnalyzeItem}
 */
function analyzeOne(text, kiwi) {
  if (!shouldAnalyzeWithKiwi(text)) {
    return { text, tokens: [], surface1to1: false };
  }
  const analyzed = analyzeLine(text, { kiwi, skipCache: false });
  if (!analyzed) {
    return { text, tokens: [], surface1to1: false };
  }
  return {
    text,
    tokens: analyzed.tokens,
    surface1to1: analyzed.surface1to1,
    ...(typeof analyzed.score === 'number' ? { score: analyzed.score } : {}),
  };
}

/**
 * @param {unknown} body
 * @param {{ rootDir?: string }} [opts]
 * @returns {Promise<
 *   | import('./serverContract.js').KiwiAnalyzeOk
 *   | import('./serverContract.js').KiwiAnalyzeBatchOk
 *   | import('./serverContract.js').KiwiAnalyzeErr
 * >}
 */
export async function handleKiwiAnalyzeBody(body, opts = {}) {
  const parsed = parseAnalyzeRequestBody(body);
  if ('error' in parsed) {
    return { ok: false, error: parsed.error };
  }

  const kiwi = await ensureKiwiServerInstance(opts);
  if (!kiwi?.ready?.()) {
    return { ok: false, error: 'KIWI_UNAVAILABLE' };
  }

  const results = parsed.texts.map((text) => analyzeOne(text, kiwi));
  if (results.length === 1) {
    const only = results[0];
    return {
      ok: true,
      text: only.text,
      tokens: only.tokens,
      surface1to1: only.surface1to1,
      ...(typeof only.score === 'number' ? { score: only.score } : {}),
    };
  }
  return { ok: true, results };
}
