import { describe, expect, it } from 'vitest';
import {
  clipMatchToItemLocals,
  phraseLocalRangesInItems,
} from './pdfService.js';

describe('phraseLocalRangesInItems', () => {
  it('soft-wrap 「명|지 계곡」은 앞줄 끝·뒷줄 앞만 구간으로 잡는다', () => {
    const items = [
      {
        str: '암반이 강 바닥을 이루고 있는 곳에서 잘 나타나는 현상입니다. 우리 나라에는 명',
      },
      {
        str: '지 계곡 외에도 영월 주천강의 요석정 주변, 삼척의 두타산 계곡',
      },
    ];
    const ranges = phraseLocalRangesInItems(items, [0, 1], '명지 계곡');
    expect(ranges).toBeTruthy();
    const a = ranges.get(0);
    const b = ranges.get(1);
    expect(items[0].str.slice(a.start, a.end)).toBe('명');
    expect(items[1].str.slice(b.start, b.end)).toBe('지 계곡');
  });

  it('단일 item은 needle 구간만', () => {
    const items = [{ str: '항아리 바위로 유명한 명지 계곡과' }];
    const ranges = phraseLocalRangesInItems(items, [0], '명지 계곡');
    expect(items[0].str.slice(ranges.get(0).start, ranges.get(0).end)).toBe(
      '명지 계곡',
    );
  });

  it('한 줄에 그리와 그가 있으면 matchStart의 그를 쓴다', () => {
    const str = '에서 어찌 그리 차분하신지요. 그 모습을 보고';
    const items = [{ str }];
    const ranges = phraseLocalRangesInItems(
      items,
      [0],
      '그',
      str.indexOf('그 모습'),
      [{ itemIndex: 0, start: 0, end: str.length }],
    );
    expect(ranges.get(0).start).toBe(str.indexOf('그 모습'));
    expect(str.slice(ranges.get(0).start, ranges.get(0).start + 2)).not.toBe(
      '그리',
    );
  });
});

describe('clipMatchToItemLocals', () => {
  it('줄바꿈 「푸른 |빛」은 앞줄 끝·뒷줄 앞만 잡고 줄 전체는 칠하지 않는다', () => {
    const a = '가는 금실로 꾸민 달개, 푸른 ';
    const b = '빛을 머금은 곱은옥이 있지요.';
    const items = [{ str: a }, { str: b }];
    const itemRefs = [
      { itemIndex: 0, start: 0, end: a.length },
      { itemIndex: 1, start: a.length, end: a.length + b.length },
    ];
    const text = a + b;
    const matchStart = text.indexOf('푸른 빛');
    const matchEnd = matchStart + '푸른 빛'.length;
    const locals = clipMatchToItemLocals(
      items,
      itemRefs,
      matchStart,
      matchEnd,
      '푸른 빛',
    );
    expect(locals).toHaveLength(2);
    expect(a.slice(locals[0].localStart, locals[0].localEnd)).toBe('푸른');
    expect(b.slice(locals[1].localStart, locals[1].localEnd)).toBe('빛');
    expect(locals[0].localStart).toBeGreaterThan(0);
  });

  it('그 모습을 찍으면 앞의 그리로 가지 않는다', () => {
    const str = '에서 어찌 그리 차분하신지요. 그 모습을 보고';
    const items = [{ str }];
    const itemRefs = [{ itemIndex: 0, start: 0, end: str.length }];
    const matchStart = str.indexOf('그 모습');
    const locals = clipMatchToItemLocals(
      items,
      itemRefs,
      matchStart,
      matchStart + 1,
      '그',
    );
    expect(locals).toHaveLength(1);
    expect(str.slice(locals[0].localStart, locals[0].localEnd)).toBe('그');
    expect(locals[0].localStart).toBe(matchStart);
  });
});
