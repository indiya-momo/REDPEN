/**
 * Kiwi 부트 — 시나리오 C(서버) 우선, 실패 시 DEV만 브라우저 wasm(A).
 */
import {
  isSpellingKiwiBoundaryEnabled,
  isUnifyKiwiJosaEnabled,
} from '../featureFlags.js';
import {
  getKiwiInstance,
  isKiwiServerMode,
  setKiwiServerMode,
} from './runtime.js';
import { resolveKiwiAnalyzeEndpoint } from './resolveEndpoint.js';
import { pingKiwiAnalyze } from './serverRunner.js';

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
