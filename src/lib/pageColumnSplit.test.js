import { describe, expect, it } from 'vitest';
import {
  detectPageColumns,
  splitPageColumns,
} from './pageColumnSplit.js';
import { buildPageText } from './pdfPageText.js';

/** @param {{ str: string, x: number, w?: number, font?: number }[]} parts */
function mockLineItems(parts, y, font = 11) {
  return parts.map((p) => {
    const size = p.font ?? font;
    return {
      str: p.str,
      transform: [size, 0, 0, size, p.x, y],
      width: p.w ?? p.str.length * size * 0.48,
    };
  });
}

/** 세로 교재형 2단 — 왼/오른에 각각 여러 줄, gutter ~페이지 폭의 10%+ */
function mockTextbookTwoColumns() {
  const leftX = 48;
  const rightX = 280;
  const font = 11;
  /** @type {import('pdfjs-dist').TextItem[]} */
  const items = [];
  const leftLines = [
    '초점과 관점',
    '안정을 추구',
    '집중이 필요하다',
    '인구가 늘어',
    '생활이 변한다',
  ];
  const rightLines = [
    '냉대 기후',
    '냉대 기후 특성',
    '온대 기후',
    '건조 기후',
    '열대 기후 분포',
  ];
  for (let i = 0; i < leftLines.length; i += 1) {
    const y = 520 - i * 28;
    items.push(...mockLineItems([{ str: leftLines[i], x: leftX, w: 90 }], y, font));
    items.push(
      ...mockLineItems([{ str: rightLines[i], x: rightX, w: 90 }], y, font),
    );
  }
  return items;
}

/**
 * 실제 교재형: 왼=채점표(칸 간격 있음), 오른=본문, 점선 gutter는 좁음(~6%).
 * 표 안 간격이 gutter와 비슷해도 본문 단 경계를 골라야 한다.
 * soft-wrap으로 초점/안 + 다음 y의 냉대가 붙지 않아야 함.
 */
function mockRubricTableLeftBodyRight() {
  const font = 10;
  /** @type {import('pdfjs-dist').TextItem[]} */
  const items = [];
  // 페이지 텍스트 bbox ≈ x 40..360 (폭 320). 표 칸 간격 ~28, 단 gutter ~22(~7%).
  const tableCritX = 48;
  const tableLevelX = 130;
  const bodyX = 210;
  const rows = [
    { left: '냉대 기후 지역을 쓰고', right: '인간 중심 관점에 초점' },
    { left: '냉대 기후 지역을 썼으나', right: '자연과 조화를 이루는 안' },
    { left: '일부만 서술한 경우', right: '정을 먼저 고려한다' },
    { left: '관련 내용이 없음', right: '윤리적 관점을 정리한다' },
    { left: '추가 채점 메모', right: '사례를 들어 설명한다' },
  ];
  for (let i = 0; i < rows.length; i += 1) {
    const y = 500 - i * 26;
    items.push(
      ...mockLineItems([{ str: rows[i].left, x: tableCritX, w: 70 }], y, font),
    );
    items.push(
      ...mockLineItems([{ str: '상', x: tableLevelX, w: 12 }], y, font),
    );
    items.push(
      ...mockLineItems([{ str: rows[i].right, x: bodyX, w: 120 }], y, font),
    );
  }
  return items;
}

describe('pageColumnSplit', () => {
  it('교재형 2단을 감지한다', () => {
    const items = mockTextbookTwoColumns();
    const layout = detectPageColumns(items);
    expect(layout).toBeTruthy();
    expect(layout.gutterGap / layout.pageWidth).toBeGreaterThanOrEqual(0.05);
    const split = splitPageColumns(items);
    expect(split?.left.length).toBeGreaterThan(0);
    expect(split?.right.length).toBeGreaterThan(0);
  });

  it('왼쪽 표+오른쪽 본문(좁은 gutter)도 감지한다', () => {
    const items = mockRubricTableLeftBodyRight();
    const layout = detectPageColumns(items);
    expect(layout).toBeTruthy();
    // 본문 단 경계(≈ bodyX 앞)여야 함 — 표 안쪽(≈130)이면 안 됨
    expect(layout.gutterX).toBeGreaterThan(150);
    expect(layout.gutterX).toBeLessThan(220);
  });

  it('열 간격이 좁은 표형 배치는 분리하지 않는다', () => {
    const font = 10;
    /** @type {import('pdfjs-dist').TextItem[]} */
    const items = [];
    // 페이지 폭을 짧은 셀로 조밀하게 채워 큰 gutter가 없게 함
    for (let i = 0; i < 6; i += 1) {
      const y = 400 - i * 20;
      for (let col = 0; col < 5; col += 1) {
        items.push(
          ...mockLineItems(
            [{ str: `셀${col}`, x: 40 + col * 55, w: 40 }],
            y,
            font,
          ),
        );
      }
    }
    expect(detectPageColumns(items)).toBeNull();
    expect(splitPageColumns(items)).toBeNull();
  });

  it('1단 본문은 감지하지 않는다', () => {
    const font = 12;
    /** @type {import('pdfjs-dist').TextItem[]} */
    const items = [];
    for (let i = 0; i < 12; i += 1) {
      items.push(
        ...mockLineItems(
          [{ str: `본문 문장 ${i}번째 줄입니다`, x: 48, w: 200 }],
          500 - i * 18,
          font,
        ),
      );
    }
    expect(detectPageColumns(items)).toBeNull();
  });
});

describe('buildPageText — 페이지 내 2단', () => {
  it('같은 y의 좌·우 단을 가로로 붙이지 않는다', () => {
    const items = mockTextbookTwoColumns();
    const { text } = buildPageText(items);
    expect(text).not.toMatch(/초점냉대/);
    expect(text).not.toMatch(/안냉대/);
    expect(text).not.toMatch(/집중온대/);
    expect(text.indexOf('초점')).toBeLessThan(text.indexOf('냉대'));
    expect(text.indexOf('집중')).toBeLessThan(text.indexOf('온대'));
  });

  it('채점표+본문 2단에서 초점·안이 냉대와 soft-wrap으로 붙지 않는다', () => {
    const items = mockRubricTableLeftBodyRight();
    const { text } = buildPageText(items);
    expect(text).not.toMatch(/초점냉대/);
    expect(text).not.toMatch(/안냉대/);
    expect(text).toMatch(/냉대 기후/);
    expect(text).toMatch(/초점/);
  });

  it('1단 페이지는 기존처럼 조립한다', () => {
    const items = [
      { str: '통해', transform: [10, 0, 0, 10, 0, 100], width: 22 },
      { str: '보장', transform: [10, 0, 0, 10, 22.6, 100], width: 22 },
    ];
    const { text, textLayout } = buildPageText(items);
    expect(text).toMatch(/통해\s+보장/);
    expect(textLayout).toBe('통해보장\n');
  });
});
