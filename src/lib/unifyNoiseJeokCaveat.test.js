import { describe, expect, it } from 'vitest';
import {
  isSpacedLeftAdnominalNoiseEojeol,
  SPACED_JEOK_NOUN_EXCLUDE,
} from './unifyNoiseListAdnominalHeuristic.js';
import {
  shouldRejectByNoiseList,
  shouldRejectByNoiseListEojeol,
  shouldRejectByNoiseListSurface,
  shouldRejectUnifyCandidateNoise,
} from './unifyNoiseList.js';
import { passesPatternRuleUnifyFilter } from './unifyPatternRule.js';
import { hasUnifyNoiseDenyEojeol } from './unifyNoiseListData.js';

/** `-적` 휴리스틱 합의 주의사항 회귀 */
describe('unifyNoiseList -적 주의사항', () => {
  it('어간≥2 DROP · JSON 예외/꼬리 없이도', () => {
    for (const w of ['정치적', '사회적', '약탈적', '자본주의적', '비이성적']) {
      expect(hasUnifyNoiseDenyEojeol(w), w).toBe(false);
      expect(isSpacedLeftAdnominalNoiseEojeol(w), w).toBe(true);
      expect(shouldRejectByNoiseList(`${w} 시장`), w).toBe(true);
      expect(shouldRejectByNoiseListEojeol(w), w).toBe(true);
    }
  });

  it('명사 적 KEEP (어간1 + 닫힌 가드)', () => {
    for (const w of [
      '목적',
      '실적',
      '기적',
      '면적',
      '인적',
      '치적',
      '거적',
      '강적',
      '경적',
      '견적',
      '연적',
      '공적',
      '과적',
      '광적',
      '국적',
      '궤적',
      '극적',
      '도적',
      '무적',
      '흔적',
    ]) {
      expect(SPACED_JEOK_NOUN_EXCLUDE.has(w), w).toBe(true);
      expect(isSpacedLeftAdnominalNoiseEojeol(w), w).toBe(false);
      expect(shouldRejectByNoiseList(`${w} 시장`), w).toBe(false);
    }
  });

  it('적인 유지', () => {
    expect(isSpacedLeftAdnominalNoiseEojeol('직접적인')).toBe(true);
    expect(shouldRejectByNoiseList('전국적인 거품')).toBe(true);
  });

  it('붙임 약탈적시장 DROP · 목적의식·실적관리·가게주인 KEEP', () => {
    expect(shouldRejectByNoiseList('약탈적시장')).toBe(true);
    expect(shouldRejectByNoiseListSurface('약탈적시장')).toBe(true);
    expect(shouldRejectUnifyCandidateNoise('약탈적시장')).toBe(true);
    expect(passesPatternRuleUnifyFilter('약탈적시장')).toBe(false);

    expect(shouldRejectByNoiseList('목적의식')).toBe(false);
    expect(shouldRejectByNoiseList('실적관리')).toBe(false);
    expect(shouldRejectByNoiseList('국적요건')).toBe(false);
    expect(shouldRejectByNoiseList('가게 주인')).toBe(false);
    expect(shouldRejectUnifyCandidateNoise('가게주인')).toBe(false);
  });

  it('발견/패턴 붙임-only: 단독 정치적도 Surface에서 DROP', () => {
    expect(shouldRejectByNoiseListSurface('정치적')).toBe(true);
    expect(shouldRejectUnifyCandidateNoise('정치적')).toBe(true);
    expect(passesPatternRuleUnifyFilter('정치적')).toBe(false);
  });

  it('어간1 관형(내적)은 휴리스틱 DROP 안 함 — 목록 보완 영역', () => {
    expect(SPACED_JEOK_NOUN_EXCLUDE.has('내적')).toBe(false);
    expect(isSpacedLeftAdnominalNoiseEojeol('내적')).toBe(false);
    expect(shouldRejectByNoiseList('내적 동기')).toBe(false);
  });
});
