/**
 * 로그인 없이 작업 화면 둘러보기 (sessionStorage + 메모리 폴백)
 * 검수·결과는 guestBrowsePolicy.guestBrowseAllowsCheckAndResults 예외.
 * 표기 통일 2차·새 업로드는 로컬 DEV만 guestBrowseAllowsLocalDevExtras.
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
