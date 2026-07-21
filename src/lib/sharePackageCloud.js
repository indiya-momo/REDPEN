/**
 * 공유 패키지 Firestore — create / get.
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
} from 'firebase/firestore';
import { firebaseApp, isFirebaseAuthConfigured } from './firebaseAuth.js';
import {
  buildSharePackagePayload,
  buildSharePackageUrl,
  isSharePackageExpired,
  SHARE_PACKAGE_COLLECTION,
} from './sharePackage.js';

/** @returns {boolean} */
export function isSharePackageCloudEnabled() {
  return isFirebaseAuthConfigured && Boolean(firebaseApp);
}

function packagesCol() {
  return collection(getFirestore(firebaseApp), SHARE_PACKAGE_COLLECTION);
}

/**
 * @param {{
 *   uid: string,
 *   ruleSet: import('./ruleSetsStorage.js').RuleSet,
 *   checkResults?: Array<Record<string, unknown>>,
 * }} args
 * @returns {Promise<{ ok: true, packageId: string, url: string } | { ok: false, reason: string }>}
 */
export async function createSharePackageCloud({
  uid,
  ruleSet,
  checkResults = [],
}) {
  const id = String(uid ?? '').trim();
  if (!isSharePackageCloudEnabled()) {
    return { ok: false, reason: 'cloud_disabled' };
  }
  if (!id) return { ok: false, reason: 'no_uid' };

  const payload = buildSharePackagePayload({
    ruleSet,
    checkResults,
    createdByUid: id,
  });
  if (!payload) return { ok: false, reason: 'invalid_project' };

  try {
    const ref = await addDoc(packagesCol(), payload);
    const packageId = ref.id;
    return {
      ok: true,
      packageId,
      url: buildSharePackageUrl(packageId),
    };
  } catch (err) {
    console.error('공유 패키지 생성 실패:', err);
    const code = String(err?.code ?? '');
    const message = String(err?.message ?? '');
    if (code === 'permission-denied') {
      return { ok: false, reason: 'permission_denied' };
    }
    if (
      code === 'invalid-argument' ||
      /unsupported field value|undefined/i.test(message)
    ) {
      return { ok: false, reason: 'invalid_payload' };
    }
    if (/exceeds|too large|size/i.test(message)) {
      return { ok: false, reason: 'too_large' };
    }
    return { ok: false, reason: 'create_failed' };
  }
}

/**
 * @param {string} packageId
 * @returns {Promise<{ ok: true, package: Record<string, unknown> } | { ok: false, reason: string }>}
 */
export async function getSharePackageCloud(packageId) {
  const id = String(packageId ?? '').trim();
  if (!isSharePackageCloudEnabled()) {
    return { ok: false, reason: 'cloud_disabled' };
  }
  if (!id) return { ok: false, reason: 'invalid_id' };

  try {
    const snap = await getDoc(doc(getFirestore(firebaseApp), SHARE_PACKAGE_COLLECTION, id));
    if (!snap.exists()) return { ok: false, reason: 'not_found' };
    const data = { id: snap.id, ...snap.data() };
    if (isSharePackageExpired(data)) {
      return { ok: false, reason: 'expired' };
    }
    return { ok: true, package: data };
  } catch (err) {
    console.error('공유 패키지 로드 실패:', err);
    return { ok: false, reason: 'load_failed' };
  }
}
