/**
 * 표기 통일 목록 3단 분류 (1단계: 규칙만).
 * drop_rule → 이미 stripDependentNounGenitive에서 제거.
 * certain_noun = 명사, ambiguous = 용언(추정). DEV 계측용.
 *
 * 계열(`과학@`): affix만 보지 않고, `@` 자리에 오는 채움말 다수결을 1차로 쓴다.
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
 * 계열 affix 기준 `@` 슬롯 채움말(한글만).
 * 접두 `과학@` + `과학 기술` → `기술` / 접미 `@하다` + `생각 하다` → `생각`
 * @param {{ key?: string, variants?: string[] }} cluster
 * @param {string} affix
 * @param {'prefix' | 'suffix'} affixType
 * @returns {string}
 */
export function seriesSlotFiller(cluster, affix, affixType) {
  const affixH = hangulOnly(affix);
  if (!affixH) return '';

  const spaced = (cluster?.variants ?? []).find((v) => /\s/.test(String(v)));
  if (spaced) {
    const words = String(spaced)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (affixType === 'prefix' && words[0] === affix && words.length >= 2) {
      return hangulOnly(words.slice(1).join(''));
    }
    if (
      affixType === 'suffix' &&
      words[words.length - 1] === affix &&
      words.length >= 2
    ) {
      return hangulOnly(words.slice(0, -1).join(''));
    }
  }

  const key = hangulOnly(cluster?.key);
  if (affixType === 'prefix' && key.startsWith(affixH) && key.length > affixH.length) {
    return key.slice(affixH.length);
  }
  if (affixType === 'suffix' && key.endsWith(affixH) && key.length > affixH.length) {
    return key.slice(0, -affixH.length);
  }
  return '';
}

/**
 * `@` 채움말 한 표 → 용언(보조 포함) / 명사 / 집계 제외
 * @param {{ key?: string, variants?: string[], auxReview?: { status?: string } | null }} cluster
 * @param {string} affix
 * @param {'prefix' | 'suffix'} affixType
 * @returns {'aux' | 'noun' | 'skip'}
 */
export function seriesSlotVote(cluster, affix, affixType) {
  if (cluster?.auxReview?.status === 'review') return 'aux';
  const filler = seriesSlotFiller(cluster, affix, affixType);
  if (!filler) return 'skip';
  if (looksLikePredicateKey(filler)) return 'aux';
  if (classifyUnifyListStem(filler) === 'certain_noun') return 'noun';
  // 짧은·애매 채움말은 용언 쪽으로 기울임 (보조·어미 잔여)
  return 'aux';
}

/**
 * 계열 1차: `@` 채움말 다수결 (동점이면 affix 휴리스틱).
 * 보조·용언 채움이 더 많으면 용언(추정), 명사 채움이 더 많으면 명사.
 * @param {{
 *   affix?: string,
 *   affixType?: string,
 *   dictPos?: string,
 *   clusters?: { key?: string, variants?: string[], auxReview?: { status?: string } | null }[],
 * }} group
 * @returns {'drop_rule' | 'certain_noun' | 'ambiguous'}
 */
export function classifyUnifyListSeries(group) {
  if (group?.dictPos === 'predicate') return 'ambiguous';
  if (group?.dictPos === 'noun') return 'certain_noun';

  const affix = String(group?.affix ?? '');
  const affixKind = classifyUnifyListStem(affix);
  if (affixKind === 'drop_rule') return 'drop_rule';

  const affixType =
    group?.affixType === 'suffix' ? /** @type {const} */ ('suffix') : 'prefix';

  let aux = 0;
  let noun = 0;
  for (const cluster of group?.clusters ?? []) {
    const vote = seriesSlotVote(cluster, affix, affixType);
    if (vote === 'aux') aux += 1;
    else if (vote === 'noun') noun += 1;
  }

  if (aux === 0 && noun === 0) return affixKind;
  if (aux > noun) return 'ambiguous';
  if (noun > aux) return 'certain_noun';
  return affixKind;
}

/**
 * 계열에 `@` 슬롯 다수결 결과(`dictPos`)를 붙인다. 목록 정렬·사전 2차 ruleKind에 쓰임.
 * @param {import('./unifyCandidateGrouping.js').ClusterGroup[]} groups
 * @returns {import('./unifyCandidateGrouping.js').ClusterGroup[]}
 */
export function markSeriesBySlotMajority(groups) {
  if (!groups?.length) return groups ?? [];
  return groups.map((group) => {
    if (group.type !== 'series') return group;
    // 사전 등이 이미 붙인 값은 유지
    if (group.dictPos === 'predicate' || group.dictPos === 'noun') return group;
    if (looksLikePredicateKey(group.affix)) {
      return { ...group, dictPos: /** @type {const} */ ('predicate') };
    }
    const kind = classifyUnifyListSeries({
      ...group,
      dictPos: undefined,
    });
    if (kind === 'ambiguous') {
      return { ...group, dictPos: /** @type {const} */ ('predicate') };
    }
    if (kind === 'certain_noun') {
      return { ...group, dictPos: /** @type {const} */ ('noun') };
    }
    return group;
  });
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
 * @param {{ type: string, affix?: string, affixType?: string, label?: string, dictPos?: string, clusters?: { key: string }[] }[]} groups
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
      pushKind(classifyUnifyListSeries(group), {
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
