import { describe, expect, it } from 'vitest';
import {
  detectSpreadGutter,
  partitionSpreadEntries,
  splitSpreadColumns,
} from './spreadColumnSplit.js';

/** @param {{ str: string, x: number, w?: number }[]} parts */
function mockItems(parts, y = 200, font = 11) {
  return parts.map((p) => {
    const size = font;
    return {
      str: p.str,
      transform: [size, 0, 0, size, p.x, y],
      width: p.w ?? p.str.length * size * 0.48,
    };
  });
}

/** 펼침면 최소 조건 — 좌·우 컬럼 + 책등 gap (폭 ≥360pt) */
function mockSpreadItems() {
  const leftX = 48;
  const rightX = 420;
  const font = 11;
  return [
    ...mockItems(
      [
        { str: '바로잡아', x: leftX, w: 55 },
        { str: '바', x: leftX + 58, w: 11 },
      ],
      200,
      font,
    ),
    ...mockItems([{ str: '하는', x: rightX, w: 22 }], 200, font),
    ...mockItems([{ str: '왼쪽윗', x: leftX }], 520, font),
    ...mockItems([{ str: '왼쪽중', x: leftX }], 460, font),
    ...mockItems([{ str: '왼쪽아래', x: leftX }], 400, font),
    ...mockItems([{ str: '오른윗', x: rightX }], 520, font),
    ...mockItems([{ str: '오른중', x: rightX }], 460, font),
    ...mockItems([{ str: '오른아래', x: rightX }], 400, font),
  ];
}

describe('detectSpreadGutter', () => {
  it('펼침면 합성 — 책등 gap을 찾는다', () => {
    const layout = detectSpreadGutter(mockSpreadItems());
    expect(layout).not.toBeNull();
    expect(layout?.gutterGap).toBeGreaterThanOrEqual(28);
  });

  it('단면 좁은 페이지 — 펼침이 아니다', () => {
    const items = mockItems([
      { str: '본문', x: 48 },
      { str: '단락', x: 48 },
      { str: '계속', x: 48 },
    ]);
    expect(detectSpreadGutter(items)).toBeNull();
  });
});

describe('splitSpreadColumns', () => {
  it('좌·우 단으로 나눈다', () => {
    const source = mockSpreadItems();
    const split = splitSpreadColumns(source);
    expect(split).not.toBeNull();
    expect(split?.left.length).toBeGreaterThan(0);
    expect(split?.right.length).toBeGreaterThan(0);
    const { left, right } = partitionSpreadEntries(source, split.gutterX);
    expect(left.every((e) => e.itemIndex >= 0)).toBe(true);
    expect(right.every((e) => e.itemIndex >= 0)).toBe(true);
  });
});
