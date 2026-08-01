/**
 * Kiwi 부트 — 시나리오 C(서버) 우선, 실패 시 DEV만 브라우저 wasm(A).
 */
import {
  getKiwiInstance,
  isKiwiServerMode,
  setKiwiServerMode,
} from './runtime.js';
import { resolveKiwiAnalyzeEndpoint } from './resolveEndpoint.js';
import { pingKiwiAnalyze } from './serverRunner.js';

/**
 * Kiwi 부트 여부.
 * 표기통일 발견 잡음 제외(이다·나열·닫힌 명사·조사 strip)는 플래그 없이
 * `isKiwiReady()`만 보므로, 서버 ping·DEV wasm을 항상 시도한다.
 * (맞춤법 경계·조사 리뷰 플래그는 각자 게이트를 유지.)
 */
export function shouldBootKiwi() {
  return true;
}

/** @deprecated 이름 유지 — DEV 로컬 A 게이트에 쓰이던 함수 */
export function shouldBootKiwiLocal() {
  if (!import.meta.env.DEV) return false;
  return shouldBootKiwi();
}

/**
 * 서버 ping → 성공 시 server mode. 실패·미설정 시 DEV만 브라우저 wasm.
 * @returns {Promise<boolean>}
 */
export async function bootKiwiIfNeeded() {
  if (!shouldBootKiwi()) return false;
  if (isKiwiServerMode()) return true;
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
      return true;
    }
  }

  if (!import.meta.env.DEV) return false;
  return bootKiwiLocalWasm();
}

/**
 * DEV 브라우저 wasm (시나리오 A) — C 실패 시 폴백.
 * @returns {Promise<boolean>}
 */
async function bootKiwiLocalWasm() {
  try {
    if (getKiwiInstance()?.ready?.()) return true;
  } catch {
    /* load */
  }
  try {
    const { loadKiwiBrowser } = await import('./loadBrowser.js');
    const kiwi = await loadKiwiBrowser();
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
