import { describe, expect, it } from 'vitest';
import {
  TIP_SORTED_GROUPS,
  buildSpellingRuleBundles,
  groupRulesByDivider,
  normalizeDividerLabel,
  normalizeTipKey,
  sortRulesByTipThenFind,
  spellingBundleDisplayLabel,
} from './spellingRuleBundles.js';

/** @param {Partial<import('./ruleTypes.js').Rule>} patch */
function rule(patch) {
  return {
    find: 'a',
    replace: 'b',
    enabled: true,
    ...patch,
  };
}

describe('normalizeDividerLabel', () => {
  it('빈 값과 "-"는 이름 없음으로 처리한다', () => {
    expect(normalizeDividerLabel('')).toBe('');
    expect(normalizeDividerLabel('-')).toBe('');
    expect(normalizeDividerLabel('  -  ')).toBe('');
  });
});

describe('spellingBundleDisplayLabel', () => {
  it('dividerLabel → dividerGroup → find 순으로 표시한다', () => {
    expect(
      spellingBundleDisplayLabel(
        rule({ find: '갯수', dividerGroup: 'E', dividerLabel: '사이시옷 법칙' }),
      ),
    ).toBe('사이시옷 법칙');
    expect(
      spellingBundleDisplayLabel(rule({ find: '갯수', dividerGroup: 'E' })),
    ).toBe('E');
    expect(spellingBundleDisplayLabel(rule({ find: '갯수' }))).toBe('갯수');
  });
});

describe('buildSpellingRuleBundles', () => {
  it('연속된 dividerGroup을 하나의 묶음으로 만든다', () => {
    const bundles = buildSpellingRuleBundles([
      rule({ find: '갯수', replace: '개수', dividerGroup: 'E', dividerLabel: '사이시옷 법칙' }),
      rule({ find: '싯가', replace: '시가', dividerGroup: 'E', dividerLabel: '사이시옷 법칙' }),
      rule({ find: '댓가', replace: '대가', dividerGroup: 'E2', dividerLabel: '사이시옷 법칙2' }),
    ]);
    expect(bundles).toHaveLength(2);
    expect(bundles[0]).toMatchObject({
      id: 'E',
      label: '사이시옷 법칙',
      uiNote: '',
      ruleCount: 2,
    });
    expect(bundles[1]).toMatchObject({
      id: 'E2',
      label: '사이시옷 법칙2',
      ruleCount: 1,
    });
  });

  it('교육부 개정 용어(F) 묶음에만 보조 문구를 붙인다', () => {
    const bundles = buildSpellingRuleBundles([
      rule({
        find: '간뇌',
        replace: '사이뇌',
        dividerGroup: 'F',
        dividerLabel: '교육부 개정 용어',
      }),
    ]);
    expect(bundles[0]).toMatchObject({
      id: 'F',
      label: '교육부 개정 용어',
      uiNote: '※기존 용어도 표준어로 사용 가능',
    });
  });

  it('B0·B1·B2는 합치지 않고 연속된 묶음 그대로 따로 둔다', () => {
    const bundles = buildSpellingRuleBundles([
      rule({ find: '역전 앞', dividerGroup: 'A1' }),
      rule({ find: '하마트면', dividerGroup: 'B0', dividerLabel: '잘못된 표현(명사)' }),
      rule({ find: '갯수', dividerGroup: 'B0', dividerLabel: '잘못된 표현(명사)' }),
      rule({ find: '않되', dividerGroup: 'B1', dividerLabel: '잘못된 표현(동사)' }),
      rule({ find: '금새', dividerGroup: 'B2', dividerLabel: '잘못된 표현(그 외)' }),
      rule({ find: '바나나', dividerGroup: 'C' }),
    ]);
    expect(bundles.map((b) => b.id)).toEqual(['A1', 'B0', 'B1', 'B2', 'C']);
    expect(bundles[1].label).toBe('잘못된 표현(명사)');
    expect(bundles[1].rules.map((r) => r.find)).toEqual(['갯수', '하마트면']);
  });

  it('B 묶음 안은 같은 tip끼리 모으고, 묶음 안·묶음끼리 가나다순으로 정렬한다', () => {
    const SAI = '사이시옷 tip';
    const GEO = '거센소리 tip';
    const bundles = buildSpellingRuleBundles([
      rule({ find: '촛점', tip: SAI, dividerGroup: 'B0' }),
      rule({ find: '뒷풀이', tip: GEO, dividerGroup: 'B0' }),
      rule({ find: '하마트면', tip: '단독', dividerGroup: 'B0' }),
      rule({ find: '갯수', tip: SAI, dividerGroup: 'B0' }),
      rule({ find: '윗층', tip: GEO, dividerGroup: 'B0' }),
      rule({ find: '댓가', tip: SAI, dividerGroup: 'B0' }),
      rule({ find: '가르키다', tip: '', dividerGroup: 'B0' }),
    ]);
    expect(bundles).toHaveLength(1);
    expect(bundles[0].rules.map((r) => r.find)).toEqual([
      '가르키다',
      '갯수',
      '댓가',
      '촛점',
      '뒷풀이',
      '윗층',
      '하마트면',
    ]);
  });

  it('tip 비교는 연속 공백을 한 칸으로 본다', () => {
    expect(normalizeTipKey("  '-이'와  '-히'\t중 ")).toBe("'-이'와 '-히' 중");
    const sorted = sortRulesByTipThenFind([
      rule({ find: '빼곡이', tip: "'-이'와 '-히' 중" }),
      rule({ find: '나른이', tip: '다른 tip' }),
      rule({ find: '가득이', tip: "'-이'와  '-히'  중" }),
    ]);
    expect(sorted.map((r) => r.find)).toEqual(['가득이', '빼곡이', '나른이']);
  });

  it('sortRulesByTipThenFind는 입력 배열을 바꾸지 않는다', () => {
    const input = [rule({ find: '나' }), rule({ find: '가' })];
    const out = sortRulesByTipThenFind(input);
    expect(out.map((r) => r.find)).toEqual(['가', '나']);
    expect(input.map((r) => r.find)).toEqual(['나', '가']);
  });

  it('TIP_SORTED_GROUPS에 없는 묶음은 시트 순서를 그대로 쓴다', () => {
    expect([...TIP_SORTED_GROUPS]).toEqual(['B0', 'B1', 'B2']);
    const bundles = buildSpellingRuleBundles([
      rule({ find: '하', tip: 't', dividerGroup: 'A' }),
      rule({ find: '가', tip: 't', dividerGroup: 'A' }),
    ]);
    expect(bundles[0].rules.map((r) => r.find)).toEqual(['하', '가']);
  });

  it('dividerGroup 없는 규칙은 단독 묶음으로 만든다', () => {
    const groups = groupRulesByDivider([
      rule({ find: 'solo', replace: 'solo2' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].rules).toHaveLength(1);
    expect(groups[0].key.startsWith('__single_')).toBe(true);
  });
});
