/**
 * 본조 2차 — 붙여쓰기 칸(가능·필수)에서 본용언 연결이 -아/-어가 아닌 발견을 뺀다.
 * 1차 ruleEngine·stem 찾기는 건드리지 않는다.
 *
 * 본용언 연결이 -아/-어가 아니면(-다(가)·-(으)라·-(으)러·-지·-고 …, `auxiliaryConnective.js`)
 * 띄어 썼든 붙여 썼든 본조 카드에서 뺀다.
 * - 띄어 쓴 것은 올바른 표기다.
 * - 붙여 쓴 것은 띄어쓰기 오류라 맞춤법 탭 「띄어쓰기」 폴더(`nonAeoAuxSpacing.js`)가 낸다.
 *   (2026-11-19 결정: 본조 탭의 「본용언이 (-아/-어) 가 아닌 경우 : 띄어쓰기 필수」 줄·말다 줄 폐지)
 * 붙인 전체가 사전 한 단어(내다보다·들여다보다)면 그대로 둔다.
 */
import {
  BON_BOJO_LONG_COMPOUND_SPLIT_ID,
  BON_BOJO_NON_AEO_SPACE_ID,
  BON_BOJO_UI_GROUP,
  auxiliarySearchTailsFromBonBojoItem,
  bonBojoUiGroupForItemId,
  getBonBojoGroups,
  isBonBojoGateOnlyItem,
  isBonBojoLogicOnlyItem,
  isBonBojoNonAeoAuxItem,
} from './bonBojoRules.js';
import {
  bonVerbHeadFromAuxInstance,
  compoundLemma,
  gluedCompoundLemma,
  isRegisteredPredicateLemma,
} from './auxiliaryDictSolid.js';
import { classifyConnectiveBeforeAux } from './auxiliaryConnective.js';

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
 * 붙여쓰기 가능·필수 칸의 발견 중 본용언 연결이 -아/-어가 아닌 것을 뺀다.
 * - 띄어 씀(`먹다 보니`) → 올바른 표기라 뺀다.
 * - 붙여 씀(`먹다보니`) → 맞춤법 탭 띄어쓰기 폴더가 내므로 여기서는 뺀다(두 탭 중복 방지).
 * - 붙인 전체가 사전 한 단어(`내다보다`)면 그대로 둔다.
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<{ groups: import('./ruleEngine.js').GroupedResult[], removed: number }>}
 */
export async function reclassifyNonAeoAuxInstances(groups, opts = {}) {
  let removed = 0;
  const out = [];
  for (const group of groups ?? []) {
    const itemId = String(group?.bonBojoItemId ?? '').trim();
    const ui = bonBojoUiGroupForItemId(itemId);
    if (
      group?.patternKind !== 'auxiliary-verb' ||
      !itemId ||
      group.auxSplitLongCompound ||
      (ui !== BON_BOJO_UI_GROUP.GLUE_OPTIONAL &&
        ui !== BON_BOJO_UI_GROUP.GLUE_REQUIRED)
    ) {
      out.push(group);
      continue;
    }
    const display = group.groupDisplayLabel || group.label || '';
    /** @type {import('./ruleEngine.js').MatchInstance[]} */
    const kept = [];
    let changed = false;
    for (const inst of group.instances ?? []) {
      const head = bonVerbHeadFromAuxInstance(inst, itemId);
      if (classifyConnectiveBeforeAux(head) !== 'non-aeo') {
        kept.push(inst);
        continue;
      }
      const matched = String(inst?.matchedText ?? '');
      const spaced = /\s/.test(matched.trim());
      const surface = matched.replace(/[^\uAC00-\uD7A3]/g, '');
      const lemma = spaced
        ? compoundLemma(matched, itemId, display)
        : gluedCompoundLemma(matched, itemId, display);
      if (lemma || surface) {
        const registered = await isRegisteredPredicateLemma(lemma, {
          fetchImpl: opts.fetchImpl,
          surface,
        });
        if (registered) {
          kept.push(inst);
          continue;
        }
      }
      changed = true;
      removed += 1;
    }
    out.push(changed ? { ...group, instances: kept } : group);
  }
  return { groups: out, removed };
}

/**
 * 본조 탭에 남으면 안 되는 비아/어 줄 — 말다(1차 찾기 줄)·옛 게이트 줄·옛 2차 생성 줄.
 * @param {import('./ruleEngine.js').GroupedResult | null | undefined} group
 */
export function isRetiredNonAeoAuxGroup(group) {
  if (group?.patternKind !== 'auxiliary-verb') return false;
  if (group.auxNonAeoSpace) return true;
  const id = String(group.bonBojoItemId ?? '').trim();
  return id === BON_BOJO_NON_AEO_SPACE_ID || isBonBojoNonAeoAuxItem(id);
}

/**
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {readonly { pageNum?: number, text?: string }[]} [_pageTexts] — 호출 호환용(쓰지 않음)
 * @param {{
 *   rules?: import('./ruleTypes.js').Rule[],
 *   globalExcludePhrases?: string[],
 *   fetchImpl?: typeof fetch,
 * }} [opts]
 */
export async function enrichAuxiliaryNonAeoSpace(groups, _pageTexts, opts = {}) {
  const reclassified = await reclassifyNonAeoAuxInstances(groups ?? [], {
    fetchImpl: opts.fetchImpl,
  });
  return reclassified.groups.filter((g) => !isRetiredNonAeoAuxGroup(g));
}
