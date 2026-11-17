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
  it('띄어 쓴 본용언+보조는 공백 자리에 붙임 표시를 올린다', () => {
    expect(
      getHighlightOverlayReplace(
        {
          find: '어 가',
          matchedText: '쉬어 가라고',
          suggestedText: '쉬어 가라고',
          pageNum: 1,
          index: 0,
        },
        { group: { patternKind: 'auxiliary-verb' } },
      ),
    ).toBe('→쉬어\u2040가라고');
    expect(
      getHighlightOverlayReplace(
        {
          find: '어 온',
          matchedText: '들어 온',
          suggestedText: '들어온',
          pageNum: 10,
          index: 0,
        },
        { group: { patternKind: 'auxiliary-verb' } },
      ),
    ).toBe('→들어\u2040온');
  });

  it('붙여 쓴 본용언+보조는 붙임 표시를 올리지 않는다', () => {
    expect(
      getHighlightOverlayReplace(
        {
          find: '어 가',
          matchedText: '쉬어가라고',
          suggestedText: '쉬어가라고',
          pageNum: 1,
          index: 0,
        },
        { group: { patternKind: 'auxiliary-verb' } },
      ),
    ).toBeNull();
  });

  it('findReplaces 붙여쓰기 행은 →손⁀끝 형태로 보인다', () => {
    expect(
      getHighlightOverlayReplace(
        {
          find: '손 끝',
          replace: '손끝',
          matchedText: '손 끝',
          suggestedText: '손끝',
          variantReplace: '손끝',
          pageNum: 1,
          index: 0,
        },
        { group: { category: 'spelling', instances: [] } },
      ),
    ).toBe('→손\u2040끝');
  });

  it('맞춤법 붙임 표시 ^는 PDF에서 ⁀로 보인다', () => {
    expect(
      getHighlightOverlayReplace(
        {
          find: '살아 생전',
          replace: '살아생전',
          matchedText: '살아 생전',
          pageNum: 1,
          index: 0,
        },
        {
          group: {
            category: 'spelling',
            overlayReplace: '→살아^생전',
            instances: [],
          },
        },
      ),
    ).toBe('→살아\u2040생전');
    expect(
      getHighlightOverlayReplace(
        {
          find: '긴 긴 밤',
          replace: '긴긴밤',
          matchedText: '긴 긴 밤',
          pageNum: 2,
          index: 0,
        },
        {
          group: {
            category: 'spelling',
            overlayReplace: '→긴^긴^밤',
            instances: [],
          },
        },
      ),
    ).toBe('→긴\u2040긴\u2040밤');
  });

  it('맞춤법 띄움 표시 ∨는 그대로 둔다', () => {
    expect(
      getHighlightOverlayReplace(
        {
          find: '그 외',
          replace: '그 외',
          matchedText: '그외',
          pageNum: 1,
          index: 0,
        },
        {
          group: {
            category: 'spelling',
            overlayReplace: '→그∨외',
            instances: [],
          },
        },
      ),
    ).toBe('→그∨외');
  });

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

  it('표기 통일 추천 group.overlayReplace를 그대로 쓴다', () => {
    expect(
      getHighlightOverlayReplace(
        {
          find: '조선 시대',
          replace: '조선시대',
          matchedText: '조선 시대',
          pageNum: 20,
          index: 0,
        },
        {
          group: {
            find: '조선 시대',
            replace: '조선시대',
            label: '조선 시대',
            overlayReplace: '→조선^시대',
            instances: [],
          },
        },
      ),
    ).toBe('→조선^시대');
  });

  it('맞춤법 finds 묶음 — group.overlayReplace를 PDF에 표시한다', () => {
    expect(
      getHighlightOverlayReplace(
        {
          find: '(?:설레이|설레였)',
          replace: '설레',
          matchedText: '설레이는',
          pageNum: 1,
          index: 0,
        },
        {
          group: {
            find: '(?:설레이|설레였)',
            replace: '설레',
            label: '설레이, 설레였 → 설레',
            spellingRuleId: '설레이',
            overlayReplace: '→설레',
            instances: [],
          },
        },
      ),
    ).toBe('→설레');
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
