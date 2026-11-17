import { describe, expect, it } from 'vitest';
import { runRuleCheck } from './ruleEngine.js';
import {
  BUILT_IN_RULES,
  buildSpellingCheckRuleFromBuiltIn,
  builtInEnabledFromSheet,
  isBuiltInRuleEnabled,
} from './builtInRules.js';
import {
  buildCautionCheckRules,
  defaultCautionEnabled,
} from './cautionRules.js';
import { isLoanwordSpellingRule } from './loanwordCheckRules.js';
import golden from './spacingCategory.golden.json';
import {
  formatBaselineHitLines,
  formatCategoryBaselineTable,
  isExpectationUnverified,
  scoreCategoryBaseline,
  suggestionMatchesExpected,
} from './categoryBaselineMetrics.js';

/**
 * 검증된 KEEP 가운데 현재 맞춤법 탭이 이미 짚는 id.
 * 엔진은 고치지 않고 기준선으로만 남긴다.
 * 목록에 없는 KEEP이 새로 짚히면 실패하고,
 * 목록에 있는 id가 더 이상 짚히지 않아도 실패한다(기준선이 바뀐 것).
 *
 * - K05 「말한바와 같이」: 편집자 검토 josa-busa-gachi(같이/같은)가
 *   입력 전체를 검토 대상으로 짚는다. 제안 문자열은 원문과 같다.
 */
const KNOWN_VERIFIED_KEEP_FLAGS = ['K05'];

/**
 * 맞춤법 탭 기본 검사와 같다 (useRuleCheck spellingActiveRules).
 * 시트에서 켜진 내장 맞춤법·외래어 + 편집자 검토(caution).
 * 본용언+보조용언 일관성 규칙과 Kiwi는 넣지 않는다.
 */
function loadSpellingTabRules() {
  const builtInEnabled = builtInEnabledFromSheet();
  const builtIn = BUILT_IN_RULES.filter((rule) =>
    isBuiltInRuleEnabled(builtInEnabled, rule),
  ).map((rule) =>
    buildSpellingCheckRuleFromBuiltIn({
      ...rule,
      enabled: true,
      category: isLoanwordSpellingRule(rule) ? 'loanword' : 'spelling',
    }),
  );
  const caution = buildCautionCheckRules(defaultCautionEnabled()).map((rule) => ({
    ...rule,
    enabled: true,
  }));
  return [...builtIn, ...caution];
}

function hitsForPage(results, pageNum) {
  const hits = [];
  for (const group of results) {
    for (const instance of group.instances) {
      if (instance.pageNum !== pageNum) continue;
      hits.push({
        matchedText: instance.matchedText,
        suggestedText: instance.suggestedText,
        index: instance.index,
        label: group.label,
        category: group.category,
      });
    }
  }
  return hits;
}

function evaluateAgainstEngine(cases, rules) {
  const runnable = cases.filter((row) => !row.skip);
  const pages = runnable.map((row, index) => ({
    pageNum: index + 1,
    text: row.input,
  }));
  const { results, errors } = runRuleCheck(pages, rules);
  const hitsById = new Map();
  runnable.forEach((row, index) => {
    hitsById.set(row.id, hitsForPage(results, index + 1));
  });

  const evaluated = cases.map((row) => {
    const hits = hitsById.get(row.id) ?? [];
    return {
      ...row,
      flagged: hits.length > 0,
      suggestionMatched: suggestionMatchesExpected(
        row.input,
        hits,
        row.expectedOutputs ?? [],
      ),
      hits,
    };
  });
  return { evaluated, errors, ruleCount: rules.length };
}

