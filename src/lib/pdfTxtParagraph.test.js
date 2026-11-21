import { describe, expect, it } from 'vitest';
import { joinPagesWithMarkers, applyLinebreakDecisions, findLinebreakCandidates } from './pdfTxtLinebreakReview.js';
import {
  PARAGRAPH_EXCEPTION_LIMIT,
  classifyParagraphPair,
  paragraphJoinGlue,
} from './pdfTxtParagraph.js';

/**
 * @param {number} x
 * @param {number} endX
 * @param {number} y
 * @param {number} [fontH]
 * @param {number} [col]
 */
function lay(x, endX, y, fontH = 12, col = 0) {
  return { x, endX, y, fontH, col, trailSpace: false };
}

const FULL = [lay(48, 400, 700), lay(48, 400, 684), lay(48, 400, 668)];

describe('paragraphJoinGlue', () => {
  it('단어 중간 한글은 공백 없이 붙인다', () => {
    expect(paragraphJoinGlue('내자', '리는')).toBe('');
    expect(paragraphJoinGlue('유명한 명', '지 계곡')).toBe('');
    expect(paragraphJoinGlue('그래서 한글중', '간강제')).toBe('');
  });

  it('어절 경계는 한 칸이다', () => {
    expect(paragraphJoinGlue('그는', '사과를')).toBe(' ');
    expect(paragraphJoinGlue('봤을 때', '손잡이')).toBe(' ');
    expect(paragraphJoinGlue('바다', '가 아름답다')).toBe(' ');
    expect(paragraphJoinGlue('임금과 물가 간', '악순환으로')).toBe(' ');
  });

  it('줄 끝 공백이 있으면 어절 경계로 본다', () => {
    expect(paragraphJoinGlue('내자', '리는', { trailSpace: true })).toBe(' ');
  });

  it('영문 줄 끝 하이픈은 소문자로 이어질 때 지운다', () => {
    expect(paragraphJoinGlue('comput-', 'ing')).toBe('dehyphen');
    expect(paragraphJoinGlue('comput\u00AD', 'ing')).toBe('dehyphen');
    expect(paragraphJoinGlue('well-', 'known')).toBe('dehyphen');
    expect(paragraphJoinGlue('AI-', 'Powered')).toBe('');
  });
});

describe('classifyParagraphPair', () => {
  it('문장부호 뒤에서는 줄을 유지한다', () => {
    const ends = ['끝났다.', '물음?', '감탄!', '말이…', '말이...', '끝났다。', '끝났다！', '끝났다？'];
    for (const left of ends) {
      expect(classifyParagraphPair(left, '다음 문장').action, left).toBe('keep');
    }
    expect(classifyParagraphPair('말했다」', '다음').action).toBe('keep');
    expect(classifyParagraphPair('말했다』', '다음').action).toBe('keep');
    expect(classifyParagraphPair('말했다》', '다음').action).toBe('keep');
    expect(classifyParagraphPair('말했다”', '다음').action).toBe('keep');
    expect(classifyParagraphPair('말했다.”', '다음').action).toBe('keep');
    expect(classifyParagraphPair('그는', '이어진다').reason).not.toBe('sentence');
  });

  it('목록·글머리에서는 줄을 유지한다', () => {
    expect(classifyParagraphPair('앞줄은 본문이다', '1. 다음 항목').action).toBe('keep');
    expect(classifyParagraphPair('앞줄은 본문이다', '• 글머리').action).toBe('keep');
    expect(classifyParagraphPair('앞줄은 본문이다', '가. 항목').action).toBe('keep');
    expect(classifyParagraphPair('앞줄은 본문이다', '- 항목').action).toBe('keep');
    expect(classifyParagraphPair('앞줄은 본문이다', '①항목').action).toBe('keep');
  });

  it('짧은 끝줄은 문단으로 나누고, 단어 중간처럼 보여도 확인 대상으로 남긴다', () => {
    const pagesLines = ['그는 떠났다', '그리고 시장에 가서 사과를 샀다', '그날 밤은 조용했다'];
    const short = classifyParagraphPair(
      pagesLines[0],
      pagesLines[1],
      lay(48, 180, 700),
      lay(48, 400, 684),
      contextOf(pagesLines),
    );
    expect(short.action).toBe('keep');
    expect(short.reason).toBe('short');

    const mid = classifyParagraphPair(
      '유명한 명',
      '지 계곡에 있는 마을이었다',
      lay(48, 180, 700),
      lay(48, 400, 684),
      contextOf(['유명한 명', '지 계곡에 있는 마을이었다', '사람들은 그곳을 기억했다']),
    );
    expect(mid.action).toBe('keep');
    expect(mid.uncertain).toBe(true);
    expect(mid.glue).toBe('');
  });

  it('제목 글자 크기·들여쓰기·세로 간격에서는 줄을 유지한다', () => {
    const heading = classifyParagraphPair(
      '서문 제목',
      '본문은 여기에서 길게 이어진다',
      lay(48, 400, 700, 20),
      lay(48, 400, 684, 12),
      null,
    );
    expect(heading.action).toBe('keep');
    expect(heading.reason).toBe('heading');

    const indented = classifyParagraphPair(
      '그는 시장에서 사과를',
      '그리고 집으로 돌아갔다',
      lay(48, 400, 700),
      lay(80, 400, 684),
      null,
    );
    expect(indented.action).toBe('keep');
    expect(indented.reason).toBe('indent');

    const gap = classifyParagraphPair(
      '그는 시장에서 사과를',
      '그리고 집으로 돌아갔다',
      lay(48, 400, 700),
      lay(48, 400, 640),
      null,
    );
    expect(gap.action).toBe('keep');
    expect(gap.reason).toBe('gap');
  });
});

