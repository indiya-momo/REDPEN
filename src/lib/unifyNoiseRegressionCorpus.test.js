import { describe, expect, it } from 'vitest';
import {
  matchesNoiseListMorphTail,
  shouldRejectByNoiseList,
} from './unifyNoiseList.js';
import { passesPatternRuleUnifyFilter } from './unifyPatternRule.js';
import {
  UNIFY_NOISE_REGRESSION_DROP,
  UNIFY_NOISE_REGRESSION_DROP_SURFACES,
  UNIFY_NOISE_REGRESSION_KEEP,
} from './unifyNoiseRegressionCorpus.js';

/**
 * KEEP/DROP 회귀 — 휴리스틱·수확 변경 시 나다·붉은형 오탐과 잡음 재유입을 막는다.
 */
describe('unifyNoiseRegressionCorpus', () => {
  it.each(UNIFY_NOISE_REGRESSION_KEEP.map((c) => [c.spaced, c.note ?? '']))(
    'KEEP shouldRejectByNoiseList(%s) — %s',
    (spaced) => {
      expect(shouldRejectByNoiseList(spaced)).toBe(false);
    },
  );

  it.each(UNIFY_NOISE_REGRESSION_KEEP.map((c) => [c.spaced, c.note ?? '']))(
    'KEEP passesPatternRuleUnifyFilter(%s) — %s',
    (spaced) => {
      expect(passesPatternRuleUnifyFilter(spaced)).toBe(true);
    },
  );

  it.each(UNIFY_NOISE_REGRESSION_DROP.map((c) => [c.spaced, c.note ?? '']))(
    'DROP shouldRejectByNoiseList(%s) — %s',
    (spaced) => {
      expect(shouldRejectByNoiseList(spaced)).toBe(true);
    },
  );

  it.each(UNIFY_NOISE_REGRESSION_DROP.map((c) => [c.spaced, c.note ?? '']))(
    'DROP passesPatternRuleUnifyFilter(%s) — %s',
    (spaced) => {
      expect(passesPatternRuleUnifyFilter(spaced)).toBe(false);
    },
  );

  it.each(
    UNIFY_NOISE_REGRESSION_DROP_SURFACES.map((c) => [c.surface, c.note ?? '']),
  )('DROP surface matchesNoiseListMorphTail(%s) — %s', (surface) => {
    expect(matchesNoiseListMorphTail(surface)).toBe(true);
  });

  it('코퍼스 규모 — KEEP/DROP이 비어 있지 않다', () => {
    expect(UNIFY_NOISE_REGRESSION_KEEP.length).toBeGreaterThanOrEqual(4);
    expect(UNIFY_NOISE_REGRESSION_DROP.length).toBeGreaterThanOrEqual(10);
  });
});
