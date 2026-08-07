import { describe, expect, it } from 'vitest';
import { isSpacedLeftAdnominalNoiseEojeol } from './unifyNoiseListAdnominalHeuristic.js';
import { isSpacedLeftJosaNoiseEojeol } from './unifyNoiseListLeftHeuristic.js';
import { shouldRejectByNoiseList } from './unifyNoiseList.js';
import { isPatternRuleHeadBlacklisted } from './unifyPatternRule.js';

describe('isSpacedLeftAdnominalNoiseEojeol', () => {
  it('관형형 -는/-던/-은/-된/-진/-한/-운/-낸/-난/-린/-른/-온/-픈/-싼 앞말을 잡는다', () => {
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
      '과열된',
      '관련된',
      '만들어진',
      '깨어진',
      '섬세한',
      '아름다운',
      '오려낸',
      '알아낸',
      '드러난',
      '일어난',
      '나타난',
      '휩싸인',
      '휩쓴',
      '굶주린',
      '게으른',
      '배고픈',
      '살아온',
      '직접적인',
      '효과적인',
    ]) {
      expect(isSpacedLeftAdnominalNoiseEojeol(left), left).toBe(true);
    }
  });

  it('조사 가드는 별도 — 붉은≠붉+은 이지만 후보는 DROP', () => {
    expect(isSpacedLeftJosaNoiseEojeol('붉은')).toBe(false);
    expect(shouldRejectByNoiseList('붉은 표시')).toBe(true);
  });

  it('가진·만한(종성 ㄴ)·사진·지진·대한·북한·재난·개인·어린·바쁜·비싼·남북한은 휴리스틱 밖', () => {
    expect(isSpacedLeftAdnominalNoiseEojeol('가진')).toBe(false);
    expect(isSpacedLeftAdnominalNoiseEojeol('만한')).toBe(false);
    expect(isSpacedLeftAdnominalNoiseEojeol('직장')).toBe(false);
    expect(isSpacedLeftAdnominalNoiseEojeol('시민')).toBe(false);
    expect(isSpacedLeftAdnominalNoiseEojeol('사진')).toBe(false);
    expect(isSpacedLeftAdnominalNoiseEojeol('지진')).toBe(false);
    expect(isSpacedLeftAdnominalNoiseEojeol('대한')).toBe(false);
    expect(isSpacedLeftAdnominalNoiseEojeol('북한')).toBe(false);
    expect(isSpacedLeftAdnominalNoiseEojeol('남북한')).toBe(false);
    expect(isSpacedLeftAdnominalNoiseEojeol('재난')).toBe(false);
    expect(isSpacedLeftAdnominalNoiseEojeol('개인')).toBe(false);
    expect(isSpacedLeftAdnominalNoiseEojeol('어린')).toBe(false);
    expect(isSpacedLeftAdnominalNoiseEojeol('바쁜')).toBe(false);
    expect(isSpacedLeftAdnominalNoiseEojeol('비싼')).toBe(false);
  });

  it('띄움·패턴 head·대부분+의·@시대·@무늬 오탐에 연결된다', () => {
    expect(shouldRejectByNoiseList('아는 사람')).toBe(true);
    expect(shouldRejectByNoiseList('않은 사람')).toBe(true);
    expect(shouldRejectByNoiseList('높은 사람')).toBe(true);
    expect(shouldRejectByNoiseList('대부분의 사람')).toBe(true);
    expect(shouldRejectByNoiseList('직장 사람')).toBe(false);
    expect(shouldRejectByNoiseList('담긴 시대')).toBe(true);
    expect(shouldRejectByNoiseList('마음이 시대')).toBe(true);
    expect(shouldRejectByNoiseList('만들어진 시대')).toBe(true);
    expect(shouldRejectByNoiseList('오려낸 무늬')).toBe(true);
    expect(shouldRejectByNoiseList('섬세한 무늬')).toBe(true);
    expect(shouldRejectByNoiseList('아름다운 무늬')).toBe(true);
    expect(shouldRejectByNoiseList('사진 시장')).toBe(false);
    expect(shouldRejectByNoiseList('대한 민국')).toBe(false);
    expect(isPatternRuleHeadBlacklisted('붉은')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('오려낸')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('섬세한')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('아름다운')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('직장')).toBe(false);
  });
});
