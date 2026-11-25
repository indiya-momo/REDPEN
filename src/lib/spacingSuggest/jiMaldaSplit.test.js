import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveKiwiNodePaths, loadKiwiNode } from '../kiwiMorph/loadNode.js';
import { clearKiwiInstance } from '../kiwiMorph/runtime.js';
import {
  collectJiMaldaCandidates,
  decideJiMaldaSplit,
  suggestJiMaldaSplits,
} from './jiMaldaSplit.js';

const { ready: HAS_KIWI_MODEL } = resolveKiwiNodePaths();

describe('지 말다 후보 어절', () => {
  it('닫힌 끝만 고르고 지마 단독은 버린다', () => {
    const text = '하지말고 뛰지말라 하지말자 하지마세요 가지마 묻지마 지마켓 잡지마다 하지 말고';
    expect(collectJiMaldaCandidates(text)).toEqual([
      '하지말고',
      '뛰지말라',
      '하지말자',
      '하지마세요',
    ]);
  });

  it('종이를 말다와 하지말아는 후보가 아니다', () => {
    expect(collectJiMaldaCandidates('종이를 말다. 하지말아 하지말아라')).toEqual([]);
  });
});

describe('지 말다 네 조건', () => {
  it('지/EC 바로 다음 말/VX이고 1:1이면 말 앞에 띄운다', () => {
    const hit = decideJiMaldaSplit('하지말고', {
      surface1to1: true,
      tokens: [
        { str: '하', tag: 'VV', position: 0, length: 1 },
        { str: '지', tag: 'EC', position: 1, length: 1 },
        { str: '말', tag: 'VX', position: 2, length: 1 },
        { str: '고', tag: 'EC', position: 3, length: 1 },
      ],
    });
    expect(hit?.suggestedText).toBe('하지 말고');
  });

  it('1:1이 깨지면 침묵', () => {
    expect(
      decideJiMaldaSplit('하지마세요', {
        surface1to1: false,
        tokens: [
          { str: '하', tag: 'VV', position: 0, length: 1 },
          { str: '지', tag: 'EC', position: 1, length: 1 },
          { str: '말', tag: 'VX', position: 2, length: 1 },
          { str: '세요', tag: 'EF', position: 3, length: 2 },
        ],
      }),
    ).toBeNull();
  });

  it('말/NNG는 보조가 아니다', () => {
    expect(
      decideJiMaldaSplit('지말하다', {
        surface1to1: true,
        tokens: [
          { str: '지', tag: 'EC', position: 0, length: 1 },
          { str: '말', tag: 'NNG', position: 1, length: 1 },
          { str: '하', tag: 'XSV', position: 2, length: 1 },
          { str: '다', tag: 'EF', position: 3, length: 1 },
        ],
      }),
    ).toBeNull();
  });

  it('Kiwi가 없으면 후보 수만큼 건너뛰고 제안은 없다', () => {
    const text = '하지말고 뛰지말라';
    expect(suggestJiMaldaSplits(text, { kiwi: null })).toEqual({
      suggestions: [],
      skipped: 2,
      considered: 2,
      silent: [],
    });
  });
});

describe.skipIf(!HAS_KIWI_MODEL)('지 말다 split (Node 모델)', () => {
  /** @type {import('kiwi-nlp').Kiwi | null} */
  let kiwi = null;

  beforeAll(async () => {
    kiwi = await loadKiwiNode({ register: false });
  }, 30_000);

  afterAll(() => {
    clearKiwiInstance();
  });

  it('말고·말라·말자만 띄우고 나머지는 침묵', () => {
    const text = [
      '하지말고',
      '뛰지말라',
      '하지말자',
      '하지마세요',
      '하지마',
      '하지 말고',
      '종이를 말다',
      '지마켓',
      '가지마',
      '묻지마',
      '잡지마다',
      '하지말아',
    ].join(' ');
    const { suggestions, skipped } = suggestJiMaldaSplits(text, { kiwi });
    expect(skipped).toBe(0);
    expect(suggestions.map((s) => s.suggestedText)).toEqual([
      '하지 말고',
      '뛰지 말라',
      '하지 말자',
    ]);
  });
});
