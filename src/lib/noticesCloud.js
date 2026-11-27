/**
 * 공지 Firestore 읽기 · 관리자 직접 쓰기.
 * 쓰기는 보안 규칙이 관리자만 허용한다.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  firebaseApp,
  getCurrentUserSession,
  isFirebaseAuthConfigured,
} from './firebaseAuth.js';
import { getLatestNotice, normalizeNotices } from './notices.js';

const COLLECTION = 'notices';
const TITLE_MAX = 200;
const BODY_MAX = 5000;

/** @returns {boolean} */
export function isNoticesCloudEnabled() {
  return isFirebaseAuthConfigured && Boolean(firebaseApp);
}

/** @returns {ReturnType<typeof getFirestore>} */
function getDb() {
  if (!isNoticesCloudEnabled()) {
    throw Object.assign(new Error('Firebase가 설정되지 않았습니다.'), {
      code: 'failed-precondition',
    });
  }
  return getFirestore(firebaseApp);
}

/** @returns {string} */
function requireAdminUid() {
  const uid = String(getCurrentUserSession()?.uid ?? '').trim();
  if (!uid) {
    throw Object.assign(new Error('로그인이 필요합니다.'), {
      code: 'unauthenticated',
    });
  }
  return uid;
}

/**
 * @param {unknown} input
 * @returns {{ title: string, body: string, pinned: boolean }}
 */
function parseNoticeInput(input) {
  const title = typeof input?.title === 'string' ? input.title.trim() : '';
  const body = typeof input?.body === 'string' ? input.body.trim() : '';
  if (!title) {
    throw Object.assign(new Error('제목을 입력해 주세요.'), {
      code: 'invalid-argument',
    });
  }
  if (title.length > TITLE_MAX) {
    throw Object.assign(new Error(`제목은 ${TITLE_MAX}자까지 입력할 수 있어요.`), {
      code: 'invalid-argument',
    });
  }
  if (body.length > BODY_MAX) {
    throw Object.assign(new Error(`본문은 ${BODY_MAX}자까지 입력할 수 있어요.`), {
      code: 'invalid-argument',
    });
  }
  return { title, body, pinned: input?.pinned === true };
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
function parseNoticeId(raw) {
  const id = typeof raw === 'string' ? raw.trim() : '';
  if (!id) {
    throw Object.assign(new Error('공지 아이디가 없습니다.'), {
      code: 'invalid-argument',
    });
  }
  if (id.length > 128 || /[\/\\]/.test(id)) {
    throw Object.assign(new Error('공지 아이디가 올바르지 않습니다.'), {
      code: 'invalid-argument',
    });
  }
  return id;
}

/**
 * @param {unknown} err
 * @returns {string}
 */
export function formatNoticeAdminError(err) {
  const code = String(err?.code ?? '').replace(/^(functions|firestore)\//, '');
  const message = String(err?.message ?? '').trim();
  if (code === 'unauthenticated') return '로그인이 필요합니다.';
  if (code === 'permission-denied') return '관리자만 공지를 쓸 수 있습니다.';
  if (code === 'invalid-argument') {
    return message || '제목이나 본문을 확인해 주세요.';
  }
  if (code === 'not-found') {
    return message || '공지를 찾을 수 없습니다. 새로고침한 뒤 다시 시도해 주세요.';
  }
  if (code === 'not-found' || /not-found/i.test(code)) {
    if (/Cloud Function|firebase:paid-admin|찾을 수 없습니다/i.test(message)) {
      return message;
    }
  }
  if (code === 'internal' || code === 'unavailable') {
    return message && !/^internal$/i.test(message)
      ? message
      : '서버 오류입니다. 잠시 후 다시 시도해 주세요.';
  }
  if (message && !/^internal$/i.test(message)) return message;
  return '처리에 실패했습니다. 잠시 후 다시 시도해 주세요.';
}

/**
 * @returns {Promise<ReturnType<typeof normalizeNotices>>}
 */
export async function fetchNotices() {
  const snap = await getDocs(collection(getDb(), COLLECTION));
  const rows = snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
  return normalizeNotices(rows);
}

/**
 * @returns {Promise<ReturnType<typeof getLatestNotice>>}
 */
export async function fetchLatestNotice() {
  return getLatestNotice(await fetchNotices());
}

/**
 * @param {{ title: string, body: string, pinned?: boolean }} input
 * @returns {Promise<{ ok: true, id: string }>}
 */
export async function createNoticeCloud(input) {
  const db = getDb();
  const uid = requireAdminUid();
  const parsed = parseNoticeInput(input);
  const ref = await addDoc(collection(db, COLLECTION), {
    title: parsed.title,
    body: parsed.body,
    pinned: parsed.pinned,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdByUid: uid,
  });
  return { ok: true, id: ref.id };
}

/**
 * @param {{ id: string, title: string, body: string, pinned?: boolean }} input
 * @returns {Promise<{ ok: true, id: string }>}
 */
export async function updateNoticeCloud(input) {
  const db = getDb();
  requireAdminUid();
  const id = parseNoticeId(input?.id);
  const parsed = parseNoticeInput(input);
  await updateDoc(doc(db, COLLECTION, id), {
    title: parsed.title,
    body: parsed.body,
    pinned: parsed.pinned,
    updatedAt: serverTimestamp(),
  });
  return { ok: true, id };
}

/**
 * @param {string} id
 * @returns {Promise<{ ok: true, id: string }>}
 */
export async function deleteNoticeCloud(id) {
  const db = getDb();
  requireAdminUid();
  const noticeId = parseNoticeId(id);
  await deleteDoc(doc(db, COLLECTION, noticeId));
  return { ok: true, id: noticeId };
}
