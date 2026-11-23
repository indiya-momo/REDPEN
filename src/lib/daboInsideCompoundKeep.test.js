import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  enrichSpellingDaboInsideCompoundKeep,
  eojeolAroundMatch,
  hasDeulyeodaboVerbStem,
  pruneDaboInsideCompoundHits,
  shouldKeepDaboInsideCompound,
  shouldKeepDaboMatchInText,
} from './daboInsideCompoundKeep.js';
import { resolveKiwiNodePaths, loadKiwiNode } from './kiwiMorph/loadNode.js';
import { analyzeLine } from './kiwiMorph/analyze.js';
import { clearKiwiInstance } from './kiwiMorph/runtime.js';
import {
  clearStdictVerbFormsCache,
  setStdictVerbFormsForTests,
} from './stdictVerbForms.js';

const kiwiReady = Boolean(resolveKiwiNodePaths()?.modelPath);

describe('daboInsideCompoundKeep (추출본)', () => {
  beforeAll(() => {
    setStdictVerbFormsForTests({
      lemmas: {
        들여다보다: ['들여다보니', '들여다보아', '들여다봐'],
        들여다보이다: ['들여다보여'],
      },
    });
  });

  afterAll(() => {
    clearStdictVerbFormsCache();
  });

  it('들여다보면·들여다보니는 KEEP', () => {
    expect(shouldKeepDaboInsideCompound('들여다보면')).toBe(true);
    expect(shouldKeepDaboInsideCompound('들여다보니')).toBe(true);
  });

  it('읽다보면·그러다보니·다보면은 KEEP 아님', () => {
    expect(shouldKeepDaboInsideCompound('읽다보면')).toBe(false);
    expect(shouldKeepDaboInsideCompound('그러다보니')).toBe(false);
    expect(shouldKeepDaboInsideCompound('다보면')).toBe(false);
  });

  it('텍스트 매치: 들여다보면만 KEEP', () => {
    expect(
      shouldKeepDaboMatchInText('유심히 들여다보면', 4, '다보면'),
    ).toBe(true);
    expect(shouldKeepDaboMatchInText('책을 읽다보면', 3, '다보면')).toBe(
      false,
    );
  });

  it('eojeolAroundMatch는 앞뒤 한글을 모은다', () => {
    expect(eojeolAroundMatch('유심히 들여다보면 알다', 4, 3)).toBe(
      '들여다보면',
    );
  });
});

describe('pruneDaboInsideCompoundHits', () => {
  beforeAll(() => {
    setStdictVerbFormsForTests({
      lemmas: {
        들여다보다: ['들여다보니', '들여다보아', '들여다봐'],
      },
    });
  });

  afterAll(() => {
    clearStdictVerbFormsCache();
  });

  it('들여다보면 인스턴스만 제거하고 읽다보면은 남긴다', () => {
    const pages = [{ pageNum: 1, text: '유심히 들여다보면 책을 읽다보면' }];
    const groups = [
      {
        label: '다보면',
        instances: [
          {
            pageNum: 1,
            index: 4,
            matchedText: '다보면',
          },
          {
            pageNum: 1,
            index: 14,
            matchedText: '다보면',
          },
        ],
      },
    ];
    // '유심히 ' = 4 chars, then 들여다보면; after space '책을 ' then 읽다보면
    const text = pages[0].text;
    const i1 = text.indexOf('들여다보면') + '들여'.length; // start of 다보면 inside
    const i2 = text.indexOf('읽다보면') + '읽'.length;
    groups[0].instances[0].index = i1;
    groups[0].instances[1].index = i2;

    const pruned = pruneDaboInsideCompoundHits(groups, pages, {
      analyze: () => null,
    });
    expect(pruned).toHaveLength(1);
    expect(pruned[0].instances).toHaveLength(1);
    expect(pruned[0].instances[0].index).toBe(i2);
  });

  it('다보 히트 없으면 enrich가 그대로 반환', async () => {
    const groups = [{ label: '기타', instances: [{ matchedText: '오래 된' }] }];
    const out = await enrichSpellingDaboInsideCompoundKeep(groups, []);
    expect(out).toBe(groups);
  });
});

describe.skipIf(!kiwiReady)('daboInsideCompoundKeep (Kiwi)', () => {
  /** @type {import('kiwi-nlp').Kiwi | null} */
  let kiwi = null;

  beforeAll(async () => {
    clearStdictVerbFormsCache();
    kiwi = await loadKiwiNode({ register: false });
    expect(kiwi?.ready?.()).toBe(true);
  }, 60_000);

  afterAll(() => {
    clearKiwiInstance();
  });

  it('추출본 없이 Kiwi만으로 들여다보면 KEEP·읽다보면 비KEEP', () => {
    const analyze = (text) => analyzeLine(text, { kiwi });
    expect(shouldKeepDaboInsideCompound('들여다보면', { analyze })).toBe(true);
    expect(shouldKeepDaboInsideCompound('들여다보니', { analyze })).toBe(true);
    expect(shouldKeepDaboInsideCompound('읽다보면', { analyze })).toBe(false);
    expect(shouldKeepDaboInsideCompound('그러다보니', { analyze })).toBe(
      false,
    );
    expect(shouldKeepDaboInsideCompound('다보면', { analyze })).toBe(false);
  });

  it('hasDeulyeodaboVerbStem은 VV 들여다보만', () => {
    expect(
      hasDeulyeodaboVerbStem(analyzeLine('들여다보면', { kiwi })),
    ).toBe(true);
    expect(hasDeulyeodaboVerbStem(analyzeLine('읽다보면', { kiwi }))).toBe(
      false,
    );
  });
});
