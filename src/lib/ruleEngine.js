import {
  applyReplaceTemplate,
  compileRuleRegex,
  ruleDisplayLabel,
} from './regexFromFind.js';
import { isGloballyExcluded, shouldSkipMatch } from './matchFilters.js';
import { isMatchSpatiallyCoherent } from './matchSpatial.js';

/**
 * @typedef {Object} PageText
 * @property {number} pageNum
 * @property {string} text
 */

/**
 * @typedef {Object} MatchInstance
 * @property {string} find
 * @property {string} replace
 * @property {string} matchedText
 * @property {string} suggestedText
 * @property {number} pageNum
 * @property {number} index
 */

/**
 * @typedef {'spelling' | 'consistency' | 'caution' | 'custom'} RuleCategory
 *
 * @typedef {Object} GroupedResult
 * @property {string} find
 * @property {string} replace
 * @property {string} label
 * @property {RuleCategory} [category]
 * @property {string} [cautionId]
 * @property {string} [tip]
 * @property {MatchInstance[]} instances
 */

const DEFAULT_CHECK_CHUNK_PAGES = 10;

/** @param {string} ch */
function isLetterOrDigit(ch) {
  return /\p{L}|\p{N}/u.test(ch);
}

function yieldToMain() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * @param {Map<string, GroupedResult>} byKey
 */
function finalizeResults(byKey) {
  return [...byKey.values()].sort((a, b) => {
    const pa = a.instances[0]?.pageNum ?? 0;
    const pb = b.instances[0]?.pageNum ?? 0;
    return pa - pb || a.label.localeCompare(b.label, 'ko');
  });
}

/**
 * @param {import('./ruleTypes.js').Rule} rule
 * @param {(PageText | import('./pdfService.js').PageData)[]} pages
 * @param {Map<string, GroupedResult>} byKey
 * @param {string[]} globalExcludePhrases
 * @param {string[]} errors
 */
function applyRuleToPages(rule, pages, byKey, globalExcludePhrases, errors) {
  const regex = compileRuleRegex(rule);
  if (!regex) {
    errors.push(`규칙 문법 오류: ${ruleDisplayLabel(rule)}`);
    return;
  }

  for (const page of pages) {
    const text = page.text;
    const re = new RegExp(regex.source, regex.flags);
    let match;
    while ((match = re.exec(text)) !== null) {
      if (match[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      if (
        isGloballyExcluded(match[0], globalExcludePhrases) ||
        shouldSkipMatch(rule, match)
      ) {
        continue;
      }
      const matchEnd = match.index + match[0].length;
      if (rule.requireLeadingBoundary && match.index > 0) {
        const prevChar = text[match.index - 1] ?? '';
        if (prevChar && isLetterOrDigit(prevChar)) {
          continue;
        }
      }
      const matchSlice = text.slice(match.index, matchEnd);
      const isCompoundRule =
        rule.patternKind === 'compound-find' ||
        rule.patternKind === 'compound-tail' ||
        rule.patternKind === 'compound-spacing' ||
        rule.patternKind === 'phrase-slot-find' ||
        rule.patternKind === 'auxiliary-verb';
      if (isCompoundRule && matchSlice.includes('\n')) {
        continue;
      }
      if (
        page.itemRefs?.length &&
        !isMatchSpatiallyCoherent(
          page,
          match.index,
          matchEnd,
          isCompoundRule ? 1.35 : 2.8,
        )
      ) {
        continue;
      }
      const suggested =
        rule.category === 'caution'
          ? match[0]
          : rule.pattern === 'regex'
            ? applyReplaceTemplate(rule.replace, match)
            : rule.replace;
      const key =
        rule.category === 'caution' && rule.cautionId
          ? `caution:${rule.cautionId}`
          : `${rule.find}\0${rule.replace}\0${rule.pattern ?? 'literal'}`;
      if (!byKey.has(key)) {
        const tip = String(rule.tip ?? '').trim();
        byKey.set(key, {
          find: rule.find,
          replace: rule.replace,
          label: ruleDisplayLabel(rule),
          category: rule.category ?? (rule.builtIn ? 'spelling' : 'custom'),
          ...(rule.cautionId ? { cautionId: rule.cautionId } : {}),
          ...(tip ? { tip } : {}),
          instances: [],
        });
      }
      byKey.get(key).instances.push({
        find: rule.find,
        replace: rule.replace,
        matchedText: match[0],
        suggestedText: suggested,
        pageNum: page.pageNum,
        index: match.index,
      });
    }
  }
}

/**
 * @param {(PageText | import('./pdfService.js').PageData)[]} pages
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {{ globalExcludePhrases?: string[] }} [options]
 * @returns {{ results: GroupedResult[], errors: string[] }}
 */
export function runRuleCheck(pages, rules, options = {}) {
  const { globalExcludePhrases = [] } = options;
  const active = rules.filter((r) => r.enabled);
  const byKey = new Map();
  const errors = [];

  for (const rule of active) {
    applyRuleToPages(rule, pages, byKey, globalExcludePhrases, errors);
  }

  return { results: finalizeResults(byKey), errors };
}

/**
 * 페이지 청크마다 메인 스레드에 양보 — UI 멈춤 완화
 * @param {(PageText | import('./pdfService.js').PageData)[]} pages
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {{
 *   globalExcludePhrases?: string[],
 *   pagesPerChunk?: number,
 *   onProgress?: (current: number, total: number) => void,
 * }} [options]
 * @returns {Promise<{ results: GroupedResult[], errors: string[] }>}
 */
export async function runRuleCheckAsync(pages, rules, options = {}) {
  const {
    globalExcludePhrases = [],
    pagesPerChunk = DEFAULT_CHECK_CHUNK_PAGES,
    onProgress,
  } = options;
  const active = rules.filter((r) => r.enabled);
  const byKey = new Map();
  const errors = [];
  const total = pages.length;

  if (total === 0) {
    onProgress?.(0, 0);
    return { results: [], errors };
  }

  for (let start = 0; start < total; start += pagesPerChunk) {
    const chunk = pages.slice(start, start + pagesPerChunk);
    for (const rule of active) {
      applyRuleToPages(rule, chunk, byKey, globalExcludePhrases, errors);
    }
    const current = Math.min(start + pagesPerChunk, total);
    onProgress?.(current, total);
    if (current < total) {
      await yieldToMain();
    }
  }

  return { results: finalizeResults(byKey), errors };
}

/**
 * @param {MatchInstance[]} instances
 * @returns {string}
 */
export function formatPagesSummary(instances) {
  const byPage = new Map();
  for (const inst of instances) {
    byPage.set(inst.pageNum, (byPage.get(inst.pageNum) ?? 0) + 1);
  }
  return [...byPage.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([p, n]) => (n > 1 ? `${p}P (${n})` : `${p}P`))
    .join(', ');
}
