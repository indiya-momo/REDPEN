/**
 * 로그인·클라우드 hydrate 시 로컬과 클라우드 기준 병합.
 * 같은 id는 savedAt이 더 최신인 쪽을 우선한다.
 */
import { enforceMaxCriteriaPresets } from './criteriaPresetLimit.js';

/** @param {string | undefined} iso */
function savedAtMs(iso) {
  const ms = Date.parse(String(iso ?? ''));
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * @param {import('./ruleSetsStorage.js').RuleSet} a
 * @param {import('./ruleSetsStorage.js').RuleSet} b
 * @returns {import('./ruleSetsStorage.js').RuleSet}
 */
export function pickNewerRuleSet(a, b) {
  const aSaved = Boolean(a.savedAt);
  const bSaved = Boolean(b.savedAt);

  if (aSaved && !bSaved) return { ...a };
  if (!aSaved && bSaved) return { ...b };

  if (aSaved && bSaved) {
    return savedAtMs(a.savedAt) >= savedAtMs(b.savedAt) ? { ...a } : { ...b };
  }

  // 둘 다 초안 — 클라oud 쪽(두 번째 인자 관례)을 우선하지 않고, 호출부에서 b를 cloud로 넘김
  return { ...b };
}

/**
 * 디스크(localStorage)와 메모리(React ref)를 id별로 합친다.
 * 로그인 직전 autosave가 디스크에 반영되지 않았을 때 최신 편집을 잃지 않게 한다.
 *
 * @param {import('./ruleSetsStorage.js').RuleSet[]} diskSets
 * @param {import('./ruleSetsStorage.js').RuleSet[]} memorySets
 * @returns {import('./ruleSetsStorage.js').RuleSet[]}
 */
export function mergeLocalRuleSetSources(diskSets, memorySets) {
  /** @type {Map<string, import('./ruleSetsStorage.js').RuleSet>} */
  const byId = new Map();

  for (const set of diskSets ?? []) {
    byId.set(set.id, { ...set });
  }
  for (const set of memorySets ?? []) {
    const prev = byId.get(set.id);
    byId.set(set.id, prev ? pickNewerRuleSet(prev, set) : { ...set });
  }

  return [...byId.values()];
}

/**
 * 동일 이름(saved) 프로젝트가 id만 다를 때 savedAt 최신 1건만 남긴다.
 *
 * @param {import('./ruleSetsStorage.js').RuleSet[]} ruleSets
 * @returns {import('./ruleSetsStorage.js').RuleSet[]}
 */
export function dedupeSavedRuleSetsByName(ruleSets) {
  /** @type {Map<string, import('./ruleSetsStorage.js').RuleSet>} */
  const newestByName = new Map();

  for (const set of ruleSets ?? []) {
    if (!set.savedAt) continue;
    const name = (set.name || '').trim();
    if (!name) continue;
    const prev = newestByName.get(name);
    if (!prev || savedAtMs(set.savedAt) >= savedAtMs(prev.savedAt)) {
      newestByName.set(name, set);
    }
  }

  const dropIds = new Set();
  for (const set of ruleSets ?? []) {
    if (!set.savedAt) continue;
    const name = (set.name || '').trim();
    if (!name) continue;
    if (newestByName.get(name)?.id !== set.id) {
      dropIds.add(set.id);
    }
  }

  return (ruleSets ?? []).filter((set) => !dropIds.has(set.id));
}

/**
 * @param {import('./ruleSetsStorage.js').RuleSet[]} localSets
 * @param {import('./ruleSetsStorage.js').RuleSet[]} cloudSets
 * @returns {import('./ruleSetsStorage.js').RuleSet[]}
 */
export function mergeRuleSetsOnLogin(localSets, cloudSets) {
  const local = localSets ?? [];
  const cloud = cloudSets ?? [];
  if (!cloud.length) return [...local];
  if (!local.length) return [...cloud];

  /** @type {Map<string, import('./ruleSetsStorage.js').RuleSet>} */
  const byId = new Map(local.map((set) => [set.id, { ...set }]));

  for (const cloudSet of cloud) {
    const localSet = byId.get(cloudSet.id);
    if (!localSet) {
      byId.set(cloudSet.id, { ...cloudSet });
      continue;
    }
    byId.set(cloudSet.id, pickNewerRuleSet(localSet, cloudSet));
  }

  for (const localSet of local) {
    if (!localSet.savedAt) continue;
    const current = byId.get(localSet.id);
    if (!current) {
      byId.set(localSet.id, { ...localSet });
      continue;
    }
    byId.set(localSet.id, pickNewerRuleSet(localSet, current));
  }

  return [...byId.values()];
}

/**
 * 로드·동기화 직후 — 동일 이름 dedupe + 저장 슬롯 상한 적용
 *
 * @param {import('./ruleSetsStorage.js').RuleSet[]} ruleSets
 * @param {string} [uid]
 * @param {string} [email]
 */
export function applyCriteriaPresetQuota(ruleSets, uid = '', email = '') {
  return dedupeSavedRuleSetsByName(
    enforceMaxCriteriaPresets(ruleSets ?? [], uid, email),
  );
}

/**
 * localStorage 저장 직전 병합 — 다른 창(마이페이지)에서 반영한 태그·삭제를 메인 autosave가 덮지 않게 한다.
 *
 * @param {import('./ruleSetsStorage.js').RuleSet[]} diskSets
 * @param {import('./ruleSetsStorage.js').RuleSet[]} memorySets
 * @returns {import('./ruleSetsStorage.js').RuleSet[]}
 */
export function mergeRuleSetsOnPersist(diskSets, memorySets) {
  const disk = diskSets ?? [];
  const memory = memorySets ?? [];
  if (!disk.length) return [...memory];
  if (!memory.length) return [...disk];

  const diskById = new Map(disk.map((set) => [set.id, set]));
  const diskSavedIds = new Set(
    disk.filter((set) => set.savedAt).map((set) => set.id),
  );
  const memorySavedIds = new Set(
    memory.filter((set) => set.savedAt).map((set) => set.id),
  );
  const diskSavedCount = diskSavedIds.size;
  const memorySavedCount = memorySavedIds.size;
  const externalDeletion =
    diskSavedCount > 0 &&
    diskSavedCount < memorySavedCount &&
    [...diskSavedIds].every((id) => memorySavedIds.has(id));

  let merged = memory.map((set) => {
    const diskSet = diskById.get(set.id);
    if (!diskSet) return { ...set };
    return pickNewerRuleSet(diskSet, set);
  });

  if (externalDeletion) {
    merged = merged.filter(
      (set) => !set.savedAt || diskSavedIds.has(set.id),
    );
  }

  const mergedIds = new Set(merged.map((set) => set.id));
  for (const diskSet of disk) {
    if (!mergedIds.has(diskSet.id)) {
      merged.push({ ...diskSet });
      mergedIds.add(diskSet.id);
    }
  }

  return merged;
}
