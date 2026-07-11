/**
 * 로그인·클라우드 hydrate 시 로컬과 클라우드 기준 병합.
 * 같은 id는 savedAt이 더 최신인 쪽을 우선한다.
 */
import { enforceMaxCriteriaPresets } from './criteriaPresetLimit.js';
import { mergeRuleSetProjectMeta } from './projectMeta.js';

/** @param {string | undefined} iso */
function savedAtMs(iso) {
  const ms = Date.parse(String(iso ?? ''));
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * @param {import('./ruleSetsStorage.js').RuleSet} a
 * @param {import('./ruleSetsStorage.js').RuleSet} b
 * @param {'first' | 'second'} [preferOnTie='first'] savedAt 동률일 때 우선할 쪽
 * @returns {import('./ruleSetsStorage.js').RuleSet}
 */
export function pickNewerRuleSet(a, b, preferOnTie = 'first') {
  const aSaved = Boolean(a.savedAt);
  const bSaved = Boolean(b.savedAt);

  /** @type {import('./ruleSetsStorage.js').RuleSet} */
  let winner;
  /** @type {import('./ruleSetsStorage.js').RuleSet} */
  let loser;

  if (aSaved && !bSaved) {
    winner = { ...a };
    loser = b;
  } else if (!aSaved && bSaved) {
    winner = { ...b };
    loser = a;
  } else if (aSaved && bSaved) {
    const aMs = savedAtMs(a.savedAt);
    const bMs = savedAtMs(b.savedAt);
    if (aMs > bMs) {
      winner = { ...a };
      loser = b;
    } else if (bMs > aMs) {
      winner = { ...b };
      loser = a;
    } else if (preferOnTie === 'second') {
      winner = { ...b };
      loser = a;
    } else {
      winner = { ...a };
      loser = b;
    }
  } else {
    winner = { ...b };
    loser = a;
  }

  return mergeRuleSetProjectMeta(winner, loser);
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
    byId.set(set.id, prev ? pickNewerRuleSet(set, prev, 'first') : { ...set });
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
 * 두 삭제 기록(툼스톤) 목록을 id 기준으로 합친다 — 같은 id는 삭제시각이 더 늦은 쪽을 남긴다.
 *
 * @param {{ id: string, deletedAt: string }[]} [a]
 * @param {{ id: string, deletedAt: string }[]} [b]
 * @returns {{ id: string, deletedAt: string }[]}
 */
export function mergeTombstones(a, b) {
  /** @type {Map<string, { id: string, deletedAt: string }>} */
  const byId = new Map();
  for (const row of [...(a ?? []), ...(b ?? [])]) {
    if (!row || typeof row.id !== 'string' || !row.id.trim()) continue;
    const id = row.id.trim();
    const deletedAt = typeof row.deletedAt === 'string' ? row.deletedAt : '';
    const prev = byId.get(id);
    if (!prev || savedAtMs(deletedAt) >= savedAtMs(prev.deletedAt)) {
      byId.set(id, { id, deletedAt });
    }
  }
  return [...byId.values()];
}

/**
 * 툼스톤을 적용해 삭제된 프로젝트를 목록에서 제거한다.
 * 예외 — 삭제시각 이후에 다시 저장(savedAt이 더 최신)한 항목은 "재생성"으로 보고 유지하며,
 * 그 id의 툼스톤은 더 이상 필요 없으므로 정리한다.
 *
 * @param {import('./ruleSetsStorage.js').RuleSet[]} sets
 * @param {{ id: string, deletedAt: string }[]} tombstones
 * @returns {{ sets: import('./ruleSetsStorage.js').RuleSet[], tombstones: { id: string, deletedAt: string }[] }}
 */
export function applyTombstones(sets, tombstones) {
  const list = sets ?? [];
  /** @type {Map<string, { id: string, deletedAt: string }>} */
  const tombById = new Map((tombstones ?? []).map((t) => [t.id, t]));
  if (!tombById.size) return { sets: [...list], tombstones: [] };

  const recreatedIds = new Set();
  const kept = list.filter((set) => {
    const tomb = tombById.get(set.id);
    if (!tomb) return true;
    if (set.savedAt && savedAtMs(set.savedAt) > savedAtMs(tomb.deletedAt)) {
      recreatedIds.add(set.id);
      return true;
    }
    return false;
  });

  const survivingTombstones = [...tombById.values()].filter(
    (t) => !recreatedIds.has(t.id),
  );
  return { sets: kept, tombstones: survivingTombstones };
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
 * `intent`로 "이번 저장에서 이 창이 일부러 추가/삭제한 id"를 알려주면,
 * 그 항목은 외부 변경 감지(externalDeletion·재삽입)에서 제외해 되돌리지 않는다.
 * intent가 비어 있으면 기존 동작과 동일하다.
 *
 * @param {import('./ruleSetsStorage.js').RuleSet[]} diskSets
 * @param {import('./ruleSetsStorage.js').RuleSet[]} memorySets
 * @param {{ added?: string[], removed?: string[] }} [intent]
 * @returns {import('./ruleSetsStorage.js').RuleSet[]}
 */
export function mergeRuleSetsOnPersist(diskSets, memorySets, intent = {}) {
  const disk = diskSets ?? [];
  const memory = memorySets ?? [];
  if (!disk.length) return [...memory];
  if (!memory.length) return [...disk];

  const addedIds = new Set(intent.added ?? []);
  const removedIds = new Set(intent.removed ?? []);

  const diskById = new Map(disk.map((set) => [set.id, set]));
  const diskSavedIds = new Set(
    disk.filter((set) => set.savedAt).map((set) => set.id),
  );
  const memorySavedIds = new Set(
    memory.filter((set) => set.savedAt).map((set) => set.id),
  );
  const diskSavedCount = diskSavedIds.size;
  // 이 창에서 방금 새로 넣은 항목(복제본)은 "외부 삭제" 판정 비교에서 제외한다.
  const memorySavedCountForCompare = [...memorySavedIds].filter(
    (id) => !addedIds.has(id),
  ).length;
  const externalDeletion =
    diskSavedCount > 0 &&
    diskSavedCount < memorySavedCountForCompare &&
    [...diskSavedIds].every((id) => memorySavedIds.has(id));

  let merged = memory.map((set) => {
    const diskSet = diskById.get(set.id);
    if (!diskSet) return { ...set };
    return pickNewerRuleSet(set, diskSet, 'first');
  });

  if (externalDeletion) {
    merged = merged.filter(
      (set) =>
        !set.savedAt || diskSavedIds.has(set.id) || addedIds.has(set.id),
    );
  }

  const mergedIds = new Set(merged.map((set) => set.id));
  for (const diskSet of disk) {
    // 이 창에서 방금 삭제한 항목은 디스크에 남아 있어도 되살리지 않는다.
    if (removedIds.has(diskSet.id)) continue;
    if (!mergedIds.has(diskSet.id)) {
      merged.push({ ...diskSet });
      mergedIds.add(diskSet.id);
    }
  }

  return merged;
}
