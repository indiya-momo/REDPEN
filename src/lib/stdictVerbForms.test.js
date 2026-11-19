import { describe, expect, it, beforeEach } from 'vitest';
import data from '../../public/data/stdict-verb-forms.json';
import {
  clearStdictVerbFormsCache,
  isSpaceRequiredCompoundLemma,
  isSpaceRequiredVerbForm,
  lemmasForSpaceRequiredForm,
  setStdictVerbFormsForTests,
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
});