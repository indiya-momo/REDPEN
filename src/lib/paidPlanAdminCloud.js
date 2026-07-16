/**
 * 관리자 — 이메일로 유료(plan) 등록/해제 Callable 래퍼.
 */
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp, isFirebaseAuthConfigured } from './firebaseAuth.js';
import { normalizeUserPlan } from './userPlan.js';

/** Callable 배포 리전 (functions/index.js CALL_OPTS 와 동일) */
const FUNCTIONS_REGION = 'us-central1';

/** @returns {ReturnType<typeof getFunctions> | null} */
function getPaidAdminFunctions() {
  if (!isPaidPlanAdminCloudEnabled()) return null;
  return getFunctions(firebaseApp, FUNCTIONS_REGION);
}

/** @returns {boolean} */
export function isPaidPlanAdminCloudEnabled() {
  return isFirebaseAuthConfigured && Boolean(firebaseApp);
}

/**
 * httpsCallable 응답에서 data 를 안전하게 꺼낸다.
 * (SDK/버전에 따라 result 또는 result.data 형태가 달라질 수 있음)
 * @param {unknown} result
 * @returns {Record<string, unknown> | null}
 */
function unwrapCallableData(result) {
  if (!result || typeof result !== 'object') return null;
  const root = /** @type {Record<string, unknown>} */ (result);
  const nested = root.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return /** @type {Record<string, unknown>} */ (nested);
  }
  // 이미 언랩된 형태
  if ('ok' in root || 'uid' in root || 'paidUsers' in root || 'users' in root) {
    return root;
  }
  return null;
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
    if (/가입|온보딩|이메일/i.test(message)) {
      return (
        message ||
        '해당 이메일로 가입·로그인(온보딩) 후 다시 등록해 주세요.'
      );
    }
    return 'Cloud Function을 찾을 수 없습니다. firebase login 후 배포(npm run firebase:paid-admin:deploy)를 실행해 주세요.';
  }
  if (code === 'internal' || code === 'unavailable') {
    if (message && !/^internal$/i.test(message)) {
      // 클라 TypeError 메시지는 그대로 노출하지 않음
      if (/Cannot read properties of undefined/i.test(message)) {
        return '서버 응답을 읽지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.';
      }
      return message;
    }
    if (/no-app|initializeApp/i.test(String(err?.details ?? err?.message ?? ''))) {
      return '서버 Admin 초기화에 실패했습니다. 잠시 후 다시 시도해 주세요.';
    }
    return '서버 오류입니다. 잠시 후 다시 시도해 주세요.';
  }
  if (/Cannot read properties of undefined/i.test(message)) {
    return '서버 응답을 읽지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.';
  }
  if (message && !/^internal$/i.test(message)) return message;
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
  const trimmed = String(email ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
  if (!trimmed) {
    throw Object.assign(new Error('이메일을 입력해 주세요.'), {
      code: 'invalid-argument',
    });
  }
  const fn = httpsCallable(getPaidAdminFunctions(), 'setUserPlanByEmail');
  const result = await fn({
    email: trimmed,
    plan: normalizeUserPlan(plan),
  });
  const data = unwrapCallableData(result);
  const uid = data && typeof data.uid === 'string' ? data.uid.trim() : '';
  if (!data || !uid) {
    throw Object.assign(
      new Error('서버 응답을 읽지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.'),
      { code: 'internal' },
    );
  }
  return {
    ok: true,
    uid,
    email:
      typeof data.email === 'string' && data.email.trim()
        ? data.email.trim()
        : trimmed,
    plan: normalizeUserPlan(data.plan),
    paidUpdatedAt:
      typeof data.paidUpdatedAt === 'number' ? data.paidUpdatedAt : Date.now(),
  };
}

/**
 * @returns {Promise<{
 *   ok: true,
 *   users: { uid: string, email: string, paidUpdatedAt: number }[],
 * }>}
 */
export async function listPaidUsersCloud() {
  if (!isPaidPlanAdminCloudEnabled()) {
    throw Object.assign(new Error('Firebase가 설정되지 않았습니다.'), {
      code: 'failed-precondition',
    });
  }
  const fn = httpsCallable(getPaidAdminFunctions(), 'listPaidUsers');
  const result = await fn({});
  const data = unwrapCallableData(result);
  if (!data) {
    return { ok: true, users: [] };
  }
  const list = Array.isArray(data.paidUsers)
    ? data.paidUsers
    : Array.isArray(data.users)
      ? data.users
      : [];
  return {
    ok: true,
    users: /** @type {{ uid: string, email: string, paidUpdatedAt: number }[]} */ (
      list
    ),
  };
}

/**
 * @param {number} ms
 */
export function formatPaidUpdatedAt(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '—';
  try {
    return new Date(n).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}
