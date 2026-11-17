/**
 * 본조 2차 — 닫힌 비아/어 연결어미 + 켠 보조용언 붙임 → 띄어쓰기 필수.
 * 1차 ruleEngine·stem 찾기는 건드리지 않는다.
 */
import {
  STEM_TAIL_BOUNDARY,
  STEM_TAIL_END,
  escapeRegex,
} from './compoundPatternCommon.js';
import {
  BON_BOJO_LONG_COMPOUND_SPLIT_ID,
  BON_BOJO_NON_AEO_SPACE_ID,
  auxiliarySearchTailsFromBonBojoItem,
  bonBojoDisplayLabelForItem,
  getBonBojoGroups,
  isBonBojoGateOnlyItem,
  isBonBojoLogicOnlyItem,
} from './bonBojoRules.js';
import {
  gluedCompoundLemma,
  isRegisteredPredicateLemma,
} from './auxiliaryDictSolid.js';
import { isGloballyExcluded } from './matchFilters.js';

/** 긴 것 우선 — 직전 슬라이스 매칭 */
export const NON_AEO_CONNECTIVE_ENDINGS = Object.freeze([
  '도록',
  '지',
  '게',
  '고',
]);

/**
 * 시트 stem에 없을 수 있는 아/어·축약 앞조각.
 * (해·봐·줘 … — 비아/어 오분류 방지)
 */
export const AEO_CONTRACTED_FRONTS = Object.freeze([
  '아',
  '어',
  '여',
  '해',
  '봐',
  '줘',
  '와',
  '워',
  '써',
  '켜',
  '펴',
  '혀',
  '려',
  '져',
  '러',
  '라',
  '겨',
  '았',
  '었',
  '였',
  '했',
]);

/**
 * 제47항 (2) 관형사형+의존명사+-하다/싶다 — 의존명사와 하다·싶다는 한 단어로 붙임.
 * 닫힌 연결어미(지·게·고·도록)와는 보통 안 겹치지만, 하다 onset 오탐 방어용.
 * @see https://www.korean.go.kr/ (한글 맞춤법 제47항)
 * @type {readonly string[]}
 */
export const NON_AEO_ALLOW_GLUE_SURFACES = Object.freeze([
  '듯하',
  '듯싶',
  '만하',
  '법하',
  '뻔하',
  '양하',
  '척하',
  '체하',
  '성싶',
  '직하',
]);

/** @type {Set<string> | null} */
let aeoFrontCache = null;

/** 시트 stem 앞토큰 + 축약 보완 */
export function listAeoConnectiveFrontsFromSheet() {
  if (aeoFrontCache) return aeoFrontCache;
  /** @type {Set<string>} */
  const set = new Set(AEO_CONTRACTED_FRONTS);
  for (const group of getBonBojoGroups()) {
    for (const item of group.items ?? []) {
      if (
        isBonBojoGateOnlyItem(item.id) ||
        isBonBojoLogicOnlyItem(item.id) ||
        item.id === BON_BOJO_LONG_COMPOUND_SPLIT_ID
      ) {
        continue;
      }
      for (const tail of auxiliarySearchTailsFromBonBojoItem(item)) {
        const parts = String(tail ?? '')
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        if (parts.length === 2 && parts[0]) set.add(parts[0]);
      }
    }
  }
  aeoFrontCache = set;
  return set;
}

/** 테스트용 */
export function clearAeoConnectiveFrontCache() {
  aeoFrontCache = null;
}

/**
 * @param {string} before — 보조 꼬리 직전 문자열
 * @returns {string} 매칭된 연결어미 또는 ''
 */
export function nonAeoConnectiveAtEnd(before) {
  const s = String(before ?? '');
  for (const ending of NON_AEO_CONNECTIVE_ENDINGS) {
    if (s.endsWith(ending)) return ending;
  }
  return '';
}

/**
 * @param {string} before
 * @param {Set<string>} [aeoFronts]
 */
export function isAeoFrontAtEnd(before, aeoFronts = listAeoConnectiveFrontsFromSheet()) {
  const s = String(before ?? '');
  if (!s) return false;
  /** @type {string[]} */
  const fronts = [...aeoFronts].sort((a, b) => b.length - a.length);
  for (const front of fronts) {
    if (front && s.endsWith(front)) return true;
  }
  return false;
}

/**
 * @param {string} text
 * @param {number} start
 * @param {number} end
 */
