import { describe, expect, it, beforeEach } from 'vitest';
import data from '../../public/data/stdict-verb-forms.json';
import {
  citationHasCompoundHyphen,
  clearStdictVerbFormsCache,
  isSpaceRequiredCompoundLemma,
  isSpaceRequiredVerbForm,
  lemmasForSpaceRequiredForm,
  resolveRegisteredVerbLemmaFromHost,
  resolveSpaceRequiredLemma,
  setStdictVerbFormsForTests,
  shouldSilenceLongCompoundHostAsRegisteredLemma,
  stdictHyphenOutsideKCount,
  stdictVerbFormsLemmaCount,
} from './stdictVerbForms.js';

describe('stdict-verb-forms.json', () => {
  beforeEach(() => {
    clearStdictVerbFormsCache();
    setStdictVerbFormsForTests(data);
  });

  it('메타에 출처·라이선스·개수가 있다', () => {
    expect(data.meta.source).toBe('국립국어원 표준국어대사전');
    expect(data.meta.downloaded).toBe('2026-11-06');
    expect(data.meta.license).toBe('CC BY-SA 2.0 KR');
    expect(data.meta.minSyllables).toBe(3);
    expect(data.meta.verbCount).toBe(69236);
    expect(data.meta.compoundVerbCount).toBe(66806);
    expect(data.meta.verbWithFormsCount).toBe(67352);
    expect(data.meta.mixedFormCount).toBe(99);
    expect(data.meta.lemmaCount).toBe(Object.keys(data.lemmas).length);
    expect(data.meta.spaceRequiredFormCount).toBe(162375);
    expect(stdictVerbFormsLemmaCount()).toBe(data.meta.lemmaCount);
    expect(Array.isArray(data.hyphenLemmasOutsideK)).toBe(true);
    expect(data.meta.hyphenOutsideKCount).toBe(data.hyphenLemmasOutsideK.length);
    expect(data.meta.hyphenLemmaCount).toBe(
      data.meta.lemmaCount + data.hyphenLemmasOutsideK.length,
    );
    expect(stdictHyphenOutsideKCount()).toBe(data.hyphenLemmasOutsideK.length);
  });

  it('붙임표 게이트는 K∪(H∖K)이고 API 정규화와 같은 기본형을 쓴다', () => {
    expect(citationHasCompoundHyphen('어루만지다')).toBe(true);
    expect(citationHasCompoundHyphen('생각하다')).toBe(true);
    expect(citationHasCompoundHyphen('가르치다')).toBe(false);
    expect(citationHasCompoundHyphen('눈여기다')).toBe(true);
    expect(citationHasCompoundHyphen('')).toBe(false);
  });

  it('덤벼들어·쫓아내·집어넣어·공부해는 복합어로 띄움 필수이다', () => {
    expect(lemmasForSpaceRequiredForm('덤벼들어')).toEqual(['덤벼들다']);
    expect(lemmasForSpaceRequiredForm('쫓아내')).toEqual(['쫓아내다']);
    expect(lemmasForSpaceRequiredForm('집어넣어')).toEqual(['집어넣다']);
    expect(lemmasForSpaceRequiredForm('공부해')).toEqual(['공부하다']);
    expect(isSpaceRequiredVerbForm('덤벼들어')).toBe(true);
    expect(isSpaceRequiredCompoundLemma('덤벼들다')).toBe(true);
  });

  it('기다려·만들어는 단일어라 띄움 필수가 아니다', () => {
    expect(isSpaceRequiredVerbForm('기다려')).toBe(false);
    expect(isSpaceRequiredVerbForm('만들어')).toBe(false);
    expect(isSpaceRequiredCompoundLemma('기다리다')).toBe(false);
  });

  it('걸려처럼 단일어와 섞인 mixed는 띄움 필수가 아니다', () => {
    expect(isSpaceRequiredVerbForm('걸려')).toBe(false);
  });

  it('들어오다처럼 본보조 등재 기본형을 추출본에서 본다', () => {
    expect(isSpaceRequiredCompoundLemma('들어오다')).toBe(true);
    expect(lemmasForSpaceRequiredForm('들어와')).toEqual(['들어오다']);
  });

  it('기본형이 없어도 활용형 유일이면 기본형을 돌려준다', () => {
    expect(resolveSpaceRequiredLemma('', '들어와')).toBe('들어오다');
    expect(resolveSpaceRequiredLemma('들어오다', '')).toBe('들어오다');
    expect(resolveSpaceRequiredLemma('', '기다려')).toBe('');
  });

  describe('resolveRegisteredVerbLemmaFromHost', () => {
    it('찾아오·들어와·생각해를 해소하고, 침묵은 lemma형 head만', () => {
      expect(resolveRegisteredVerbLemmaFromHost('찾아오')).toBe('찾아오다');
      expect(resolveRegisteredVerbLemmaFromHost('들어와')).toBe('들어오다');
      // 역색인 유일 — host+다 단계와 무관하게 해소됨
      expect(resolveRegisteredVerbLemmaFromHost('생각해')).toBe('생각하다');
      expect(resolveRegisteredVerbLemmaFromHost('어루만져')).toBe('어루만지다');
      expect(resolveRegisteredVerbLemmaFromHost('찾아오는')).toBe('');
      expect(resolveRegisteredVerbLemmaFromHost('찾아오면')).toBe('');
    });

    it('침묵은 등재 기본형 head(…다)만 — 활용형 본+보조는 유지', () => {
      expect(shouldSilenceLongCompoundHostAsRegisteredLemma('찾아오다')).toBe(
        true,
      );
      expect(shouldSilenceLongCompoundHostAsRegisteredLemma('들어오다')).toBe(
        true,
      );
      expect(shouldSilenceLongCompoundHostAsRegisteredLemma('관람하다')).toBe(
        true,
      );
      expect(shouldSilenceLongCompoundHostAsRegisteredLemma('어루만져')).toBe(
        false,
      );
      expect(shouldSilenceLongCompoundHostAsRegisteredLemma('들어와')).toBe(
        false,
      );
      expect(shouldSilenceLongCompoundHostAsRegisteredLemma('생각해')).toBe(
        false,
      );
      expect(shouldSilenceLongCompoundHostAsRegisteredLemma('찾아오')).toBe(
        false,
      );
    });

    it('추출본 미로드면 해소·침묵 모두 빈다', () => {
      clearStdictVerbFormsCache();
      expect(resolveRegisteredVerbLemmaFromHost('찾아오')).toBe('');
      expect(shouldSilenceLongCompoundHostAsRegisteredLemma('찾아오다')).toBe(
        false,
      );
    });
  });
});