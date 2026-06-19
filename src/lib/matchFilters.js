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

import { shouldSkipAuxiliaryVerbMatch } from './auxiliaryVerbMatchFilters.js';

/**
 * @param {string} matched
 * @param {string} phrase
 * @param {string} [sourceText]
 * @param {number} [matchIndex]
 * @param {string[] | undefined} [cautionStems]
 */
function isExcludedByPhrase(
  matchedRaw,
  matched,
  phrase,
  sourceText,
  matchIndex,
  cautionStems,
) {
  const normPhrase = normalizeSpaces(phrase);
  if (!normPhrase) return false;

  if (matched === normPhrase) return true;
  if (!sourceText || matchIndex == null) return false;

  const fromMatch = normalizeSpaces(
    sourceText.slice(matchIndex, matchIndex + phrase.length),
  );
  if (fromMatch === normPhrase) return true;

  if (!cautionStems?.length) return false;

  const orderedStems = [...cautionStems].sort((a, b) => b.length - a.length);
  for (const stem of orderedStems) {
    const normStem = normalizeSpaces(stem);
    if (!normStem || !matched.endsWith(normStem)) continue;

    const stemStart = matchIndex + matchedRaw.length - stem.length;
    const continuation = normalizeSpaces(sourceText.slice(stemStart));
    if (continuation === normPhrase || continuation.startsWith(normPhrase)) {
      return true;
    }
  }

  return false;
}

/**
 * 일관성(붙임·띄움) 등 제외 조건
 * @param {import('./ruleTypes.js').Rule} rule
 * @param {RegExpExecArray} match
 * @param {string} [sourceText] — except가 어간 뒤 이어짐(바라보다 등)일 때 필요
 */
export function shouldSkipMatch(rule, match, sourceText) {
  if (shouldSkipAuxiliaryVerbMatch(rule, match)) return true;

  const prefix = match[1] ?? '';
  const matchedRaw = match[0] ?? '';
  const matched = normalizeSpaces(matchedRaw);

  if (rule.excludePrefixes?.length) {
    const normalizedPrefixes = rule.excludePrefixes.map(normalizeSpaces);
    if (normalizedPrefixes.includes(normalizeSpaces(prefix))) {
      return true;
    }
  }

  if (rule.excludePhrases?.length) {
    const matchIndex = match.index ?? 0;
    for (const phrase of rule.excludePhrases) {
      if (
        isExcludedByPhrase(
          matchedRaw,
          matched,
          phrase,
          sourceText,
          matchIndex,
          rule.cautionStems,
        )
      ) {
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
