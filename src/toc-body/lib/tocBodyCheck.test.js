import { describe, expect, it } from 'vitest';
import {
  displayPageNumber,
  systemPageFromDisplay,
} from '../../lib/printedPageDisplay.js';
import {
  classifyTocTitle,
  expandTocRawLine,
  filterPagesForTocBodyCheck,
  isSystemPageInTocExcludePrintRange,
  parseTocBodyExcludePages,
  printPageReachesListedPrint,
  resolveTocBodyExcludeSystemPages,
  isTocHangulSpacingMismatch,
  normalizeTocLine,
  parseTocBodyEntries,
  parseTocBodyText,
  parseTrailingTocPage,
  diffTocWithPdfOutline,
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

  it('경제왕국 — PDF 띄어쓰기(경제 왕국)도 찾는다', () => {
    const pages = [{ pageNum: 28, text: '경제 왕국 만들기\n본문' }];
    const groups = runTocBodyCheck(
      pages,
      '경제왕국 만들기  28┃경제는 분위기다 30',
      null,
      '18-23',
    );
    expect(groups.find((g) => g.label === '경제왕국 만들기')?.tocStatus).not.toBe(
      'missing',
    );
    expect(
      groups.find((g) => g.label === '경제왕국 만들기')?.instances[0]?.pageNum,
    ).toBe(28);
  });

  it('펼침면 왼쪽 6·오른쪽 7쪽 — 목차 7쪽도 검색 대상', () => {
    const mapToPrint = (s) => displayPageNumber(s, 0, true, 1, true);
    const mapToSystem = (p) => systemPageFromDisplay(p, 0, true, 1, true);
    expect(printPageReachesListedPrint(6, 7)).toBe(true);
    const groups = runTocBodyCheck(
      [{ pageNum: 4, text: '추천의 글\n본문' }],
      '추천의 글 7',
      null,
      null,
      mapToSystem,
      mapToPrint,
    );
    expect(groups[0]?.tocStatus).toBe('match');
    expect(groups[0]?.instances[0]?.pageNum).toBe(4);
  });

  it('실제 목차 15항목 형식 — 앞쪽 글·PART·┃ 항목을 찾는다', () => {
    const toc = `추천의 글 7
여는 글 11
감수의 글 경제 왕국의 성문 앞에서 15
PART 1 경제는 분위기다 24
CHAPTER 1  경제왕국 27
경제왕국 만들기  28┃경제는 분위기다 30`;
    const map = (n) => n;
    const pages = [
      { pageNum: 7, text: '추천의 글\n본문' },
      { pageNum: 11, text: '여는 글\n본문' },
      { pageNum: 15, text: '감수의 글\n경제 왕국의 성문 앞에서' },
      { pageNum: 24, text: 'PART I\n경제는 분위기다' },
      { pageNum: 27, text: 'CHAPTER 1.\n경제왕국' },
      { pageNum: 28, text: '경제왕국 만들기' },
      { pageNum: 30, text: '경제는 분위기다\n본문' },
    ];
    const groups = runTocBodyCheck(pages, toc, null, '18-23', map, map);
    const byLabel = Object.fromEntries(groups.map((g) => [g.label, g]));
    expect(byLabel['추천의 글']?.tocStatus).toBe('match');
    expect(byLabel['여는 글']?.tocStatus).toBe('match');
    expect(byLabel['감수의 글 경제 왕국의 성문 앞에서']?.tocStatus).toBe(
      'match',
    );
    expect(byLabel['경제왕국 만들기']?.tocStatus).toBe('match');
    expect(byLabel['경제는 분위기다']?.tocStatus).toBe('match');
    expect(byLabel['경제는 분위기다']?.instances[0]?.pageNum).toBe(30);
    expect(
      groups.filter((g) => g.tocStatus === 'missing').length,
    ).toBeLessThanOrEqual(2);
  });

  it('짧은 제목 — 목차 줄 쪽수(30) 이후 본문을 쓰고 앞쪽(24-25) 목차판은 무시', () => {
    const toc = '경제왕국 만들기  28┃경제는 분위기다 30';
    const pages = [
      { pageNum: 24, text: 'PART I\n경제는 분위기다\n앞쪽' },
      { pageNum: 30, text: '경제는 분위기다\n본문 시작' },
    ];
    const map = (n) => n;
    const groups = runTocBodyCheck(pages, toc, null, '18-23', map, map);
    const econ = groups.find((g) => g.label === '경제는 분위기다');
    expect(econ?.tocStatus).toBe('match');
    expect(econ?.instances).toHaveLength(1);
    expect(econ?.instances[0]?.pageNum).toBe(30);
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

  it('목차 제외는 인쇄 쪽 번호 기준 — 28쪽 본문 파일 페이지는 남긴다', () => {
    const shift = 8;
    const anchor = 11;
    const mapToPrint = (s) =>
      displayPageNumber(s, shift, true, anchor, true);
    const mapToSystem = (d) =>
      systemPageFromDisplay(d, shift, true, anchor, true);
    const exclude = parseTocBodyExcludePages('18-23');
    expect(mapToPrint(11)).toBe(28);
    expect(
      isSystemPageInTocExcludePrintRange(11, exclude, mapToPrint),
    ).toBe(false);
    expect(
      filterPagesForTocBodyCheck(
        [
          { pageNum: 10, text: '목차' },
          { pageNum: 11, text: '경제왕국 만들기' },
        ],
        null,
        '18-23',
        mapToSystem,
        mapToPrint,
      ).map((p) => p.pageNum),
    ).toEqual([11]);

    const toc = '경제왕국 만들기  28┃경제는 분위기다 30';
    const groups = runTocBodyCheck(
      [
        { pageNum: 11, text: '경제왕국 만들기' },
        { pageNum: 13, text: '경제는 분위기다' },
      ],
      toc,
      null,
      '18-23',
      mapToSystem,
      mapToPrint,
    );
    expect(groups.find((g) => g.label === '경제왕국 만들기')?.tocStatus).toBe(
      'match',
    );
    expect(groups.find((g) => g.label === '경제는 분위기다')?.tocStatus).toBe(
      'match',
    );
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

    const map = (n) => n;
    const withPrintExclude = runTocBodyCheck(
      [
        { pageNum: 24, text: 'PART Ⅰ. 경제는 분위기다' },
        { pageNum: 30, text: 'PART I\n경제는 분위기다' },
      ],
      'PART Ⅰ. 경제는 분위기다 30',
      null,
      '18',
      map,
      map,
    );
    expect(withPrintExclude[0]?.instances[0]?.pageNum).toBe(30);

    const tocOnly = runTocBodyCheck(
      [{ pageNum: 24, text: 'PART Ⅰ. 경제는 분위기다' }],
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

  it('목차판(18-23)만 제외하고 앞쪽 본문(7·15쪽 등)은 검색한다', () => {
    const pages = [
      { pageNum: 7, text: '추천의 글\n본문' },
      { pageNum: 15, text: '감수의 글\n경제 왕국' },
      { pageNum: 20, text: 'PART Ⅰ. 경제는 분위기다 … 목차 …' },
      { pageNum: 30, text: 'PART I\n경제는 분위기다' },
    ];
    const groups = runTocBodyCheck(
      pages,
      `추천의 글 7
감수의 글 15
PART Ⅰ. 경제는 분위기다 30`,
      null,
      '18-23',
    );
    const rec = groups.find((g) => g.label === '추천의 글');
    const preface = groups.find((g) => g.label === '감수의 글');
    const part = groups.find((g) => g.label === 'PART Ⅰ. 경제는 분위기다');
    expect(rec?.tocStatus).toBe('match');
    expect(rec?.instances[0]?.pageNum).toBe(7);
    expect(preface?.tocStatus).toBe('match');
    expect(preface?.instances[0]?.pageNum).toBe(15);
    expect(part?.instances[0]?.pageNum).toBe(30);
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
      null,
      null,
      (print) => print - 6,
      (file) => file + 6,
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

  it('제목 후보 줄에서만 검색 — 본문 부분문자열은 무시', () => {
    let text = '';
    const items = [];
    const itemRefs = [];
    const addLine = (str, size, y) => {
      const start = text.length;
      items.push({ str, transform: [size, 0, 0, size, 40, y] });
      itemRefs.push({ start, end: start + str.length, itemIndex: items.length - 1 });
      text += `${str}\n`;
    };
    addLine('제1장 서론의 배경 설명', 10, 100);
    addLine('제1장 서론', 18, 70);
    const pages = [{ pageNum: 1, text, items, itemRefs }];
    const groups = runTocBodyCheck(pages, '제1장 서론');
    expect(groups[0]?.tocStatus).toBe('match');
    expect(groups[0]?.instances[0]?.matchedText).toBe('제1장 서론');
    expect(groups[0]?.instances[0]?.index).toBe(14);
  });

  it('본문 인용만 있으면 일치가 아니라 불일치(소제목 없음)로 표시한다', () => {
    let text = '';
    const items = [];
    const itemRefs = [];
    const addLine = (str, size, y) => {
      const start = text.length;
      items.push({ str, transform: [size, 0, 0, size, 48, y] });
      itemRefs.push({ start, end: start + str.length, itemIndex: items.length - 1 });
      text += `${str}\n`;
    };
    addLine('불확실성의 케이크는 경제에서 자주 쓰인다', 10, 150);
    const pages = [{ pageNum: 42, text, items, itemRefs }];
    const groups = runTocBodyCheck(pages, '불확실성의 케이크 42');
    expect(groups[0]?.tocStatus).toBe('mismatch');
    expect(groups[0]?.tocMismatchReason).toBe('body-mention-only');
  });

  it('소제목 줄을 본문 첫 문장보다 우선해 하이라이트한다', () => {
    let text = '';
    const items = [];
    const itemRefs = [];
    const addLine = (str, size, y) => {
      const start = text.length;
      items.push({ str, transform: [size, 0, 0, size, 48, y] });
      itemRefs.push({ start, end: start + str.length, itemIndex: items.length - 1 });
      text += `${str}\n`;
    };
    addLine('불확실성의 케이크', 13, 180);
    addLine('불확실성의 케이크는 경제에서 자주 쓰인다', 10, 150);
    const pages = [{ pageNum: 43, text, items, itemRefs }];
    const groups = runTocBodyCheck(pages, '불확실성의 케이크 43');
    expect(groups[0]?.tocStatus).toBe('match');
    expect(groups[0]?.instances[0]?.index).toBe(0);
    expect(groups[0]?.instances[0]?.matchedText).toBe('불확실성의 케이크');
  });

  it('diffTocWithPdfOutline — 목차에 없는 PDF 제목 후보', () => {
    const entries = parseTocBodyEntries('제1장 서론');
    const headings = [
      {
        id: '1:0',
        pageNum: 1,
        text: '제1장 서론',
        startIndex: 20,
        fontSize: 18,
      },
      {
        id: '2:0',
        pageNum: 2,
        text: '숨은 장제',
        startIndex: 0,
        fontSize: 18,
      },
    ];
    const { outlineOnly } = diffTocWithPdfOutline(entries, headings);
    expect(outlineOnly.map((h) => h.text)).toEqual(['숨은 장제']);
  });

  it('제목 줄 오매칭이어도 본문 전체에서 다시 찾는다', () => {
    const pages = [
      {
        pageNum: 1,
        text: '제1장\n제1장 서론 본문\n',
        items: [
          { str: '제1장', transform: [18, 0, 0, 18, 40, 100] },
          { str: '제1장 서론 본문', transform: [10, 0, 0, 10, 40, 70] },
        ],
        itemRefs: [],
      },
    ];
    const groups = runTocBodyCheck(pages, '제1장 서론');
    expect(groups[0]?.tocStatus).toBe('match');
    expect(groups[0]?.instances[0]?.matchedText).toContain('제1장 서론');
  });
});
