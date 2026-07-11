/**
 * 로그인 없이 작업 화면 둘러보기 (sessionStorage + 메모리 폴백)
 * 검수 실행은 checkAuthGate가 그대로 막는다.
 */

const STORAGE_KEY = 'indiya-guest-browse-v1';

/** @type {boolean} */
let memoryFlag = false;

function readStore() {
  if (typeof sessionStorage === 'undefined') return memoryFlag;
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return memoryFlag;
  }
}

function writeStore(active) {
  memoryFlag = active;
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (active) sessionStorage.setItem(STORAGE_KEY, '1');
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* memoryFlag만 유지 */
  }
}

/** @returns {boolean} */
export function isGuestBrowseActive() {
  return readStore();
}

export function beginGuestBrowse() {
  writeStore(true);
}

export function endGuestBrowse() {
  writeStore(false);
}
