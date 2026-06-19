import { getBuiltInOverlayReplace } from './builtInRules.js';

/**
 * @param {import('./ruleEngine.js').MatchInstance} inst
 * @returns {string | null}
 */
export function getHighlightOverlayReplace(inst) {
  if (!inst?.find) return null;
  const text = String(getBuiltInOverlayReplace(inst.find, inst.replace) ?? '').trim();
  return text || null;
}
