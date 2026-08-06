import { beforeAll, describe, expect, it } from 'vitest';
import { resolveKiwiNodePaths, loadKiwiNode } from './kiwiMorph/loadNode.js';

/**
 * Kiwi joinSent 실증 — 모델 있을 때만 (로컬/CI에 tmp/kiwi-models 필요).
 */
const kiwiReady = resolveKiwiNodePaths().ready;

describe.skipIf(!kiwiReady)('b1 joinSent spike (Kiwi)', () => {
  /** @type {import('kiwi-nlp').Kiwi | null} */
  let kiwi = null;

  beforeAll(async () => {
    kiwi = await loadKiwiNode({ register: false });
  }, 60_000);

  it('joinSent 사용 가능', () => {
    expect(kiwi?.joinSent).toBeTypeOf('function');
  });

  it('을 → ㄹ 계열 (가+을→갈, 우겨넣+을→우겨넣을)', () => {
    expect(
      kiwi.joinSent(
        [
          { form: '가', tag: 'VV' },
          { form: '을', tag: 'ETM' },
        ],
        true,
      ).str,
    ).toBe('갈');
    expect(
      kiwi.joinSent(
        [
          { form: '우겨넣', tag: 'VV' },
          { form: '을', tag: 'ETM' },
        ],
        true,
      ).str,
    ).toBe('우겨넣을');
  });

  it('잘못된 품사 태그는 거부하지 않음 — 동일·죽은 표면 (충돌 잔여 위험 문서화)', () => {
    const join = (stem, tag, end) =>
      kiwi.joinSent(
        [
          { form: stem, tag },
          { form: end, tag: 'ETM' },
        ],
        true,
      ).str;

    expect(join('예쁘', 'VV', '은')).toBe('예쁜');
    expect(join('예쁘', 'VA', '은')).toBe('예쁜');
    expect(join('예쁘', 'VV', '는')).toBe('예쁘는');
    expect(join('예쁘', 'VA', '는')).toBe('예쁘는');

    expect(join('먹', 'VA', '는')).toBe('먹는');
    expect(join('먹', 'VV', '는')).toBe('먹는');

    expect(join('좋', 'VV', '는')).toBe('좋는');
    expect(join('좋', 'VA', '는')).toBe('좋는');
  });
});
