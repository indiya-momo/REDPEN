import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { firebaseApp, isFirebaseAuthConfigured } from './firebaseAuth.js';

const PARENT = 'userCriteria';
const SUB = 'checkResults';

/** @returns {boolean} */
export function isCheckResultsCloudEnabled() {
  return isFirebaseAuthConfigured && Boolean(firebaseApp);
}

/**
 * @param {string} uid
 */
function resultsCol(uid) {
  return collection(getFirestore(firebaseApp), PARENT, uid.trim(), SUB);
}

/**
 * @param {{
 *   uid: string,
 *   snapshot: {
 *     schemaVersion: number,
 *     kind: string,
 *     createdAt: number,
 *     expiresAt: number,
 *     projectId: string,
 *     pdfFileName: string,
 *     sheetName: string,
 *     filename: string,
 *     summaryLine: string,
 *     summary: object,
 *     rows: object[],
 *     truncated: boolean,
 *     rowCount: number,
 *   },
 * }} args
 * @returns {Promise<string | null>} doc id
 */
export async function saveCheckResultCloud({ uid, snapshot }) {
  const id = String(uid ?? '').trim();
  if (!isCheckResultsCloudEnabled() || !id || !snapshot?.projectId) return null;

  const ref = await addDoc(resultsCol(id), {
    ...snapshot,
    uid: id,
    savedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * @param {{ uid: string, projectId: string, now?: number }} args
 * @returns {Promise<Array<{ id: string } & Record<string, unknown>>>}
 */
export async function listCheckResultsCloud({ uid, projectId, now = Date.now() }) {
  const id = String(uid ?? '').trim();
  const pid = String(projectId ?? '').trim();
  if (!isCheckResultsCloudEnabled() || !id || !pid) return [];

  const q = query(resultsCol(id), where('projectId', '==', pid));
  const snap = await getDocs(q);
  /** @type {Array<{ id: string } & Record<string, unknown>>} */
  const rows = [];
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const expiresAt = Number(data.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) continue;
    rows.push({ id: docSnap.id, ...data });
  }
  rows.sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
  return rows;
}
