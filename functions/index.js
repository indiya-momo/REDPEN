const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { isQuotaAdmin, parseAdminAllowlist } = require('./adminAllowlist.js');

const USER_CRITERIA = 'userCriteria';

/** provider-only 이메일 계정 스캔 상한 (페이지당 1000명) */
const LIST_USERS_MAX_PAGES = 5;

/** @type {import('firebase-admin/app').App | null} */
let adminApp = null;

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
 * Auth 사용자를 이메일로 찾는다.
 * getUserByEmail 은 top-level email 만 보므로, 실패 시 호출자·listUsers(상한)로 provider 이메일을 본다.
 * Admin updateUser(email) 은 클라 세션을 끊을 수 있어 쓰지 않는다.
 *
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
  for (let page = 0; page < LIST_USERS_MAX_PAGES; page += 1) {
    const result = await auth.listUsers(1000, pageToken);
    for (const user of result.users) {
      if (collectUserEmails(user).has(email)) return user;
    }
    pageToken = result.pageToken;
    if (!pageToken) break;
  }

  return null;
}

function resolveAdminEnv() {
  // PowerShell Set-Content BOM 대비
  const fromEnvEmails =
    process.env.BETA_QUOTA_ADMIN_EMAILS ??
    process.env['\ufeffBETA_QUOTA_ADMIN_EMAILS'] ??
    '';
  const fromEnvUids =
    process.env.BETA_QUOTA_ADMIN_UIDS ??
    process.env['\ufeffBETA_QUOTA_ADMIN_UIDS'] ??
    '';
  return {
    emails: fromEnvEmails,
    uids: fromEnvUids,
  };
}

async function assertAdmin(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  }

  const uid = String(request.auth.uid).trim();
  const adminEnv = resolveAdminEnv();
  const emailAllow = parseAdminAllowlist(adminEnv.emails, { lowercase: true });
  const uidAllow = parseAdminAllowlist(adminEnv.uids);

  if (emailAllow.length === 0 && uidAllow.length === 0) {
    console.error('assertAdmin: BETA_QUOTA_ADMIN_EMAILS/UIDS 가 비어 있음');
    throw new HttpsError(
      'failed-precondition',
      '관리자 allowlist가 설정되지 않았습니다.',
    );
  }

  const { auth } = getAdmin();

  if (isQuotaAdmin({ uid, token: { email: '' } }, adminEnv)) return;

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

  for (const adminEmail of emailAllow) {
    try {
      const adminUser = await auth.getUserByEmail(adminEmail);
      if (adminUser.uid === uid) return;
    } catch (err) {
      if (err?.code !== 'auth/user-not-found') {
        console.warn('assertAdmin getUserByEmail failed', err?.code);
      }
    }
  }

  console.warn('assertAdmin deny', {
    uid,
    callerEmailCount: callerEmails.size,
    allowEmailCount: emailAllow.length,
    allowUidCount: uidAllow.length,
  });
  throw new HttpsError('permission-denied', '관리자만 사용할 수 있습니다.');
}

const CALL_OPTS = {
  region: 'us-central1',
  timeoutSeconds: 60,
  cors: true,
  invoker: 'public',
};

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
      console.error('resolveTargetUser failed', err?.code ?? err);
      throw new HttpsError('internal', '사용자 조회에 실패했습니다.');
    }

    if (!user) {
      throw new HttpsError(
        'not-found',
        '해당 이메일로 가입·로그인(온보딩) 후 다시 등록해 주세요.',
      );
    }

    const resolvedEmail = normalizeEmail(user.email) || email;
    const targetUid = user.uid;
    const now = Date.now();
    const ref = db.collection(USER_CRITERIA).doc(targetUid);
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

    return {
      ok: true,
      uid: targetUid,
      email: resolvedEmail,
      plan,
      paidUpdatedAt: now,
    };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error('setUserPlanByEmail unexpected', err);
    throw new HttpsError('internal', '유료 등록 처리에 실패했습니다.');
  }
});

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

    for (const docSnap of snap.docs) {
      const profile = docSnap.data()?.profile ?? {};
      let email = normalizeEmail(profile.paidEmail);
      if (!email) {
        try {
          const user = await auth.getUser(docSnap.id);
          email =
            normalizeEmail(user.email) ||
            [...collectUserEmails(user)][0] ||
            '';
        } catch {
          email = '';
        }
      }
      paidUsers.push({
        uid: docSnap.id,
        email,
        paidUpdatedAt:
          typeof profile.paidUpdatedAt === 'number' ? profile.paidUpdatedAt : 0,
      });
    }

    paidUsers.sort((a, b) => b.paidUpdatedAt - a.paidUpdatedAt);

    return { ok: true, paidUsers };
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
