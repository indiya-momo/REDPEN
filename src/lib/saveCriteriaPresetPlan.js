import { normalizeRuleSet } from './ruleSetNormalize.js';
import { newId } from './ruleSetsStorage.js';
import { mergeProjectContext } from './projectMeta.js';

/**
 * 검수 화면 "저장"의 대상 프로젝트를 정하는 순수 규칙.
 *
 * 핵심 원칙: 저장은 "지금 작업 중인 프로젝트(sourceId)"를 기준으로 한다.
 * 이름(name)은 그 프로젝트의 표지(제목)를 바꾸는 값일 뿐, 다른 프로젝트를
 * 찾아 덮어쓰는 열쇠로 쓰지 않는다. 그래서 입력한 이름이 "다른" 프로젝트와
 * 겹치면 조용히 덮어쓰지 않고 duplicate_name으로 막는다.
 *
 * @param {import('./ruleSetsStorage.js').RuleSet[]} sets
 * @param {{
 *   sourceId: string,
 *   name: string,
 *   config: object,
 *   savedAt: string,
 *   criteriaCheckpoint?: string,
 *   projectContextSnapshot?: object | null,
 *   createId?: () => string,
 * }} params
 * @returns {
 *   | { ok: false, reason: 'not_found' | 'empty_name' | 'duplicate_name' }
 *   | { ok: true, next: import('./ruleSetsStorage.js').RuleSet[], targetId: string, intent: { added?: string[] } }
 * }
 */
export function planSaveCriteriaPreset(sets, params) {
  const {
    sourceId,
    name,
    config,
    savedAt,
    criteriaCheckpoint,
    projectContextSnapshot = null,
    createId = newId,
  } = params;

  const list = sets ?? [];
  const source = list.find((s) => s.id === sourceId);
  if (!source) return { ok: false, reason: 'not_found' };

  const trimmed = (name || '').trim();
  if (!trimmed) return { ok: false, reason: 'empty_name' };

  const existing = list.find((s) => (s.name || '').trim() === trimmed);

  // 이름이 "다른" 프로젝트와 겹치면 덮어쓰지 않고 막는다. (원본 보호)
  if (existing && existing.id !== sourceId) {
    return { ok: false, reason: 'duplicate_name' };
  }

  const contextBase = existing?.projectContext ?? source.projectContext;
  const projectContext = projectContextSnapshot
    ? mergeProjectContext(contextBase, projectContextSnapshot)
    : contextBase;

  const fields = {
    ...config,
    name: trimmed,
    savedAt,
    projectContext,
    criteriaCheckpoint,
  };

  // 1) 지금 작업 중인 그 프로젝트를 그대로 갱신 (이름이 자기 자신과 같은 경우)
  if (existing) {
    const targetId = existing.id; // 위 가드로 sourceId 와 동일함이 보장됨
    const next = list.map((s) =>
      s.id === targetId ? normalizeRuleSet({ ...s, ...fields }) : s,
    );
    return { ok: true, next, targetId, intent: {} };
  }

  // 2) 저장 안 된 단일 초안이면 그 초안 자리에 저장 (첫 저장)
  const soleDraft = list.length === 1 && !list[0]?.savedAt;
  if (soleDraft) {
    const targetId = list[0].id;
    const next = list.map((s) =>
      s.id === targetId ? normalizeRuleSet({ id: targetId, ...fields }) : s,
    );
    return { ok: true, next, targetId, intent: {} };
  }

  // 3) 새 이름 → 새 프로젝트로 만들어 목록에 추가 (슬롯 채우기)
  const targetId = createId();
  const created = normalizeRuleSet({ id: targetId, ...fields });
  return {
    ok: true,
    next: [...list, created],
    targetId,
    intent: { added: [targetId] },
  };
}
