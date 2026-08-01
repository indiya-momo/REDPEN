import { describe, expect, it } from 'vitest';
import {
  clampAnalyzeText,
  KIWI_ANALYZE_MAX_CHARS,
  parseAnalyzeRequestBody,
} from './serverContract.js';
import {
  clearRemoteAnalyzeCache,
  getRemoteAnalyze,
  putRemoteAnalyze,
} from './remoteCache.js';
import { analyzeLine, clearKiwiAnalyzeCache } from './analyze.js';
import { clearKiwiInstance, setKiwiServerMode } from './runtime.js';
import { collectRuleCheckKiwiPrefetchSurfaces } from './prefetchSurfaces.js';

describe('kiwiMorph serverContract', () => {
  it('clampAnalyzeText는 최대 길이를 자른다', () => {
    const long = '가'.repeat(KIWI_ANALYZE_MAX_CHARS + 10);
    expect(clampAnalyzeText(long).length).toBe(KIWI_ANALYZE_MAX_CHARS);
  });

  it('parseAnalyzeRequestBody는 text·texts를 받는다', () => {
    expect(parseAnalyzeRequestBody({ text: '초콜렛을' })).toEqual({
      texts: ['초콜렛을'],
    });
    expect(parseAnalyzeRequestBody({ texts: ['a', '', 'b'] })).toEqual({
      texts: ['a', 'b'],
    });
    expect(parseAnalyzeRequestBody({})).toEqual({ error: 'KIWI_TEXT_MISSING' });
  });
});

describe('kiwiMorph remoteCache + analyzeLine', () => {
  it('서버 캐시가 있으면 로컬 kiwi 없이 analyzeLine이 동작한다', () => {
    clearKiwiInstance();
    clearKiwiAnalyzeCache();
    clearRemoteAnalyzeCache();
    setKiwiServerMode(false);

    putRemoteAnalyze('초콜렛을', {
      tokens: [
        { str: '초콜렛', tag: 'NNG', position: 0, length: 3 },
        { str: '을', tag: 'JKO', position: 3, length: 1 },
      ],
      surface1to1: true,
    });

    expect(getRemoteAnalyze('초콜렛을')?.tokens?.length).toBe(2);
    expect(analyzeLine('초콜렛을')?.surface1to1).toBe(true);

    clearRemoteAnalyzeCache();
    clearKiwiAnalyzeCache();
  });
});

describe('collectRuleCheckKiwiPrefetchSurfaces', () => {
  it('페이지 본문과 줄을 모은다', () => {
    const surfaces = collectRuleCheckKiwiPrefetchSurfaces([
      { text: '경제학을 배운다\n초콜렛을 먹는다' },
    ]);
    expect(surfaces).toContain('경제학을 배운다\n초콜렛을 먹는다');
    expect(surfaces).toContain('경제학을 배운다');
    expect(surfaces).toContain('초콜렛을 먹는다');
  });
});
