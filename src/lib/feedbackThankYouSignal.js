/** Form 제출 리다이렉트 탭 → 원래 앱 탭에 감사 말풍선·선물 UI 동기화 */
export const FEEDBACK_THANK_SIGNAL_KEY = 'indiya-feedback-thank-signal';

const SIGNAL_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * @param {string} uid
 */
export function publishFeedbackThankYouSignal(uid) {
  const id = uid.trim();
  if (!id || typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      FEEDBACK_THANK_SIGNAL_KEY,
      JSON.stringify({ uid: id, at: Date.now() }),
    );
  } catch {
    /* private mode */
  }
}

/**
 * @param {string} [expectedUid]
 * @returns {{ uid: string, at: number } | null}
 */
export function takeFeedbackThankYouSignal(expectedUid = '') {
  try {
    const raw = localStorage.getItem(FEEDBACK_THANK_SIGNAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const uid = typeof parsed?.uid === 'string' ? parsed.uid.trim() : '';
    const at = Number(parsed?.at) || 0;
    if (!uid || !at || Date.now() - at > SIGNAL_MAX_AGE_MS) {
      localStorage.removeItem(FEEDBACK_THANK_SIGNAL_KEY);
      return null;
    }
    const expected = expectedUid.trim();
    if (expected && uid !== expected) {
      return null;
    }
    localStorage.removeItem(FEEDBACK_THANK_SIGNAL_KEY);
    return { uid, at };
  } catch {
    try {
      localStorage.removeItem(FEEDBACK_THANK_SIGNAL_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}
