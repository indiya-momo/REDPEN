/**
 * Kiwi 인스턴스 레지스트리 — 브라우저 기본은 null(heuristic).
 * Node 테스트·스크립트가 loadNode 후 setKiwiInstance 호출.
 */

/** @type {import('kiwi-nlp').Kiwi | null} */
let kiwiInstance = null;

/** @returns {import('kiwi-nlp').Kiwi | null} */
export function getKiwiInstance() {
  return kiwiInstance;
}

/**
 * @param {import('kiwi-nlp').Kiwi | null} kiwi
 */
export function setKiwiInstance(kiwi) {
  kiwiInstance = kiwi;
}

export function clearKiwiInstance() {
  kiwiInstance = null;
}

/** 모델·wasm이 로드되어 analyze 가능한지 */
export function isKiwiReady() {
  try {
    return Boolean(kiwiInstance?.ready?.());
  } catch {
    return false;
  }
}
