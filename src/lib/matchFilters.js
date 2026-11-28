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
import { isSpellingKiwiBoundaryEnabled } from './featureFlags.js';
import { shouldSkipMatchByKiwiBoundary } from './kiwiMorph/boundaryGate.js';
import { isKiwiReady } from './kiwiMorph/runtime.js';

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

  if (
    rule.excludeWords?.length &&
    sourceText != null &&
    match.index != null &&
    isInsideExcludedWord(sourceText, match.index, matchedRaw.length, rule.excludeWords)
  ) {
    return true;
  }

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

  if (
    isSpellingKiwiBoundaryEnabled() &&
    isKiwiReady() &&
    sourceText != null &&
    match.index != null
  ) {
    try {
      if (shouldSkipMatchByKiwiBoundary(matchedRaw, sourceText, match.index)) {
        return true;
      }
    } catch {
      /* 현행 유지 */
    }
  }

  return false;
}

/**
 * 매칭 글자가 「제외어」 안에 통째로 들어 있는지. 예: 「루즈」 ⊂ 「크루즈」.
 * @param {string} text
 * @param {number} matchIndex
 * @param {number} matchLength
 * @param {string[]} words
 */
export function isInsideExcludedWord(text, matchIndex, matchLength, words) {
  const end = matchIndex + matchLength;
  for (const word of words) {
    if (!word) continue;
    let start = text.indexOf(word, Math.max(0, matchIndex - word.length + 1));
    while (start !== -1 && start <= matchIndex) {
      if (start + word.length >= end) return true;
      start = text.indexOf(word, start + 1);
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
