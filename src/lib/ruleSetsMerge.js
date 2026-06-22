/**
 * 로그인·클라우드 hydrate 시 로컬과 클라우드 기준 병합.
 * localStorage에 savedAt이 있는 프로젝트는 클라우드가 절대 덮지 않는다.
 */

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
    if (localSet?.savedAt) {
      continue;
    }
    byId.set(cloudSet.id, { ...cloudSet });
  }

  for (const localSet of local) {
    if (!localSet.savedAt) continue;
    byId.set(localSet.id, { ...localSet });
  }

  return [...byId.values()];
}
