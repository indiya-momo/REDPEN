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
 * 계열 `@` 채움말이 목록 제외 대상인지.
 * - 한글 단음절: 금융업(업)·금융학(학)
 * - 숫자 포함: 기술58·「기술 58」
 * @param {{ key?: string, variants?: string[] }} cluster
 * @param {string} affix
 * @param {'prefix' | 'suffix'} affixType
 */
export function isExcludedSeriesSlotFiller(cluster, affix, affixType) {
  const raw = seriesSlotFillerRaw(cluster, affix, affixType);
  if (!raw) return false;
  if (/\d/.test(raw)) return true;
  return hangulOnly(raw).length < 2;
}

/** @deprecated 이름만 호환 — {@link isExcludedSeriesSlotFiller} */
export function isMonosyllableSeriesSlotFiller(cluster, affix, affixType) {
  return isExcludedSeriesSlotFiller(cluster, affix, affixType);
}

/**
 * 띄움에 순수 숫자 어절이 있거나, 「2음절+ · (단음절|숫자)」패턴이면 처음부터 목록 제외.
 * 예: 금융 업·기술 58·가 시장
 * @param {{ key?: string, variants?: string[] }} cluster
 */
export function isUnifyListDroppedMonoSlotCluster(cluster) {
  for (const variant of cluster?.variants ?? []) {
    const words = String(variant)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    // 기술 58 · 58 은행 — @/어절에 순수 숫자
    if (words.some((w) => /^\d+$/.test(w))) return true;
    if (words.length !== 2) continue;
    const aH = hangulOnly(words[0]);
    const bH = hangulOnly(words[1]);
    const aHasDigit = /\d/.test(words[0]);
    const bHasDigit = /\d/.test(words[1]);
    if (aH.length >= 2 && (bHasDigit || bH.length === 1)) return true;
    if (bH.length >= 2 && (aHasDigit || aH.length === 1)) return true;
  }
  return false;
}

/**
 * seriesSlotFiller와 같되 숫자는 남김 (`@` 숫자 판별용).
 * @param {{ key?: string, variants?: string[] }} cluster
 * @param {string} affix
 * @param {'prefix' | 'suffix'} affixType
 * @returns {string}
 */
function seriesSlotFillerRaw(cluster, affix, affixType) {
  const affixH = hangulOnly(affix);
  if (!affixH) return '';

  const spaced = (cluster?.variants ?? []).find((v) => /\s/.test(String(v)));
  if (spaced) {
    const words = String(spaced)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (affixType === 'prefix' && hangulOnly(words[0]) === affixH && words.length >= 2) {
      return words.slice(1).join('').replace(/[^\uAC00-\uD7A3\d]/gu, '');
    }
    if (
      affixType === 'suffix' &&
      hangulOnly(words[words.length - 1]) === affixH &&
      words.length >= 2
    ) {
      return words
        .slice(0, -1)
        .join('')
        .replace(/[^\uAC00-\uD7A3\d]/gu, '');
    }
  }

  const key = String(cluster?.key ?? '')
    .normalize('NFC')
    .replace(/[^\uAC00-\uD7A3\d]/gu, '');
  const keyH = hangulOnly(key);
  if (affixType === 'prefix' && keyH.startsWith(affixH) && key.length > affix.length) {
    // 기술58 / 기술58은행 — affix 뒤 잔여(숫자 포함)
    if (key.startsWith(affix)) return key.slice(affix.length);
    // affix는 한글만 비교됐을 때 키 앞 한글 길이만큼
    let i = 0;
    let h = 0;
    while (i < key.length && h < affixH.length) {
      if (/[\uAC00-\uD7A3]/.test(key[i])) h += 1;
      i += 1;
    }
    return key.slice(i);
  }
  if (affixType === 'suffix' && keyH.endsWith(affixH) && key.length > affix.length) {
    if (key.endsWith(affix)) return key.slice(0, -affix.length);
    let i = key.length;
    let h = 0;
    while (i > 0 && h < affixH.length) {
      i -= 1;
      if (/[\uAC00-\uD7A3]/.test(key[i])) h += 1;
    }
    return key.slice(0, i);
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
