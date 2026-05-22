/** @param {string} s */
export function normalizeSpaces(s) {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} input — 쉼표·줄바꿈 구분
 * @returns {string[]}
 */
export function parseCommaList(input) {
  if (!input?.trim()) return [];
  return input
    .split(/[,，\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 일관성(붙임·띄움) 등 제외 조건
 * @param {import('./ruleTypes.js').Rule} rule
 * @param {RegExpExecArray} match
 */
export function shouldSkipMatch(rule, match) {
  const prefix = match[1] ?? '';
  const matched = normalizeSpaces(match[0]);

  if (rule.excludePrefixes?.length) {
    const normalizedPrefixes = rule.excludePrefixes.map(normalizeSpaces);
    if (normalizedPrefixes.includes(normalizeSpaces(prefix))) {
      return true;
    }
  }

  if (rule.excludePhrases?.length) {
    for (const phrase of rule.excludePhrases) {
      if (matched === normalizeSpaces(phrase)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * @param {string} matchedText
 * @param {string[] | undefined} globalExcludePhrases
 */
export function isGloballyExcluded(matchedText, globalExcludePhrases) {
  if (!globalExcludePhrases?.length) return false;
  const matched = normalizeSpaces(matchedText);
  return globalExcludePhrases.some(
    (p) => matched === normalizeSpaces(p),
  );
}
