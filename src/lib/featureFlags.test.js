import { afterEach, describe, expect, it } from 'vitest';
import {
  isLoanwordConverterEnabled,
  isMyPageProjectHubEnabled,
  isSpellingExportEnabled,
  isTocBodyCheckEnabled,
} from './featureFlags.js';

describe('featureFlags', () => {
  const prevDev = import.meta.env.DEV;
  const prevToc = import.meta.env.VITE_FEATURE_TOC_BODY_CHECK;
  const prevExport = import.meta.env.VITE_FEATURE_SPELLING_EXPORT;
  const prevProjectHub = import.meta.env.VITE_FEATURE_MYPAGE_PROJECT_HUB;
  const prevLoanword = import.meta.env.VITE_FEATURE_LOANWORD_CONVERTER;

  afterEach(() => {
    import.meta.env.DEV = prevDev;
    import.meta.env.VITE_FEATURE_TOC_BODY_CHECK = prevToc;
    import.meta.env.VITE_FEATURE_SPELLING_EXPORT = prevExport;
    import.meta.env.VITE_FEATURE_MYPAGE_PROJECT_HUB = prevProjectHub;
    import.meta.env.VITE_FEATURE_LOANWORD_CONVERTER = prevLoanword;
  });

  it('dev에서는 목차·본문·엑셀 export·프로젝트 허브·외래어 변환이 켜진다', () => {
    import.meta.env.DEV = true;
    expect(isTocBodyCheckEnabled()).toBe(true);
    expect(isSpellingExportEnabled()).toBe(true);
    expect(isMyPageProjectHubEnabled()).toBe(true);
    expect(isLoanwordConverterEnabled()).toBe(true);
  });

  it('프로덕션에서는 목차·프로젝트 허브만 env 없으면 꺼지고 export·외래어 변환은 기본 켜진다', () => {
    import.meta.env.DEV = false;
    import.meta.env.VITE_FEATURE_TOC_BODY_CHECK = undefined;
    import.meta.env.VITE_FEATURE_SPELLING_EXPORT = undefined;
    import.meta.env.VITE_FEATURE_MYPAGE_PROJECT_HUB = undefined;
    import.meta.env.VITE_FEATURE_LOANWORD_CONVERTER = undefined;
    expect(isTocBodyCheckEnabled()).toBe(false);
    expect(isMyPageProjectHubEnabled()).toBe(false);
    expect(isLoanwordConverterEnabled()).toBe(true);
    expect(isSpellingExportEnabled()).toBe(true);
  });

  it('프로덕션에서 VITE_FEATURE_SPELLING_EXPORT=false면 export를 끈다', () => {
    import.meta.env.DEV = false;
    import.meta.env.VITE_FEATURE_SPELLING_EXPORT = 'false';
    expect(isSpellingExportEnabled()).toBe(false);
  });

  it('프로덕션에서 VITE_FEATURE_LOANWORD_CONVERTER=false면 외래어 변환을 끈다', () => {
    import.meta.env.DEV = false;
    import.meta.env.VITE_FEATURE_LOANWORD_CONVERTER = 'false';
    expect(isLoanwordConverterEnabled()).toBe(false);
  });

  it('프로덕션 preview는 env true로 명시해도 켜진다', () => {
    import.meta.env.DEV = false;
    import.meta.env.VITE_FEATURE_SPELLING_EXPORT = 'true';
    expect(isSpellingExportEnabled()).toBe(true);
  });
});
