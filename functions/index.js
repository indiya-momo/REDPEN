const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { isQuotaAdmin, parseAdminAllowlist } = require('./adminAllowlist.js');

const USER_CRITERIA = 'userCriteria';

/**
 * .env 배포가 깨져도 동작하도록 운영자 식별자를 코드에 고정.
 * (functions/.env 의 BETA_QUOTA_ADMIN_* 와 합쳐짐)
 *
 * 참고: Google 로그인인데 Auth top-level email 이 비어 있는 계정이 있음.
 * 그 경우 getUserByEmail(관리자메일) 이 실패하므로 UID 도 고정한다.
 */
const BUILTIN_ADMIN_EMAILS = ['wakano1017@gmail.com'];
const BUILTIN_ADMIN_UIDS = ['sRAczpH8p3YpFOKKmZhJNLxL5Vh1'];

/** @type {import('firebase-admin/app').App | null} */
let adminApp = null;

/** Admin SDK 앱을 한 번만 초기화하고, 같은 인스턴스를 Auth/Firestore에 전달 */
function ensureAdminApp() {
  const { initializeApp, getApps } = require('firebase-admin/app');
  if (!adminApp) {
    adminApp = getApps().length > 0 ? getApps()[0] : initializeApp();
  }
  return adminApp;
}

function getAdmin() {
  const app = ensureAdminApp();
  const { getAuth } = require('firebase-admin/auth');
  const { getFirestore, FieldValue } = require('firebase-admin/firestore');
  return {
    auth: getAuth(app),
    db: getFirestore(app),
    FieldValue,
  };
}

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
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * top-level email + providerData email 수집.
 * getUserByEmail 은 top-level 만 보므로 provider 이메일도 따로 본다.
 * @param {import('firebase-admin/auth').UserRecord} user
 * @returns {Set<string>}
 */
function collectUserEmails(user) {
  /** @type {Set<string>} */
  const emails = new Set();
  if (user?.email) emails.add(normalizeEmail(user.email));
  for (const provider of user?.providerData ?? []) {
    if (provider.email) emails.add(normalizeEmail(provider.email));
  }
  return emails;
}

/**
 * provider 에만 이메일이 있는 계정은 getUserByEmail 이 실패한다.
 * Admin updateUser(email) 로 top-level 을 채우면 클라이언트 세션이
 * 끊길 수 있어, 조회만 하고 Auth 레코드는 수정하지 않는다.
 * @param {import('firebase-admin/auth').Auth} auth
 * @param {string} email
 * @param {string} [callerUid]
 * @returns {Promise<import('firebase-admin/auth').UserRecord | null>}
 */
async function resolveTargetUser(auth, email, callerUid = '') {
  try {
    return await auth.getUserByEmail(email);
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') throw err;
  }

  if (callerUid) {
    try {
      const caller = await auth.getUser(callerUid);
      if (collectUserEmails(caller).has(email)) return caller;
    } catch (err) {
      console.warn('resolveTargetUser caller getUser failed', callerUid, err?.code);
    }
  }

  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      if (collectUserEmails(user).has(email)) return user;
    }
    pageToken = page.pageToken;
  } while (pageToken);

  return null;
}

function resolveAdminEnv() {
  const fromEnvEmails =
    process.env.BETA_QUOTA_ADMIN_EMAILS ??
    process.env['\ufeffBETA_QUOTA_ADMIN_EMAILS'] ??
    '';
  const fromEnvUids =
    process.env.BETA_QUOTA_ADMIN_UIDS ??
    process.env['\ufeffBETA_QUOTA_ADMIN_UIDS'] ??
    '';
  const mergedEmails = [
    ...BUILTIN_ADMIN_EMAILS,
    ...parseAdminAllowlist(fromEnvEmails, { lowercase: true }),
  ].join(',');
  const mergedUids = [
    ...BUILTIN_ADMIN_UIDS,
    ...parseAdminAllowlist(fromEnvUids),
  ].join(',');
  return { emails: mergedEmails, uids: mergedUids };
}

async function assertAdmin(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  }

  const uid = String(request.auth.uid).trim();
  const adminEnv = resolveAdminEnv();
  const { auth } = getAdmin();

  // 1) uid allowlist (토큰/Auth email 이 비어 있어도 통과)
  if (isQuotaAdmin({ uid, token: { email: '' } }, adminEnv)) return;

  // 2) 호출자 이메일을 여러 경로로 수집
  /** @type {Set<string>} */
  const callerEmails = new Set();
  const tokenEmail = normalizeEmail(request.auth.token?.email);
  if (tokenEmail) callerEmails.add(tokenEmail);

  try {
    const user = await auth.getUser(uid);
    for (const mail of collectUserEmails(user)) callerEmails.add(mail);
  } catch (err) {
    console.warn('assertAdmin getUser failed', uid, err?.code ?? err);
  }

  for (const email of callerEmails) {
    if (isQuotaAdmin({ uid, token: { email } }, adminEnv)) return;
  }

  // 3) 관리자 이메일의 Auth uid 와 대조 (top-level email 이 있을 때만 유효)
  const adminEmails = parseAdminAllowlist(adminEnv.emails, {
    lowercase: true,
  });
  for (const adminEmail of adminEmails) {
    try {
      const adminUser = await auth.getUserByEmail(adminEmail);
      if (adminUser.uid === uid) return;
    } catch (err) {
      if (err?.code !== 'auth/user-not-found') {
        console.warn('assertAdmin getUserByEmail failed', adminEmail, err?.code);
      }
    }
  }

  console.warn('assertAdmin deny', {
    uid,
    callerEmails: [...callerEmails],
    envEmails: adminEnv.emails,
    envUids: adminEnv.uids,
  });
  throw new HttpsError('permission-denied', '관리자만 사용할 수 있습니다.');
}

