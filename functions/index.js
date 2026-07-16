const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { isQuotaAdmin } = require('./adminAllowlist.js');

initializeApp();

const USER_CRITERIA = 'userCriteria';

/**
 * @param {unknown} raw
 * @returns {'free' | 'paid'}
 */
function normalizeUserPlan(raw) {
  return raw === 'paid' ? 'paid' : 'free';
}

/**
 * @param {unknown} raw
 */
function normalizeEmail(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase();
}

/**
 * 관리자가 이메일로 대상 계정의 profile.plan 을 paid|free 로 설정한다.
 * 환경 변수: BETA_QUOTA_ADMIN_UIDS, BETA_QUOTA_ADMIN_EMAILS (쉼표 구분)
 *
 * profile 중첩 필드는 점 표기 update로 nickname 등 기존 값을 지우지 않는다.
 */
exports.setUserPlanByEmail = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  }

  const adminEnv = {
    uids: process.env.BETA_QUOTA_ADMIN_UIDS ?? '',
    emails: process.env.BETA_QUOTA_ADMIN_EMAILS ?? '',
  };
  if (!isQuotaAdmin(request.auth, adminEnv)) {
    throw new HttpsError('permission-denied', '관리자만 사용할 수 있습니다.');
  }

  const email = normalizeEmail(request.data?.email);
  const plan = normalizeUserPlan(request.data?.plan);
  if (!email || !email.includes('@')) {
    throw new HttpsError('invalid-argument', '이메일 형식이 올바르지 않습니다.');
  }

  let user;
  try {
    user = await getAuth().getUserByEmail(email);
  } catch (err) {
    if (err && err.code === 'auth/user-not-found') {
      throw new HttpsError(
        'not-found',
        '해당 이메일로 가입·로그인(온보딩) 후 다시 등록해 주세요.',
      );
    }
    throw new HttpsError('internal', '사용자 조회에 실패했습니다.');
  }

  const uid = user.uid;
  const now = Date.now();
  const ref = getFirestore().collection(USER_CRITERIA).doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set({
      profile: {
        plan,
        paidUpdatedAt: now,
        paidUpdatedBy: request.auth.uid,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await ref.update({
      'profile.plan': plan,
      'profile.paidUpdatedAt': now,
      'profile.paidUpdatedBy': request.auth.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  return {
    ok: true,
    uid,
    email: user.email ?? email,
    plan,
    paidUpdatedAt: now,
  };
});
