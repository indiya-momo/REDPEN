import { afterEach, describe, expect, it } from 'vitest';
import {
  clearStdictPosIndexCache,
  ensureStdictPosIndexLoaded,
  lookupStdictPosHits,
  setStdictPosIndexForTests,
  stdictPosIndexBareKeyCount,
  stdictPosIndexLoadError,
} from './stdictPosIndex.js';

afterEach(() => {
  clearStdictPosIndexCache();
});

describe('stdictPosIndex', () => {
  it('테스트 주입으로 bareKey 조회', () => {
    setStdictPosIndexForTests({
      index: {
        가교: [
          { word: '가교01', pos: '품사 없음' },
          { word: '가교02', pos: '명사' },
        ],
        모르다: [{ word: '모르다', pos: '동사' }],
      },
    });
    expect(stdictPosIndexBareKeyCount()).toBe(2);
    expect(lookupStdictPosHits('가교')).toEqual([
      { word: '가교01', pos: '품사 없음' },
      { word: '가교02', pos: '명사' },
    ]);
    expect(lookupStdictPosHits('없는말')).toEqual([]);
    expect(stdictPosIndexLoadError()).toBeNull();
  });

  it('빈 색인은 STDICT_INDEX_EMPTY', () => {
    setStdictPosIndexForTests({ index: {} });
    expect(stdictPosIndexLoadError()).toBe('STDICT_INDEX_EMPTY');
  });

  it('fetch 실패는 STDICT_INDEX_LOAD_FAILED', async () => {
    await ensureStdictPosIndexLoaded({
      fetchImpl: async () =>
        /** @type {Response} */ ({
          ok: false,
          status: 404,
        }),
    });
    expect(stdictPosIndexLoadError()).toBe('STDICT_INDEX_LOAD_FAILED');
    expect(lookupStdictPosHits('가교')).toEqual([]);
  });
});
