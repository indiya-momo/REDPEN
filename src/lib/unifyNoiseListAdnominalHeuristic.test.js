import { describe, expect, it } from 'vitest';
import { isSpacedLeftAdnominalNoiseEojeol } from './unifyNoiseListAdnominalHeuristic.js';
import { isSpacedLeftJosaNoiseEojeol } from './unifyNoiseListLeftHeuristic.js';
import { shouldRejectByNoiseList } from './unifyNoiseList.js';
import { isPatternRuleHeadBlacklisted } from './unifyPatternRule.js';

describe('isSpacedLeftAdnominalNoiseEojeol', () => {
  it('관형형 -는/-던/-은 앞말을 잡는다', () => {
    for (const left of [
      '아는',
      '못하는',
      '사는',
      '말하는',
      '않는',
      '가던',
      '붉은',
      '않은',
      '높은',
      '맑은',
    ]) {
      expect(isSpacedLeftAdnominalNoiseEojeol(left), left).toBe(true);
    }
  });

  it('조사 가드는 별도 — 붉은≠붉+은 이지만 후보는 DROP', () => {
    expect(isSpacedLeftJosaNoiseEojeol('붉은')).toBe(false);
    expect(shouldRejectByNoiseList('붉은 표시')).toBe(true);
  });

  it('가진·만한(종성 ㄴ)은 휴리스틱 밖 — 명사 앞말은 통과', () => {
    expect(isSpacedLeftAdnominalNoiseEojeol('가진')).toBe(false);
    expect(isSpacedLeftAdnominalNoiseEojeol('만한')).toBe(false);
    expect(isSpacedLeftAdnominalNoiseEojeol('직장')).toBe(false);
    expect(isSpacedLeftAdnominalNoiseEojeol('시민')).toBe(false);
  });

  it('띄움·패턴 head·대부분+의에 연결된다', () => {
    expect(shouldRejectByNoiseList('아는 사람')).toBe(true);
    expect(shouldRejectByNoiseList('않은 사람')).toBe(true);
    expect(shouldRejectByNoiseList('높은 사람')).toBe(true);
    expect(shouldRejectByNoiseList('대부분의 사람')).toBe(true);
    expect(shouldRejectByNoiseList('직장 사람')).toBe(false);
    expect(shouldRejectByNoiseList('가진 사람')).toBe(false);
    expect(isPatternRuleHeadBlacklisted('붉은')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('직장')).toBe(false);
  });
});
