import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { firebaseApp, isFirebaseAuthConfigured } from './firebaseAuth.js';

const COLLECTION = 'userCriteria';

/** @returns {boolean} */
export function isRuleSetsCloudEnabled() {
  return isFirebaseAuthConfigured && Boolean(firebaseApp);
}

/**
 * @param {string | null | undefined} activeSetId
 * @param {{ id: string }[]} sets
 * @returns {string | null}
 */
export function resolveCloudActiveSetId(activeSetId, sets) {
  const id = String(activeSetId ?? '').trim();
  if (id && sets.some((s) => s.id === id)) return id;
  return sets[0]?.id ?? null;
}

/**
 * hydrate 후 활성 세트 — localStorage·저장 프로젝트를 클라우드 초안보다 우선
 * @param {import('./ruleSetsStorage.js').RuleSet[]} sets
 * @param {string | null | undefined} localActiveId
 * @param {string | null | undefined} cloudActiveId
 * @returns {string | null}
 */
export function resolveHydratedActiveSetId(sets, localActiveId, cloudActiveId) {
  if (!sets.length) return null;

  const savedNamed = [...sets]
    .filter((set) => Boolean(set.savedAt) && (set.name || '').trim())
    .sort(
      (a, b) => Date.parse(b.savedAt ?? '') - Date.parse(a.savedAt ?? ''),
    );

  const localId = resolveCloudActiveSetId(localActiveId, sets);
  if (localId) {
    const localSet = sets.find((set) => set.id === localId);
    if (localSet?.savedAt && (localSet.name || '').trim()) return localId;
  }

  if (savedNamed.length) return savedNamed[0].id;

  return (
    resolveCloudActiveSetId(localActiveId, sets) ??
    resolveCloudActiveSetId(cloudActiveId, sets) ??
    sets[0]?.id ??
    null
  );
}

/**
 * @param {string} uid
 */
function criteriaDocRef(uid) {
  return doc(getFirestore(firebaseApp), COLLECTION, uid.trim());
}

/**
 * @param {string} uid
 * @returns {Promise<{
 *   ruleSets: import('./ruleSetsStorage.js').RuleSet[],
 *   activeSetId: string | null,
 * } | null>}
 */
export async function loadRuleSetsCloud(uid) {
  const id = String(uid ?? '').trim();
  if (!isRuleSetsCloudEnabled() || !id) return null;

  const snap = await getDoc(criteriaDocRef(id));
  if (!snap.exists()) return null;

  const data = snap.data();
  if (!Array.isArray(data.ruleSets) || !data.ruleSets.length) return null;

  return {
    ruleSets: data.ruleSets.map((set) => ({ ...(set ?? {}) })),
    activeSetId:
      typeof data.activeSetId === 'string' ? data.activeSetId.trim() : null,
  };
}

/**
 * @param {string} uid
 * @param {import('./ruleSetsStorage.js').RuleSet[]} ruleSets
 * @param {string | null | undefined} activeSetId
 */
export async function saveRuleSetsCloud(uid, ruleSets, activeSetId) {
  const id = String(uid ?? '').trim();
  if (!isRuleSetsCloudEnabled() || !id) return false;

  await setDoc(
    criteriaDocRef(id),
    {
      ruleSets,
      activeSetId: activeSetId ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return true;
}
