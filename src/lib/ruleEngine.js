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
    const regex = compileRuleRegex(rule);
    if (!regex) {
      errors.push(`규칙 문법 오류: ${ruleDisplayLabel(rule)}`);
      continue;
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
        const matchSlice = text.slice(match.index, matchEnd);
        const isCompoundRule =
          rule.patternKind === 'compound-tail' ||
          rule.patternKind === 'compound-spacing';
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
            category:
              rule.category ?? (rule.builtIn ? 'spelling' : 'custom'),
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

  const results = [...byKey.values()].sort((a, b) => {
    const pa = a.instances[0]?.pageNum ?? 0;
    const pb = b.instances[0]?.pageNum ?? 0;
    return pa - pb || a.label.localeCompare(b.label, 'ko');
  });

  return { results, errors };
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
    .map(([p, n]) => (n > 1 ? `p.${p} (${n})` : `p.${p}`))
    .join(', ');
}
