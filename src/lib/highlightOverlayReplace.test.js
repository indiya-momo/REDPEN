import { describe, expect, it, vi } from 'vitest';
import {
  formatConsistencyUnifyHighlightOverlay,
  getHighlightOverlayReplace,
} from './highlightOverlayReplace.js';

vi.mock('./builtInRules.js', () => ({
  getBuiltInOverlayReplace: (find, replace) => {
    if (find === '가 닿' && replace === '가닿') return '→가⁀닿';
    if (find === '되풀이 되' && replace === '되풀이되') return '→되풀이⁀되';
    return null;
  },
}));

describe('getHighlightOverlayReplace', () => {
  it('returns overlay_replace text as-is from sheet', () => {
    expect(
      getHighlightOverlayReplace({
        find: '가 닿',
        replace: '가닿',
        suggestedText: '가닿',
        matchedText: '가 닿',
        pageNum: 210,
        index: 0,
      }),
    ).toBe('→가⁀닿');
    expect(
      getHighlightOverlayReplace({
        find: '되풀이 되',
        replace: '되풀이되',
        suggestedText: '되풀이되',
        matchedText: '되풀이 되',
        pageNum: 210,
        index: 0,
      }),
    ).toBe('→되풀이⁀되');
  });

  it('returns null when overlay_replace is empty', () => {
    expect(
      getHighlightOverlayReplace({
        find: '우리 나라',
        replace: '우리나라',
        suggestedText: '우리나라',
        matchedText: '우리 나라',
        pageNum: 1,
        index: 0,
      }),
    ).toBeNull();
  });

  it('통일형 오버레이 — 통일형 문자열만 표시', () => {
    const inst = {
      find: '세계 경제',
      replace: '$0',
      matchedText: '세계 경제',
      pageNum: 1,
      index: 0,
    };
    const customRules = [
      {
        patternKind: 'compound-find',
        tailWord: '세계 경제',
        consistencyUnifyEntry: true,
        overlayReplace: '세계경제',
      },
    ];
    const group = {
      find: '세계 경제',
      replace: '$0',
      label: '세계˅경제',
      tailWord: '세계 경제',
      instances: [],
    };
    expect(
      getHighlightOverlayReplace(inst, { customRules, group }),
    ).toBe('세계경제');
    expect(
      formatConsistencyUnifyHighlightOverlay(
        { matchedText: '붉은표시' },
        '붉은 표시',
      ),
    ).toBe('붉은 표시');
    expect(
      formatConsistencyUnifyHighlightOverlay(
        { matchedText: '세계경제' },
        '세계경제',
      ),
    ).toBe('세계경제');
    expect(
      formatConsistencyUnifyHighlightOverlay(
        { matchedText: '붉은표시' },
        '붉은표시→붉은 표시',
      ),
    ).toBe('붉은 표시');
  });

  it('통일형 📌 — 확정형은 원고 오버레이 없음, 변형만 표시', () => {
    const customRules = [
      {
        patternKind: 'compound-find',
        tailWord: '신라시대',
        consistencyUnifyEntry: true,
        consistencyUnifyPinned: true,
      },
      {
        patternKind: 'compound-find',
        tailWord: '통일신라시대',
        consistencyUnifyEntry: true,
        overlayReplace: '신라시대',
      },
      {
        patternKind: 'compound-find',
        tailWord: '신라 시대',
        consistencyUnifyEntry: true,
        overlayReplace: '신라시대',
      },
    ];
    expect(
      getHighlightOverlayReplace(
        {
          find: '신라시대',
          replace: '$0',
          matchedText: '신라시대',
          pageNum: 1,
          index: 0,
        },
        {
          customRules,
          group: {
            find: '신라시대',
            replace: '$0',
            label: '신라시대',
            tailWord: '신라시대',
            instances: [],
          },
        },
      ),
    ).toBeNull();
    expect(
      getHighlightOverlayReplace(
        {
          find: '통일신라시대',
          replace: '$0',
          matchedText: '통일신라시대',
          pageNum: 1,
          index: 0,
        },
        {
          customRules,
          group: {
            find: '통일신라시대',
            replace: '$0',
            label: '통일신라시대',
            tailWord: '통일신라시대',
            instances: [],
          },
        },
      ),
    ).toBe('→ 신라시대 📌');
  });
});
