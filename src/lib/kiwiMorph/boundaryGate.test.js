import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { shouldSkipMatch } from '../matchFilters.js';
import {
  clearKiwiInstance,
  isKiwiBoundaryStemTag,
  shouldSkipMatchByKiwiBoundary,
  shouldSkipMatchByKiwiTokens,
} from './index.js';
import { resolveKiwiNodePaths } from './loadNode.js';

const { ready: HAS_KIWI_MODEL } = resolveKiwiNodePaths();

/** @returns {RegExpExecArray} */
function fakeMatch(text, matched, index) {
  const m = /** @type {RegExpExecArray} */ ([matched]);
  m.index = index;
  m.input = text;
  return m;
}

describe('kiwiMorph boundaryGate (순수 토큰)', () => {
  it('화이트리스트 태그', () => {
    expect(isKiwiBoundaryStemTag('NNG')).toBe(true);
    expect(isKiwiBoundaryStemTag('NNG-R')).toBe(true);
    expect(isKiwiBoundaryStemTag('VV')).toBe(false);
  });

  it('경제 ⊂ 경제학 → skip', () => {
    const text = '경제학과 성장';
    const tokens = [
      { str: '경제학', tag: 'NNG', position: 0, length: 3 },
      { str: '과', tag: 'JC', position: 3, length: 1 },
    ];
    expect(shouldSkipMatchByKiwiTokens('경제', text, 0, tokens)).toBe(true);
  });

  it('경제학 전체 토큰 → keep', () => {
    const text = '경제학';
    const tokens = [{ str: '경제학', tag: 'NNG', position: 0, length: 3 }];
    expect(shouldSkipMatchByKiwiTokens('경제학', text, 0, tokens)).toBe(false);
  });

  it('초콜렛 + 뒤 조사 → 어간만 매치 keep', () => {
    const text = '초콜렛을 먹었다';
    const tokens = [
      { str: '초콜렛', tag: 'NNG', position: 0, length: 3 },
      { str: '을', tag: 'JKO', position: 3, length: 1 },
    ];
    expect(shouldSkipMatchByKiwiTokens('초콜렛', text, 0, tokens)).toBe(false);
  });

  it('VV 부분일치는 화이트리스트 밖 → keep(보수)', () => {
    const text = '먹었다';
    const tokens = [
      { str: '먹', tag: 'VV', position: 0, length: 1 },
      { str: '었', tag: 'EP', position: 1, length: 1 },
      { str: '다', tag: 'EF', position: 2, length: 1 },
    ];
    // '먹었' would be mid/end across tokens — if we match only part of VV differently
    expect(shouldSkipMatchByKiwiTokens('먹', text, 0, tokens)).toBe(false);
  });
});

describe.skipIf(!HAS_KIWI_MODEL)('kiwiMorph boundaryGate (Node 모델)', () => {
  beforeAll(async () => {
    const { loadKiwiNode } = await import('./loadNode.js');
    await loadKiwiNode();
  }, 120_000);

  afterAll(() => {
    clearKiwiInstance();
  });

  it('경제학 안 경제 → skip', () => {
    const text = '경제학과 경제 성장';
    expect(shouldSkipMatchByKiwiBoundary('경제', text, 0)).toBe(true);
  });

  it('띄움 경제(별도 토큰) → keep', () => {
    const text = '경제학과 경제 성장';
    const idx = text.indexOf('경제 성장');
    expect(shouldSkipMatchByKiwiBoundary('경제', text, idx)).toBe(false);
  });

  it('초콜렛을 중 초콜렛 → keep', () => {
    const text = '나는 초콜렛을 먹었다.';
    const idx = text.indexOf('초콜렛');
    expect(shouldSkipMatchByKiwiBoundary('초콜렛', text, idx)).toBe(false);
  });

  it('shouldSkipMatch 플래그 OFF면 Kiwi 무시', () => {
    import.meta.env.VITE_SPELLING_KIWI_BOUNDARY = undefined;
    const text = '경제학';
    const m = fakeMatch(text, '경제', 0);
    expect(shouldSkipMatch({}, m, text)).toBe(false);
  });

  it('shouldSkipMatch 플래그 ON이면 부분일치 skip', () => {
    import.meta.env.VITE_SPELLING_KIWI_BOUNDARY = 'true';
    const text = '경제학';
    const m = fakeMatch(text, '경제', 0);
    expect(shouldSkipMatch({}, m, text)).toBe(true);
    import.meta.env.VITE_SPELLING_KIWI_BOUNDARY = undefined;
  });
});
