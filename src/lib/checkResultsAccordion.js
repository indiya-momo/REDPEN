import { consistencyGroupScope } from './consistencyCheckScopes.js';
import { isConsistencyUnifyResultGroup } from './consistencyUnifyRegister.js';

/**
 * 맞춤법 검수 결과를 1단 카테고리(편집자 검토 / 맞춤법 규칙 / 외래어)로 나눈다.
 * @param {Array<{ group: { category?: string }, source: string }>} entries
 * @returns {{
 *   caution: typeof entries,
 *   builtin: typeof entries,
 *   loanword: typeof entries,
 * }}
 */
export function partitionSpellingResultEntries(entries) {
  /** @type {typeof entries} */
  const caution = [];
  /** @type {typeof entries} */
  const builtin = [];
  /** @type {typeof entries} */
  const loanword = [];

  for (const entry of entries ?? []) {
    if (entry?.source !== 'spelling') continue;
    const cat = entry.group?.category;
    if (cat === 'caution') caution.push(entry);
    else if (cat === 'loanword') loanword.push(entry);
    else builtin.push(entry);
  }

  return { caution, builtin, loanword };
}

/**
 * 기본으로 펼칠 카테고리 — 편집자 검토 우선, 없으면 첫 비어 있지 않은 칸.
 * @param {{ caution: unknown[], builtin: unknown[], loanword: unknown[] }} parts
 * @returns {'caution' | 'builtin' | 'loanword' | null}
 */
export function defaultOpenSpellingCategory(parts) {
  if (parts.caution.length) return 'caution';
  if (parts.builtin.length) return 'builtin';
  if (parts.loanword.length) return 'loanword';
  return null;
}

/**
 * 표기 통일 결과를 1단 카테고리로 나눈다.
 * 집계(`countConsistencyGroupsWithFindings`)와 동일한 분류.
 * @param {Array<{ group: { patternKind?: string, instances?: unknown[] }, source: string }>} entries
 * @param {import('./ruleTypes.js').Rule[]} [customRules]
 * @returns {{
 *   literal: typeof entries,
 *   unify: typeof entries,
 *   common: typeof entries,
 *   auxiliary: typeof entries,
 * }}
 */
export function partitionConsistencyResultEntries(entries, customRules = []) {
  /** @type {typeof entries} */
  const literal = [];
  /** @type {typeof entries} */
  const unify = [];
  /** @type {typeof entries} */
  const common = [];
  /** @type {typeof entries} */
  const auxiliary = [];

  for (const entry of entries ?? []) {
    if (entry?.source !== 'consistency') continue;
    const group = entry.group;
    if (!group) continue;
    if (group.patternKind === 'phrase-slot-find') {
      common.push(entry);
      continue;
    }
    const scope = consistencyGroupScope(group);
    if (scope === 'literal-slot') {
      if (isConsistencyUnifyResultGroup(customRules, group)) {
        unify.push(entry);
      } else {
        literal.push(entry);
      }
    } else if (scope === 'auxiliary') {
      auxiliary.push(entry);
    }
  }

  return { literal, unify, common, auxiliary };
}

/**
 * 기본으로 펼칠 표기 통일 카테고리 — 여러 항목 찾기 우선.
 * @param {{
 *   literal: unknown[],
 *   unify: unknown[],
 *   common: unknown[],
 *   auxiliary: unknown[],
 * }} parts
 * @returns {'literal' | 'unify' | 'common' | 'auxiliary' | null}
 */
export function defaultOpenConsistencyCategory(parts) {
  if (parts.literal.length) return 'literal';
  if (parts.unify.length) return 'unify';
  if (parts.common.length) return 'common';
  if (parts.auxiliary.length) return 'auxiliary';
  return null;
}

/**
 * PDF 표시 중인 발견 건수 합.
 * @param {Array<{ source: string, group: { instances?: unknown[] } }>} entries
 * @param {(source: string, group: object) => number} [visibleInstanceCount]
 */
export function sumVisibleFindings(entries, visibleInstanceCount) {
  let sum = 0;
  for (const { source, group } of entries ?? []) {
    if (visibleInstanceCount) {
      sum += visibleInstanceCount(source, group);
    } else {
      sum += group?.instances?.length ?? 0;
    }
  }
  return sum;
}

/**
 * PDF 표시 중인 발견이 1건 이상인 기준(그룹) 수.
 * @param {Array<{ source: string, group: { instances?: unknown[] } }>} entries
 * @param {(source: string, group: object) => number} [visibleInstanceCount]
 */
export function countGroupsWithVisibleFindings(entries, visibleInstanceCount) {
  let n = 0;
  for (const { source, group } of entries ?? []) {
    const shown = visibleInstanceCount
      ? visibleInstanceCount(source, group)
      : (group?.instances?.length ?? 0);
    if (shown > 0) n += 1;
  }
  return n;
}
