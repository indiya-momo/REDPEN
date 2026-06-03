import { describe, expect, it } from 'vitest';
import {
  classifyTocTitle,
  expandTocRawLine,
  filterPagesForTocBodyCheck,
  parseTocBodyExcludePages,
  resolveTocBodyExcludeSystemPages,
  isTocHangulSpacingMismatch,
  normalizeTocLine,
  parseTocBodyEntries,
  parseTocBodyText,
  parseTrailingTocPage,
  runTocBodyCheck,
  tocTitleSimilarity,
} from './tocBodyCheck.js';

describe('tocBodyCheck', () => {
  it('목차 줄에서 끝 페이지 번호를 제거한다', () => {
    expect(normalizeTocLine('제1장 서론 15')).toBe('제1장 서론');
    expect(normalizeTocLine('서론 …… 99')).toBe('서론');
  });

  it('일치 · 누락 · 불일치로 분류한다', () => {
    const pages = [
      {
        pageNum: 1,
        text: '앞글 제1장 서론 뒤쪽 본문',
      },
    ];
    const toc = '제1장 서론\n없는 장제목';
    const groups = runTocBodyCheck(pages, toc);
    expect(groups.map((g) => g.tocStatus)).toEqual(['match', 'missing']);
    expect(groups[0].label).toBe('제1장 서론');
    expect(groups[0].instances[0]?.pageNum).toBe(1);
    expect(groups[1].instances).toHaveLength(0);
  });

  it('classifyTocTitle', () => {
    expect(classifyTocTitle('보여 준다', [])).toBe('missing');
    expect(
      classifyTocTitle('보여 준다', [
        {
          matchedText: '보여 준다',
          find: '',
          replace: '',
          suggestedText: '',
          pageNum: 1,
          index: 0,
        },
      ]),
    ).toBe('match');
    expect(
      classifyTocTitle('보여 준다', [
        {
          matchedText: '보여준다',
          find: '',
          replace: '',
          suggestedText: '',
          pageNum: 1,
          index: 0,
        },
      ]),
    ).toBe('mismatch');
    expect(tocTitleSimilarity('보여 준다', '보여준다')).toBe(1);
    expect(isTocHangulSpacingMismatch('보여 준다', '보여준다')).toBe(true);
    expect(isTocHangulSpacingMismatch('보여 준다', '보여 든다')).toBe(false);
    expect(
      classifyTocTitle('보여 준다', [
        {
          matchedText: '보여 든다',
          find: '',
          replace: '',
          suggestedText: '',
          pageNum: 1,
          index: 0,
        },
      ]),
    ).toBe('mismatch');
  });

  it('parseTocBodyText — 빈 줄·중복 제거', () => {
    expect(parseTocBodyText('  a\n\na\nb  ')).toEqual(['a', 'b']);
  });

  it('띄어쓰기만 다른 한글 제목은 검사 결과 불일치', () => {
    const groups = runTocBodyCheck(
      [{ pageNum: 10, text: '…보여준다…' }],
      '보여 준다 10',
    );
    expect(groups[0]?.tocStatus).toBe('mismatch');
    expect(groups[0]?.instances[0]?.matchedText).toBe('보여준다');
  });

  it('CHAPTER 2. — 본문에 와·가운뎃점이 있어도 분위기 경제를 찾는다', () => {
    const pages = [
      {
        pageNum: 34,
        text: 'CHAPTER 2.\n분위기와 경제\n본문',
      },
    ];
    const groups = runTocBodyCheck(pages, 'CHAPTER 2. 분위기 경제', null, '18-24');
    expect(groups[0]?.tocStatus).not.toBe('missing');
    expect(groups[0]?.instances[0]?.pageNum).toBe(34);
  });

  it('CHAPTER 1. — 장 번호 마침표 토큰이 깨지지 않고 본문 2줄을 찾는다', () => {
    const pages = [
      {
        pageNum: 27,
        text: 'CHAPTER 1.\n경제왕국\n본문',
      },
    ];
    const groups = runTocBodyCheck(pages, 'CHAPTER 1. 경제왕국', null, '18-24');
    expect(groups[0]?.tocStatus).toBe('match');
    expect(groups[0]?.instances[0]?.pageNum).toBe(27);
  });

  it('로마 숫자 Ⅰ(I)·마침표·줄바꿈 차이는 찾되 불일치로 표시한다', () => {
    const pages = [
      {
        pageNum: 25,
        text: 'PART I\n경제는 분위기다\n본문',
      },
    ];
    const groups = runTocBodyCheck(pages, 'PART Ⅰ. 경제는 분위기다 25');
    expect(groups[0]?.tocStatus).toBe('mismatch');
    expect(groups[0]?.instances[0]?.pageNum).toBe(25);
    expect(groups[0]?.instances[0]?.matchedText).toContain('PART I');
  });

  it('┃(박스 세로선)으로 한 줄에 여러 항목을 나눈다', () => {
    expect(
      parseTocBodyEntries(
        '경제왕국 만들기  28┃경제는 분위기다 30',
      ).map((e) => [e.title, e.tocPage]),
    ).toEqual([
      ['경제왕국 만들기', 28],
      ['경제는 분위기다', 30],
    ]);
    expect(
      parseTocBodyEntries(
        '분위기와 시장  34┃경제순환 모형도  35┃기름값과 기분  37',
      ).map((e) => e.title),
    ).toEqual(['분위기와 시장', '경제순환 모형도', '기름값과 기분']);
  });

  it('│ 제거 — 본문에는 세로선이 없다', () => {
    expect(normalizeTocLine('감수의 글│경제 왕국의 성문 앞에서 15')).toBe(
      '감수의 글 경제 왕국의 성문 앞에서',
    );
    expect(expandTocRawLine('감수의 글│경제 왕국의 성문 앞에서 15')).toEqual([
      '감수의 글',
      '경제 왕국의 성문 앞에서',
      '감수의 글 경제 왕국의 성문 앞에서',
    ]);
  });

  it('한 줄에 페이지가 둘 있으면 │ 또는 공백으로 항목을 나눈다', () => {
    expect(expandTocRawLine('경제 왕국 만들기  26│경제는 분위기다  29')).toEqual([
      '경제 왕국 만들기',
      '경제는 분위기다',
    ]);
    expect(expandTocRawLine('경제 왕국 만들기  26 경제는 분위기다  29')).toEqual([
      '경제 왕국 만들기',
      '경제는 분위기다',
    ]);
    expect(
      parseTocBodyEntries('경제 왕국 만들기  26 경제는 분위기다  29').map((e) => [
        e.title,
        e.tocPage,
      ]),
    ).toEqual([
      ['경제 왕국 만들기', 26],
      ['경제는 분위기다', 29],
    ]);
  });

  it('본문 시작 페이지 이후만 검색한다', () => {
    const pages = [
      { pageNum: 1, text: '목차에만 있는 제목' },
      { pageNum: 10, text: '본문 제1장 서론 시작' },
    ];
    const groups = runTocBodyCheck(pages, '제1장 서론', 10);
    expect(groups[0]?.tocStatus).toBe('match');
    expect(groups[0]?.instances[0]?.pageNum).toBe(10);
    expect(filterPagesForTocBodyCheck(pages, 10)).toHaveLength(1);
  });

  it('parseTocBodyExcludePages — 단일·범위·목록', () => {
    expect([...parseTocBodyExcludePages('18')]).toEqual([18]);
    expect([...parseTocBodyExcludePages('18-20')]).toEqual([18, 19, 20]);
    expect([...parseTocBodyExcludePages('17, 19')]).toEqual([17, 19]);
    expect([...parseTocBodyExcludePages('18~22쪽')]).toEqual([
      18, 19, 20, 21, 22,
    ]);
  });

  it('인쇄 쪽 보정 시 제외 범위를 파일 페이지로 변환한다', () => {
    const map = (d) => d + 6;
    expect(
      [...resolveTocBodyExcludeSystemPages('18-20', map)].sort((a, b) => a - b),
    ).toEqual([24, 25, 26]);
  });

  it('PDF 목차 페이지 범위는 검색에서 제외하고 본문 쪽만 검증한다', () => {
    const pages = [
      {
        pageNum: 18,
        text: 'PART Ⅰ. 경제는 분위기다 … 목차 …',
      },
      {
        pageNum: 24,
        text: 'PART I\n경제는 분위기다\n본문',
      },
    ];
    const both = runTocBodyCheck(pages, 'PART Ⅰ. 경제는 분위기다 24');
    expect(both[0]?.instances[0]?.pageNum).toBe(24);

    const withExclude = runTocBodyCheck(
      pages,
      'PART Ⅰ. 경제는 분위기다 24',
      null,
      '18',
    );
    expect(withExclude[0]?.tocStatus).toBe('mismatch');
    expect(withExclude[0]?.instances[0]?.pageNum).toBe(24);

    const map = (d) => d + 6;
    const withPrintExclude = runTocBodyCheck(
      [
        { pageNum: 24, text: 'PART Ⅰ. 경제는 분위기다' },
        { pageNum: 30, text: 'PART I\n경제는 분위기다' },
      ],
      'PART Ⅰ. 경제는 분위기다 30',
      null,
      '18',
      map,
    );
    expect(withPrintExclude[0]?.instances[0]?.pageNum).toBe(30);

    const tocOnly = runTocBodyCheck(
      [{ pageNum: 18, text: 'PART Ⅰ. 경제는 분위기다' }],
      'PART Ⅰ. 경제는 분위기다 24',
    );
    expect(tocOnly[0]?.tocStatus).toBe('match');

    const tocOnlyExcluded = runTocBodyCheck(
      [{ pageNum: 18, text: 'PART Ⅰ. 경제는 분위기다' }],
      'PART Ⅰ. 경제는 분위기다 24',
      null,
      '18',
    );
    expect(tocOnlyExcluded[0]?.tocStatus).toBe('missing');
  });

  it('│ 합친 제목으로 본문 일치', () => {
    const pages = [
      {
        pageNum: 15,
        text: '감수의 글 경제 왕국의 성문 앞에서 본문이 이어진다.',
      },
    ];
    const groups = runTocBodyCheck(
      pages,
      '감수의 글│경제 왕국의 성문 앞에서 15',
    );
    const merged = groups.find((g) => g.label === '감수의 글 경제 왕국의 성문 앞에서');
    expect(merged?.tocStatus).toBe('match');
  });

  it('한 줄 목차 — 본문 줄바꿈이 있어도 일치', () => {
    const pages = [
      {
        pageNum: 15,
        text: '감수의 글\n경제 왕국의 성문 앞에서\n본문',
      },
    ];
    const groups = runTocBodyCheck(
      pages,
      '감수의 글 경제 왕국의 성문 앞에서 15',
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('감수의 글 경제 왕국의 성문 앞에서');
    expect(groups[0].tocStatus).toBe('match');
    expect(groups[0].instances[0]?.pageNum).toBe(15);
  });

  it('목차 쪽수 페이지를 우선하고, 없으면 본문 전체를 검색한다', () => {
    const pages = [
      { pageNum: 3, text: '감수의 글 경제 왕국의 성문 앞에서' },
      { pageNum: 15, text: '감수의 글\n경제 왕국의 성문 앞에서' },
    ];
    const groups = runTocBodyCheck(
      pages,
      '감수의 글 경제 왕국의 성문 앞에서 15',
    );
    expect(groups[0].tocStatus).toBe('match');
    expect(groups[0].instances[0]?.pageNum).toBe(15);

    const fallback = runTocBodyCheck(
      [{ pageNum: 9, text: '감수의 글\n경제 왕국의 성문 앞에서' }],
      '감수의 글 경제 왕국의 성문 앞에서 15',
    );
    expect(fallback[0].tocStatus).toBe('match');
    expect(fallback[0].instances[0]?.pageNum).toBe(9);
  });

  it('PDF 음절이 줄마다 쪼개져도 한글 제목을 찾는다', () => {
    const pages = [
      {
        pageNum: 15,
        text: '감\n수\n의\n글\n경제\n왕국\n의\n성문\n앞\n에서',
      },
    ];
    const groups = runTocBodyCheck(
      pages,
      '감수의 글 경제 왕국의 성문 앞에서 15',
    );
    expect(groups[0].tocStatus).toBe('match');
  });

  it('parseTrailingTocPage — 전각 쪽수', () => {
    expect(parseTrailingTocPage('서론 １５')).toBe(15);
    expect(parseTocBodyEntries('감수의 글 15')[0].tocPage).toBe(15);
  });

  it('줄바꿈으로 끊긴 목차 행을 이어 붙인다', () => {
    const entries = parseTocBodyEntries(`분위기와 시장  32 내 그럴 줄 알았
다!  37 불확실성의 케이크  40`);
    expect(entries.some((e) => e.title.includes('알았 다!'))).toBe(true);
    expect(entries.some((e) => e.title === '다!')).toBe(false);
  });

  it('실제 목차 형식 — 여러 항목 파싱', () => {
    const toc = `추천의 글 7
여는 글 11
감수의 글 경제 왕국의 성문 앞에서 15
PART 1 경제는 분위기다
CHAPTER 1  경제 왕국
경제 왕국 만들기  26 경제는 분위기다  29`;
    const entries = parseTocBodyEntries(toc);
    expect(entries.map((e) => e.title)).toEqual([
      '추천의 글',
      '여는 글',
      '감수의 글 경제 왕국의 성문 앞에서',
      'PART 1 경제는 분위기다',
      'CHAPTER 1 경제 왕국',
      '경제 왕국 만들기',
      '경제는 분위기다',
    ]);
    expect(entries[0].tocPage).toBe(7);
    expect(entries[6].tocPage).toBe(29);
  });

  it('│ 목차 — 본문 줄바꿈이 있어도 합친 제목 일치', () => {
    const pages = [
      {
        pageNum: 15,
        text: '감수의 글\n경제 왕국의 성문 앞에서 본문',
      },
    ];
    const groups = runTocBodyCheck(
      pages,
      '감수의 글│경제 왕국의 성문 앞에서 15',
    );
    const merged = groups.find((g) => g.label === '감수의 글 경제 왕국의 성문 앞에서');
    expect(merged?.tocStatus).toBe('match');
  });
});
