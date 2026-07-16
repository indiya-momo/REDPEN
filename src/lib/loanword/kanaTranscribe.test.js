import { describe, it, expect } from 'vitest';
import {
  convertKanaPhrase,
  isKanaQuery,
  normalizeKana,
} from './kanaTranscribe.js';

const hangulOf = (q) => convertKanaPhrase(q).results[0]?.hangul;

describe('isKanaQuery', () => {
  it('가나(히라가나·가타카나·장음 부호)만이면 true', () => {
    expect(isKanaQuery('とうきょう')).toBe(true);
    expect(isKanaQuery('サッポロ')).toBe(true);
    expect(isKanaQuery('そん まさよし')).toBe(true);
    expect(isKanaQuery('ラーメン')).toBe(true);
  });

  it('한자·라틴이 섞이면 false', () => {
    expect(isKanaQuery('伊藤ひろぶみ')).toBe(false);
    expect(isKanaQuery('tokyo')).toBe(false);
    expect(isKanaQuery('')).toBe(false);
  });
});

describe('normalizeKana', () => {
  it('가타카나를 히라가나로, 장음 부호는 유지', () => {
    expect(normalizeKana('サッポロ')).toBe('さっぽろ');
    expect(normalizeKana('ラーメン')).toBe('らーめん');
  });
});

describe('convertKanaPhrase — 표 4·세칙', () => {
  it('어두 예사소리·장모음 생략: とうきょう → 도쿄', () => {
    expect(hangulOf('とうきょう')).toBe('도쿄');
  });

  it('어중 거센소리: きょうと → 교토', () => {
    expect(hangulOf('きょうと')).toBe('교토');
  });

  it('촉음은 ㅅ 받침: さっぽろ → 삿포로', () => {
    expect(hangulOf('さっぽろ')).toBe('삿포로');
    expect(hangulOf('サッポロ')).toBe('삿포로');
  });

  it('같은 모음 반복 장음 생략: おおさか → 오사카', () => {
    expect(hangulOf('おおさか')).toBe('오사카');
  });

  it('ん은 ㄴ 받침, 단어별 어두 적용: そん まさよし → 손 마사요시', () => {
    expect(hangulOf('そん まさよし')).toBe('손 마사요시');
  });

  it('요음: しんじゅく → 신주쿠', () => {
    expect(hangulOf('しんじゅく')).toBe('신주쿠');
  });

  it('えい는 장음으로 줄이지 않음: めいじ → 메이지', () => {
    expect(hangulOf('めいじ')).toBe('메이지');
  });

  it('장음 부호 생략: ラーメン → 라멘', () => {
    expect(hangulOf('ラーメン')).toBe('라멘');
  });

  it('つ는 항상 쓰: つしま → 쓰시마', () => {
    expect(hangulOf('つしま')).toBe('쓰시마');
  });

  it('확장 가타카나 근사: ティー → 티 (근사 안내 포함)', () => {
    const result = convertKanaPhrase('ティー');
    expect(result.results[0].hangul).toBe('티');
    expect(result.results[0].notes.join(' ')).toContain('근사');
  });

  it('적용 근거(trace)에 조항이 붙는다', () => {
    const { results } = convertKanaPhrase('とうきょう');
    const ids = results[0].trace.map((t) => t.rule.id);
    expect(ids).toContain('표 4 (어두)');
    expect(ids).toContain('일본어 제2항');
  });

  it('가나가 아니면 found=false', () => {
    expect(convertKanaPhrase('伊藤').found).toBe(false);
  });
});
