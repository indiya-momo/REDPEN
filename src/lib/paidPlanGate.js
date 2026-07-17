/**
 * 유료 혜택 게이트 — 클릭·저장 직전에 Firestore plan 을 local 과 맞춘 뒤 판정.
 * UI 는 이 모듈만 쓰고, plan 변수명과 planXxx() 저장 플랜이 겹치지 않게 한다.
 */
import { showAppAlert } from './appDialog.js';
import { ensureLocalPlanFromCloud } from './userProfileCloud.js';
import { isPaidPlan, PAID_SHARE_ONLY_MESSAGE } from './userPlan.js';

/** 검수 결과 보관·다운로드 */
export const PAID_CHECK_RESULTS_ONLY_MESSAGE =
  '유료회원 전용입니다.\n검수 결과 자동 보관은 유료(plan: paid) 계정에서만 됩니다.';

/**
 * @param {string} uid
 * @returns {Promise<'free' | 'paid'>}
 */
export async function resolveUserPlan(uid) {
  return ensureLocalPlanFromCloud(uid);
}

/**
 * @param {string} uid
 * @returns {Promise<boolean>}
 */
export async function isPaidUser(uid) {
  const userPlan = await ensureLocalPlanFromCloud(uid);
  return isPaidPlan({ plan: userPlan });
}

/**
 * @param {string} uid
 * @returns {Promise<boolean>} true 면 공유 진행
 */
export async function assertPaidShareOrAlert(uid) {
  if (await isPaidUser(uid)) return true;
  await showAppAlert(PAID_SHARE_ONLY_MESSAGE);
  return false;
}

/**
 * @param {string} uid
 * @returns {Promise<boolean>} true 면 검수 이력 다운로드 진행
 */
export async function assertPaidCheckResultsOrAlert(uid) {
  if (await isPaidUser(uid)) return true;
  await showAppAlert(PAID_CHECK_RESULTS_ONLY_MESSAGE);
  return false;
}
