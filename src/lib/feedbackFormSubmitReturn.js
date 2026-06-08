import {
  grantFeedbackDailyQuotaBonus,
  isLocalDevQuotaRelaxed,
} from './betaDailyQuota.js';
import {
  publishFeedbackThankYouSignal,
  takeFeedbackThankYouSignal,
} from './feedbackThankYouSignal.js';
import { grantBadgeIfNew } from './badgeGrants.js';
import { markRewardNotice } from './rewardNotice.js';

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
async function finalizeFeedbackThankYou(id, email) {
  const result = await grantFeedbackDailyQuotaBonus(id, email);
  const localRewardOnly =
    isLocalDevQuotaRelaxed() && !result.alreadyHadBonus;
  const showThankYou =
    (result.granted && !result.alreadyHadBonus) || localRewardOnly;
  if (showThankYou) {
    markRewardNotice(id);
    publishFeedbackThankYouSignal(id);
    grantBadgeIfNew(id, 'slot-2', { notify: false });
  }
  return {
    granted: result.granted,
    alreadyHadBonus: result.alreadyHadBonus,
    showThankYou,
    showEventReward: false,
    localRewardOnly,
  };
}

/**
 * Google Form 제출 후 리다이렉트 — pending uid와 일치할 때만 혜택
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

  clearFeedbackFormSubmitPending();
  const finalized = await finalizeFeedbackThankYou(id, email);
  return {
    handled: true,
    ...finalized,
  };
}

/**
 * 페이지 로드·새로고침 — URL 리다이렉트, 탭 간 신호, 로컬 pending 순으로 감사 UI
 * @param {string} uid
 * @param {string} [email]
 */
export async function resolveFeedbackThankYouOnLoad(uid, email = '') {
  const id = uid.trim();
  if (!id || typeof window === 'undefined') {
    return { handled: false, granted: false, showThankYou: false };
  }

  const redirect = await consumeFeedbackFormSubmitReturn(id, email);
  if (redirect.showThankYou) {
    return redirect;
  }

  const signal = takeFeedbackThankYouSignal(id);
  if (signal) {
    return {
      handled: true,
      granted: false,
      showThankYou: true,
      showEventReward: false,
      fromSignal: true,
    };
  }

  if (!isLocalDevQuotaRelaxed()) {
    return redirect.handled
      ? redirect
      : { handled: false, granted: false, showThankYou: false };
  }

  const pending = readFeedbackFormSubmitPending();
  if (!pending || pending.uid !== id) {
    return redirect.handled
      ? redirect
      : { handled: false, granted: false, showThankYou: false };
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
  const finalized = await finalizeFeedbackThankYou(id, email);
  return {
    handled: true,
    ...finalized,
    fromLocalRefresh: true,
  };
}
