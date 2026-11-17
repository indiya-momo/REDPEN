import { describe, expect, it } from 'vitest';
import {
  NUMERAL_SPACING_CATEGORY,
  findNumeralSpacingHits,
  findNumeralSpacingInPages,
  isWellFormedNumeral,
  numeralSpacingGroups,
} from './numeralSpacing.js';

/**
 * PR #3 `categoryBaselineMetrics.suggestionMatchesExpected`와 같은 판정.
 * 그 모듈이 main에 오면 F19 행의 flagged/suggestionMatched만 이 함수 결과로 채우면 된다.
 * @param {string} input
 * @param {{ matchedText: string, suggestedText: string, index: number }[]} hits
 * @param {string[]} expectedOutputs
 */
function suggestionMatchesExpected(input, hits, expectedOutputs) {
  const expected = new Set(expectedOutputs);
  for (const hit of hits) {
    if (expected.has(hit.suggestedText)) return true;
    if (
      input.slice(hit.index, hit.index + hit.matchedText.length) ===
      hit.matchedText
    ) {
      const rewritten =
        input.slice(0, hit.index) +
        hit.suggestedText +
        input.slice(hit.index + hit.matchedText.length);
      if (expected.has(rewritten)) return true;
    }
  }
  return false;
}

/**
 * @param {{ id: string, category: string, expect: string, input: string, expectedOutputs?: string[], verified: boolean }[]} rows
 */
function scoreNumeralRows(rows) {
  let tp = 0;
  let fn = 0;
  let fp = 0;
  let tn = 0;
  for (const row of rows) {
    const hits = findNumeralSpacingHits(row.input);
    const flagged = hits.length > 0;
    const suggestionMatched = suggestionMatchesExpected(
      row.input,
      hits,
      row.expectedOutputs ?? [],
    );
    if (row.expect === 'FIX') {
      if (suggestionMatched) tp += 1;
      else fn += 1;
    } else if (row.expect === 'KEEP') {
      if (flagged) fp += 1;
      else tn += 1;
    }
  }
  return { tp, fn, fp, tn };
}

function suggest(input) {
  return findNumeralSpacingHits(input).map((hit) => ({
    from: hit.matchedText,
    to: hit.suggestedText,
  }));
}

