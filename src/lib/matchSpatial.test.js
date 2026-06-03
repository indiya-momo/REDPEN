import { describe, expect, it } from 'vitest';
import { isMatchSpatiallyCoherent } from './matchSpatial.js';

describe('isMatchSpatiallyCoherent', () => {
  it('한 줄 안의 매칭은 글자별 y 좌표가 달라도 통과한다', () => {
    let text = '';
    const items = [];
    const itemRefs = [];
    const parts = ['불', '확', '실', '성', '의', '케', '이', '크'];
    const y = 200;
    for (const ch of parts) {
      const start = text.length;
      items.push({ str: ch, transform: [12, 0, 0, 12, 48, y] });
      itemRefs.push({ start, end: start + 1, itemIndex: items.length - 1 });
      text += ch;
    }
    text += '\n';
    const page = { pageNum: 42, text, items, itemRefs };
    expect(isMatchSpatiallyCoherent(page, 0, 8, 1.35)).toBe(true);
  });
});
