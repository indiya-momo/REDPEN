import { describe, expect, it, vi } from 'vitest';
import {
  formatConsistencyUnifyHighlightOverlay,
  getHighlightOverlayReplace,
  markCandidateSpacing,
  spacingMarkPositionsInBox,
  spacingOnlyMarks,
} from './highlightOverlayReplace.js';

vi.mock('./builtInRules.js', () => ({
  getBuiltInOverlayReplace: (find, replace) => {
    if (find === '가 닿' && replace === '가닿') return '→가⁀닿';
    if (find === '되풀이 되' && replace === '되풀이되') return '→되풀이⁀되';
    return null;
  },
}));

describe('getHighlightOverlayReplace', () => {
  it('붙여쓰기 가능·필수 — 띄운 표면에 붙임 표시', () => {
    expect(
      getHighlightOverlayReplace(
        {
          find: '어 가',
          matchedText: '쉬어 가라고',
          suggestedText: '쉬어 가라고',
          pageNum: 1,
          index: 0,
        },
        {
          group: {
            patternKind: 'auxiliary-verb',
            bonBojoItemId: 'verb-gada',
          },
        },
      ),
    ).toBe('→쉬어\u2040가라고');
    expect(
      getHighlightOverlayReplace(
        {
          find: '어 지',
          matchedText: '만들어 지',
          suggestedText: '만들어지',
          pageNum: 10,
          index: 0,
        },
        {
          group: {
            patternKind: 'auxiliary-verb',
            bonBojoItemId: 'verb-jida',
          },
        },
      ),
    ).toBe('→만들어\u2040지');
  });

  it('붙여쓰기 가능 — 이미 붙인 올바른 표면은 기호 없음 (해보이는·쉬어가라고)', () => {
    expect(
      getHighlightOverlayReplace(
        {
          find: '해 보',
          matchedText: '해보이는',
          suggestedText: '해 보이는',
          pageNum: 32,
          index: 0,
        },
        {
          group: {
            patternKind: 'auxiliary-verb',
            bonBojoItemId: 'verb-boda1',
            label: '(아/어) + 보다',
          },
        },
      ),
    ).toBeNull();
    expect(
      getHighlightOverlayReplace(
        {
          find: '어 가',
          matchedText: '쉬어가라고',
          suggestedText: '쉬어가라고',
          pageNum: 1,
          index: 0,
        },
        {
          group: {
            patternKind: 'auxiliary-verb',
            bonBojoItemId: 'verb-gada',
          },
        },
      ),
    ).toBeNull();
  });

  it('하이라이트 박스 기준 — 뛰지|말라 사이(s=2)에 ∨ x', () => {
    const marks = spacingMarkPositionsInBox(
      { left: 100, top: 50, width: 50, height: 10 },
      5,
      [{ type: 'insert', s: 2, e: 2 }],
    );
    expect(marks).toEqual([
      { type: 'insert', x: 120, top: 50, size: 10 },
    ]);
  });

  it('띄어쓰기 필수 — 붙임 표면에 ∨', () => {
    expect(
      getHighlightOverlayReplace(
        {
          find: 'auxiliary:non-aeo:verb-malda',
          matchedText: '뛰지말라',
          suggestedText: '뛰지 말라',
          pageNum: 32,
          index: 0,
        },
        {
          group: {
            patternKind: 'auxiliary-verb',
            bonBojoItemId: 'verb-malda',
            auxNonAeoSpace: true,
          },
        },
      ),
    ).toBe('→뛰지\u2228말라');
    expect(
      spacingOnlyMarks('뛰지말라', '→뛰지\u2228말라'),
    ).toEqual([{ type: 'insert', s: 2, e: 2 }]);
  });

  it('띄어쓰기 필수 — 이미 띄운 올바른 표면은 기호 없음', () => {
    expect(
      getHighlightOverlayReplace(
        {
          find: '지 말',
          matchedText: '뛰지 말라',
          suggestedText: '뛰지 말라',
          pageNum: 1,
          index: 0,
        },
        {
          group: {
            patternKind: 'auxiliary-verb',
            bonBojoItemId: 'verb-malda',
          },
        },
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

  it('검토(caution)는 group.label을 오버레이로 쓴다 (화면=교정본 동일)', () => {
    expect(
      getHighlightOverlayReplace(
        {
          find: '한번',
          replace: '(검토)',
          matchedText: '한번',
          suggestedText: '한번',
          pageNum: 1,
          index: 0,
        },
        {
          group: {
            category: 'caution',
            label: '한 번, 한번',
            cautionId: 'noun-noun-han',
            instances: [],
          },
        },
      ),
    ).toBe('한 번, 한번');
  });
});

describe('markCandidateSpacing', () => {
  it('검토 후보 라벨 안의 띄어쓰기를 ∨로 바꾼다', () => {
    expect(markCandidateSpacing('한 번, 한번')).toBe('한∨번, 한번');
    expect(markCandidateSpacing('가슴 속, 가슴속')).toBe('가슴∨속, 가슴속');
  });

  it('→ 교정 라벨·쉼표 없는 문구는 그대로', () => {
    expect(markCandidateSpacing('→할∨때')).toBe('→할∨때');
    expect(markCandidateSpacing('한번')).toBe('한번');
  });
});
