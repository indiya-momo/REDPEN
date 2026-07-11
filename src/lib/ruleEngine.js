import {
  applyReplaceTemplate,
  compileRuleRegex,
  ruleDisplayLabel,
} from './regexFromFind.js';
import { isGloballyExcluded, shouldSkipMatch } from './matchFilters.js';
import { getLineContextAtTextIndex } from '../toc-body/lib/pdfHeadingExtract.js';
import { isMatchSpatiallyCoherent } from './matchSpatial.js';
import {
  buildPageByNum,
  sortInstancesReadingOrder,
} from './matchReadingOrder.js';
import { cautionHighlightSpan } from './cautionRules.js';

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
 * @property {string} [highlightText] — PDF 하이라이트만 이 구간 (matchedText는 결과 표시용)
 * @property {number} [highlightIndex] — highlightText 시작 위치 (없으면 matchedText 안에서 유도)
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
 * @property {string} [spellingRuleId]
 * @property {string} [tip]
 * @property {import('./ruleTypes.js').RuleKind} [patternKind]
 * @property {string} [tailWord]
 * @property {string} [groupDisplayLabel]
 * @property {string} [dividerGroup] — 맞춤법 묶음 키(엑셀 묶음 열 정렬·병합용)
 * @property {string} [dividerLabel] — 묶음 표시 이름(엑셀 묶음 열 표시용)
 * @property {MatchInstance[]} instances
 */

const DEFAULT_CHECK_CHUNK_PAGES = 10;

/** @param {string} ch */
function isLetterOrDigit(ch) {
  return /\p{L}|\p{N}/u.test(ch);
}

/**
 * 통일형 붙임 표기는 「통일신라시대」 안의 「신라시대」처럼 앞글자 붙은 부분일치를 제외한다.
 * @param {import('./ruleTypes.js').Rule} rule
 */
function ruleRequiresLeadingBoundary(rule) {
  if (rule.requireLeadingBoundary) return true;
  if (!rule.consistencyUnifyEntry) return false;
  const kind = rule.patternKind ?? '';
  if (
    kind !== 'compound-find' &&
    kind !== 'compound-tail' &&
    kind !== 'compound-spacing'
  ) {
    return false;
  }
  const tail = String(rule.tailWord ?? '').trim();
  return Boolean(tail) && !/\s/.test(tail);
}

function yieldToMain() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * @param {Map<string, GroupedResult>} byKey
 * @param {(PageText | import('./pdfService.js').PageData)[]} [pages]
 */