export function isWordBoundedTail(text, start, end) {
  const t = String(text ?? '');
  if (start < 0 || end > t.length || end <= start) return false;
  const before = start > 0 ? t[start - 1] : '';
  const after = end < t.length ? t[end] : '';
  // 보조 꼬리 앞은 한글 연결어미(음절)여야 하므로 before는 한글 허용.
  // 꼬리 뒤가 한글·영숫자면 단어 중간으로 본다.
  if (after && /[\uAC00-\uD7A3A-Za-z0-9]/.test(after)) return false;
  if (before && /[A-Za-z0-9]/.test(before)) return false;
  return true;
}

/**
 * @param {string} [itemId]
 * @returns {string[]}
 */
export function auxOnsetsForItem(itemId) {
  const id = String(itemId ?? '').trim();
  if (!id) return [];
  /** @type {Set<string>} */
  const onsets = new Set();
  for (const group of getBonBojoGroups()) {
    for (const item of group.items ?? []) {
      if (item.id !== id) continue;
      const label = String(item.label ?? '').trim();
      if (/^[\uAC00-\uD7A3]+$/.test(label)) onsets.add(label);
      for (const tail of auxiliarySearchTailsFromBonBojoItem(item)) {
        const parts = String(tail ?? '')
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        if (parts.length === 2 && parts[1]) onsets.add(parts[1]);
      }
    }
  }
  return [...onsets].sort((a, b) => b.length - a.length || a.localeCompare(b, 'ko'));
}

/**
 * @param {import('./ruleTypes.js').Rule[] | undefined} rules
 */
export function isNonAeoSpaceGateEnabled(rules) {
  return (rules ?? []).some(
    (r) =>
      r?.auxNonAeoGate === true &&
      r.enabled !== false &&
      r.bonBojoItemId === BON_BOJO_NON_AEO_SPACE_ID,
  );
}

/**
 * @param {import('./ruleTypes.js').Rule[] | undefined} rules
 * @returns {string[]}
 */
export function enabledAuxItemIdsForNonAeo(rules) {
  /** @type {Set<string>} */
  const ids = new Set();
  for (const r of rules ?? []) {
    if (r?.patternKind !== 'auxiliary-verb' || r.enabled === false) continue;
    if (r.auxNonAeoGate || r.auxSplitLongCompound) continue;
    const id = r.bonBojoItemId?.trim();
    if (!id || isBonBojoGateOnlyItem(id) || isBonBojoLogicOnlyItem(id)) continue;
    if (id === BON_BOJO_LONG_COMPOUND_SPLIT_ID) continue;
    ids.add(id);
  }
  return [...ids];
}

/**
 * @param {string} surface
 */
function isAllowGlueSurface(surface) {
  const s = String(surface ?? '').replace(/\s+/g, '');
  if (!s) return false;
  return NON_AEO_ALLOW_GLUE_SURFACES.some((key) => s.includes(key));
}

/**
 * @param {string} text
 * @param {string} onset
 * @returns {RegExp}
 */
function auxTailRegex(onset) {
  return new RegExp(
    `${escapeRegex(onset)}${STEM_TAIL_END}${STEM_TAIL_BOUNDARY}`,
    'g',
  );
}

/**
 * @param {string} pageText
 * @param {string} itemId
 * @param {string[]} [globalExcludePhrases]
 */
export function collectNonAeoGluedHits(
  pageText,
  itemId,
  globalExcludePhrases = [],
) {
  const text = String(pageText ?? '');
  const onsets = auxOnsetsForItem(itemId);
  /** @type {{ start: number, end: number, matchedText: string, suggestedText: string, connective: string }[]} */
  const hits = [];
  if (!text || !onsets.length) return hits;

  for (const onset of onsets) {
    const re = auxTailRegex(onset);
    let m;
    while ((m = re.exec(text)) !== null) {
      const auxStart = m.index;
      const auxEnd = m.index + m[0].length;
      if (!isWordBoundedTail(text, auxStart, auxEnd)) continue;

      const before = text.slice(0, auxStart);
      const connective = nonAeoConnectiveAtEnd(before);
      if (!connective) continue;
      // 닫힌 연결어미면 후보. 아/어·축약(`해봐`)은 연결어미에 안 걸려 제외.
      const connStart = auxStart - connective.length;
      let headStart = connStart;
      while (
        headStart > 0 &&
        /[\uAC00-\uD7A3]/.test(text[headStart - 1] ?? '')
      ) {
        headStart -= 1;
      }
      const matchedText = text.slice(headStart, auxEnd);
      const suggestedText = `${text.slice(headStart, auxStart)} ${text.slice(auxStart, auxEnd)}`;
      const bridge = text.slice(connStart, auxEnd);
      if (isAllowGlueSurface(bridge) || isAllowGlueSurface(matchedText)) continue;
      if (isGloballyExcluded(matchedText, globalExcludePhrases)) continue;
      if (/\s/.test(matchedText)) continue;

      hits.push({
        start: headStart,
        end: auxEnd,
        matchedText,
        suggestedText,
        connective,
      });
    }
  }
  return hits;
}

