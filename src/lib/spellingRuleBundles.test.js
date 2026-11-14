import { describe, expect, it } from 'vitest';
import {
  buildSpellingRuleBundles,
  groupRulesByDivider,
  normalizeDividerLabel,
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

  it('B0·B1·B2는 한 폴더로 모으고 코드 순 → 가나다순으로 정렬한다', () => {
    const bundles = buildSpellingRuleBundles([
      rule({ find: '역전 앞', dividerGroup: 'A1', dividerLabel: '등재(명사)' }),
      rule({ find: '하마트면', dividerGroup: 'B0', dividerLabel: '잘못된 표현(명사)' }),
      rule({ find: '갯수', dividerGroup: 'B0', dividerLabel: '잘못된 표현(명사)' }),
      rule({ find: '않되', dividerGroup: 'B1', dividerLabel: '잘못된 표현(동사)' }),
      rule({ find: '금새', dividerGroup: 'B2', dividerLabel: '잘못된 표현(그 외)' }),
      rule({ find: '바나나', dividerGroup: 'C', dividerLabel: '외래어' }),
      // 시트 맨 아래에 잘못 붙인 행
      rule({ find: '가르키다', dividerGroup: 'B1', dividerLabel: '잘못된 표현(동사)' }),
      rule({ find: '간뇌', dividerGroup: 'F', dividerLabel: '교육부 개정 용어' }),
    ]);
    expect(bundles.map((b) => b.id)).toEqual(['A1', 'B', 'C', 'F']);
    const b = bundles[1];
    expect(b).toMatchObject({ id: 'B', label: '잘못된 표현', uiNote: '', ruleCount: 5 });
    expect(b.rules.map((r) => r.find)).toEqual(['갯수', '하마트면', '가르키다', '않되', '금새']);
    // 원래 코드는 그대로
    expect(b.rules.map((r) => r.dividerGroup)).toEqual(['B0', 'B0', 'B1', 'B1', 'B2']);
  });

  it('A1/A2/A, C/C1/C2는 접두어가 같아도 합치지 않는다', () => {
    const bundles = buildSpellingRuleBundles([
      rule({ find: '1', dividerGroup: 'A1' }),
      rule({ find: '2', dividerGroup: 'A2' }),
      rule({ find: '3', dividerGroup: 'A' }),
      rule({ find: '4', dividerGroup: 'C' }),
      rule({ find: '5', dividerGroup: 'C1' }),
      rule({ find: '6', dividerGroup: 'C2' }),
    ]);
    expect(bundles.map((b) => b.id)).toEqual(['A1', 'A2', 'A', 'C', 'C1', 'C2']);
  });

  it('합칠 묶음이 없으면 기존처럼 연속 묶음만 만든다', () => {
    const bundles = buildSpellingRuleBundles([
      rule({ find: 'x', dividerGroup: 'E' }),
      rule({ find: 'y', dividerGroup: 'E' }),
    ]);
    expect(bundles).toHaveLength(1);
    expect(bundles[0].rules.map((r) => r.find)).toEqual(['x', 'y']);
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
