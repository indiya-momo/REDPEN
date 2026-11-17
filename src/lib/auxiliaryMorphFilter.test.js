import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { analyzeLine } from './kiwiMorph/analyze.js';
import { loadKiwiNode, resolveKiwiNodePaths } from './kiwiMorph/loadNode.js';
import { clearKiwiInstance } from './kiwiMorph/runtime.js';
import {
  isConfirmedAuxiliaryMorph,
  isDeuldaAuxiliaryGroup,
  isFalseDeuldaAuxiliaryMorph,
  pruneAuxiliaryFalseMorph,
} from './auxiliaryMorphFilter.js';

const { ready: HAS_KIWI_MODEL } = resolveKiwiNodePaths();

describe('isConfirmedAuxiliaryMorph', () => {
  it('분석 없거나 토큰 없으면 판단 불가(null)', () => {
    expect(isConfirmedAuxiliaryMorph(null)).toBeNull();
    expect(isConfirmedAuxiliaryMorph({ tokens: [] })).toBeNull();
  });

  it('VV·VX가 있으면 인정 (1:1 아니어도)', () => {
    expect(
      isConfirmedAuxiliaryMorph({
        surface1to1: false,
        tokens: [
          { str: '하', tag: 'VV' },
          { str: '어', tag: 'EC' },
          { str: '보이', tag: 'VV' },
          { str: '는', tag: 'ETM' },
        ],
      }),
    ).toBe(true);
    expect(
      isConfirmedAuxiliaryMorph({
        tokens: [
          { str: '쉬', tag: 'VV' },
          { str: '어', tag: 'EC' },
          { str: '가', tag: 'VX' },
          { str: '라고', tag: 'EC' },
        ],
      }),
    ).toBe(true);
  });

  it('명사+조사만이면 인정하지 않는다', () => {
    expect(
      isConfirmedAuxiliaryMorph({
        surface1to1: true,
        tokens: [
          { str: '신라', tag: 'NNP' },
          { str: '가', tag: 'JKS' },
        ],
      }),
    ).toBe(false);
  });
});

describe('isFalseDeuldaAuxiliaryMorph (legacy)', () => {
  it('아들/NNG + 아/JKV 는 들다가 아니다', () => {
    expect(
      isFalseDeuldaAuxiliaryMorph('아들아', {
        surface1to1: true,
        tokens: [
          { str: '아들', tag: 'NNG', position: 0, length: 2 },
          { str: '아', tag: 'JKV', position: 2, length: 1 },
        ],
      }),
    ).toBe(true);
  });

  it('녹아 + 아/EC + 들/VX 는 들다로 남긴다', () => {
    expect(
      isFalseDeuldaAuxiliaryMorph('녹아들어', {
        surface1to1: true,
        tokens: [
          { str: '녹', tag: 'VV', position: 0, length: 1 },
          { str: '아', tag: 'EC', position: 1, length: 1 },
          { str: '들', tag: 'VX', position: 2, length: 1 },
          { str: '어', tag: 'EC', position: 3, length: 1 },
        ],
      }),
    ).toBe(false);
  });
});

describe('pruneAuxiliaryFalseMorph', () => {
  it('용언이 확인된 히트만 남긴다 (가다·들다 공통)', () => {
    const analyze = (text) => {
      if (text === '신라가') {
        return {
          tokens: [
            { str: '신라', tag: 'NNP' },
            { str: '가', tag: 'JKS' },
          ],
        };
      }
      if (text === '아들아') {
        return {
          tokens: [
            { str: '아들', tag: 'NNG' },
            { str: '아', tag: 'JKV' },
          ],
        };
      }
      if (text === '살아가는') {
        return {
          tokens: [
            { str: '살아가', tag: 'VV' },
            { str: '는', tag: 'ETM' },
          ],
        };
      }
      if (text === '녹아들어') {
        return {
          tokens: [
            { str: '녹아들', tag: 'VV' },
            { str: '어', tag: 'EC' },
          ],
        };
      }
      if (text === '해보이는') {
        return {
          surface1to1: false,
          tokens: [
            { str: '하', tag: 'VV' },
            { str: '어', tag: 'EC' },
            { str: '보이', tag: 'VV' },
            { str: '는', tag: 'ETM' },
          ],
        };
      }
      return { tokens: [] };
    };
    const next = pruneAuxiliaryFalseMorph(
      [
        {
          patternKind: 'auxiliary-verb',
          bonBojoItemId: 'verb-gada',
          label: '(아/어) + 가다',
          instances: [
            { matchedText: '신라가', pageNum: 1, index: 0 },
            { matchedText: '살아가는', pageNum: 1, index: 10 },
          ],
        },
        {
          patternKind: 'auxiliary-verb',
          bonBojoItemId: 'verb-delda',
          label: '(아/어) + 들다',
          instances: [
            { matchedText: '아들아', pageNum: 1, index: 0 },
            { matchedText: '녹아들어', pageNum: 1, index: 10 },
          ],
        },
        {
          patternKind: 'auxiliary-verb',
          bonBojoItemId: 'verb-boda1',
          label: '(아/어) + 보다',
          instances: [{ matchedText: '해보이는', pageNum: 1, index: 0 }],
        },
      ],
      { analyze },
    );
    expect(next[0].instances.map((i) => i.matchedText)).toEqual(['살아가는']);
    expect(next[1].instances.map((i) => i.matchedText)).toEqual(['녹아들어']);
    expect(next[2].instances.map((i) => i.matchedText)).toEqual(['해보이는']);
  });

  it('분석 불가면 유지(fail-open)', () => {
    const next = pruneAuxiliaryFalseMorph(
      [
        {
          patternKind: 'auxiliary-verb',
          bonBojoItemId: 'verb-gada',
          instances: [{ matchedText: '모호한가', pageNum: 1, index: 0 }],
        },
      ],
      { analyze: () => null },
    );
    expect(next[0].instances).toHaveLength(1);
  });

  it('들다 그룹 판별은 유지', () => {
    expect(isDeuldaAuxiliaryGroup({ bonBojoItemId: 'verb-delda' })).toBe(true);
    expect(isDeuldaAuxiliaryGroup({ bonBojoItemId: 'verb-boda1' })).toBe(false);
  });
});

describe.skipIf(!HAS_KIWI_MODEL)('보조 용언 확인 (Node Kiwi)', () => {
  beforeAll(async () => {
    await loadKiwiNode({ register: true });
  }, 30_000);

  afterAll(() => {
    clearKiwiInstance();
  });

  it('신라가·아들아·나라들과는 버리고 살아가는·녹아들어·쉬어가라고는 남긴다', () => {
    expect(isConfirmedAuxiliaryMorph(analyzeLine('신라가'))).toBe(false);
    expect(isConfirmedAuxiliaryMorph(analyzeLine('아들아'))).toBe(false);
    expect(isConfirmedAuxiliaryMorph(analyzeLine('나라들과'))).toBe(false);
    expect(isConfirmedAuxiliaryMorph(analyzeLine('살아가는'))).toBe(true);
    expect(isConfirmedAuxiliaryMorph(analyzeLine('녹아들어'))).toBe(true);
    expect(isConfirmedAuxiliaryMorph(analyzeLine('쉬어가라고'))).toBe(true);
    expect(isConfirmedAuxiliaryMorph(analyzeLine('해보이는'))).toBe(true);
  });
});