const CALL_OPTS = {
  region: 'us-central1',
  timeoutSeconds: 60,
  cors: true,
  invoker: 'public',
};

/**
 * 관리자가 이메일로 대상 계정의 profile.plan 을 paid|free 로 설정한다.
 */
exports.setUserPlanByEmail = onCall(CALL_OPTS, async (request) => {
  try {
    await assertAdmin(request);

    const email = normalizeEmail(request.data?.email);
    const plan = normalizeUserPlan(request.data?.plan);
    if (!email || !email.includes('@')) {
      throw new HttpsError(
        'invalid-argument',
        '이메일 형식이 올바르지 않습니다.',
      );
    }

    const { auth, db, FieldValue } = getAdmin();

    let user;
    try {
      user = await resolveTargetUser(auth, email, request.auth.uid);
    } catch (err) {
      console.error('resolveTargetUser failed', email, err?.code ?? err);
      throw new HttpsError('internal', '사용자 조회에 실패했습니다.');
    }

    if (!user) {
      throw new HttpsError(
        'not-found',
        '해당 이메일로 가입·로그인(온보딩) 후 다시 등록해 주세요.',
      );
    }

    const resolvedEmail = normalizeEmail(user.email) || email;
    const uid = user.uid;
    const now = Date.now();
    const ref = db.collection(USER_CRITERIA).doc(uid);
    const snap = await ref.get();

    if (!snap.exists) {
      await ref.set({
        profile: {
          plan,
          paidUpdatedAt: now,
          paidUpdatedBy: request.auth.uid,
          ...(plan === 'paid' ? { paidEmail: resolvedEmail } : {}),
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      /** @type {Record<string, unknown>} */
      const patch = {
        'profile.plan': plan,
        'profile.paidUpdatedAt': now,
        'profile.paidUpdatedBy': request.auth.uid,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (plan === 'paid') {
        patch['profile.paidEmail'] = resolvedEmail;
      } else {
        patch['profile.paidEmail'] = FieldValue.delete();
      }
      await ref.update(patch);
    }

    const payload = {
      ok: true,
      uid,
      email: resolvedEmail,
      plan,
      paidUpdatedAt: now,
    };
    console.info('setUserPlanByEmail ok', {
      uid: payload.uid,
      email: payload.email,
      plan: payload.plan,
    });
    return payload;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error('setUserPlanByEmail unexpected', err);
    throw new HttpsError('internal', '유료 등록 처리에 실패했습니다.');
  }
});

/**
 * 관리자 — 현재 plan=paid 인 계정 목록 (이메일·등록 시각).
 */
exports.listPaidUsers = onCall(CALL_OPTS, async (request) => {
  try {
    await assertAdmin(request);

    const { auth, db } = getAdmin();
    const snap = await db
      .collection(USER_CRITERIA)
      .where('profile.plan', '==', 'paid')
      .get();

    /** @type {{ uid: string, email: string, paidUpdatedAt: number }[]} */
    const paidUsers = [];

    for (const doc of snap.docs) {
      const profile = doc.data()?.profile ?? {};
      let email = normalizeEmail(profile.paidEmail);
      if (!email) {
        try {
          const user = await auth.getUser(doc.id);
          email =
            normalizeEmail(user.email) ||
            [...collectUserEmails(user)][0] ||
            '';
        } catch {
          email = '';
        }
      }
      paidUsers.push({
        uid: doc.id,
        email,
        paidUpdatedAt:
          typeof profile.paidUpdatedAt === 'number' ? profile.paidUpdatedAt : 0,
      });
    }

    paidUsers.sort((a, b) => b.paidUpdatedAt - a.paidUpdatedAt);
    console.info('listPaidUsers ok', { count: paidUsers.length });

    // 클라이언트는 paidUsers 를 우선 사용 (users 키 혼동 방지)
    return { ok: true, paidUsers, users: paidUsers };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error('listPaidUsers unexpected', err);
    const msg = String(err?.message ?? '');
    if (/index|FAILED_PRECONDITION/i.test(msg)) {
      throw new HttpsError(
        'failed-precondition',
        'Firestore 인덱스가 필요합니다. Firebase 콘솔의 인덱스 링크를 확인해 주세요.',
      );
    }
    throw new HttpsError('internal', '유료 목록 조회에 실패했습니다.');
  }
});
