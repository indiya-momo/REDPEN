import {
  buildFeedbackFormOpenUrl,
  markFeedbackFormSubmitPending,
} from './feedbackFormSubmitReturn.js';

/** @typedef {'bug' | 'feature' | 'other'} FeedbackType */

/** 오픈베타 Google Form — env 미설정 시에도 앱에서 열림 */
export const DEFAULT_FEEDBACK_FORM_VIEW_URL =
  'https://forms.gle/XGxKjjyWZiYDnqrm8';

export const FEEDBACK_TYPES = [
  { id: /** @type {FeedbackType} */ ('bug'), label: '버그' },
  { id: /** @type {FeedbackType} */ ('feature'), label: '기능 요청' },
  { id: /** @type {FeedbackType} */ ('other'), label: '기타' },
];

/**
 * Google Form 연동 — .env에 값을 넣으면 submitFeedback이 POST합니다.
 * no-cors: 응답 본문을 읽을 수 없어 ok:true ≠ Form 수신 보장.
 * 연결 후 검증: project-docs/feedback-form.md
 * @see .env.example
 */
export function getFeedbackFormConfig() {
  return {
    actionUrl: String(import.meta.env.VITE_FEEDBACK_FORM_ACTION_URL ?? '').trim(),
    viewUrl: String(import.meta.env.VITE_FEEDBACK_FORM_VIEW_URL ?? '').trim(),
    prefillViewUrl: String(
      import.meta.env.VITE_FEEDBACK_FORM_PREFILL_VIEW_URL ?? '',
    ).trim(),
    entryUid: String(import.meta.env.VITE_FEEDBACK_FORM_ENTRY_UID ?? '').trim(),
    entryType: String(import.meta.env.VITE_FEEDBACK_FORM_ENTRY_TYPE ?? '').trim(),
    entryMessage: String(
      import.meta.env.VITE_FEEDBACK_FORM_ENTRY_MESSAGE ?? '',
    ).trim(),
    entryInconvenient: String(
      import.meta.env.VITE_FEEDBACK_FORM_ENTRY_INCONVENIENT ?? '',
    ).trim(),
    entryConvenient: String(
      import.meta.env.VITE_FEEDBACK_FORM_ENTRY_CONVENIENT ?? '',
    ).trim(),
  };
}

export function getFeedbackFormViewUrl() {
  const fromEnv = getFeedbackFormConfig().viewUrl;
  return fromEnv || DEFAULT_FEEDBACK_FORM_VIEW_URL;
}

/** 베타: Google Form이 기본 채널 (항상 view URL 있음) */
export function isBetaFeedbackFormPrimary() {
  return Boolean(getFeedbackFormViewUrl());
}

/** 단답·장문형 2필드 POST */
export function isLegacyFeedbackFormConfigured() {
  const { actionUrl, entryType, entryMessage } = getFeedbackFormConfig();
  return Boolean(actionUrl && entryType && entryMessage);
}

/** 체크박스(기타) 2질문 POST — 불편한 점 / 편한 점 */
export function isPairedFeedbackFormConfigured() {
  const { actionUrl, entryInconvenient, entryConvenient } = getFeedbackFormConfig();
  return Boolean(actionUrl && entryInconvenient && entryConvenient);
}

export function isFeedbackFormConfigured() {
  return isLegacyFeedbackFormConfigured() || isPairedFeedbackFormConfigured();
}

export function isFeedbackFormLinked() {
  return isFeedbackFormConfigured() || Boolean(getFeedbackFormViewUrl());
}

export function openFeedbackFormView() {
  const url = getFeedbackFormViewUrl();
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

/**
 * Google Form 열기 — 제출 후 리다이렉트 시에만 검수 보너스 (session pending)
 * @param {string} uid
 */
export function openFeedbackFormForUser(uid) {
  const id = uid.trim();
  if (!id) return { opened: false };
  const url = buildFeedbackFormOpenUrl(id);
  if (!url) return { opened: false };
  markFeedbackFormSubmitPending(id);
  window.open(url, '_blank', 'noopener,noreferrer');
  return { opened: true };
}

/** @param {FeedbackType} type */
export function feedbackTypeLabel(type) {
  return FEEDBACK_TYPES.find((t) => t.id === type)?.label ?? type;
}

/**
 * @param {URLSearchParams} body
 * @param {string} entryName
 * @param {string} text
 */
function appendCheckboxOther(body, entryName, text) {
  body.append(entryName, '__other_option__');
  body.append(`${entryName}.other_option_response`, text);
}

/**
 * @param {{ type: FeedbackType, message: string }} payload
 * @returns {Promise<{ ok: true } | { ok: false, reason: 'not_configured' | 'empty' | 'submit_failed', error?: string }>}
 */
export async function submitFeedback({ type, message }) {
  const text = message.trim();
  if (!text) return { ok: false, reason: 'empty' };

  if (!isFeedbackFormConfigured()) {
    return { ok: false, reason: 'not_configured' };
  }

  const {
    actionUrl,
    entryType,
    entryMessage,
    entryInconvenient,
    entryConvenient,
  } = getFeedbackFormConfig();
  const body = new URLSearchParams();

  if (isPairedFeedbackFormConfigured()) {
    appendCheckboxOther(
      body,
      entryInconvenient,
      `[${feedbackTypeLabel(type)}] ${text}`,
    );
    appendCheckboxOther(body, entryConvenient, '앱에서 피드백 전송');
  } else {
    body.append(entryType, feedbackTypeLabel(type));
    body.append(entryMessage, text);
  }

  try {
    await fetch(actionUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: 'submit_failed',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Form 미설정 시 임시 — 클립보드용
 * @param {{ type: FeedbackType, message: string }} payload
 */
export function formatFeedbackDraft({ type, message }) {
  return `[${feedbackTypeLabel(type)}]\n\n${message.trim()}`;
}
