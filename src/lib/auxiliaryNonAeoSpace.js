/**
 * 본조 2차 — 닫힌 비아/어 연결어미 + 켠 보조용언 붙임 → 띄어쓰기 필수.
 * 1차 ruleEngine·stem 찾기는 건드리지 않는다.
 *
 * 1차·붙임보강이 붙여쓰기 칸(가능·필수)에 넣은 발견도 여기서 다시 본다.
 * 본용언 연결이 -아/-어가 아니면(-다(가)·-(으)라·-(으)러·-지·-고 …, `auxiliaryConnective.js`)
 * - 띄어 쓴 것은 올바른 표기라 카드에서 뺀다.
 * - 붙여 쓴 것은 띄움 필수 줄(`verb-non-aeo-space`)로 옮긴다.
 * 붙인 전체가 사전 한 단어(내다보다·들여다보다)면 그대로 둔다.
 */
import {
  STEM_TAIL_BOUNDARY,
  STEM_TAIL_END,
  escapeRegex,
} from './compoundPatternCommon.js';
import {
  BON_BOJO_LONG_COMPOUND_SPLIT_ID,
  BON_BOJO_NON_AEO_SPACE_ID,
  BON_BOJO_NON_AEO_SPACE_LABEL,
  BON_BOJO_UI_GROUP,
  auxiliarySearchTailsFromBonBojoItem,
  bonBojoDisplayLabelForItem,
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
 * 비아/어 발견이 갈 줄. 말다는 자기 줄(이미 띄움 필수 칸), 나머지는 게이트 줄.
 * 보다·가다 줄에 두면 붙여쓰기 가능·필수 칸으로 합쳐지므로 따로 모은다.
 * @param {string} itemId
 */
export function nonAeoTargetItemId(itemId) {
  const id = String(itemId ?? '').trim();
  return isBonBojoNonAeoAuxItem(id) ? id : BON_BOJO_NON_AEO_SPACE_ID;
}

/** @param {string} targetId */
function nonAeoTargetDisplay(targetId) {
  return (
    bonBojoDisplayLabelForItem(targetId) ||
    (targetId === BON_BOJO_NON_AEO_SPACE_ID
      ? BON_BOJO_NON_AEO_SPACE_LABEL
      : `(비아/어) + ${targetId}`)
  );
}

/**
 * 붙인 표면 → 본용언·보조 사이 띄움 제안. 붙임보강이 만든 띄움 제안이 있으면 그대로 쓴다.
 * @param {import('./ruleEngine.js').MatchInstance} inst
 * @param {string} head
 */
function spacedSuggestionForGlued(inst, head) {
  const matched = String(inst?.matchedText ?? '');
  const suggested = String(inst?.suggestedText ?? '').trim();
  if (
    /\s/.test(suggested) &&
    suggested.replace(/\s+/g, '') === matched.replace(/\s+/g, '')
  ) {
    return suggested;
  }
  const at = head ? matched.indexOf(head) : -1;
  if (at < 0) return '';
  const cut = at + head.length;
  if (cut >= matched.length) return '';
  return `${matched.slice(0, cut)} ${matched.slice(cut)}`;
}

/**
 * 붙여쓰기 가능·필수 칸의 발견 중 본용언 연결이 -아/-어가 아닌 것을 정리한다.
 * - 띄어 씀(`먹다 보니`) → 올바른 표기라 뺀다.
 * - 붙여 씀(`먹다보니`) → `moved`로 돌려준다(띄움 필수 줄로 옮길 것).
 * - 붙인 전체가 사전 한 단어(`내다보다`)면 둘 다 그대로 둔다.
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<{
 *   groups: import('./ruleEngine.js').GroupedResult[],
 *   moved: { itemId: string, inst: import('./ruleEngine.js').MatchInstance }[],
 * }>}
 */
export async function reclassifyNonAeoAuxInstances(groups, opts = {}) {
  /** @type {{ itemId: string, inst: import('./ruleEngine.js').MatchInstance }[]} */
  const moved = [];
  const out = [];
  for (const group of groups ?? []) {
    const itemId = String(group?.bonBojoItemId ?? '').trim();
    const ui = bonBojoUiGroupForItemId(itemId);
    if (
      group?.patternKind !== 'auxiliary-verb' ||
      !itemId ||
      group.auxSplitLongCompound ||
      group.auxNonAeoSpace ||
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
      if (inst?.auxNonAeoSpace) {
        kept.push(inst);
        continue;
      }
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
      if (spaced) continue;
      const suggestedText = spacedSuggestionForGlued(inst, head);
      if (!suggestedText) continue;
      const { tip: _tip, auxDictSolid: _solid, ...rest } = inst;
      moved.push({
        itemId,
        inst: {
          ...rest,
          find: `auxiliary:non-aeo:${itemId}`,
          replace: suggestedText,
          suggestedText,
          auxNonAeoSpace: true,
        },
      });
    }
    out.push(changed ? { ...group, instances: kept } : group);
  }
  return { groups: out, moved };
}

/**
 * 같은 쪽에서 글자 범위가 겹치면 같은 발견으로 본다.
 * @param {import('./ruleEngine.js').MatchInstance[]} instances
 * @param {number} pageNum
 * @param {number} start
 * @param {string} matchedText
 */
function overlapsInstance(instances, pageNum, start, matchedText) {
  const end = start + String(matchedText ?? '').length;
  return (instances ?? []).some((inst) => {
    if (inst.pageNum !== pageNum) return false;
    const s = inst.index ?? 0;
    const e = s + String(inst.matchedText ?? '').length;
    return s < end && start < e;
  });
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
  const rules = opts.rules ?? [];
  const gateOn = isNonAeoSpaceGateEnabled(rules);
  // 게이트와 상관없이 붙여쓰기 칸의 비아/어는 정리한다(허용 카드로 남지 않게).
  const reclassified = await reclassifyNonAeoAuxInstances(groups ?? [], {
    fetchImpl: opts.fetchImpl,
  });
  const list = reclassified.groups;
  if (!gateOn) return list;

  const itemIds = enabledAuxItemIdsForNonAeo(rules);
  const pages = pageTexts ?? [];
  const excludes = opts.globalExcludePhrases ?? [];

  /** 1차·붙임보강으로 이미 있는 같은 줄에 합친다 (말다 이중 카드 방지) */
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

  /**
   * @param {string} targetId
   * @param {import('./ruleEngine.js').MatchInstance} nextInst
   */
  const addToTarget = (targetId, nextInst) => {
    let group = byItem.get(targetId) ?? created.get(targetId) ?? null;
    if (!group) {
      const display = nonAeoTargetDisplay(targetId);
      group = {
        find: `auxiliary:non-aeo:${targetId}`,
        replace: '$0',
        label: display,
        category: 'consistency',
        patternKind: 'auxiliary-verb',
        bonBojoItemId: targetId,
        groupDisplayLabel: display,
        auxNonAeoSpace: true,
        tip: '본용언 연결이 -아/-어가 아니면 보조용언을 띄어 씁니다.',
        instances: [],
      };
      created.set(targetId, group);
      byItem.set(targetId, group);
    }
    if (
      overlapsInstance(
        group.instances,
        nextInst.pageNum ?? 0,
        nextInst.index ?? 0,
        nextInst.matchedText,
      )
    ) {
      return;
    }
    const existingAt = list.indexOf(group);
    if (existingAt >= 0) {
      const nextGroup = {
        ...group,
        instances: [...(group.instances ?? []), nextInst],
      };
      list[existingAt] = nextGroup;
      byItem.set(targetId, nextGroup);
      if (created.has(targetId)) created.set(targetId, nextGroup);
    } else {
      group.instances.push(nextInst);
    }
  };

  for (const { itemId, inst } of reclassified.moved) {
    addToTarget(nonAeoTargetItemId(itemId), inst);
  }

  for (const itemId of itemIds) {
    const display =
      bonBojoDisplayLabelForItem(itemId) ||
      `(비아/어) + ${itemId}`;
    const targetId = nonAeoTargetItemId(itemId);
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
        addToTarget(targetId, {
          find: `auxiliary:non-aeo:${itemId}`,
          replace: hit.suggestedText,
          matchedText: hit.matchedText,
          suggestedText: hit.suggestedText,
          pageNum,
          index: hit.start,
          auxNonAeoSpace: true,
        });
      }
    }
  }

  if (!created.size) return list;
  return [...list, ...created.values()];
}
