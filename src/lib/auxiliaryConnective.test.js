import { describe, expect, it } from 'vitest';
import { classifyConnectiveBeforeAux, isAeoRaReoHead } from './auxiliaryConnective.js';
import { collectNonAeoAuxCandidates } from './nonAeoAuxSpacing.js';

describe('auxiliaryConnective — 라/러 어절의 -아/-어 판정', () => {
  it('르 불규칙 -아/-어는 -아/-어로 본다 (잘라·얼러 포함)', () => {
    for (const head of ['잘라', '얼러', '골라', '흘러', '불러', '따라', '이르러']) {
      expect(isAeoRaReoHead(head), head).toBe(true);
    }
  });

  it('으 탈락 -라/-러는 비아/어로 본다', () => {
    for (const head of ['하라', '가라', '하러', '놀러', '먹으라', '먹으러']) {
      expect(isAeoRaReoHead(head), head).toBe(false);
    }
  });

});

describe('auxiliaryConnective — -려 + 하다·들다', () => {
  it('-려 뒤가 하다·들다면 비아/어, 다른 보조용언이면 -아/-어', () => {
    expect(classifyConnectiveBeforeAux('하려', 'verb-hada')).toBe('non-aeo');
    expect(classifyConnectiveBeforeAux('가려', 'verb-delda')).toBe('non-aeo');
    expect(classifyConnectiveBeforeAux('가려', 'verb-juda1')).toBe('aeo');
    expect(classifyConnectiveBeforeAux('내려', 'verb-boda1')).toBe('aeo');
    expect(classifyConnectiveBeforeAux('가려')).toBe('aeo');
    expect(classifyConnectiveBeforeAux('먹으려', 'verb-juda1')).toBe('non-aeo');
  });

  it('띄어쓰기 후보: 하려하다·먹으려들다는 잡고 가려주다·오려붙여보다는 안 잡는다', () => {
    const heads = (text) => collectNonAeoAuxCandidates(text).map((c) => c.suggestedText);
    expect(heads('그걸 하려하다')).toContain('하려 하다');
    expect(heads('자꾸 먹으려들다')).toContain('먹으려 들다');
    expect(heads('눈을 가려주다')).toEqual([]);
    expect(heads('종이를 오려붙여보다')).toEqual([]);
    expect(heads('하려 하다')).toEqual([]);
  });
});