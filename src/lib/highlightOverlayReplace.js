import { getBuiltInOverlayReplace } from './builtInRules.js';
import { getConsistencyUnifyOverlayForGroup } from './consistencyUnifyRegister.js';

/** 맞춤법 오버레이와 같은 붙임 표시. `쉬어 가라고` → `→쉬어⁀가라고` */
const AUX_GLUE_MARK = '\u2040';

/**
 * 맞춤법 시트 붙임 표시 `^`를 PDF에서 `⁀`로 보여 준다. `∨`는 띄움이라 그대로 둔다.
 * @param {string} text
 */
function spellingGlueOverlay(text) {
  const raw = String(text ?? '').trim();
  if (!raw.includes('^')) return raw;
  return raw.replaceAll('^', AUX_GLUE_MARK);
}

/** @param {import('./ruleEngine.js').GroupedResult | null | undefined} group */
function isSpellingOverlayGroup(group) {
  if (!group) return false;
  if (group.category === 'spelling') return true;
  return Boolean(String(group.spellingRuleId ?? '').trim());
}

/** 붙여 쓴 말을 띄운 제안. 등재 붙임과 반대다. */
function isAuxiliaryLongSplitInstance(inst) {
  const matched = String(inst?.matchedText ?? '').replace(/\s+/g, '');
  const suggested = String(inst?.suggestedText ?? '').trim();
  if (!matched || !suggested || !/\s/.test(suggested)) return false;
  return suggested.replace(/\s+/g, '') === matched;
}

/**
 * 띄어 쓴 본조. 공백 자리에 기본 붙임 표시를 넣는다.
 * @param {import('./ruleEngine.js').MatchInstance} inst
 * @returns {string | null}
 */
function auxiliarySpacedGlueOverlay(inst) {
  const matched = String(inst?.matchedText ?? '').trim();
  if (!matched || !/\s/.test(matched)) return null;
  return `→${matched.replace(/\s+/g, AUX_GLUE_MARK)}`;
}

/**
 * 맞춤법·본조 공통 — 공백만 붙이는 교정. `손 끝`→`손끝` → `→손⁀끝`.
 * 일부만 붙이면(`뒤 끝 없`→`뒤끝 없`) 빠진 공백만 ⁀, 남는 공백은 유지.
 * @param {string} matched
 * @param {string} suggested
 * @returns {string | null}
 */
export function spacingGlueOverlay(matched, suggested) {
  const a = String(matched ?? '');
  const b = String(suggested ?? '');
  if (!a || !b || !/\s/.test(a)) return null;
  if (a.replace(/\s+/g, '') !== b.replace(/\s+/g, '')) return null;

  let i = 0;
  let j = 0;
  let out = '';
  while (i < a.length) {
    if (/\s/.test(a[i])) {
      let k = i;
      while (k < a.length && /\s/.test(a[k])) k += 1;
      if (j < b.length && /\s/.test(b[j])) {
        out += ' ';
        while (j < b.length && /\s/.test(b[j])) j += 1;
      } else {
        out += AUX_GLUE_MARK;
      }
      i = k;
      continue;
    }
    out += a[i];
    i += 1;
    if (j < b.length && !/\s/.test(b[j])) j += 1;
    else {
      while (j < b.length && /\s/.test(b[j])) j += 1;
      if (j < b.length) j += 1;
    }
  }
  return `→${out}`;
}

/**
 * 통일형 PDF 오버레이 — 통일형(+📌) 표시. 「→ 통일형 📌」는 화살표 유지
 * @param {import('./ruleEngine.js').MatchInstance} _inst
 * @param {string} unifiedRaw
 */
export function formatConsistencyUnifyHighlightOverlay(_inst, unifiedRaw) {
  let unified = String(unifiedRaw ?? '').trim();
  if (!unified) return null;
  // 변형 원고: 「→ 신라시대 📌」
  if (unified.startsWith('→') && unified.includes('📌')) {
    return unified;
  }
  if (unified.startsWith('→')) unified = unified.slice(1).trim();
  const arrow = unified.indexOf('→');
  if (arrow >= 0) unified = unified.slice(arrow + 1).trim();
  return unified || null;
}

/**
 * @param {import('./ruleEngine.js').MatchInstance} inst
 * @param {{
 *   customRules?: import('./ruleTypes.js').Rule[],
 *   group?: import('./ruleEngine.js').GroupedResult | null,
 * }} [options]
 * @returns {string | null}
 */
export function getHighlightOverlayReplace(inst, options = {}) {
  if (!inst?.find) return null;

  const { customRules = [], group = null } = options;
  if (group?.patternKind === 'auxiliary-verb') {
    if (group?.auxSplitLongCompound && isAuxiliaryLongSplitInstance(inst)) {
      return `→${String(inst.suggestedText).trim()}`;
    }
    const glue = auxiliarySpacedGlueOverlay(inst);
    if (glue) return glue;
  }

  // findReplaces 행: 찾은 말마다 제 고칠 말(J overlay_replace 무시)
  const variantReplace = String(inst.variantReplace ?? '').trim();
  if (variantReplace) {
    const glue = spacingGlueOverlay(inst.matchedText, variantReplace);
    if (glue) return glue;
    return `→${variantReplace}`;
  }
  if (group?.tailWord) {
    const consistencyOverlay = getConsistencyUnifyOverlayForGroup(
      customRules,
      group,
    );
    if (consistencyOverlay) {
      return formatConsistencyUnifyHighlightOverlay(inst, consistencyOverlay);
    }
  }

  // 표기 통일 추천 preview 등 — 그룹에 직접 실린 오버레이
  if (!group?.tailWord) {
    const direct = String(group?.overlayReplace ?? '').trim();
    if (direct) {
      return isSpellingOverlayGroup(group) ? spellingGlueOverlay(direct) : direct;
    }
  }

  const text = String(
    getBuiltInOverlayReplace(inst.find, inst.replace, group?.spellingRuleId) ??
      '',
  ).trim();
  if (text) return spellingGlueOverlay(text);

  const suggested = String(inst.suggestedText ?? '').trim();
  if (isSpellingOverlayGroup(group) || group?.category === 'spelling') {
    return spacingGlueOverlay(inst.matchedText, suggested);
  }
  return null;
}
