/**
 * 둘러보기(게스트) 기능 경계 — session 플래그는 guestBrowseSession,
 * “무엇을 허용할지”는 여기만 본다.
 */
import {
  beginGuestBrowse,
  endGuestBrowse,
  isGuestBrowseActive,
} from './guestBrowseSession.js';

/** @typedef {{
 *   stayOnMainWithoutLogin: boolean,
 *   demoPdfAutoLoad: boolean,
 *   runCheckAndResultPopup: boolean,
 * }} GuestBrowseCapabilities */

/** @type {GuestBrowseCapabilities} */
export const GUEST_BROWSE_CAPABILITIES = {
  stayOnMainWithoutLogin: true,
  demoPdfAutoLoad: true,
  runCheckAndResultPopup: true,
};

export { beginGuestBrowse, endGuestBrowse, isGuestBrowseActive };

/** 로그인 없이 main에 머무를 수 있는지 */
export function guestBrowseAllowsWorkspaceStay() {
  return (
    isGuestBrowseActive() && GUEST_BROWSE_CAPABILITIES.stayOnMainWithoutLogin
  );
}

/** 데모 원고 자동 로드 */
export function guestBrowseAllowsDemoPdfAutoLoad() {
  return isGuestBrowseActive() && GUEST_BROWSE_CAPABILITIES.demoPdfAutoLoad;
}

/** 검수 실행·결과 패널·안내 팝업 */
export function guestBrowseAllowsCheckAndResults() {
  return (
    isGuestBrowseActive() && GUEST_BROWSE_CAPABILITIES.runCheckAndResultPopup
  );
}
