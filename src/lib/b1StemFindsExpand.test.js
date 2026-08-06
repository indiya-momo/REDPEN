import { describe, expect, it } from 'vitest';
import {
  b1ExpandSkipReason,
  expandB1SpellingRow,
  isValidB1ExpandedSurface,
  mergeB1Finds,
} from './b1StemFindsExpand.js';

describe('b1StemFindsExpand guards', () => {
  it('B1이 아니면 스킵', () => {
    expect(b1ExpandSkipReason({ find: '우겨넣', replace: '욱여넣' })).toBe(
      'not-B1',
    );
  });

  it('받침 불일치·블록리스트·복잡 replace 스킵', () => {
    expect(
      b1ExpandSkipReason({
        dividerGroup: 'B1',
        find: '안절부절하',
        replace: '안절부절못',
      }),
    ).toBe('batchim-mismatch-skip');
    expect(
      b1ExpandSkipReason({
        dividerGroup: 'B1',
        find: '스런',
        replace: '스러운',
      }),
    ).toBe('stem-blocklist');
    expect(
      b1ExpandSkipReason({
        dividerGroup: 'B1',
        find: '어떻해',
        replace: '어떡해 또는 어떻게',
      }),
    ).toBe('complex-replace');
  });

  it('이미 관형 표면·명사성 블록리스트 스킵', () => {
    expect(
      b1ExpandSkipReason({
        dividerGroup: 'B1',
        find: '걸맞는',
        replace: '걸맞은',
      }),
    ).toBe('already-finite');
    expect(
      b1ExpandSkipReason({
        dividerGroup: 'B1',
        find: '오랫만',
        replace: '오랜만',
      }),
    ).toBe('stem-blocklist');
  });

  it('우겨넣·덮히는 전개 가능', () => {
    expect(
      b1ExpandSkipReason({
        dividerGroup: 'B1',
        find: '우겨넣',
        replace: '욱여넣',
      }),
    ).toBeNull();
    expect(
      b1ExpandSkipReason({
        dividerGroup: 'B1',
        find: '덮히',
        replace: '덮이',
      }),
    ).toBeNull();
  });

  it('자모·어간 동일 표면은 무효', () => {
    expect(isValidB1ExpandedSurface('우겨넣', '우겨넣')).toBe(false);
    expect(isValidB1ExpandedSurface('우겨넣', '우겨넣ㄴ')).toBe(false);
    expect(isValidB1ExpandedSurface('우겨넣', '우겨넣은')).toBe(true);
  });

  it('mergeB1Finds는 find 우선·기존 유지·2개 미만이면 undefined', () => {
    expect(mergeB1Finds('우겨넣', undefined, [])).toBeUndefined();
    const m = mergeB1Finds('덮히', ['덮히', '덮혔', '덮혀'], ['덮힌', '덮히는']);
    expect(m?.[0]).toBe('덮히');
    expect(m).toEqual(expect.arrayContaining(['덮혔', '덮혀', '덮힌', '덮히는']));
  });
});

describe('b1StemFindsExpand with mock joinSent', () => {
  it('우겨넣 finds에 관형 합침', () => {
    const kiwi = {
      joinSent(morphs) {
        const stem = morphs[0].form;
        const end = morphs[1].form;
        const map = {
          은: `${stem}은`,
          을: `${stem}을`,
          는: `${stem}는`,
          고: `${stem}고`,
        };
        return { str: map[end] ?? `${stem}${end}` };
      },
    };
    const { row, changed, added } = expandB1SpellingRow(
      {
        find: '우겨넣',
        replace: '욱여넣',
        dividerGroup: 'B1',
        enabled: true,
      },
      kiwi,
    );
    expect(changed).toBe(true);
    expect(added).toEqual(
      expect.arrayContaining(['우겨넣은', '우겨넣을', '우겨넣는', '우겨넣고']),
    );
    expect(row.finds?.[0]).toBe('우겨넣');
    expect(row.replace).toBe('욱여넣');
  });

  it('덮히는 기존 finds 유지 + 덮힌', () => {
    const kiwi = {
      joinSent(morphs) {
        const end = morphs[1].form;
        if (end === '은') return { str: '덮힌' };
        if (end === '어') return { str: '덮혀' };
        return { str: `덮히${end}` };
      },
    };
    const { row, changed } = expandB1SpellingRow(
      {
        find: '덮히',
        replace: '덮이',
        finds: ['덮히', '덮혔', '덮혀'],
        dividerGroup: 'B1',
      },
      kiwi,
    );
    expect(changed).toBe(true);
    expect(row.finds).toEqual(expect.arrayContaining(['덮히', '덮혔', '덮혀', '덮힌']));
  });

  it('스런은 스킵', () => {
    const kiwi = { joinSent: () => ({ str: '스러운' }) };
    const { changed, skip } = expandB1SpellingRow(
      { find: '스런', replace: '스러운', dividerGroup: 'B1' },
      kiwi,
    );
    expect(changed).toBe(false);
    expect(skip).toBe('stem-blocklist');
  });
});