describe('categoryBaselineMetrics', () => {
  it('미검증·보류는 정밀도/재현율 밖에 두고, 제안이 어긋난 FIX는 FN이다', () => {
    const report = scoreCategoryBaseline([
      {
        id: 'a',
        category: 'ㄱ',
        expect: 'FIX',
        verified: true,
        flagged: true,
        suggestionMatched: true,
      },
      {
        id: 'b',
        category: 'ㄱ',
        expect: 'FIX',
        verified: true,
        flagged: true,
        suggestionMatched: false,
      },
      {
        id: 'c',
        category: 'ㄱ',
        expect: 'KEEP',
        verified: true,
        flagged: true,
        suggestionMatched: false,
      },
      {
        id: 'd',
        category: 'ㄱ',
        expect: 'KEEP',
        verified: true,
        flagged: false,
        suggestionMatched: false,
      },
      {
        id: 'e',
        category: 'ㄱ',
        expect: 'FIX',
        verified: false,
        flagged: true,
        suggestionMatched: true,
      },
      {
        id: 'f',
        category: 'ㄱ',
        expect: '보류',
        verified: false,
        skip: true,
        flagged: false,
        suggestionMatched: false,
      },
      {
        id: 'g',
        category: 'ㄴ',
        expect: 'confirm',
        verified: true,
        flagged: false,
        suggestionMatched: false,
      },
      {
        id: 'h',
        category: 'ㄴ',
        expect: '안내',
        verified: true,
        flagged: true,
        suggestionMatched: false,
      },
    ]);

    const first = report.categories[0];
    expect(first.category).toBe('ㄱ');
    expect(first.tp).toBe(1);
    expect(first.fn).toBe(1);
    expect(first.fp).toBe(1);
    expect(first.tn).toBe(1);
    expect(first.precision).toBeCloseTo(0.5);
    expect(first.recall).toBeCloseTo(0.5);
    expect(first.unverified).toBe(1);
    expect(first.skipped).toBe(1);
    expect(report.falsePositives.map((row) => row.id)).toEqual(['c']);
    expect(report.unverifiedFlagged.map((row) => row.id)).toEqual(['e']);

    const second = report.categories[1];
    expect(second.confirm).toBe(1);
    expect(second.guide).toBe(1);
    expect(second.precision).toBeNull();
    expect(second.recall).toBeNull();
    expect(report.totals.tp).toBe(1);
    expect(report.totals.fp).toBe(1);
    expect(report.totals.unverified).toBe(1);
    expect(report.totals.skipped).toBe(1);
    expect(report.totals.confirm).toBe(1);
    expect(report.totals.guide).toBe(1);
  });

  it('기대출력은 제안 문자열 또는 입력에 적용한 결과와 맞는다', () => {
    expect(
      suggestionMatchesExpected(
        '둥글둥굴',
        [{ index: 0, matchedText: '둥글둥굴', suggestedText: '둥글둥글' }],
        ['둥글둥글'],
      ),
    ).toBe(true);
    expect(
      suggestionMatchesExpected(
        '도와드려보다',
        [{ index: 0, matchedText: '도와드려보다', suggestedText: '도와드려 보다' }],
        ['도와 드려 보다', '도와드려 보다'],
      ),
    ).toBe(true);
    expect(
      suggestionMatchesExpected(
        '될수 있',
        [{ index: 0, matchedText: '될수 있', suggestedText: '될수 있' }],
        ['될 수 있'],
      ),
    ).toBe(false);
    expect(isExpectationUnverified('stdict 확인(용언·부사 둘 다)')).toBe(true);
    expect(isExpectationUnverified('Kiwi 태깅')).toBe(true);
    expect(isExpectationUnverified('사전 확인')).toBe(false);
    expect(isExpectationUnverified('붙임 허용 여부 확인')).toBe(false);
  });
});

describe('spacingCategory golden baseline', () => {
  it('행 수·검증 표시가 시트와 같다', () => {
    expect(golden.cases).toHaveLength(39);
    const ids = golden.cases.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    const skipped = golden.cases.filter((row) => row.skip);
    expect(skipped.map((row) => row.id)).toEqual(['F09']);
    expect(skipped[0].expect).toBe('보류');
    expect(skipped[0].input).toBe('사같은');

    for (const row of golden.cases) {
      if (row.skip) continue;
      expect(row.verified, row.id).toBe(!isExpectationUnverified(row.needsCheck));
    }
  });

  it('검증된 KEEP 오탐만 실패하고, 놓친 FIX는 범주별 표로만 남긴다', () => {
    const { evaluated, errors, ruleCount } = evaluateAgainstEngine(
      golden.cases,
      loadSpellingTabRules(),
    );
    const report = scoreCategoryBaseline(evaluated);
    const flaggedKeepIds = report.falsePositives.map((row) => row.id).sort();

    console.log(`spelling-tab rules: ${ruleCount}, compile errors: ${errors.length}`);
    console.log(formatCategoryBaselineTable(report));
    console.log('verified KEEP flags:\n' + formatBaselineHitLines(report.falsePositives));
    console.log(
      'unverified flags:\n' + formatBaselineHitLines(report.unverifiedFlagged),
    );

    expect(errors, errors.join('\n')).toEqual([]);
    expect(flaggedKeepIds).toEqual([...KNOWN_VERIFIED_KEEP_FLAGS].sort());
  });
});
