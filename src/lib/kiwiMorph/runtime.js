/**
 * Kiwi 인스턴스 레지스트리 — 브라우저 기본은 null(heuristic).
 * Node 테스트·스크립트가 loadNode 후 setKiwiInstance 호출.
 * 시나리오 C: 서버 모드면 로컬 wasm 없이도 ready (remoteCache 경유).
 */

/** @type {import('kiwi-nlp').Kiwi | null} */
let kiwiInstance = null;

/** 서버 analyze 사용 가능 (브라우저 wasm 미로드) */
let kiwiServerMode = false;

/** @returns {import('kiwi-nlp').Kiwi | null} */
export function getKiwiInstance() {
  return kiwiInstance;
}

/**
 * @param {import('kiwi-nlp').Kiwi | null} kiwi
 */
export function setKiwiInstance(kiwi) {
  kiwiInstance = kiwi;
  // 인스턴스 교체 시 이전 analyze 캐시 무효
  void import('./analyze.js')
    .then((m) => m.clearKiwiAnalyzeCache?.())
    .catch(() => {});
}

export function clearKiwiInstance() {
  kiwiInstance = null;
  void import('./analyze.js')
    .then((m) => m.clearKiwiAnalyzeCache?.())
    .catch(() => {});
}

/** @param {boolean} on */
export function setKiwiServerMode(on) {
  kiwiServerMode = Boolean(on);
}

export function isKiwiServerMode() {
  return kiwiServerMode;
}

/** 로컬 인스턴스 또는 서버 모드(C) */
export function isKiwiReady() {
  try {
    if (kiwiServerMode) return true;
    return Boolean(kiwiInstance?.ready?.());
  } catch {
    return false;
  }
}
