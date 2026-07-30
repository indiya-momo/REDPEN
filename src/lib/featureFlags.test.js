import { afterEach, describe, expect, it } from 'vitest';
import {
  isLoanwordConverterEnabled,
  isMyPageProjectHubEnabled,
  isSpellingExportEnabled,
  isTocBodyCheckEnabled,
  isUnifyCandidateFindEnabled,
  isUnifyJosaSlmReviewEnabled,
  isUnifyPredicateSlmReviewEnabled,
  isUnifyStdictPosReviewEnabled,
} from './featureFlags.js';

describe('featureFlags', () => {
  const prevDev = import.meta.env.DEV;
  const prevToc = import.meta.env.VITE_FEATURE_TOC_BODY_CHECK;
  const prevExport = import.meta.env.VITE_FEATURE_SPELLING_EXPORT;
  const prevProjectHub = import.meta.env.VITE_FEATURE_MYPAGE_PROJECT_HUB;
  const prevLoanword = import.meta.env.VITE_FEATURE_LOANWORD_CONVERTER;
  const prevUnifyCandidate = import.meta.env.VITE_FEATURE_UNIFY_CANDIDATE_FIND;
  const prevJosaSlm = import.meta.env.VITE_UNIFY_JOSA_SLM;
  const prevPredicateSlm = import.meta.env.VITE_UNIFY_PREDICATE_SLM;
  const prevStdict = import.meta.env.VITE_UNIFY_STDICT;

  afterEach(() => {
    import.meta.env.DEV = prevDev;
    import.meta.env.VITE_FEATURE_TOC_BODY_CHECK = prevToc;
    import.meta.env.VITE_FEATURE_SPELLING_EXPORT = prevExport;
    import.meta.env.VITE_FEATURE_MYPAGE_PROJECT_HUB = prevProjectHub;
    import.meta.env.VITE_FEATURE_LOANWORD_CONVERTER = prevLoanword;
    import.meta.env.VITE_FEATURE_UNIFY_CANDIDATE_FIND = prevUnifyCandidate;
    import.meta.env.VITE_UNIFY_JOSA_SLM = prevJosaSlm;
    import.meta.env.VITE_UNIFY_PREDICATE_SLM = prevPredicateSlm;
    import.meta.env.VITE_UNIFY_STDICT = prevStdict;
  });

  it('dev에서는 목차·본문·엑셀 export·프로젝트 허브·외래어 변환·표기 통일 추천이 켜진다', () => {
    import.meta.env.DEV = true;
    expect(isTocBodyCheckEnabled()).toBe(true);
    expect(isSpellingExportEnabled()).toBe(true);
    expect(isMyPageProjectHubEnabled()).toBe(true);
    expect(isLoanwordConverterEnabled()).toBe(true);
    expect(isUnifyCandidateFindEnabled()).toBe(true);
  });

  it('프로덕션에서는 목차·프로젝트 허브·표기 통일 추천만 env 없으면 꺼지고 export·외래어 변환은 기본 켜진다', () => {
    import.meta.env.DEV = false;
    import.meta.env.VITE_FEATURE_TOC_BODY_CHECK = undefined;
    import.meta.env.VITE_FEATURE_SPELLING_EXPORT = undefined;
    import.meta.env.VITE_FEATURE_MYPAGE_PROJECT_HUB = undefined;
    import.meta.env.VITE_FEATURE_LOANWORD_CONVERTER = undefined;
    import.meta.env.VITE_FEATURE_UNIFY_CANDIDATE_FIND = undefined;
    expect(isTocBodyCheckEnabled()).toBe(false);
    expect(isMyPageProjectHubEnabled()).toBe(false);
    expect(isUnifyCandidateFindEnabled()).toBe(false);
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
    import.meta.env.VITE_FEATURE_UNIFY_CANDIDATE_FIND = 'true';
    expect(isSpellingExportEnabled()).toBe(true);
    expect(isUnifyCandidateFindEnabled()).toBe(true);
  });

  it('조사·어간 SLM은 VITE_UNIFY_JOSA_SLM=true 일 때만 켜진다', () => {
    import.meta.env.VITE_UNIFY_JOSA_SLM = undefined;
    expect(isUnifyJosaSlmReviewEnabled()).toBe(false);
    import.meta.env.VITE_UNIFY_JOSA_SLM = 'true';
    expect(isUnifyJosaSlmReviewEnabled()).toBe(true);
  });

  it('용언 2차 SLM은 VITE_UNIFY_PREDICATE_SLM=true 일 때만 켜진다', () => {
    import.meta.env.VITE_UNIFY_PREDICATE_SLM = undefined;
    expect(isUnifyPredicateSlmReviewEnabled()).toBe(false);
    import.meta.env.VITE_UNIFY_PREDICATE_SLM = 'true';
    expect(isUnifyPredicateSlmReviewEnabled()).toBe(true);
  });

  it('표준국어대사전 품사 2차는 VITE_UNIFY_STDICT=true 일 때만 켜진다', () => {
    import.meta.env.VITE_UNIFY_STDICT = undefined;
    expect(isUnifyStdictPosReviewEnabled()).toBe(false);
    import.meta.env.VITE_UNIFY_STDICT = 'true';
    expect(isUnifyStdictPosReviewEnabled()).toBe(true);
  });
});
