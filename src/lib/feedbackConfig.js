/** @typedef {'bug' | 'feature' | 'other'} FeedbackType */

export const FEEDBACK_TYPES = [
  { id: /** @type {FeedbackType} */ ('bug'), label: '버그' },
  { id: /** @type {FeedbackType} */ ('feature'), label: '기능 요청' },
  { id: /** @type {FeedbackType} */ ('other'), label: '기타' },
];

/**
 * Google Form 연동 — .env에 값을 넣으면 submitFeedback이 POST합니다.
 * no-cors: 응답 본문을 읽을 수 없어 ok:true ≠ Form 수신 보장.
 * 연결 후 검증: docs/feedback-form.md
 * @see .env.example
 */
export function getFeedbackFormConfig() {
  return {
    actionUrl: String(import.meta.env.VITE_FEEDBACK_FORM_ACTION_URL ?? '').trim(),
    entryType: String(import.meta.env.VITE_FEEDBACK_FORM_ENTRY_TYPE ?? '').trim(),
    entryMessage: String(
      import.meta.env.VITE_FEEDBACK_FORM_ENTRY_MESSAGE ?? '',
    ).trim(),
  };
}

export function isFeedbackFormConfigured() {
  const { actionUrl, entryType, entryMessage } = getFeedbackFormConfig();
  return Boolean(actionUrl && entryType && entryMessage);
}

/** @param {FeedbackType} type */
export function feedbackTypeLabel(type) {
  return FEEDBACK_TYPES.find((t) => t.id === type)?.label ?? type;
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

  const { actionUrl, entryType, entryMessage } = getFeedbackFormConfig();
  const body = new URLSearchParams();
  body.append(entryType, feedbackTypeLabel(type));
  body.append(entryMessage, text);

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