describe('numeralSpacing', () => {
  it('F19 천 오백을 천오백으로 붙인다', () => {
    expect(suggest('천 오백')).toEqual([{ from: '천 오백', to: '천오백' }]);
  });

  it('같은 만 단위 안의 띄어쓰기를 한 제안으로 붙인다', () => {
    expect(suggest('삼천 이백 오십')).toEqual([
      { from: '삼천 이백 오십', to: '삼천이백오십' },
    ]);
    expect(suggest('일 만 이천')).toEqual([
      { from: '일 만 이천', to: '일만 이천' },
    ]);
    expect(suggest('이억 삼천 오백')).toEqual([
      { from: '이억 삼천 오백', to: '이억 삼천오백' },
    ]);
    expect(suggest('오백 만')).toEqual([{ from: '오백 만', to: '오백만' }]);
    expect(suggest('십이억 삼천 사백')).toEqual([
      { from: '십이억 삼천 사백', to: '십이억 삼천사백' },
    ]);
    expect(suggest('삼 천')).toEqual([{ from: '삼 천', to: '삼천' }]);
    expect(suggest('십 일')).toEqual([{ from: '십 일', to: '십일' }]);
  });

  it('음절마다 띄운 큰 수를 만·억 경계만 남기고 붙인다', () => {
    expect(
      suggest('십 이 억 삼 천 사 백 오 십 육 만 칠 천 팔 백 구 십 팔'),
    ).toEqual([
      {
        from: '십 이 억 삼 천 사 백 오 십 육 만 칠 천 팔 백 구 십 팔',
        to: '십이억 삼천사백오십육만 칠천팔백구십팔',
      },
    ]);
  });

  it('문장 안에서는 수사 구간만 짚는다', () => {
    const input = '가격은 천 오백 원이다';
    const hits = findNumeralSpacingHits(input);
    expect(hits).toHaveLength(1);
    expect(hits[0].matchedText).toBe('천 오백');
    expect(hits[0].suggestedText).toBe('천오백');
    expect(input.slice(hits[0].index, hits[0].index + hits[0].matchedText.length)).toBe(
      '천 오백',
    );
  });

  it('만·억·조 경계의 띄어쓰기는 그대로 둔다', () => {
    const canonical = '십이억 삼천사백오십육만 칠천팔백구십팔';
    expect(findNumeralSpacingHits(canonical)).toEqual([]);
    expect(findNumeralSpacingHits('일만 이천')).toEqual([]);
    expect(findNumeralSpacingHits('만 이천')).toEqual([]);
    expect(findNumeralSpacingHits('백이십만 오천')).toEqual([]);
    expect(findNumeralSpacingHits('일조 이억 삼만 사천')).toEqual([]);
    expect(findNumeralSpacingHits('천오백')).toEqual([]);
  });

  it('의존명사·단위·지시·나열·범위·고유명처럼 보이면 짚지 않는다', () => {
    const keep = [
      '천 년',
      '백 번',
      '오 분',
      '십 대',
      '이 사람',
      '이 천',
      '이 백성',
      '일 이 삼',
      '사 오',
      '사오 일',
      '천년 전',
      '이십 삼십',
      '김 일',
      '천  오백',
      '천\n오백',
      '수천 오백',
      '제천 오백',
    ];
    for (const input of keep) {
      expect(findNumeralSpacingHits(input), input).toEqual([]);
    }
  });

  it('끊어 쓴 두 수는 하나로 붙이지 않는다', () => {
    expect(findNumeralSpacingHits('천 오백 삼천')).toEqual([
      expect.objectContaining({
        matchedText: '천 오백',
        suggestedText: '천오백',
      }),
    ]);
    expect(findNumeralSpacingHits('일만 이천 삼천')).toEqual([]);
  });

  it('잘 된 수사만 닫힌 꼴로 본다', () => {
    expect(isWellFormedNumeral('천오백')).toBe(true);
    expect(isWellFormedNumeral('십이억삼천사백오십육만칠천팔백구십팔')).toBe(true);
    expect(isWellFormedNumeral('일이삼')).toBe(false);
    expect(isWellFormedNumeral('사오')).toBe(false);
    expect(isWellFormedNumeral('이십삼십')).toBe(false);
    expect(isWellFormedNumeral('')).toBe(false);
  });

  it('쪽 텍스트에서 그룹 category는 수사다', () => {
    const hits = findNumeralSpacingInPages([
      { pageNum: 2, text: '앞에 천 오백 원' },
      { pageNum: 4, text: '삼천 이백 오십' },
    ]);
    expect(hits.map((hit) => hit.pageNum)).toEqual([2, 4]);
    const groups = numeralSpacingGroups(hits);
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.category === NUMERAL_SPACING_CATEGORY)).toBe(
      true,
    );
    expect(groups[0].instances[0]).toMatchObject({
      pageNum: 2,
      matchedText: '천 오백',
      suggestedText: '천오백',
    });
  });

  it('기준선 수사 행은 TP가 있고 KEEP는 오탐이 없다', () => {
    const report = scoreNumeralRows([
      {
        id: 'F19',
        category: '수사',
        expect: 'FIX',
        input: '천 오백',
        expectedOutputs: ['천오백'],
        verified: true,
      },
      {
        id: 'F19b',
        category: '수사',
        expect: 'FIX',
        input: '삼천 이백 오십',
        expectedOutputs: ['삼천이백오십'],
        verified: true,
      },
      {
        id: 'K17',
        category: '수사',
        expect: 'KEEP',
        input: '천년 전',
        verified: true,
      },
      {
        id: 'K-boundary',
        category: '수사',
        expect: 'KEEP',
        input: '십이억 삼천사백오십육만 칠천팔백구십팔',
        verified: true,
      },
      {
        id: 'K-counter',
        category: '수사',
        expect: 'KEEP',
        input: '천 년',
        verified: true,
      },
      {
        id: 'K-list',
        category: '수사',
        expect: 'KEEP',
        input: '일 이 삼',
        verified: true,
      },
      {
        id: 'K-demonstrative',
        category: '수사',
        expect: 'KEEP',
        input: '이 사람',
        verified: true,
      },
    ]);
    expect(report.tp).toBeGreaterThan(0);
    expect(report.fn).toBe(0);
    expect(report.fp).toBe(0);
    expect(report.tn).toBe(5);
  });
});
