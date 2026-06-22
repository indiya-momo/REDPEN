/**
 * 로그인·클라우드 hydrate 시 로컬과 클라우드 기준 병합.
 * 저장 프로젝트(savedAt)가 클라우드 초안에 덮이지 않도록 한다.
 */

/**
 * @param {string | undefined} a
 * @param {string | undefined} b
 */
function savedAtMillis(a, b) {
  const ma = Date.parse(a ?? '');
  const mb = Date.parse(b ?? '');
  return {
    a: Number.isFinite(ma) ? ma : 0,
    b: Number.isFinite(mb) ? mb : 0,
  };
}

/**
 * @param {import('./ruleSetsStorage.js').RuleSet} cloudSet
 * @param {import('./ruleSetsStorage.js').RuleSet} localSet
 */
function preferLocalSavedPreset(cloudSet, localSet) {
  if (!localSet.savedAt) return false;
  if (!cloudSet.savedAt) return true;
  const { a: cloudMs, b: localMs } = savedAtMillis(
    cloudSet.savedAt,
    localSet.savedAt,
  );
  return localMs >= cloudMs;
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
  const byId = new Map(cloud.map((set) => [set.id, { ...set }]));

  for (const localSet of local) {
    if (!localSet.savedAt) continue;

    const name = (localSet.name || '').trim();
    const bySameId = byId.get(localSet.id);
    if (bySameId) {
      if (preferLocalSavedPreset(bySameId, localSet)) {
        byId.set(localSet.id, { ...bySameId, ...localSet, id: localSet.id });
      }
      continue;
    }

    if (name) {
      const bySameName = [...byId.values()].find(
        (set) => (set.name || '').trim() === name && Boolean(set.savedAt),
      );
      if (bySameName) {
        if (preferLocalSavedPreset(bySameName, localSet)) {
          byId.set(bySameName.id, {
            ...bySameName,
            ...localSet,
            id: bySameName.id,
          });
        }
        continue;
      }
    }

    byId.set(localSet.id, { ...localSet });
  }

  return [...byId.values()];
}
