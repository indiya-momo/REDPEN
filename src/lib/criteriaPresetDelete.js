/**
 * 저장된 기준 삭제 후 남은 세트·활성 ID를 계산한다.
 *
 * @param {import('./ruleSetsStorage.js').RuleSet[]} sets
 * @param {string} activeId
 * @param {string} targetId
 * @returns {{
 *   ok: true,
 *   next: import('./ruleSetsStorage.js').RuleSet[],
 *   nextActiveId: string | null,
 *   needsDefault: boolean,
 *   label: string,
 * } | { ok: false, reason: 'not_found' | 'not_saved' }}
 */
export function planCriteriaPresetDelete(sets, activeId, targetId) {
  const target = sets.find((s) => s.id === targetId);
  if (!target) return { ok: false, reason: 'not_found' };

  if (!target.savedAt) return { ok: false, reason: 'not_saved' };

  const label = (target.name || '이름 없는 기준').trim() || '이름 없는 기준';
  const next = sets.filter((s) => s.id !== targetId);

  if (targetId !== activeId) {
    return { ok: true, next, nextActiveId: activeId, needsDefault: false, label };
  }

  if (!next.length) {
    return { ok: true, next: [], nextActiveId: null, needsDefault: true, label };
  }

  const unsaved = next.find((s) => !s.savedAt);
  if (unsaved) {
    return {
      ok: true,
      next,
      nextActiveId: unsaved.id,
      needsDefault: false,
      label,
    };
  }

  const latestSaved = [...next]
    .filter((s) => s.savedAt)
    .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))[0];

  return {
    ok: true,
    next,
    nextActiveId: latestSaved?.id ?? next[0].id,
    needsDefault: false,
    label,
  };
}
