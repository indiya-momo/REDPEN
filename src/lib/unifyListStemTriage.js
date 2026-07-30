/**
 * 표기 통일 목록 3단 분류 (1단계: 규칙만).
 * drop_rule → 이미 stripDependentNounGenitive에서 제거.
 * certain_noun = 명사, ambiguous = 용언(추정). DEV 계측용.
 * @see project-docs/unify-predicate-review-slm-design-2026-07-30.md
 */

import { looksLikePredicateKey } from './unifyPredicateBucket.js';
import { isDependentNounPlusUi } from './unifyDependentNounGenitive.js';

/**
 * @param {string} key
 * @returns {string}
 */
function hangulOnly(key) {
  return String(key ?? '')
    .normalize('NFC')
    .replace(/[^\uAC00-\uD7A3]/g, '');
}

/**
 * @param {string} key
 * @returns {'drop_rule' | 'certain_noun' | 'ambiguous'}
 */
export function classifyUnifyListStem(key) {
  if (isDependentNounPlusUi(key)) return 'drop_rule';
  // 용언·어미처럼 보이면 용언(추정) — 1단계 유지, 2단계 SLM 후보
  if (looksLikePredicateKey(key)) return 'ambiguous';
  const h = hangulOnly(key);
  if (h.length >= 2) return 'certain_noun';
  return 'ambiguous';
}

/**
 * 띄어쓰기만 다른 키를 hangul 어근으로 묶어 [stem, uniqueKeys] 목록.
 * @param {{ key: string }[]} clusters
 * @returns {[string, string[]][]}
 */
function stemBuckets(clusters) {
  /** @type {Map<string, string[]>} */
  const byStem = new Map();
  for (const cluster of clusters ?? []) {
    const key = String(cluster.key ?? '');
    const stem = hangulOnly(key) || key;
    const keys = byStem.get(stem);
    if (keys) keys.push(key);
    else byStem.set(stem, [key]);
  }
  return [...byStem.entries()].map(([stem, keys]) => [
    stem,
    [...new Set(keys)],
  ]);
}

/**
 * @param {string[]} keys
 */
function labelForKeys(keys) {
  return keys.length > 1 ? keys.join(' · ') : keys[0];
}

/**
 * strip 이후 그룹에서 명사 / 용언(추정) 목록.
 * 집계 단위 = 화면 카드(계열 1, 띄어쓰기 변형은 hangul 어근 1).
 * @param {{ type: string, affix?: string, affixType?: string, label?: string, clusters?: { key: string }[] }[]} groups
 * @returns {{
 *   certainNoun: { id: string, label: string }[],
 *   ambiguous: { id: string, label: string }[],
 * }}
 */
export function collectUnifyListTriage(groups) {
  /** @type {{ id: string, label: string }[]} */
  const certainNoun = [];
  /** @type {{ id: string, label: string }[]} */
  const ambiguous = [];

  /**
   * @param {'certain_noun' | 'ambiguous' | 'drop_rule'} kind
   * @param {{ id: string, label: string }} item
   */
  function pushKind(kind, item) {
    if (kind === 'certain_noun') certainNoun.push(item);
    else if (kind === 'ambiguous') ambiguous.push(item);
  }

  for (const group of groups ?? []) {
    if (group.type === 'series') {
      pushKind(classifyUnifyListStem(group.affix), {
        id: `series:${group.affixType}:${group.affix}`,
        label: group.label || `${group.affix}@`,
      });
      continue;
    }

    // 용언 버킷 · 단일 — 띄어쓰기 변형은 어근 1건. 용언 버킷은 전부 용언(추정).
    if (group.type === 'predicate' || group.type === 'single') {
      const forceAmbiguous = group.type === 'predicate';
      for (const [stem, keys] of stemBuckets(group.clusters ?? [])) {
        const kind = forceAmbiguous
          ? 'ambiguous'
          : classifyUnifyListStem(stem);
        pushKind(kind, {
          id: `${group.type}:${stem}`,
          label: labelForKeys(keys),
        });
      }
    }
  }

  return { certainNoun, ambiguous };
}
