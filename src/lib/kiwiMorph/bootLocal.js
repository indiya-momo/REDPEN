/**
 * Kiwi 부트 — 시나리오 C(서버) 우선, 실패 시 DEV만 브라우저 wasm(A).
 * JOSA·BOUNDARY ON일 때만 boot. NOISE_FILTER는 1차 리스트라 boot 안 함.
 * 대량 prefetch는 BOUNDARY 전용.
 */
import {
  getKiwiInstance,
  isKiwiServerMode,
  setKiwiServerMode,
} from './runtime.js';
import { resolveKiwiAnalyzeEndpoint } from './resolveEndpoint.js';
import { pingKiwiAnalyze } from './serverRunner.js';
import {
  isSpellingKiwiBoundaryEnabled,
  isUnifyKiwiJosaEnabled,
} from '../featureFlags.js';

/**
 * Kiwi boot 여부 — 동기/서버 분석이 필요한 플래그만.
 * - VITE_UNIFY_KIWI_JOSA: 표기통일 조사 strip 등
 * - VITE_SPELLING_KIWI_BOUNDARY: 맞춤법 matchFilters + 표기통일 enrich 경계
 * NOISE_FILTER는 1차 리스트(denylist·패턴 꼬리)만 쓰므로 boot 조건에서 제외.
 * OFF면 isKiwiReady()=false → 전 경로 heuristic (boot/HTTP/wasm 없음).
 */
export function shouldBootKiwi() {
  return isUnifyKiwiJosaEnabled() || isSpellingKiwiBoundaryEnabled();
}

/** @deprecated 이름 유지 — DEV 로컬 A 게이트에 쓰이던 함수 */
export function shouldBootKiwiLocal() {
  if (!import.meta.env.DEV) return false;
  return shouldBootKiwi();
}

/**
 * 서버 ping → 성공 시 server mode. 실패·미설정 시 DEV만 브라우저 wasm.
 * NOISE_FILTER 등 동기 분석이 필요하면 DEV에서 서버 모드여도 wasm을 함께 올린다.
 * @param {{ maxWaitMs?: number }} [opts] 로컬 wasm 대기 상한(ms). 찾기 UI는 짧게.
 * @returns {Promise<boolean>}
 */
export async function bootKiwiIfNeeded(opts = {}) {
  if (!shouldBootKiwi()) return false;
  if (isKiwiServerMode()) {
    if (import.meta.env.DEV) await ensureDevLocalWasm(opts);
    return true;
  }
  try {
    if (getKiwiInstance()?.ready?.()) return true;
  } catch {
    /* continue */
  }

  const endpoint = resolveKiwiAnalyzeEndpoint();
  if (endpoint) {
    const ready = await pingKiwiAnalyze(endpoint);
    if (ready) {
      setKiwiServerMode(true);
      if (import.meta.env.DEV) await ensureDevLocalWasm(opts);
      return true;
    }
  }

  if (!import.meta.env.DEV) return false;
  return bootKiwiLocalWasm(opts);
}

/**
 * DEV — 서버 C만 ready면 analyzeLine이 remoteCache 미스로 fail-open.
 * 잡음 필터 등 동기 morph를 위해 wasm을 보강. 대기는 maxWaitMs로 끊음.
 * @param {{ maxWaitMs?: number }} [opts]
 */
async function ensureDevLocalWasm(opts = {}) {
  try {
    if (getKiwiInstance()?.ready?.()) return true;
  } catch {
    /* load */
  }
  return bootKiwiLocalWasm(opts);
}

/**
 * DEV 브라우저 wasm (시나리오 A) — C 실패 시 폴백.
 * @param {{ maxWaitMs?: number }} [opts]
 * @returns {Promise<boolean>}
 */
async function bootKiwiLocalWasm(opts = {}) {
  try {
    if (getKiwiInstance()?.ready?.()) return true;
  } catch {
    /* load */
  }
  try {
    const { loadKiwiBrowser } = await import('./loadBrowser.js');
    const kiwi = await loadKiwiBrowser({
      maxWaitMs: opts.maxWaitMs,
    });
    return Boolean(kiwi?.ready?.());
  } catch (err) {
    console.warn('[kiwiMorph] local boot 실패', err);
    return false;
  }
}

/** @deprecated use bootKiwiIfNeeded */
export async function bootKiwiLocalIfNeeded() {
  return bootKiwiIfNeeded();
}
