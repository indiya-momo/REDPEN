import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clearKiwiInstance } from './runtime.js';
import { resolveKiwiNodePaths } from './loadNode.js';
import {
  classifyKiwiSpacedEojeolPos,
  isKiwiNounCompoundEojeol,
  shouldRejectUnifySatelliteSpacedByPos,
} from './unifyExclude.js';
import { shouldRejectByNoiseList } from '../unifyNoiseList.js';
import { UNIFY_NOISE_REGRESSION_DROP_KIWI_ADNOMINAL } from '../unifyNoiseRegressionCorpus.js';

const { ready: HAS_KIWI_MODEL } = resolveKiwiNodePaths();

const ADNOMINAL_LEFTS = [
  '가진',
  '아는',
  '못하는',
  '사는',
  '말하는',
  '않는',
  '않은',
  '높은',
  '만한',
  '붉은',
];

/**
 * 옵션 1: Kiwi ready 시 관형형+사람은 POS로 DROP.
 * `가진`은 리스트 관형 휴리스틱(는/던) 밖이라 여기서만 고정.
 */
describe.skipIf(!HAS_KIWI_MODEL)('adnominal+사람 Kiwi phase2', () => {
  beforeAll(async () => {
    const { loadKiwiNode } = await import('./loadNode.js');
    await loadKiwiNode();
  }, 120_000);

  afterAll(() => {
    clearKiwiInstance();
  });

  it('Kiwi POS rejects adnominal+사람; keeps noun+사람', () => {
    for (const left of ADNOMINAL_LEFTS) {
      expect(isKiwiNounCompoundEojeol(left), left).toBe(false);
      expect(classifyKiwiSpacedEojeolPos(left), left).not.toBe('noun');
    }
    expect(isKiwiNounCompoundEojeol('직장')).toBe(true);

    for (const left of ADNOMINAL_LEFTS) {
      const spaced = `${left} 사람`;
      expect(
        shouldRejectUnifySatelliteSpacedByPos(spaced, 'noun'),
        spaced,
      ).toBe(true);
    }
    expect(shouldRejectUnifySatelliteSpacedByPos('직장 사람', 'noun')).toBe(
      false,
    );
  });

  it.each(
    UNIFY_NOISE_REGRESSION_DROP_KIWI_ADNOMINAL.map((c) => [
      c.spaced,
      c.note ?? '',
    ]),
  )('DROP_KIWI_ADNOMINAL %s — %s', (spaced) => {
    expect(shouldRejectByNoiseList(spaced)).toBe(false);
    expect(shouldRejectUnifySatelliteSpacedByPos(spaced, 'noun')).toBe(true);
  });
});
