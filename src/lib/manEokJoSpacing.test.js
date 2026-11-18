import { describe, expect, it } from 'vitest';
import {
  findManEokJoSpacingHits,
  findManEokJoSpacingInPages,
} from './manEokJoSpacing.js';

describe('findManEokJoSpacingHits — S3-3 split', () => {
  it('3만4천 → 3만 4천', () => {
    const hits = findManEokJoSpacingHits('인구는 3만4천 명이다.');
    expect(hits).toEqual([
      expect.objectContaining({
        matchedText: '3만4천',
        suggestedText: '3만 4천',
        kind: 'split',
      }),
    ]);
  });

  it('47억5천만 → 47억 5천만', () => {
    const hits = findManEokJoSpacingHits('규모 47억5천만 원');
    expect(hits[0]).toMatchObject({
      matchedText: '47억5천만',
      suggestedText: '47억 5천만',
      kind: 'split',
    });
  });

  it('이미 띄어 쓴 3만 4천·47억 5천만은 KEEP', () => {
    expect(findManEokJoSpacingHits('3만 4천')).toEqual([]);
    expect(findManEokJoSpacingHits('47억 5천만')).toEqual([]);
    expect(findManEokJoSpacingHits('3만 4,500')).toEqual([]);
  });
});

describe('findManEokJoSpacingHits — S3-3 attach', () => {
  it('3 만 → 3만', () => {
    const hits = findManEokJoSpacingHits('약 3 만 이 모였다.');
    expect(hits).toEqual([
      expect.objectContaining({
        matchedText: '3 만',
        suggestedText: '3만',
        kind: 'attach',
      }),
    ]);
  });

  it('병용 예시는 KEEP', () => {
    expect(findManEokJoSpacingHits('3천')).toEqual([]);
    expect(findManEokJoSpacingHits('4만')).toEqual([]);
    expect(findManEokJoSpacingHits('90만')).toEqual([]);
  });
});

describe('findManEokJoSpacingInPages', () => {
  it('쪽 번호를 붙인다', () => {
    const hits = findManEokJoSpacingInPages([
      { pageNum: 2, text: '3만4천' },
    ]);
    expect(hits[0].pageNum).toBe(2);
    expect(hits[0].suggestedText).toBe('3만 4천');
  });
});
