/**
 * Google 로그인 직후 검수권 선물 안내.
 * 리다이렉트 복귀 시 App이 welcome을 건너뛰고 main으로 갈 수 있어
 * sessionStorage 플래그 + App 단 소비로 처리한다.
 * 「확인」 후에는 uid별 localStorage에 남겨 재로그인해도 다시 띄우지 않는다.
 */
import {
  ensureSignupBonusGranted,
  notifySignupBonusGranted,
} from './betaDailyQuota.js';

export const ENTER_MAIN_AFTER_GOOGLE_KEY = 'indiya-enter-main-after-google';
export const SIGNUP_BONUS_NOTICE_PENDING_KEY =
  'indiya-signup-bonus-notice-pending';

const SEEN_PREFIX = 'indiya-signup-bonus-notice-seen--';

/** 같은 탭에서 안내가 두 번 뜨지 않게 */
let presentedInThisPageLoad = false;

/**
 * @param {string} uid
 */
function seenStorageKey(uid) {
  return `${SEEN_PREFIX}${uid.trim()}`;
}

/**
 * 이 계정이 검수권 선물 안내를 이미 확인했는지.
 * @param {string} uid
 */
export function hasSeenSignupBonusNotice(uid) {
  const id = typeof uid === 'string' ? uid.trim() : '';
  if (!id || typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(seenStorageKey(id)) === '1';
  } catch {
    return false;
  }
}

/**
 * 「확인」 후 — 재로그인해도 다시 안 뜨게 저장.
 * @param {string} uid
 */
export function markSignupBonusNoticeSeen(uid) {
  const id = typeof uid === 'string' ? uid.trim() : '';
  if (!id || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(seenStorageKey(id), '1');
  } catch {
    /* private mode */
  }
}

export function markEnterMainAfterGoogle() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(ENTER_MAIN_AFTER_GOOGLE_KEY, '1');
}

export function markSignupBonusNoticePending() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(SIGNUP_BONUS_NOTICE_PENDING_KEY, '1');
}

export function clearSignupBonusLoginPending() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(ENTER_MAIN_AFTER_GOOGLE_KEY);
  sessionStorage.removeItem(SIGNUP_BONUS_NOTICE_PENDING_KEY);
}

/**
 * @returns {{ pendingEnter: boolean, pendingNotice: boolean }}
 */
export function peekSignupBonusLoginPending() {
  if (typeof sessionStorage === 'undefined') {
    return { pendingEnter: false, pendingNotice: false };
  }
  return {
    pendingEnter: sessionStorage.getItem(ENTER_MAIN_AFTER_GOOGLE_KEY) === '1',
    pendingNotice:
      sessionStorage.getItem(SIGNUP_BONUS_NOTICE_PENDING_KEY) === '1',
  };
}

/**
 * 로그인 직후 플래그가 있으면 검수권 안내를 띄운다(계정당 1회).
 * @param {string} uid
 * @returns {Promise<{ handled: boolean, enterMain: boolean }>}
 */
export async function consumeSignupBonusLoginNotice(uid) {
  const { pendingEnter, pendingNotice } = peekSignupBonusLoginPending();
  if (!pendingEnter && !pendingNotice) {
    return { handled: false, enterMain: false };
  }

  clearSignupBonusLoginPending();

  if (!uid?.trim()) {
    return { handled: true, enterMain: pendingEnter };
  }

  try {
    await ensureSignupBonusGranted(uid);
  } catch {
    /* 지급은 다음 검수 시 재시도 */
  }

  const alreadySeen =
    hasSeenSignupBonusNotice(uid) || presentedInThisPageLoad;

  if (!alreadySeen) {
    presentedInThisPageLoad = true;
    try {
      await notifySignupBonusGranted();
      markSignupBonusNoticeSeen(uid);
    } catch {
      /* 안내 실패해도 화면 진입은 진행 — 다음 로그인에 재시도 */
      presentedInThisPageLoad = false;
    }
  }

  return { handled: true, enterMain: pendingEnter || pendingNotice };
}

/**
 * 온보딩 「시작하기」에서 직접 안내할 때.
 * @param {string} uid
 */
export async function presentSignupBonusNoticeOnce(uid) {
  const id = typeof uid === 'string' ? uid.trim() : '';
  if (!id) return;

  clearSignupBonusLoginPending();
  presentedInThisPageLoad = true;

  try {
    await ensureSignupBonusGranted(id);
  } catch {
    /* ignore */
  }

  if (hasSeenSignupBonusNotice(id)) return;

  try {
    await notifySignupBonusGranted();
    markSignupBonusNoticeSeen(id);
  } catch {
    presentedInThisPageLoad = false;
  }
}

/** @deprecated presentSignupBonusNoticeOnce 사용 */
export function markSignupBonusNoticePresented() {
  presentedInThisPageLoad = true;
  clearSignupBonusLoginPending();
}

/** @internal 테스트용 */
export function resetSignupBonusNoticeForTests() {
  presentedInThisPageLoad = false;
}
