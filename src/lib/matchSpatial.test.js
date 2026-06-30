import { describe, expect, it } from 'vitest';
import { isMatchSpatiallyCoherent } from './matchSpatial.js';
import { runRuleCheck } from './ruleEngine.js';

describe('isMatchSpatiallyCoherent', () => {
  it('펼침면처럼 같은 y인데 책등 x 점프로 엮인 바하는 비일관으로 거른다', () => {
    const y = 200;
    const size = 11;
    const items = [
      { str: '바', transform: [size, 0, 0, size, 148, y], width: 11 },
      { str: '하', transform: [size, 0, 0, size, 362, y], width: 11 },
    ];
    const text = '바하\n';
    const itemRefs = [
      { start: 0, end: 1, itemIndex: 0 },
      { start: 1, end: 2, itemIndex: 1 },
    ];
    const page = { pageNum: 7, text, items, itemRefs };
    expect(isMatchSpatiallyCoherent(page, 0, 2)).toBe(false);
  });

  it('한 단에 붙은 진짜 바하는 통과한다', () => {
    const y = 200;
    const size = 11;
    const items = [
      { str: '바하', transform: [size, 0, 0, size, 48, y], width: 22 },
    ];
    const text = '바하\n';
    const itemRefs = [{ start: 0, end: 2, itemIndex: 0 }];
    const page = { pageNum: 7, text, items, itemRefs };
    expect(isMatchSpatiallyCoherent(page, 0, 2)).toBe(true);
  });

  it('펼침면 바하 오탐은 맞춤법 검사에서 걸러진다', () => {
    const y = 200;
    const size = 11;
    const items = [
      { str: '바', transform: [size, 0, 0, size, 148, y], width: 11 },
      { str: '하', transform: [size, 0, 0, size, 362, y], width: 11 },
    ];
    const text = '바하\n';
    const itemRefs = [
      { start: 0, end: 1, itemIndex: 0 },
      { start: 1, end: 2, itemIndex: 1 },
    ];
    const page = { pageNum: 7, text, items, itemRefs };
    const rules = [
      {
        find: '바하',
        replace: '바흐',
        pattern: 'literal',
        category: 'spelling',
        builtIn: true,
      },
    ];
    const { results } = runRuleCheck([page], rules);
    expect(results[0]?.instances ?? []).toHaveLength(0);
  });

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
