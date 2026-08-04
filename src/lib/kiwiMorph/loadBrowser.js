/**
 * 브라우저(로컬 DEV) Kiwi 로드 — /@kiwi/* 는 vite kiwiDevModelsPlugin 전용.
 * 프로덕션·모델 없음 → null (heuristic 유지).
 * 로드는 백그라운드에서 이어질 수 있고, 호출측은 maxWaitMs 후 null로 진행 가능.
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

/** 기본 대기 상한 — 초과 시 heuristic (백그라운드 로드는 계속) */
export const KIWI_BROWSER_LOAD_MAX_MS = 12_000;

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
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T>}
 */
function raceWithTimeout(promise, ms) {
  if (!(ms > 0)) return promise;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error('KIWI_LOAD_TIMEOUT');
      // @ts-expect-error code
      err.code = 'KIWI_LOAD_TIMEOUT';
      reject(err);
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * @param {{
 *   wasmUrl?: string,
 *   modelBaseUrl?: string,
 *   userWords?: { word: string, tag?: string, score?: number }[],
 *   register?: boolean,
 *   force?: boolean,
 *   maxWaitMs?: number,
 * }} [opts]
 * @returns {Promise<import('kiwi-nlp').Kiwi | null>}
 */
export async function loadKiwiBrowser(opts = {}) {
  if (!opts.force && getKiwiInstance()?.ready?.()) {
    return getKiwiInstance();
  }

  const maxWaitMs =
    typeof opts.maxWaitMs === 'number'
      ? opts.maxWaitMs
      : KIWI_BROWSER_LOAD_MAX_MS;

  if (!opts.force && loadPromise) {
    try {
      return await raceWithTimeout(loadPromise, maxWaitMs);
    } catch (err) {
      if (err?.code === 'KIWI_LOAD_TIMEOUT') {
        console.warn(
          '[kiwiMorph] 로컬 로드 대기 초과 — heuristic 유지 (백그라운드 계속)',
        );
        return getKiwiInstance();
      }
      return null;
    }
  }

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

  try {
    return await raceWithTimeout(loadPromise, maxWaitMs);
  } catch (err) {
    if (err?.code === 'KIWI_LOAD_TIMEOUT') {
      console.warn(
        '[kiwiMorph] 로컬 로드 대기 초과 — heuristic 유지 (백그라운드 계속)',
      );
      return getKiwiInstance();
    }
    loadPromise = null;
    return null;
  }
}
