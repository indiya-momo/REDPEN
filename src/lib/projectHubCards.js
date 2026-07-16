import { buildProjectCardViewModelFromRuleSet } from '../presentation/ruleSetProjectCard.js';

const CREATED_AT_FROM_ID = /^set_(\d+)_/;

/**
 * 프로젝트의 "만든 시각"(정렬용).
 *
 * id가 `set_<생성시각ms>_<난수>` 형태라, 거기에 박힌 생성 시각을 쓴다.
 * 편집·저장해도 id는 바뀌지 않으므로 목록 위치가 고정된다.
 * (savedAt 은 클라우드 병합의 "최신본 판정"에 쓰이므로 정렬 기준으로 쓰지 않는다.)
 * 형식이 다른 옛 id는 savedAt, 그것도 없으면 0 으로 대체한다.
 *
 * @param {import('./ruleSetsStorage.js').RuleSet} set
 * @returns {number}
 */
export function projectCreatedAtMs(set) {
  const match = CREATED_AT_FROM_ID.exec(set?.id ?? '');
  if (match) return Number(match[1]);
  const saved = Date.parse(set?.savedAt ?? '');
  return Number.isNaN(saved) ? 0 : saved;
}

/**
 * 만든 순서 오름차순 = 오래된 것이 왼쪽. 편집해도 순서가 바뀌지 않는다.
 * @param {import('./ruleSetsStorage.js').RuleSet} a
 * @param {import('./ruleSetsStorage.js').RuleSet} b
 */
export function compareProjectsByCreatedAt(a, b) {
  const diff = projectCreatedAtMs(a) - projectCreatedAtMs(b);
  if (diff !== 0) return diff;
  return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
}

/**
 * @param {import('./ruleSetsStorage.js').RuleSet[]} projects
 * @param {string | null} activeSetId
 */
export function buildSortedProjectCards(projects, activeSetId) {
  return [...(projects ?? [])]
    .sort(compareProjectsByCreatedAt)
    .map((set) =>
      buildProjectCardViewModelFromRuleSet(set, {
        isActive: set.id === activeSetId,
      }),
    );
}