function finalizeResults(byKey, pages = []) {
  const pageByNum = buildPageByNum(pages);
  for (const group of byKey.values()) {
    group.instances = sortInstancesReadingOrder(group.instances, pageByNum);
  }
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
/**
 * 문자열 찾기 — 줄 단위 검색(소제목·본문이 한 덩어리 page.text에 붙는 경우 방지)
 * @param {import('./ruleTypes.js').Rule} rule
 * @param {import('./pdfService.js').PageData} page
 * @param {Map<string, GroupedResult>} byKey
 * @param {string[]} globalExcludePhrases
 */
/**
 * @param {import('./ruleTypes.js').Rule} rule
 * @param {import('./pdfService.js').PageData} page
 * @param {Map<string, GroupedResult>} byKey
 * @param {number} globalIndex
 * @param {string} matchedText
 */
function pushCompoundFindInstance(rule, page, byKey, globalIndex, matchedText) {
  const key = `${rule.find}\0${rule.replace}\0${rule.pattern ?? 'literal'}`;
  if (!byKey.has(key)) {
    const tip = String(rule.tip ?? '').trim();
    byKey.set(key, {
      find: rule.find,
      replace: rule.replace,
      label: ruleDisplayLabel(rule),
      category: rule.category ?? 'custom',
      ...(tip ? { tip } : {}),
      patternKind: rule.patternKind,
      ...(rule.tailWord ? { tailWord: rule.tailWord } : {}),
      ...(rule.patternKind === 'auxiliary-verb' && rule.label?.trim()
        ? { groupDisplayLabel: rule.label.trim() }
        : {}),
      ...(rule.dividerGroup ? { dividerGroup: rule.dividerGroup } : {}),
      ...(rule.dividerLabel ? { dividerLabel: rule.dividerLabel } : {}),
      instances: [],
    });
  }
  byKey.get(key).instances.push({
    find: rule.find,
    replace: rule.replace,
    matchedText,
    suggestedText: matchedText,
    pageNum: page.pageNum,
    index: globalIndex,
  });
}

/** @param {MatchInstance[]} instances @param {number} pageNum @param {number} index */
function hasNearbyInstance(instances, pageNum, index) {
  return instances.some(
    (i) => i.pageNum === pageNum && Math.abs(i.index - index) <= 4,
  );
}

/**
 * compound-find·본조 모두 page.text — PDF 추출 줄·어절 공백과 동일.
 * textLayout은 좁은 음절 gap을 붙여 띄움 stem(해 왔 등)이 빠지므로 본조에 쓰지 않음.
 * 관형어(통해 보) 오탐은 auxiliaryVerbMatchFilters로 제외.
 * @param {import('./pdfService.js').PageData} page
 */
function pageViewForCompoundFind(_rule, page) {
  return { text: page.text, itemRefs: page.itemRefs };
}

function applyCompoundFindByLines(rule, page, byKey, globalExcludePhrases) {
  const regex = compileRuleRegex(rule);
  if (!regex) return;

  const { text: searchText, itemRefs: searchRefs } = pageViewForCompoundFind(
    rule,
    page,
  );
  /** @type {import('./pdfService.js').PageData} */
  const searchPage = { ...page, text: searchText, itemRefs: searchRefs };

  let offset = 0;
  for (const line of searchText.split('\n')) {
    const lineStart = offset;
    offset += line.length + 1;
    if (!line) continue;

    const re = new RegExp(regex.source, regex.flags);
    let match;
    while ((match = re.exec(line)) !== null) {
      if (!match[0]) {
        re.lastIndex += 1;
        continue;
      }
      if (
        isGloballyExcluded(match[0], globalExcludePhrases) ||
        shouldSkipMatch(rule, match, line)
      ) {
        continue;
      }
      const globalIndex = lineStart + match.index;
      if (ruleRequiresLeadingBoundary(rule) && match.index > 0) {
        let atLineStart = false;
        if (searchRefs?.length) {
          const ctx = getLineContextAtTextIndex(searchPage, globalIndex);
          if (ctx && globalIndex <= ctx.lineStart + 2) {
            atLineStart = true;
          }
        }
        if (!atLineStart) {
          const prevChar = line[match.index - 1] ?? '';
          if (prevChar && isLetterOrDigit(prevChar)) continue;
        }
      }
      pushCompoundFindInstance(rule, page, byKey, globalIndex, match[0]);
    }
  }

}

function applyRuleToPages(rule, pages, byKey, globalExcludePhrases, errors) {
  const regex = compileRuleRegex(rule);
  if (!regex) {
    errors.push(`규칙 문법 오류: ${ruleDisplayLabel(rule)}`);
    return;
  }

  if (
    rule.patternKind === 'compound-find' ||
    rule.patternKind === 'auxiliary-verb'
  ) {
    for (const page of pages) {
      applyCompoundFindByLines(rule, page, byKey, globalExcludePhrases);
    }
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
        shouldSkipMatch(rule, match, text)
      ) {
        continue;
      }
      const matchEnd = match.index + match[0].length;
      if (ruleRequiresLeadingBoundary(rule) && match.index > 0) {
        let atLineStart = false;
        if (page.itemRefs?.length) {
          const ctx = getLineContextAtTextIndex(page, match.index);
          if (ctx && match.index <= ctx.lineStart + 2) {
            atLineStart = true;
          }
        }
        if (!atLineStart) {
          const prevChar = text[match.index - 1] ?? '';
          if (prevChar && isLetterOrDigit(prevChar)) {
            continue;
          }
        }
      }
      const matchSlice = text.slice(match.index, matchEnd);
      const isAuxiliaryVerb = rule.patternKind === 'auxiliary-verb';
      const isCompoundRule =
        rule.patternKind === 'compound-find' ||
        rule.patternKind === 'compound-tail' ||
        rule.patternKind === 'compound-spacing' ||
        rule.patternKind === 'phrase-slot-find' ||
        isAuxiliaryVerb;
      if (isCompoundRule && matchSlice.includes('\n') && !isAuxiliaryVerb) {
        continue;
      }
      let maxLineGap = isCompoundRule ? 1.35 : 2.8;
      if (isAuxiliaryVerb) {
        maxLineGap = matchSlice.includes('\n') ? 6 : 2.5;
      }
      if (
        page.itemRefs?.length &&
        !isMatchSpatiallyCoherent(page, match.index, matchEnd, maxLineGap)
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
          : rule.spellingRuleId
            ? `spelling:${rule.spellingRuleId}`
            : `${rule.find}\0${rule.replace}\0${rule.pattern ?? 'literal'}`;
      if (!byKey.has(key)) {
        const tip = String(rule.tip ?? '').trim();
        byKey.set(key, {
          find: rule.find,
          replace: rule.replace,
          label: ruleDisplayLabel(rule),
          category: rule.category ?? (rule.builtIn ? 'spelling' : 'custom'),
          ...(rule.cautionId ? { cautionId: rule.cautionId } : {}),
          ...(rule.spellingRuleId ? { spellingRuleId: rule.spellingRuleId } : {}),
          ...(tip ? { tip } : {}),
          ...(rule.patternKind ? { patternKind: rule.patternKind } : {}),
          ...(rule.patternKind === 'auxiliary-verb' && rule.tailWord
            ? {
                tailWord: rule.tailWord,
                ...(rule.label?.trim()
                  ? { groupDisplayLabel: rule.label.trim() }
                  : {}),
              }
            : {}),
          ...(rule.dividerGroup ? { dividerGroup: rule.dividerGroup } : {}),
          ...(rule.dividerLabel ? { dividerLabel: rule.dividerLabel } : {}),
          instances: [],
        });
      }
      let highlightText;
      let highlightIndex;
      if (rule.category === 'caution' && rule.cautionStems?.length) {
        const span = cautionHighlightSpan(match[0], rule.cautionStems);
        highlightText = span.text;
        highlightIndex = match.index + span.indexOffset;
      }
      byKey.get(key).instances.push({
        find: rule.find,
        replace: rule.replace,
        matchedText: match[0],
        suggestedText: suggested,
        pageNum: page.pageNum,
        index: match.index,
        ...(highlightText ? { highlightText, highlightIndex } : {}),
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

  return { results: finalizeResults(byKey, pages), errors: [...new Set(errors)] };
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

  return { results: finalizeResults(byKey, pages), errors: [...new Set(errors)] };
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
