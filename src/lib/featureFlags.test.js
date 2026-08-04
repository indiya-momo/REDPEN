import { afterEach, describe, expect, it } from 'vitest';
import {
  isLoanwordConverterEnabled,
  isMyPageProjectHubEnabled,
  isSpellingExportEnabled,
  isSpellingKiwiBoundaryEnabled,
  isTocBodyCheckEnabled,
  isUnifyCandidateFindEnabled,
  isUnifyJosaSlmReviewEnabled,
  isUnifyKiwiJosaEnabled,
  isUnifyKiwiNoiseFilterEnabled,
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
  const prevKiwiJosa = import.meta.env.VITE_UNIFY_KIWI_JOSA;
  const prevKiwiBoundary = import.meta.env.VITE_SPELLING_KIWI_BOUNDARY;
  const prevKiwiNoise = import.meta.env.VITE_UNIFY_KIWI_NOISE_FILTER;
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
    import.meta.env.VITE_UNIFY_KIWI_JOSA = prevKiwiJosa;
    import.meta.env.VITE_SPELLING_KIWI_BOUNDARY = prevKiwiBoundary;
    import.meta.env.VITE_UNIFY_KIWI_NOISE_FILTER = prevKiwiNoise;
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

  it('프로덕션에서는 목차·프로젝트 허브만 env 없으면 꺼지고 export·외래어·표기 통일 추천은 기본 켜진다', () => {
    import.meta.env.DEV = false;
    import.meta.env.VITE_FEATURE_TOC_BODY_CHECK = undefined;
    import.meta.env.VITE_FEATURE_SPELLING_EXPORT = undefined;
    import.meta.env.VITE_FEATURE_MYPAGE_PROJECT_HUB = undefined;
    import.meta.env.VITE_FEATURE_LOANWORD_CONVERTER = undefined;
    import.meta.env.VITE_FEATURE_UNIFY_CANDIDATE_FIND = undefined;
    expect(isTocBodyCheckEnabled()).toBe(false);
    expect(isMyPageProjectHubEnabled()).toBe(false);
    expect(isUnifyCandidateFindEnabled()).toBe(true);
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

  it('프로덕션에서 VITE_FEATURE_UNIFY_CANDIDATE_FIND=false면 표기 통일 추천을 끈다', () => {
    import.meta.env.DEV = false;
    import.meta.env.VITE_FEATURE_UNIFY_CANDIDATE_FIND = 'false';
    expect(isUnifyCandidateFindEnabled()).toBe(false);
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

  it('Kiwi 조사 경계는 VITE_UNIFY_KIWI_JOSA=true 일 때만 켜진다', () => {
    import.meta.env.VITE_UNIFY_KIWI_JOSA = undefined;
    expect(isUnifyKiwiJosaEnabled()).toBe(false);
    import.meta.env.VITE_UNIFY_KIWI_JOSA = 'true';
    expect(isUnifyKiwiJosaEnabled()).toBe(true);
  });

  it('맞춤법 Kiwi 경계는 VITE_SPELLING_KIWI_BOUNDARY=true 일 때만 켜진다', () => {
    import.meta.env.VITE_SPELLING_KIWI_BOUNDARY = undefined;
    expect(isSpellingKiwiBoundaryEnabled()).toBe(false);
    import.meta.env.VITE_SPELLING_KIWI_BOUNDARY = 'true';
    expect(isSpellingKiwiBoundaryEnabled()).toBe(true);
  });

  it('표기통일 Kiwi 잡음 필터는 dev 기본 ON, prod는 true일 때만', () => {
    import.meta.env.DEV = true;
    import.meta.env.VITE_UNIFY_KIWI_NOISE_FILTER = undefined;
    expect(isUnifyKiwiNoiseFilterEnabled()).toBe(true);
    import.meta.env.VITE_UNIFY_KIWI_NOISE_FILTER = 'false';
    expect(isUnifyKiwiNoiseFilterEnabled()).toBe(false);
    import.meta.env.VITE_UNIFY_KIWI_NOISE_FILTER = 'true';
    expect(isUnifyKiwiNoiseFilterEnabled()).toBe(true);

    import.meta.env.DEV = false;
    import.meta.env.VITE_UNIFY_KIWI_NOISE_FILTER = undefined;
    expect(isUnifyKiwiNoiseFilterEnabled()).toBe(false);
    import.meta.env.VITE_UNIFY_KIWI_NOISE_FILTER = 'true';
    expect(isUnifyKiwiNoiseFilterEnabled()).toBe(true);
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
