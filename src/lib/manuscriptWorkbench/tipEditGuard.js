/** tip 상자 클릭 직후 모드 버튼·하이라이트로 클릭이 새어 창이 닫히는 것 방지 */
let suppressUntil = 0;

export function suppressTipEditSideClicks(ms = 500) {
  suppressUntil = Date.now() + Math.max(0, Number(ms) || 0);
}

export function isTipEditSideClickSuppressed() {
  return Date.now() < suppressUntil;
}
