import { getBuiltInOverlayReplace } from './builtInRules.js';
import { getConsistencyUnifyOverlayForGroup } from './consistencyUnifyRegister.js';

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
    if (consistencyOverlay) return consistencyOverlay;
  }

  const text = String(getBuiltInOverlayReplace(inst.find, inst.replace) ?? '').trim();
  return text || null;
}
