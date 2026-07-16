/**
 * 외래어 표기법 검수 — 전용 스캐너.
 *
 * 오표기가 수만 개라 일반 규칙 엔진(규칙 1개 = 전체 훑기 1회)에 넣으면
 * 검수가 크게 느려진다. 대신 오표기들을 큰 교대(alternation) 정규식
 * 몇 개로 묶어 페이지를 몇 번만 훑는다. 조판에 비유하면 오식 대조표를
 * 낱장으로 넘기지 않고 한 판에 모아 놓고 원고와 맞대는 방식이다.
 *
 * 결과는 기존 GroupedResult 형태(category: 'loanword')로 배출해서
 * 결과 패널·하이라이트·엑셀 내보내기에 그대로 흘러든다.
 */

import {
  LOANWORD_CATEGORY,
  buildLoanwordSuggestion,
  buildLoanwordTip,
  loanwordBundleIdOf,
} from './loanwordCheckRules.js';
import { isGloballyExcluded } from './matchFilters.js';
import {
  buildPageByNum,
  sortInstancesReadingOrder,
} from './matchReadingOrder.js';

/** 교대 정규식 하나에 넣을 오표기 수 (너무 크면 컴파일·실행이 느려짐) */
const CHUNK_SIZE = 1500;

/** @param {string} s */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** @param {string} ch */
function isHangulOrWordChar(ch) {
  if (!ch) return false;
  return /[\p{L}\p{N}]/u.test(ch);
}

/**
 * 켜진 묶음의 오표기만 골라 교대 정규식 목록으로 컴파일.
 * 긴 오표기가 먼저 맞도록 길이 내림차순 정렬(교대는 앞선 후보 우선).
 * @param {Record<string, { c: string[], s?: string }>} dict
 * @param {{ main: boolean, short: boolean }} enabled
 * @returns {RegExp[]}
 */
export function buildLoanwordMatchers(dict, enabled) {
  const typos = Object.keys(dict ?? {}).filter(
    (typo) => enabled?.[loanwordBundleIdOf(typo)] === true,
  );
  typos.sort((a, b) => b.length - a.length);

  /** @type {RegExp[]} */
  const matchers = [];
  for (let i = 0; i < typos.length; i += CHUNK_SIZE) {
    const chunk = typos.slice(i, i + CHUNK_SIZE).map(escapeRegExp);
    matchers.push(new RegExp(chunk.join('|'), 'g'));
  }
  return matchers;
}

/**
 * 같은 자리(겹치는 범위)에 이미 더 긴 지적이 있으면 건너뛴다.
 * @param {Map<number, number>} claimed index → end
 * @param {number} start
 * @param {number} end
 */
function overlapsClaimed(claimed, start, end) {
  for (const [s, e] of claimed) {
    if (start < e && s < end) return true;
  }
  return false;
}

/**
 * 페이지들을 훑어 외래어 오표기 지적 그룹을 만든다.
 * @param {(import('./ruleEngine.js').PageText | import('./pdfService.js').PageData)[]} pages
 * @param {Record<string, { c: string[], s?: string }>} dict
 * @param {{ main: boolean, short: boolean }} enabled
 * @param {{ globalExcludePhrases?: string[] }} [options]
 * @returns {import('./ruleEngine.js').GroupedResult[]}
 */
export function runLoanwordCheck(pages, dict, enabled, options = {}) {
  const { globalExcludePhrases = [] } = options;
  const matchers = buildLoanwordMatchers(dict, enabled);
  if (!matchers.length) return [];

  /** @type {Map<string, import('./ruleEngine.js').GroupedResult>} */
  const byKey = new Map();

  for (const page of pages) {
    const text = String(page.text ?? '');
    if (!text) continue;
    /** @type {Map<number, number>} 이 페이지에서 이미 지적한 구간 */
    const claimed = new Map();

    for (const matcher of matchers) {
      const re = new RegExp(matcher.source, matcher.flags);
      let match;
      while ((match = re.exec(text)) !== null) {
        const matched = match[0];
        if (!matched) {
          re.lastIndex += 1;
          continue;
        }
        const start = match.index;
        const end = start + matched.length;

        // 앞글자가 붙은 부분일치 제외 — '아지로'의 '지로' 등
        const prevChar = text[start - 1] ?? '';
        if (isHangulOrWordChar(prevChar)) continue;
        // 줄바꿈에 걸친 다단어 오표기 제외
        if (matched.includes('\n')) continue;
        if (isGloballyExcluded(matched, globalExcludePhrases)) continue;
        // 긴 오표기가 이미 차지한 구간이면 건너뜀 (교대식은 긴 것부터 훑음)
        if (overlapsClaimed(claimed, start, end)) continue;
        claimed.set(start, end);

        const entry = dict[matched];
        if (!entry) continue;
        const suggestion = buildLoanwordSuggestion(entry.c);
        const key = `${matched}\0${suggestion}`;
        if (!byKey.has(key)) {
          byKey.set(key, {
            find: matched,
            replace: suggestion,
            label: `${matched} → ${suggestion}`,
            category: LOANWORD_CATEGORY,
            tip: buildLoanwordTip(entry.c, entry.s),
            instances: [],
          });
        }
        byKey.get(key).instances.push({
          find: matched,
          replace: suggestion,
          matchedText: matched,
          suggestedText: suggestion,
          pageNum: page.pageNum,
          index: start,
        });
      }
    }
  }

  const pageByNum = buildPageByNum(pages);
  for (const group of byKey.values()) {
    group.instances = pageByNum.size
      ? sortInstancesReadingOrder(group.instances, pageByNum)
      : [...group.instances].sort(
          (a, b) => a.pageNum - b.pageNum || a.index - b.index,
        );
  }
  return [...byKey.values()].sort((a, b) => {
    const pa = a.instances[0]?.pageNum ?? 0;
    const pb = b.instances[0]?.pageNum ?? 0;
    return (
      pa - pb ||
      (a.instances[0]?.index ?? 0) - (b.instances[0]?.index ?? 0) ||
      a.label.localeCompare(b.label, 'ko')
    );
  });
}
