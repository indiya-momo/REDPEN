import { describe, expect, it } from 'vitest';
import {
  formatYongryeLocale,
  formatYongryeMeaningLine,
  groupOfficialYongrye,
} from './yongryeDisplay.js';

describe('yongryeDisplay', () => {
  it('formatYongryeLocale joins guk / lang', () => {
    expect(formatYongryeLocale('파나마', '에스파냐어')).toBe(
      '파나마 / 에스파냐어',
    );
    expect(formatYongryeLocale('프랑스', '')).toBe('프랑스');
    expect(formatYongryeLocale('', '')).toBe('');
  });

  it('formatYongryeMeaningLine prefixes dash and appends locale', () => {
    expect(
      formatYongryeMeaningLine({
        m: '프랑스의 화가(1748~1825).',
        guk: '프랑스',
      }),
    ).toBe('-프랑스의 화가(1748~1825)., 프랑스');
    expect(
      formatYongryeMeaningLine({
        m: '파나마 치리키(Chiriquí)주의 주도',
        guk: '파나마',
        lang: '에스파냐어',
      }),
    ).toBe('-파나마 치리키(Chiriquí)주의 주도, 파나마 / 에스파냐어');
    expect(formatYongryeMeaningLine({ m: '태풍이름 3조' })).toBe(
      '-태풍이름 3조',
    );
  });

  it('groupOfficialYongrye counts and keeps locale per line', () => {
    const grouped = groupOfficialYongrye([
      { h: '다비드', c: '인명', m: '고대 이스라엘의 왕.' },
      {
        h: '다비드',
        c: '인명',
        m: '프랑스의 화가.',
        guk: '프랑스',
      },
      {
        h: '다비드',
        c: '지명',
        m: '파나마 주도',
        guk: '파나마',
        lang: '에스파냐어',
      },
      { h: '데이비드', c: '일반 용어', m: '태풍이름 3조' },
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].h).toBe('다비드');
    expect(grouped[0].count).toBe(3);
    expect(grouped[0].cats).toEqual(['인명', '지명']);
    expect(grouped[0].lines).toHaveLength(3);
    expect(formatYongryeMeaningLine(grouped[0].lines[1])).toContain('프랑스');
    expect(grouped[1].count).toBe(1);
  });
});