/**
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {readonly { pageNum?: number, text?: string }[]} pageTexts
 * @param {{
 *   rules?: import('./ruleTypes.js').Rule[],
 *   globalExcludePhrases?: string[],
 *   fetchImpl?: typeof fetch,
 * }} [opts]
 */
export async function enrichAuxiliaryNonAeoSpace(groups, pageTexts, opts = {}) {
  const list = [...(groups ?? [])];
  const rules = opts.rules ?? [];
  if (!isNonAeoSpaceGateEnabled(rules)) return groups ?? [];

  const itemIds = enabledAuxItemIdsForNonAeo(rules);
  if (!itemIds.length) return groups ?? [];

  const pages = pageTexts ?? [];
  if (!pages.length) return groups ?? [];

  const excludes = opts.globalExcludePhrases ?? [];

  /** 1차·붙임보강으로 이미 있는 같은 item 줄에 합친다 (말다 이중 카드 방지) */
  /** @type {Map<string, import('./ruleEngine.js').GroupedResult>} */
  const byItem = new Map();
  for (const group of list) {
    const id = group?.bonBojoItemId?.trim();
    if (group?.patternKind === 'auxiliary-verb' && id && !byItem.has(id)) {
      byItem.set(id, group);
    }
  }

  /** @type {Map<string, import('./ruleEngine.js').GroupedResult>} */
  const created = new Map();

  for (const itemId of itemIds) {
    const display =
      bonBojoDisplayLabelForItem(itemId) ||
      `(비아/어) + ${itemId}`;
    for (const page of pages) {
      const pageNum = page.pageNum ?? 0;
      const text = page.text ?? '';
      if (!text) continue;
      for (const hit of collectNonAeoGluedHits(text, itemId, excludes)) {
        const lemma = gluedCompoundLemma(hit.matchedText, itemId, display);
        if (lemma) {
          const registered = await isRegisteredPredicateLemma(lemma, {
            fetchImpl: opts.fetchImpl,
          });
          if (registered) continue;
        }
        let group = byItem.get(itemId) ?? created.get(itemId) ?? null;
        if (!group) {
          group = {
            find: `auxiliary:non-aeo:${itemId}`,
            replace: '$0',
            label: display,
            category: 'consistency',
            patternKind: 'auxiliary-verb',
            bonBojoItemId: itemId,
            groupDisplayLabel: display,
            auxNonAeoSpace: true,
            tip: '본용언 연결이 -아/-어가 아니면 보조용언을 띄어 씁니다.',
            instances: [],
          };
          created.set(itemId, group);
          byItem.set(itemId, group);
        }
        const dup = (group.instances ?? []).some(
          (inst) =>
            inst.pageNum === pageNum &&
            Math.abs((inst.index ?? 0) - hit.start) <= 4 &&
            String(inst.matchedText ?? '').replace(/\s+/g, '') ===
              hit.matchedText.replace(/\s+/g, ''),
        );
        if (dup) continue;
        const nextInst = {
          find: `auxiliary:non-aeo:${itemId}`,
          replace: hit.suggestedText,
          matchedText: hit.matchedText,
          suggestedText: hit.suggestedText,
          pageNum,
          index: hit.start,
          auxNonAeoSpace: true,
        };
        const existingAt = list.indexOf(group);
        if (existingAt >= 0) {
          const nextGroup = {
            ...group,
            instances: [...(group.instances ?? []), nextInst],
          };
          list[existingAt] = nextGroup;
          byItem.set(itemId, nextGroup);
          if (created.has(itemId)) created.set(itemId, nextGroup);
        } else {
          group.instances.push(nextInst);
        }
      }
    }
  }

  if (!created.size) return list;
  return [...list, ...created.values()];
}
