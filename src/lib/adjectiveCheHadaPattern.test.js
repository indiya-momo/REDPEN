import { describe, expect, it } from 'vitest';
import { buildAuxiliaryVerbFindRules } from './auxiliaryVerbPattern.js';
import { matches } from '../test/matchText.js';

describe('adjectiveCheHadaPattern', () => {
  it('아는체하다 붙임 — 한다·하다·했다', () => {
    const rules = buildAuxiliaryVerbFindRules('체하');
    expect(rules.length).toBe(1);

    for (const text of ['아는체한다', '아는체하다', '아는체했다']) {
      expect(matches(rules[0], text), text).toBe(true);
    }

    for (const text of [
      '아는 체 한다',
      '아는 체 하다',
      '체한다',
      '체하다',
    ]) {
      expect(matches(rules[0], text), text).toBe(false);
    }
  });
});
