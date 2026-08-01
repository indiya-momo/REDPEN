import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mapLayoutIndexToVisualIndex } from '../unifyCandidateDiscover.js';
import {
  analyzeLine,
  clearKiwiAnalyzeCache,
  clearKiwiInstance,
  isJosaTag,
  mapRestoredToVisual,
  setKiwiInstance,
  stripTrailingJosaFromTokens,
  stripTrailingJosaKiwi,
} from './index.js';
import { resolveKiwiNodePaths } from './loadNode.js';

const { ready: HAS_KIWI_MODEL } = resolveKiwiNodePaths();

describe('kiwiMorph tokens helpers', () => {
  it('J* 태그를 조사로 본다', () => {
    expect(isJosaTag('JKO')).toBe(true);
    expect(isJosaTag('JX')).toBe(true);
    expect(isJosaTag('NNG')).toBe(false);
  });

  it('토큰에서 끝 조사만 떼면 어간이 된다', () => {
    const surface = '초콜렛을';
    const tokens = [
      { str: '초콜렛', tag: 'NNG', position: 0, length: 3 },
      { str: '을', tag: 'JKO', position: 3, length: 1 },
    ];
    expect(stripTrailingJosaFromTokens(surface, tokens)).toBe('초콜렛');
  });

  it('조사가 없으면 null', () => {
    const tokens = [{ str: '경제학', tag: 'NNG', position: 0, length: 3 }];
    expect(stripTrailingJosaFromTokens('경제학', tokens)).toBeNull();
  });
});

describe('shouldAnalyzeWithKiwi', () => {
  it('한 글자 공백 나열은 스킵', async () => {
    const { shouldAnalyzeWithKiwi } = await import('./shouldAnalyze.js');
    expect(shouldAnalyzeWithKiwi('명 지 계 곡')).toBe(false);
    expect(shouldAnalyzeWithKiwi('경제학자로서')).toBe(true);
  });
});

describe('analyzeLine cache', () => {
  it('동일 입력 두 번째는 analyze를 다시 호출하지 않는다', () => {
    clearKiwiAnalyzeCache();
    let calls = 0;
    const kiwi = {
      ready: () => true,
      analyze: (s) => {
        calls += 1;
        return {
          tokens: [{ str: s, tag: 'NNG', position: 0, length: s.length }],
          score: 0,
        };
      },
    };
    setKiwiInstance(/** @type {any} */ (kiwi));
    expect(analyzeLine('경제학', { kiwi })).toBeTruthy();
    expect(analyzeLine('경제학', { kiwi })).toBeTruthy();
    expect(calls).toBe(1);
    expect(analyzeLine('경제학', { kiwi, skipCache: true })).toBeTruthy();
    expect(calls).toBe(2);
    clearKiwiInstance();
    clearKiwiAnalyzeCache();
  });
});

describe('mapRestoredToVisual', () => {
  it('absIndex만 있으면 layout/page 인덱스를 반환한다', () => {
    const page = {};
    expect(
      mapRestoredToVisual(page, 2, { absIndex: (i) => i + 10 }),
    ).toBe(12);
  });

  it('mapLayoutToVisual bridge로 visual로 투영한다', () => {
    const page = {
      itemRefsLayout: [{ start: 0, end: 10, itemIndex: 0 }],
      itemRefs: [{ start: 0, end: 8, itemIndex: 0 }],
    };
    const visual = mapRestoredToVisual(page, 4, {
      absIndex: (i) => i,
      mapLayoutToVisual: mapLayoutIndexToVisualIndex,
    });
    expect(typeof visual).toBe('number');
    expect(visual).toBeGreaterThanOrEqual(0);
  });

  it('bridge 없이 restoredOffset을 그대로 쓴다', () => {
    expect(mapRestoredToVisual({}, 7)).toBe(7);
  });
});

describe.skipIf(!HAS_KIWI_MODEL)('kiwiMorph Node (모델 필요)', () => {
  beforeAll(async () => {
    const { loadKiwiNode } = await import('./loadNode.js');
    const kiwi = await loadKiwiNode();
    expect(kiwi).toBeTruthy();
  }, 120_000);

  afterAll(() => {
    clearKiwiInstance();
  });

  it('JKO: 초콜렛을 → 초콜렛', () => {
    expect(stripTrailingJosaKiwi('초콜렛을')).toBe('초콜렛');
  });

  it('JKG: 경제왕국의 → 경제왕국', () => {
    expect(stripTrailingJosaKiwi('경제왕국의')).toBe('경제왕국');
  });

  it('JX: 학생도 → 학생', () => {
    expect(stripTrailingJosaKiwi('학생도')).toBe('학생');
  });

  it('JKB: 학교에서 → 학교', () => {
    expect(stripTrailingJosaKiwi('학교에서')).toBe('학교');
  });

  it('JKS: 고양이가 → 고양이', () => {
    expect(stripTrailingJosaKiwi('고양이가')).toBe('고양이');
  });

  it('띄움 마지막 어절 조사: 경제 왕국의 → 경제 왕국', () => {
    expect(stripTrailingJosaKiwi('경제 왕국의')).toBe('경제 왕국');
  });

  it('user dict: 명지계곡을 → 명지계곡', () => {
    expect(stripTrailingJosaKiwi('명지계곡을')).toBe('명지계곡');
  });

  it('표면형 1:1 (Match.all)', () => {
    const r = analyzeLine('나는 초콜렛을 먹었다.');
    expect(r?.surface1to1).toBe(true);
    expect(r?.tokens.some((t) => t.tag === 'JKO' && t.str === '을')).toBe(
      true,
    );
  });

  it('조사가 없으면 null → heuristic 폴백 유도', () => {
    expect(stripTrailingJosaKiwi('경제학')).toBeNull();
  });

  it('활용형 끝은 조사 strip 대상 아님 (먹었다)', () => {
    // 문장 전체면 끝 토큰이 EF — 조사 런이 없으면 null
    expect(stripTrailingJosaKiwi('먹었다')).toBeNull();
  });
});
