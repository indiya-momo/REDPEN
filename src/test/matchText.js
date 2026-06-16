import { compileRuleRegex } from '../lib/regexFromFind.js';
import { shouldSkipMatch } from '../lib/matchFilters.js';

/**
 * @param {import('../lib/ruleTypes.js').Rule} rule
 * @param {string} text
 */
export function matchAllRegex(rule, text) {
  const compiled = compileRuleRegex(rule);
  if (!compiled) return [];
  const re = new RegExp(compiled.source, compiled.flags);
  /** @type {string[]} */
  const hits = [];
  let m = re.exec(text);
  while (m !== null) {
    if (m[0].length === 0) {
      re.lastIndex += 1;
      m = re.exec(text);
      continue;
    }
    hits.push(m[0]);
    m = re.exec(text);
  }
  return hits;
}

/** @param {import('../lib/ruleTypes.js').Rule} rule @param {string} text */
export function matchesRegex(rule, text) {
  return matchAllRegex(rule, text).length > 0;
}

/**
 * @param {import('../lib/ruleTypes.js').Rule} rule
 * @param {string} text
 */
export function matchAll(rule, text) {
  const compiled = compileRuleRegex(rule);
  if (!compiled) return [];
  const re = new RegExp(compiled.source, compiled.flags);
  /** @type {string[]} */
  const hits = [];
  let m = re.exec(text);
  while (m !== null) {
    if (m[0].length === 0) {
      re.lastIndex += 1;
      m = re.exec(text);
      continue;
    }
    if (!shouldSkipMatch(rule, m, text)) hits.push(m[0]);
    m = re.exec(text);
  }
  return hits;
}

/**
 * @param {import('../lib/ruleTypes.js').Rule} rule
 * @param {string} text
 */
export function matches(rule, text) {
  return matchAll(rule, text).length > 0;
}
