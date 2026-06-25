import { getBuiltInOverlayReplace } from './builtInRules.js';
import { getConsistencyUnifyOverlayForGroup } from './consistencyUnifyRegister.js';
import { formatConsistencyListLabel } from './patternDisplayLabels.js';

/**
 * 통일형 PDF 오버레이 — 찾은 문자열은 ˅로 공백 위치 표시(일관성 찾기와 동일)
 * @param {import('./ruleEngine.js').MatchInstance} inst
 * @param {string} unifiedRaw
 */
export function formatConsistencyUnifyHighlightOverlay(inst, unifiedRaw) {
  const unified = formatConsistencyListLabel(unifiedRaw);
  if (!unified) return null;
  const found = formatConsistencyListLabel(inst.matchedText ?? '');
  if (!found || found === unified) return null;
  return `${found}→${unified}`;
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
