/**
 * 브라우저(로컬 DEV) Kiwi 로드 — /@kiwi/* 는 vite kiwiDevModelsPlugin 전용.
 * 프로덕션·모델 없음 → null (heuristic 유지).
 */
import { KiwiBuilder } from 'kiwi-nlp';
import { KIWI_DEFAULT_USER_WORDS } from './userDict.js';
import { setKiwiInstance, getKiwiInstance } from './runtime.js';

const MODEL_FILES = [
  'combiningRule.txt',
  'default.dict',
  'extract.mdl',
  'multi.dict',
  'sj.morph',
  'cong.mdl',
  'nounchr.mdl',
  'dialect.dict',
];

/** @type {Promise<import('kiwi-nlp').Kiwi | null> | null} */
let loadPromise = null;

/**
 * @param {string} url
 * @returns {Promise<Uint8Array>}
 */
async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Kiwi fetch failed ${res.status}: ${url}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * @param {{
 *   wasmUrl?: string,
 *   modelBaseUrl?: string,
 *   userWords?: { word: string, tag?: string, score?: number }[],
 *   register?: boolean,
 *   force?: boolean,
 * }} [opts]
 * @returns {Promise<import('kiwi-nlp').Kiwi | null>}
 */
export async function loadKiwiBrowser(opts = {}) {
  // 서버 모드만으로 isKiwiReady()==true인 경우 wasm을 건너뛰면
  // analyze가 캐시 미스 null → morph 제외가 전부 fail-open 된다.
  // 로컬 인스턴스 유무로만 short-circuit.
  if (!opts.force && getKiwiInstance()?.ready?.()) {
    return getKiwiInstance();
  }
  if (!opts.force && loadPromise) return loadPromise;

  loadPromise = (async () => {
    const wasmUrl = opts.wasmUrl || '/@kiwi/wasm';
    const modelBase = (opts.modelBaseUrl || '/@kiwi/models').replace(/\/$/, '');

    /** @type {Record<string, Uint8Array>} */
    const modelFiles = {};
    try {
      await Promise.all(
        MODEL_FILES.map(async (name) => {
          modelFiles[name] = await fetchBytes(`${modelBase}/${name}`);
        }),
      );
    } catch (err) {
      console.warn('[kiwiMorph] 로컬 모델 로드 실패 — heuristic 유지', err);
      return null;
    }

    try {
      const builder = await KiwiBuilder.create(wasmUrl);
      const kiwi = await builder.build({
        modelFiles,
        modelType: 'cong',
        loadDefaultDict: true,
        loadMultiDict: true,
        loadTypoDict: false,
        userWords: opts.userWords ?? [...KIWI_DEFAULT_USER_WORDS],
      });
      if (opts.register !== false) {
        setKiwiInstance(kiwi);
      }
      return kiwi;
    } catch (err) {
      console.warn('[kiwiMorph] Kiwi build 실패 — heuristic 유지', err);
      return null;
    }
  })();

  return loadPromise;
}
