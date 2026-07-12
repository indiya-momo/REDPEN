/**
 * 국립국어원 용례집 조회 검증.
 * 데이터(yongryeEnglish.json)가 아직 생성되지 않은 환경에서는 건너뛴다.
 */

import { describe, it, expect } from 'vitest';
import { loadYongryeDictionary, lookupYongrye } from './yongryeDictionary.js';

const dictionary = await loadYongryeDictionary();
const hasData = Object.keys(dictionary).length > 0;

describe.skipIf(!hasData)('용례집 조회 (공식 심의 표기)', () => {
  it('williams → 윌리엄스 (규칙 엔진의 윌리엄즈와 구별되는 공식 표기)', () => {
    const entries = lookupYongrye('Williams', dictionary);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].h).toBe('윌리엄스');
  });

  it('mobile — 동철 이의어는 복수 항목으로 반환한다 (모빌/모바일)', () => {
    const entries = lookupYongrye('mobile', dictionary);
    expect(entries.length).toBeGreaterThan(1);
    const forms = entries.map((e) => e.h);
    expect(forms).toContain('모빌');
    expect(forms).toContain('모바일');
  });

  it('여러 단어 지명도 조회된다 (west new york → 웨스트뉴욕)', () => {
    const entries = lookupYongrye('West New York', dictionary);
    expect(entries[0].h).toBe('웨스트뉴욕');
  });

  it('인명 전체 표기에서 성(姓)으로 색인된다 (karp → 카프)', () => {
    const entries = lookupYongrye('Karp', dictionary);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].h).toBe('카프');
    expect(entries[0].m).toContain('전체 표기');
  });

  it('미등재 단어는 빈 배열', () => {
    expect(lookupYongrye('zzzznotaword', dictionary)).toEqual([]);
  });
});
