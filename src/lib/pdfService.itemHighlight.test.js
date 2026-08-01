import { describe, expect, it } from 'vitest';
import { phraseLocalRangesInItems } from './pdfService.js';

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
});
