import { getBuiltInOverlayReplace } from './builtInRules.js';
import { getConsistencyUnifyOverlayForGroup } from './consistencyUnifyRegister.js';

/**
 * 통일형 PDF 오버레이 — 통일형 문자열만 그대로 표시(기호 없음)
 * @param {import('./ruleEngine.js').MatchInstance} _inst
 * @param {string} unifiedRaw
 */
export function formatConsistencyUnifyHighlightOverlay(_inst, unifiedRaw) {
  let unified = String(unifiedRaw ?? '').trim();
  if (!unified) return null;
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
  if (group?.tailWord) {
    const consistencyOverlay = getConsistencyUnifyOverlayForGroup(
      customRules,
      group,
    );
    if (consistencyOverlay) {
      return formatConsistencyUnifyHighlightOverlay(inst, consistencyOverlay);
    }
  }

  const text = String(getBuiltInOverlayReplace(inst.find, inst.replace) ?? '').trim();
  return text || null;
}
