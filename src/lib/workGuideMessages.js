/**
 * 작업 가이드 문구 진입점 — 둘러보기 / 로그인 온보딩 모듈만 고른다.
 * 문구 본문은 각 파일에만 둔다 (한곳에 if로 섞지 않음).
 */
import { isGuestBrowseActive } from './guestBrowsePolicy.js';
import * as guest from './workGuideMessagesGuest.jsx';
import * as member from './workGuideMessagesMember.jsx';

/** @returns {typeof guest} */
export function getWorkGuideMessages() {
  return isGuestBrowseActive() ? guest : member;
}
