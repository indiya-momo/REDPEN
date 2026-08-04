import { describe, expect, it } from 'vitest';
import {
  UNIFY_NOISE_BON_BOJO_REFS,
  UNIFY_NOISE_EXCEPTION_EOJEOLS,
  UNIFY_NOISE_TAG_TEMPLATES,
  UNIFY_NOISE_VERBAL_TAILS,
  hasUnifyNoiseDenyEojeol,
  matchesNoiseListMorphTail,
  shouldRejectByNoiseList,
  spacedVariantHitsNoiseDenylist,
} from './unifyNoiseList.js';

describe('unifyNoiseList (1차 정적 리스트)', () => {
  it('예외·꼬리·본보조 ref 메타가 있다', () => {
    expect(UNIFY_NOISE_EXCEPTION_EOJEOLS.has('대부분')).toBe(true);
    expect(UNIFY_NOISE_VERBAL_TAILS).toContain('있다고');
    expect(UNIFY_NOISE_BON_BOJO_REFS).toContain('verb-hada');
    expect(UNIFY_NOISE_TAG_TEMPLATES.some((t) => t.id === 'noun-verbal-connective')).toBe(
      true,
    );
    expect(hasUnifyNoiseDenyEojeol('기록하다')).toBe(false);
    expect(hasUnifyNoiseDenyEojeol('가정하고')).toBe(false);
  });

  it('예외는 NNG 오통과만', () => {
    expect(hasUnifyNoiseDenyEojeol('대부분')).toBe(true);
    expect(hasUnifyNoiseDenyEojeol('일부')).toBe(true);
    expect(hasUnifyNoiseDenyEojeol('공무원')).toBe(false);
    expect(UNIFY_NOISE_EXCEPTION_EOJEOLS.size).toBeLessThanOrEqual(20);
  });

  it('수확 꼬리로 가치있다고·구성되며·것이고를 잡는다', () => {
    expect(matchesNoiseListMorphTail('가치있다고')).toBe(true);
    expect(matchesNoiseListMorphTail('구성되며')).toBe(true);
    expect(matchesNoiseListMorphTail('것이고')).toBe(true);
    expect(matchesNoiseListMorphTail('주식')).toBe(false);
  });

  it('띄움 1차 리스트 — 잡음 제외·명사복합 유지', () => {
    expect(spacedVariantHitsNoiseDenylist('대부분 공무원')).toBe(true);
    expect(shouldRejectByNoiseList('대부분 공무원')).toBe(true);
    expect(shouldRejectByNoiseList('가정하고 공무원')).toBe(true);
    expect(shouldRejectByNoiseList('가치있다고 시장')).toBe(true);
    expect(shouldRejectByNoiseList('구성되며 시장')).toBe(true);
    expect(shouldRejectByNoiseList('기록하여 결과')).toBe(true);
    expect(shouldRejectByNoiseList('경리 업무')).toBe(false);
  });
});
