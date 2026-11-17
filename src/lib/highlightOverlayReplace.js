import { isAuxiliaryDictSolidInstance } from './auxiliaryDictSolid.js';
import { getBuiltInOverlayReplace } from './builtInRules.js';
import { getConsistencyUnifyOverlayForGroup } from './consistencyUnifyRegister.js';

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
  // 본용언+보조 — 사전 등재 합성어만 하이라이트 위에 붙여 쓴 말을 올린다
  if (
    group?.patternKind === 'auxiliary-verb' &&
    isAuxiliaryDictSolidInstance(inst)
  ) {
    return `→${String(inst.suggestedText).trim()}`;
  }

  // findReplaces 행: 찾은 말마다 제 고칠 말(J overlay_replace 무시)
  const variantReplace = String(inst.variantReplace ?? '').trim();
  if (variantReplace) return `→${variantReplace}`;
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
    if (direct) return direct;
  }

  const text = String(
    getBuiltInOverlayReplace(inst.find, inst.replace, group?.spellingRuleId) ??
      '',
  ).trim();
  return text || null;
}