describe('applyLinebreakDecisions 문단 재조립', () => {
  it('폭 정보가 없어도 짧은 제목 줄은 나누고 긴 줄은 잇는다', () => {
    const pages = [
      {
        pageNum: 1,
        lines: [
          '서문',
          '첫 문장은 충분히 길어서 본문 폭을 채운다.',
          '둘째 줄도 비슷하게 길게 이어진다.',
        ],
      },
    ];
    expect(applyLinebreakDecisions(pages, {})).toBe(
      '서문\n첫 문장은 충분히 길어서 본문 폭을 채운다.\n둘째 줄도 비슷하게 길게 이어진다.',
    );
  });

  it('본문 줄은 한 칸으로 잇고 문장 끝은 남긴다', () => {
    const pages = [
      {
        pageNum: 1,
        lines: [
          '그는 어제 시장에 가서 사과를',
          '한 상자 샀다.',
          '그리고 집에 돌아왔다.',
        ],
        lineLayout: FULL,
      },
    ];
    expect(applyLinebreakDecisions(pages, {})).toBe(
      '그는 어제 시장에 가서 사과를 한 상자 샀다.\n그리고 집에 돌아왔다.',
    );
    expect(findLinebreakCandidates(pages)).toEqual([]);
  });

  it('한글 단어 중간은 붙여 쓰고, 사용자가 띄어 씀·줄 유지로 바꿀 수 있다', () => {
    const pages = [
      {
        pageNum: 1,
        lines: ['유명한 명', '지 계곡에 갔다.', '다음'],
        lineLayout: [lay(48, 400, 700), lay(48, 400, 684), lay(48, 220, 668)],
      },
    ];
    expect(applyLinebreakDecisions(pages, {})).toBe(
      '유명한 명지 계곡에 갔다.\n다음',
    );
    expect(applyLinebreakDecisions(pages, { '1:0': 'space' })).toBe(
      '유명한 명 지 계곡에 갔다.\n다음',
    );
    expect(applyLinebreakDecisions(pages, { '1:0': 'keep' })).toBe(
      '유명한 명\n지 계곡에 갔다.\n다음',
    );
  });

  it('영문 하이픈은 지우고 잇는다', () => {
    const pages = [
      {
        pageNum: 3,
        lines: ['The editor kept typ-', 'ing until midnight came.'],
        lineLayout: [lay(48, 400, 700), lay(48, 400, 684)],
      },
    ];
    expect(applyLinebreakDecisions(pages, {})).toBe(
      'The editor kept typing until midnight came.',
    );
    expect(paragraphJoinGlue('well-', 'known')).toBe('dehyphen');
    expect(
      applyLinebreakDecisions(
        [
          {
            pageNum: 1,
            lines: ['a well-', 'known path through town.'],
            lineLayout: [lay(48, 400, 700), lay(48, 400, 684)],
          },
        ],
        {},
      ),
    ).toBe('a wellknown path through town.');
    expect(
      applyLinebreakDecisions(
        [
          {
            pageNum: 1,
            lines: ['the AI-', 'Powered press arrived.'],
            lineLayout: [lay(48, 400, 700), lay(48, 400, 684)],
          },
        ],
        {},
      ),
    ).toBe('the AI-Powered press arrived.');
  });

  it('다른 단의 왼쪽 여백은 들여쓰기로 보지 않는다', () => {
    const pages = [
      {
        pageNum: 1,
        lines: ['왼쪽 단의 마지막 어절은', '오른쪽 단으로 이어진다.'],
        lineLayout: [lay(48, 360, 120, 12, 0), lay(420, 760, 700, 12, 1)],
      },
    ];
    expect(applyLinebreakDecisions(pages, {})).toBe(
      '왼쪽 단의 마지막 어절은 오른쪽 단으로 이어진다.',
    );
  });

  it('쪽과 쪽 사이는 빈 줄로 나누고 검수전은 조판 줄바꿈을 유지한다', () => {
    const pages = [
      { pageNum: 1, lines: ['그는 시장에 가서', '사과를 샀다.'] },
      { pageNum: 2, lines: ['그리고 집에 왔다.'] },
    ];
    expect(applyLinebreakDecisions(pages, {})).toBe(
      '그는 시장에 가서 사과를 샀다.\n\n그리고 집에 왔다.',
    );
    expect(joinPagesWithMarkers(pages)).toBe(
      '그는 시장에 가서\n사과를 샀다.\n\n--- p.2 ---\n그리고 집에 왔다.',
    );
    expect(applyLinebreakDecisions(pages, {}, { autoParagraph: false })).toBe(
      '그는 시장에 가서\n사과를 샀다.\n\n그리고 집에 왔다.',
    );
  });

  it('애매한 예외만 모으고 상한을 넘기면 나머지는 자동 판정이다', () => {
    const lines = Array.from({ length: PARAGRAPH_EXCEPTION_LIMIT + 2 }, () => '간쪽중');
    const pages = [{ pageNum: 1, lines }];
    const candidates = findLinebreakCandidates(pages);
    expect(candidates).toHaveLength(PARAGRAPH_EXCEPTION_LIMIT);
    expect(candidates.every((c) => c.defaultDecision === 'nospace')).toBe(true);
    expect(applyLinebreakDecisions(pages, {})).not.toContain('\n');
  });
});

/**
 * @param {string[]} lines
 */
function contextOf(lines) {
  return {
    byCol: new Map([
      [
        0,
        {
          fullEndX: 400,
          minX: 48,
          fullChars: Math.max(...lines.map((line) => line.length)),
        },
      ],
    ]),
  };
}
