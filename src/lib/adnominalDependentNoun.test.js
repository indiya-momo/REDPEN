import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  decideAdnominalDependentSplit,
  findAdnominalDependentNounHits,
  looksLikeGluedAdnominalNnb,
} from './adnominalDependentNoun.js';
import {
  clearDeHeadwordGate,
  ensureDeHeadwordsLoaded,
  getDeHeadwordGateStatus,
  matchDeHeadwordGate,
  setDeHeadwordGateError,
  setDeHeadwordsForTests,
} from './stdictDeHeadwords.js';
import { resolveKiwiNodePaths, loadKiwiNode } from './kiwiMorph/loadNode.js';
import { clearKiwiInstance } from './kiwiMorph/runtime.js';
import { analyzeLine } from './kiwiMorph/analyze.js';

describe('decideAdnominalDependentSplit (목 토큰)', () => {
  it('ETM+NNB 수 → 띄어', () => {
    expect(
      decideAdnominalDependentSplit('있을수', {
        tokens: [
          { str: '있', tag: 'VA', position: 0, length: 1 },
          { str: '을', tag: 'ETM', position: 1, length: 1 },
          { str: '수', tag: 'NNB', position: 2, length: 1 },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        matchedText: '있을수',
        suggestedText: '있을 수',
        kind: '수',
      }),
    );
  });

  it('거+JKO(걸) KEEP', () => {
    expect(
      decideAdnominalDependentSplit('끝난걸', {
        tokens: [
          { str: '끝나', tag: 'VV', position: 0, length: 2 },
          { str: 'ᆫ', tag: 'ETM', position: 1, length: 1 },
          { str: '거', tag: 'NNB', position: 2, length: 1 },
          { str: 'ᆯ', tag: 'JKO', position: 2, length: 1 },
        ],
      }),
    ).toBeNull();
  });

  it('거+걸까 → 띄어', () => {
    expect(
      decideAdnominalDependentSplit('생각한걸까', {
        tokens: [
          { str: '생각', tag: 'NNG', position: 0, length: 2 },
          { str: '하', tag: 'XSV', position: 2, length: 1 },
          { str: 'ᆫ', tag: 'ETM', position: 2, length: 1 },
          { str: '거', tag: 'NNB', position: 3, length: 1 },
          { str: '이', tag: 'VCP', position: 3, length: 1 },
          { str: 'ᆯ까', tag: 'EF', position: 3, length: 2 },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        matchedText: '생각한걸까',
        suggestedText: '생각한 걸까',
      }),
    );
  });

  it('바 NNB KEEP', () => {
    expect(
      decideAdnominalDependentSplit('말한바', {
        tokens: [
          { str: '말', tag: 'NNG', position: 0, length: 1 },
          { str: '하', tag: 'XSV', position: 1, length: 1 },
          { str: 'ᆫ', tag: 'ETM', position: 1, length: 1 },
          { str: '바', tag: 'NNB', position: 2, length: 1 },
        ],
      }),
    ).toBeNull();
  });

  it('kiwi 없으면 findHits 빈 배열', () => {
    expect(findAdnominalDependentNounHits('있을수', { kiwi: null })).toEqual(
      [],
    );
  });

  it('looksLikeGluedAdnominalNnb', () => {
    expect(looksLikeGluedAdnominalNnb('있을수')).toBe(true);
    expect(looksLikeGluedAdnominalNnb('학교')).toBe(false);
  });
});

const kiwiReady = resolveKiwiNodePaths().ready;

describe.skipIf(!kiwiReady)('golden FIX · 실제 Kiwi', () => {
  /** @type {import('kiwi-nlp').Kiwi | null} */
  let kiwi = null;

  beforeAll(async () => {
    kiwi = await loadKiwiNode({ register: false });
    expect(kiwi?.ready?.()).toBe(true);
  }, 60_000);

  it('F01 될수 있 → 될 수', () => {
    expect(findAdnominalDependentNounHits('될수 있', { kiwi })).toEqual([
      expect.objectContaining({
        matchedText: '될수',
        suggestedText: '될 수',
        kind: '수',
      }),
    ]);
  });

  it('F02 봤을거 → 봤을 거', () => {
    expect(findAdnominalDependentNounHits('봤을거', { kiwi })).toEqual([
      expect.objectContaining({
        matchedText: '봤을거',
        suggestedText: '봤을 거',
        kind: '거',
      }),
    ]);
  });

  it('F03 생각한걸까 → 생각한 걸까', () => {
    expect(findAdnominalDependentNounHits('생각한걸까', { kiwi })).toEqual([
      expect.objectContaining({
        matchedText: '생각한걸까',
        suggestedText: '생각한 걸까',
        kind: '거',
      }),
    ]);
  });

  it('있는것 · 잊을만큼 · 할만큼', () => {
    expect(findAdnominalDependentNounHits('있는것이다', { kiwi })).toEqual([
      expect.objectContaining({
        matchedText: '있는것',
        suggestedText: '있는 것',
      }),
    ]);
    expect(
      findAdnominalDependentNounHits('고통을 잊을만큼의 고민', { kiwi }),
    ).toEqual([
      expect.objectContaining({
        matchedText: '잊을만큼',
        suggestedText: '잊을 만큼',
        kind: '만큼',
      }),
    ]);
    expect(findAdnominalDependentNounHits('할만큼', { kiwi })).toEqual([
      expect.objectContaining({
        matchedText: '할만큼',
        suggestedText: '할 만큼',
      }),
    ]);
  });
});

describe.skipIf(!kiwiReady)('golden KEEP · 실제 Kiwi', () => {
  /** @type {import('kiwi-nlp').Kiwi | null} */
  let kiwi = null;

  beforeAll(async () => {
    clearKiwiInstance();
    kiwi = await loadKiwiNode({ register: false });
  }, 60_000);

  afterAll(() => {
    clearKiwiInstance();
  });

  it.each([
    ['K01', '할수록'],
    ['K02', '끝난걸'],
    ['K03', '할걸'],
    ['K04', '어떤지 몰라'],
    ['K05', '말한바와 같이'],
    ['K06', '한 걸 알았다'],
    ['K-mag', '그만큼 깊다'],
    ['K-mag2', '이만큼'],
    ['K-noun', '키만큼'],
    ['K-su', '선수'],
    ['K-byeol', '별수 없이'],
    ['K-mal', '말수가 적다'],
    ['K-sal', '살수차'],
    ['K-geot', '그것은 없다'],
  ])('%s %s', (_id, input) => {
    expect(findAdnominalDependentNounHits(input, { kiwi })).toEqual([]);
  });

  it('위엄있·재미있다 — 관형사형+의존명사 아님', () => {
    expect(findAdnominalDependentNounHits('단단하게 위엄있다', { kiwi })).toEqual(
      [],
    );
    expect(findAdnominalDependentNounHits('재미있다', { kiwi })).toEqual([]);
  });

  it('분석 표본: 할수록은 EC', () => {
    const a = analyzeLine('할수록', { kiwi });
    expect(a?.tokens?.some((t) => t.tag === 'EC')).toBe(true);
  });
});


describe('데 · 목 토큰 (kiwi-nlp@0.23.0 기록용 목)', () => {
  it('looksLikeGluedAdnominalNnb: 갈데', () => {
    expect(looksLikeGluedAdnominalNnb('갈데')).toBe(true);
  });

  it('갈데: 가/VV + ㄹ/ETM + 데/NNB → 갈 데', () => {
    expect(
      decideAdnominalDependentSplit('갈데', {
        tokens: [
          { str: '가', tag: 'VV', position: 0, length: 1 },
          { str: 'ᆯ', tag: 'ETM', position: 0, length: 1 },
          { str: '데', tag: 'NNB', position: 1, length: 1 },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        matchedText: '갈데',
        suggestedText: '갈 데',
        kind: '데',
      }),
    );
  });

  it('하는데: 하/VV + 는데/EC → 없음', () => {
    expect(
      decideAdnominalDependentSplit('하는데', {
        tokens: [
          { str: '하', tag: 'VV', position: 0, length: 1 },
          { str: '는데', tag: 'EC', position: 1, length: 2 },
        ],
      }),
    ).toBeNull();
  });

  it('하는데다: 는/ETM + 데/NNB + 다/JX → 하는 데', () => {
    expect(
      decideAdnominalDependentSplit('하는데다', {
        tokens: [
          { str: '하', tag: 'VV', position: 0, length: 1 },
          { str: '는', tag: 'ETM', position: 1, length: 1 },
          { str: '데', tag: 'NNB', position: 2, length: 1 },
          { str: '다', tag: 'JX', position: 3, length: 1 },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        matchedText: '하는데',
        suggestedText: '하는 데',
        kind: '데',
      }),
    );
  });

  it('하는데에도: 데/NNB + 에/JKB + 도/JX → 하는 데', () => {
    expect(
      decideAdnominalDependentSplit('하는데에도', {
        tokens: [
          { str: '하', tag: 'VV', position: 0, length: 1 },
          { str: '는', tag: 'ETM', position: 1, length: 1 },
          { str: '데', tag: 'NNB', position: 2, length: 1 },
          { str: '에', tag: 'JKB', position: 3, length: 1 },
          { str: '도', tag: 'JX', position: 4, length: 1 },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        matchedText: '하는데',
        suggestedText: '하는 데',
        kind: '데',
      }),
    );
  });

  it('좋은데가: 은/ETM + 데/NNB + 가/JKS → 좋은 데', () => {
    expect(
      decideAdnominalDependentSplit('좋은데가', {
        tokens: [
          { str: '좋', tag: 'VA', position: 0, length: 1 },
          { str: '은', tag: 'ETM', position: 1, length: 1 },
          { str: '데', tag: 'NNB', position: 2, length: 1 },
          { str: '가', tag: 'JKS', position: 3, length: 1 },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        matchedText: '좋은데',
        suggestedText: '좋은 데',
        kind: '데',
      }),
    );
  });

  it('앉은데를: 은/ETM + 데/NNB + 를/JKO → 앉은 데', () => {
    expect(
      decideAdnominalDependentSplit('앉은데를', {
        tokens: [
          { str: '앉', tag: 'VV', position: 0, length: 1 },
          { str: '은', tag: 'ETM', position: 1, length: 1 },
          { str: '데', tag: 'NNB', position: 2, length: 1 },
          { str: '를', tag: 'JKO', position: 3, length: 1 },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        matchedText: '앉은데',
        suggestedText: '앉은 데',
        kind: '데',
      }),
    );
  });

  it('간데: ㄴ/ETM + 데/NNB, 조사 없음 → 없음(가드 4)', () => {
    expect(
      decideAdnominalDependentSplit('간데', {
        tokens: [
          { str: '가', tag: 'VV', position: 0, length: 1 },
          { str: 'ᆫ', tag: 'ETM', position: 0, length: 1 },
          { str: '데', tag: 'NNB', position: 1, length: 1 },
        ],
      }),
    ).toBeNull();
  });

  it('없는데·없는데도 → 없음(가드)', () => {
    expect(
      decideAdnominalDependentSplit('없는데', {
        tokens: [
          { str: '없', tag: 'VA', position: 0, length: 1 },
          { str: '는', tag: 'ETM', position: 1, length: 1 },
          { str: '데', tag: 'NNB', position: 2, length: 1 },
        ],
      }),
    ).toBeNull();
    expect(
      decideAdnominalDependentSplit('없는데도', {
        tokens: [
          { str: '없', tag: 'VA', position: 0, length: 1 },
          { str: '는', tag: 'ETM', position: 1, length: 1 },
          { str: '데', tag: 'NNB', position: 2, length: 1 },
          { str: '도', tag: 'JX', position: 3, length: 1 },
        ],
      }),
    ).toBeNull();
  });

  it('그럴듯한데도: 첫 쌍 듯/NNB는 힌트 밖, 데는 EC → 없음', () => {
    expect(
      decideAdnominalDependentSplit('그럴듯한데도', {
        tokens: [
          { str: '그렇', tag: 'VA-I', position: 0, length: 2 },
          { str: 'ᆯ', tag: 'ETM', position: 1, length: 1 },
          { str: '듯', tag: 'NNB', position: 2, length: 1 },
          { str: '하', tag: 'XSA', position: 3, length: 1 },
          { str: 'ᆫ데', tag: 'EC', position: 4, length: 1 },
          { str: '도', tag: 'JX', position: 5, length: 1 },
        ],
      }),
    ).toBeNull();
  });

  it('듯/NNB 다음의 조사 없는 한/ETM + 데/NNB → 없음(건너뛴 뒤에도 가드 4)', () => {
    expect(
      decideAdnominalDependentSplit('예쁜듯한데', {
        tokens: [
          { str: '예쁘', tag: 'VA', position: 0, length: 2 },
          { str: 'ᆫ', tag: 'ETM', position: 1, length: 1 },
          { str: '듯', tag: 'NNB', position: 2, length: 1 },
          { str: '한', tag: 'ETM', position: 3, length: 1 },
          { str: '데', tag: 'NNB', position: 4, length: 1 },
        ],
      }),
    ).toBeNull();
  });

  it('아무데: 아무/MM + 데/NNB → 없음', () => {
    expect(
      decideAdnominalDependentSplit('아무데', {
        tokens: [
          { str: '아무', tag: 'MM', position: 0, length: 2 },
          { str: '데', tag: 'NNB', position: 2, length: 1 },
        ],
      }),
    ).toBeNull();
  });
});

describe('데 표제어 게이트', () => {
  afterAll(() => {
    clearDeHeadwordGate();
  });

  it('주입: 쓸데없는은 어간 쓸데없으로 맞음', () => {
    setDeHeadwordsForTests({
      meta: { sourceDate: '20261106' },
      entries: [
        { raw: '쓸데-없다', surface: '쓸데없다', stem: '쓸데없', poses: '형용사' },
      ],
    });
    expect(matchDeHeadwordGate('쓸데없는')?.how).toBe('접두');
    expect(matchDeHeadwordGate('갈데')).toBeNull();
    expect(getDeHeadwordGateStatus().ok).toBe(true);
    expect(getDeHeadwordGateStatus().count).toBe(1);
  });

  it('로드 실패 시 조용히 끄지 않고 표시', () => {
    setDeHeadwordGateError('데 표제어 게이트를 읽지 못했다 (404).');
    const st = getDeHeadwordGateStatus();
    expect(st.ok).toBe(false);
    expect(st.state).toBe('error');
    expect(st.message).toMatch(/읽지 못했다/);
  });

  it('ensureDeHeadwordsLoaded: 주입 후 쓸데 게이트가 맞는다', async () => {
    clearDeHeadwordGate();
    expect(getDeHeadwordGateStatus().ok).toBe(false);
    await ensureDeHeadwordsLoaded({
      data: {
        meta: { sourceDate: '20261106' },
        entries: [
          { raw: '쓸-데', surface: '쓸데', stem: '쓸데', poses: '명사' },
          { raw: '쓸데-없다', surface: '쓸데없다', stem: '쓸데없', poses: '형용사' },
        ],
      },
    });
    expect(getDeHeadwordGateStatus().ok).toBe(true);
    expect(matchDeHeadwordGate('쓸데')?.how).toBe('정확');
    expect(matchDeHeadwordGate('쓸데없는')?.how).toBe('접두');
  });
});


describe.skipIf(!kiwiReady)('데 · 실제 Kiwi (kiwi-nlp@0.23.0)', () => {
  /** @type {import('kiwi-nlp').Kiwi | null} */
  let kiwi = null;

  beforeAll(async () => {
    setDeHeadwordsForTests({
      meta: { sourceDate: '20261106' },
      entries: [
        { raw: '쓸데-없다', surface: '쓸데없다', stem: '쓸데없', poses: '형용사' },
        { raw: '쓸데없-이', surface: '쓸데없이', stem: '쓸데없이', poses: '부사' },
        { raw: '난데-없다', surface: '난데없다', stem: '난데없', poses: '형용사' },
        { raw: '난데없-이', surface: '난데없이', stem: '난데없이', poses: '부사' },
        { raw: '간데-없다', surface: '간데없다', stem: '간데없', poses: '형용사' },
        { raw: '간데없-이', surface: '간데없이', stem: '간데없이', poses: '부사' },
        { raw: '온데간데-없다', surface: '온데간데없다', stem: '온데간데없', poses: '형용사' },
        { raw: '온데간데없-이', surface: '온데간데없이', stem: '온데간데없이', poses: '부사' },
      ],
    });
    kiwi = await loadKiwiNode({ register: false });
    expect(kiwi?.ready?.()).toBe(true);
  }, 60_000);

  afterAll(() => {
    clearDeHeadwordGate();
  });

  it.each([
    ['갈데', '갈 데'],
    ['있을데', '있을 데'],
    ['먹을데', '먹을 데'],
    ['할데', '할 데'],
    ['갈데가', '갈 데'],
    ['거부한데다', '거부한 데'],
    ['늘어난데다', '늘어난 데'],
    ['산적한데다', '산적한 데'],
    ['하는데다', '하는 데'],
    ['좋은데가', '좋은 데'],
    ['앉은데를', '앉은 데'],
    ['하는데에도', '하는 데'],
  ])('잡을 것 %s → %s', (input, suggested) => {
    const hits = findAdnominalDependentNounHits(input, { kiwi });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0]).toEqual(
      expect.objectContaining({
        suggestedText: suggested,
        kind: '데',
      }),
    );
  });

  it.each([
    '하는데',
    '있는데',
    '좋은데',
    '그런데',
    '근데',
    '한데',
    '있던데',
    '갈텐데',
    '예쁜데',
    '갔는데',
    '간데',
  ])('안 잡을 것 %s', (input) => {
    expect(findAdnominalDependentNounHits(input, { kiwi })).toEqual([]);
  });

  it.each([
    '없는데',
    '없는데도',
    '형편없는데',
    '심화되는데도',
    '그럴듯한데도',
  ])('회귀 오탐 표면 %s → 없음', (input) => {
    expect(findAdnominalDependentNounHits(input, { kiwi })).toEqual([]);
  });

  it.each([
    '쓸데없는',
    '쓸데없이',
    '난데없이',
    '간데없이',
    '온데간데없이',
  ])('게이트 %s → 없음', (input) => {
    expect(findAdnominalDependentNounHits(input, { kiwi })).toEqual([]);
  });
});
