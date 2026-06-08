import { grantFeedbackDailyQuotaBonus } from './betaDailyQuota.js';
import { grantBadgeIfNew } from './badgeGrants.js';

const DEFAULT_FEEDBACK_FORM_VIEW_URL =
  'https://forms.gle/XGxKjjyWZiYDnqrm8';

export const FEEDBACK_SUBMITTED_QUERY = 'feedbackSubmitted';

const PENDING_KEY = 'indiya-feedback-submit-pending';
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * @returns {string}
 */
export function getFeedbackFormReturnUrl() {
  const fromEnv = String(
    import.meta.env.VITE_FEEDBACK_FORM_RETURN_URL ?? '',
  ).trim();
  if (fromEnv) return fromEnv;
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set(FEEDBACK_SUBMITTED_QUERY, '1');
  return url.toString();
}

/**
 * @param {string} uid
 * @returns {boolean}
 */
export function hasValidFeedbackFormSubmitPending(uid) {
  const pending = readFeedbackFormSubmitPending();
  const id = uid.trim();
  if (!id || !pending || pending.uid !== id) return false;
  if (Date.now() - pending.at > PENDING_MAX_AGE_MS) return false;
  return true;
}

/**
 * @param {string} uid
 */
export function markFeedbackFormSubmitPending(uid) {
  const id = uid.trim();
  if (!id || typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ uid: id, at: Date.now() }),
    );
  } catch {
    /* private mode */
  }
}

/**
 * @returns {{ uid: string, at: number } | null}
 */
function readFeedbackFormSubmitPending() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const uid = typeof parsed?.uid === 'string' ? parsed.uid.trim() : '';
    const at = Number(parsed?.at) || 0;
    if (!uid || !at) return null;
    return { uid, at };
  } catch {
    return null;
  }
}

function clearFeedbackFormSubmitPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @param {URLSearchParams} [params]
 */
export function stripFeedbackSubmittedFromUrl(params) {
  if (typeof window === 'undefined') return;
  const search = params ?? new URLSearchParams(window.location.search);
  if (!search.has(FEEDBACK_SUBMITTED_QUERY)) return;
  search.delete(FEEDBACK_SUBMITTED_QUERY);
  const next = search.toString();
  const path = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', path);
}

/**
 * @param {string} uid
 */
export function buildFeedbackFormOpenUrl(uid) {
  const prefillViewUrl = String(
    import.meta.env.VITE_FEEDBACK_FORM_PREFILL_VIEW_URL ?? '',
  ).trim();
  const viewUrl = String(import.meta.env.VITE_FEEDBACK_FORM_VIEW_URL ?? '').trim();
  const entryUid = String(import.meta.env.VITE_FEEDBACK_FORM_ENTRY_UID ?? '').trim();
  const base = (prefillViewUrl || viewUrl || DEFAULT_FEEDBACK_FORM_VIEW_URL).trim();
  if (!base) return '';
  const id = uid.trim();
  const entry = entryUid.trim();
  if (!id || !entry) return base;
  const joiner = base.includes('?') ? '&' : '?';
  return `${base}${joiner}${encodeURIComponent(entry)}=${encodeURIComponent(id)}`;
}

/**
 * @param {string} id
 * @param {string} email
 */
async function applyFeedbackRewards(id, email) {
  const result = await grantFeedbackDailyQuotaBonus(id, email);
  if (result.granted && !result.alreadyHadBonus) {
    grantBadgeIfNew(id, 'slot-2', { notify: true });
  }
  return result;
}

/**
 * Form 리다이렉트 탭 — 보너스만 지급, pending은 작업 탭 새로고침까지 유지
 * @param {string} uid
 * @param {string} [email]
 */
export async function consumeFeedbackFormSubmitReturn(uid, email = '') {
  if (typeof window === 'undefined') {
    return { handled: false, granted: false, showThankYou: false };
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get(FEEDBACK_SUBMITTED_QUERY) !== '1') {
    return { handled: false, granted: false, showThankYou: false };
  }

  stripFeedbackSubmittedFromUrl(params);

  const id = uid.trim();
  if (!id) {
    return { handled: true, granted: false, showThankYou: false, reason: 'no_uid' };
  }

  const pending = readFeedbackFormSubmitPending();
  if (!pending || pending.uid !== id) {
    return {
      handled: true,
      granted: false,
      showThankYou: false,
      reason: 'no_pending',
    };
  }
  if (Date.now() - pending.at > PENDING_MAX_AGE_MS) {
    clearFeedbackFormSubmitPending();
    return {
      handled: true,
      granted: false,
      showThankYou: false,
      reason: 'expired',
    };
  }

  const result = await applyFeedbackRewards(id, email);
  return {
    handled: true,
    granted: result.granted,
    alreadyHadBonus: result.alreadyHadBonus,
    showThankYou: false,
  };
}

/**
 * 작업 탭 새로고침(F5) — pending이 있으면 선물 말풍선 (탭 복귀만으로는 안 뜸)
 * @param {string} id
 * @param {string} email
 */
async function resolveFeedbackThankYouFromPending(id, email) {
  const pending = readFeedbackFormSubmitPending();
  if (!pending || pending.uid !== id) {
    return null;
  }
  if (Date.now() - pending.at > PENDING_MAX_AGE_MS) {
    clearFeedbackFormSubmitPending();
    return {
      handled: true,
      granted: false,
      showThankYou: false,
      reason: 'expired',
    };
  }

  clearFeedbackFormSubmitPending();
  const result = await applyFeedbackRewards(id, email);
  return {
    handled: true,
    granted: result.granted,
    alreadyHadBonus: result.alreadyHadBonus,
    showThankYou: true,
    fromPendingRefresh: true,
  };
}

/**
 * 페이지 로드 — Form 리다이렉트는 보너스만, 말풍선은 작업 탭 새로고침 때만
 * @param {string} uid
 * @param {string} [email]
 */
export async function resolveFeedbackThankYouOnLoad(uid, email = '') {
  const id = uid.trim();
  if (!id || typeof window === 'undefined') {
    return { handled: false, granted: false, showThankYou: false };
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get(FEEDBACK_SUBMITTED_QUERY) === '1') {
    return consumeFeedbackFormSubmitReturn(id, email);
  }

  const pendingRefresh = await resolveFeedbackThankYouFromPending(id, email);
  if (pendingRefresh) {
    return pendingRefresh;
  }

  return { handled: false, granted: false, showThankYou: false };
}
