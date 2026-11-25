import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveKiwiNodePaths, loadKiwiNode } from '../kiwiMorph/loadNode.js';
import { clearKiwiInstance } from '../kiwiMorph/runtime.js';
import {
  collectAuxPairs,
  confirmAuxPairs,
  decideAuxPair,
} from './auxPairConfirm.js';

const { ready: HAS_KIWI_MODEL } = resolveKiwiNodePaths();

describe('보조용언 두 어절 후보', () => {
  it('줄 안에서 아/어로 끝나는 앞 어절만 고른다', () => {
    const text = '쉬어 가라고\n날아 올라 학교';
    expect(collectAuxPairs(text).map((p) => `${p.left} ${p.right}`)).toEqual([
      '쉬어 가라고',
      '날아 올라',
    ]);
  });
});

describe('보조용언 판정', () => {
  it('아/어 연결 다음이 VX이면 기본형을 만든다', () => {
    const hit = decideAuxPair(
      { left: '쉬어', right: '가라고' },
      {
        surface1to1: true,
        tokens: [
          { str: '쉬', tag: 'VV', position: 0, length: 1 },
          { str: '어', tag: 'EC', position: 1, length: 1 },
          { str: '가', tag: 'VX', position: 3, length: 1 },
          { str: '라고', tag: 'EC', position: 4, length: 2 },
        ],
      },
    );
    expect(hit).toEqual({ pair: '쉬어 가라고', lemma: '쉬어가다' });
  });

  it('1:1이 깨지면 침묵', () => {
    expect(
      decideAuxPair(
        { left: '들어', right: '온' },
        {
          surface1to1: false,
          tokens: [
            { str: '듣', tag: 'VV-I', position: 0, length: 1 },
            { str: '어', tag: 'EC', position: 1, length: 1 },
            { str: '오', tag: 'VX', position: 3, length: 1 },
          ],
        },
      ),
    ).toBeNull();
  });

  it('뒤가 본용언 VV이면 보조가 아니다', () => {
    expect(
      decideAuxPair(
        { left: '날아', right: '올라' },
        {
          surface1to1: true,
          tokens: [
            { str: '날', tag: 'VV', position: 0, length: 1 },
            { str: '아', tag: 'EC', position: 1, length: 1 },
            { str: '오르', tag: 'VV', position: 3, length: 2 },
            { str: '어', tag: 'EF', position: 5, length: 1 },
          ],
        },
      ),
    ).toBeNull();
  });

  it('사전이 없으면 확인으로 올리지 않는다', async () => {
    const kiwi = {
      ready: () => true,
      analyze: () => ({
        tokens: [
          { str: '쉬', tag: 'VV', position: 0, length: 1 },
          { str: '어', tag: 'EC', position: 1, length: 1 },
          { str: '가', tag: 'VX', position: 3, length: 1 },
        ],
      }),
    };
    const result = await confirmAuxPairs('쉬어 가라고', { kiwi });
    expect(result.confirms).toEqual([]);
    expect(result.skipped).toBe(1);
    expect(result.morph).toBe(1);
  });
});

describe.skipIf(!HAS_KIWI_MODEL)('보조용언 두 어절 (Node 모델)', () => {
  /** @type {import('kiwi-nlp').Kiwi | null} */
  let kiwi = null;

  beforeAll(async () => {
    kiwi = await loadKiwiNode({ register: false });
  }, 120_000);

  afterAll(() => {
    clearKiwiInstance();
  });

  it('1:1인 VX만 확인 후보가 되고 등재된 것만 남긴다', async () => {
    const text = '쉬어 가라고. 날아 올라. 들어 온. 하지 말고.';
    const registered = new Set(['쉬어가다']);
    const result = await confirmAuxPairs(text, {
      kiwi,
      includeDetail: true,
      isRegistered: async (lemma) => registered.has(lemma),
    });
    expect(result.skipped).toBe(0);
    expect(result.confirms.map((row) => row.pair)).toEqual(['쉬어 가라고']);
    expect(result.confirms[0]?.direction).toBe('confirm');
  });
});
