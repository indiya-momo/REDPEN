/**
 * 관리자 — 이메일로 유료(plan) 등록/해제 Callable 래퍼.
 */
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp, isFirebaseAuthConfigured } from './firebaseAuth.js';
import { normalizeUserPlan } from './userPlan.js';

/** @returns {boolean} */
export function isPaidPlanAdminCloudEnabled() {
  return isFirebaseAuthConfigured && Boolean(firebaseApp);
}

/**
 * @param {unknown} err
 * @returns {string}
 */
export function formatPaidPlanAdminError(err) {
  const code = String(err?.code ?? '').replace(/^functions\//, '');
  const message = String(err?.message ?? '').trim();
  if (code === 'unauthenticated') return '로그인이 필요합니다.';
  if (code === 'permission-denied') return '관리자만 사용할 수 있습니다.';
  if (code === 'invalid-argument') {
    return message || '이메일 형식이 올바르지 않습니다.';
  }
  if (code === 'not-found') {
    return (
      message ||
      '해당 이메일로 가입·로그인(온보딩) 후 다시 등록해 주세요.'
    );
  }
  if (message) return message;
  return '처리에 실패했습니다. 잠시 후 다시 시도해 주세요.';
}

/**
 * @param {string} email
 * @param {'free' | 'paid' | string} plan
 * @returns {Promise<{
 *   ok: true,
 *   uid: string,
 *   email: string,
 *   plan: 'free' | 'paid',
 *   paidUpdatedAt: number,
 * }>}
 */
export async function setUserPlanByEmailCloud(email, plan) {
  if (!isPaidPlanAdminCloudEnabled()) {
    throw Object.assign(new Error('Firebase가 설정되지 않았습니다.'), {
      code: 'failed-precondition',
    });
  }
  const trimmed = String(email ?? '').trim();
  if (!trimmed) {
    throw Object.assign(new Error('이메일을 입력해 주세요.'), {
      code: 'invalid-argument',
    });
  }
  const fn = httpsCallable(getFunctions(firebaseApp), 'setUserPlanByEmail');
  const result = await fn({
    email: trimmed,
    plan: normalizeUserPlan(plan),
  });
  return /** @type {{
    ok: true,
    uid: string,
    email: string,
    plan: 'free' | 'paid',
    paidUpdatedAt: number,
  }} */ (result.data);
}
