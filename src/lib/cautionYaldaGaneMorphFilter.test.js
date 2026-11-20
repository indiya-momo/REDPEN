import { describe, expect, it } from 'vitest';
import {
  ganeAnalyzeSurface,
  isGanuldaGaneMorph,
  isYaldaGaneInstance,
  pruneYaldaGaneFalseMorph,
  YALDA_CAUTION_ID,
} from './cautionYaldaGaneMorphFilter.js';

describe('ganeAnalyzeSurface', () => {
  it('가는 뒤 명사 어절까지 넣는다', () => {
    const page = '장식, 가는 금실로 꾸민';
    const highlightIndex = page.indexOf('가는');
    expect(
      ganeAnalyzeSurface(page, {
        pageNum: 1,
        index: page.indexOf(', 가는'),
        highlightIndex,
        highlightText: '가는',
        matchedText: ', 가는',
      }),
    ).toBe(', 가는 금실로');
  });

  it('마음 가는 곳은 뒤 어절까지', () => {
    const page = '은 마음 가는 곳부터';
    const highlightIndex = page.indexOf('가는');
    expect(
      ganeAnalyzeSurface(page, {
        pageNum: 1,
        index: page.indexOf('마음 가는'),
        highlightIndex,
        highlightText: '가는',
        matchedText: '마음 가는',
      }),
    ).toBe('마음 가는 곳부터');
  });
});

describe('isGanuldaGaneMorph', () => {
  it('가늘 VA → 유지', () => {
    expect(
      isGanuldaGaneMorph({
        tokens: [
          { str: '가늘', tag: 'VA' },
          { str: 'ㄴ', tag: 'ETM' },
          { str: '금실', tag: 'NNG' },
        ],
      }),
    ).toBe(true);
    expect(
      isGanuldaGaneMorph({
        tokens: [{ str: '가는', tag: 'VA' }],
      }),
    ).toBe(true);
  });

  it('가 VV + 는 ETM → DROP', () => {
    expect(
      isGanuldaGaneMorph({
        tokens: [
          { str: '마음', tag: 'NNG' },
          { str: '가', tag: 'VV' },
          { str: '는', tag: 'ETM' },
          { str: '곳', tag: 'NNG' },
        ],
      }),
    ).toBe(false);
  });

  it('분석 없음·애매 → null', () => {
    expect(isGanuldaGaneMorph(null)).toBe(null);
    expect(isGanuldaGaneMorph({ tokens: [] })).toBe(null);
    expect(
      isGanuldaGaneMorph({
        tokens: [{ str: '금실', tag: 'NNG' }],
      }),
    ).toBe(null);
  });
});

describe('pruneYaldaGaneFalseMorph', () => {
  const text = '은 마음 가는 곳부터 가는 금실로';
  const pages = [{ pageNum: 1, text }];

  it('가늘다만 남기고 가다·실패는 버린다', () => {
    const firstGane = text.indexOf('가는');
    const secondGane = text.indexOf('가는', firstGane + 1);
    const groups = [
      {
        cautionId: YALDA_CAUTION_ID,
        category: 'caution',
        label: '얇다, 가늘다',
        find: 'F',
        replace: '(검토)',
        instances: [
          {
            pageNum: 1,
            index: text.indexOf('마음 가는'),
            highlightIndex: firstGane,
            highlightText: '가는',
            matchedText: '마음 가는',
          },
          {
            pageNum: 1,
            index: secondGane,
            highlightIndex: secondGane,
            highlightText: '가는',
            matchedText: '가는',
          },
          {
            pageNum: 1,
            index: 0,
            highlightText: '얇은',
            matchedText: '얇은',
          },
        ],
      },
    ];

    const analyze = (surface) => {
      if (String(surface).includes('금실')) {
        return {
          tokens: [
            { str: '가늘', tag: 'VA' },
            { str: 'ㄴ', tag: 'ETM' },
            { str: '금실', tag: 'NNG' },
          ],
        };
      }
      if (String(surface).includes('마음')) {
        return {
          tokens: [
            { str: '마음', tag: 'NNG' },
            { str: '가', tag: 'VV' },
            { str: '는', tag: 'ETM' },
          ],
        };
      }
      return null;
    };

    const next = pruneYaldaGaneFalseMorph(groups, pages, { analyze });
    expect(next[0].instances.map((i) => i.highlightText)).toEqual([
      '가는',
      '얇은',
    ]);
    expect(isYaldaGaneInstance(next[0].instances[0])).toBe(true);
    expect(next[0].instances[0].highlightIndex).toBe(secondGane);
  });
});
