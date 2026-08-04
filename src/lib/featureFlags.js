/**
 * 목차 · 본문 일치 검수.
 * - `npm run dev`: 항상 켜짐
 * - 프로덕션·Pages 빌드: 기본 꺼짐 (Vercel/GitHub Pages에는 「개발중」만 표시)
 * - 로컬에서 preview로 켜려면 `.env`에 `VITE_FEATURE_TOC_BODY_CHECK=true`
 */
export function isTocBodyCheckEnabled() {
  if (import.meta.env.DEV) return true;
  return import.meta.env.VITE_FEATURE_TOC_BODY_CHECK === 'true';
}

/**
 * 맞춤법·일관성 검수 결과 엑셀 다운로드.
 * - `npm run dev`: 항상 켜짐
 * - 프로덕션: 기본 켜짐 (`VITE_FEATURE_SPELLING_EXPORT=false` 로만 끔)
 * - GitHub Pages 빌드: deploy-pages.yml 에서도 `true` 명시
 */
export function isSpellingExportEnabled() {
  if (import.meta.env.DEV) return true;
  if (import.meta.env.VITE_FEATURE_SPELLING_EXPORT === 'false') return false;
  return true;
}

/**
 * 마이페이지 「나의 프로젝트」 라이브러리(카드·태그·복제 등).
 * - `npm run dev`: 항상 켜짐
 * - 프로덕션·Pages 빌드: 기본 꺼짐 (준비 중 UI만 표시)
 * - 로컬 preview에서 켜려면 `.env`에 `VITE_FEATURE_MYPAGE_PROJECT_HUB=true`
 */
export function isMyPageProjectHubEnabled() {
  if (import.meta.env.DEV) return true;
  return import.meta.env.VITE_FEATURE_MYPAGE_PROJECT_HUB === 'true';
}

/**
 * 맞춤법 탭 「외래어 표기(영어 → 한글 지원)」.
 * - 둘러보기·로그인 작업 모두 기본 표시
 * - 끌 때만 `VITE_FEATURE_LOANWORD_CONVERTER=false`
 * - Pages 배포는 deploy-pages.yml에서 `true` 명시
 */
export function isLoanwordConverterEnabled() {
  if (import.meta.env.VITE_FEATURE_LOANWORD_CONVERTER === 'false') return false;
  return true;
}

/**
 * 표기 통일 탭 「표기 통일 추천」(띄어쓰기 이형태).
 * - `npm run dev`: 항상 켜짐
 * - 프로덕션(Vercel·Pages): 기본 켜짐 (`VITE_FEATURE_UNIFY_CANDIDATE_FIND=false` 로만 끔)
 * - Pages CI는 deploy-pages.yml 에서도 `true` 명시
 */
export function isUnifyCandidateFindEnabled() {
  if (import.meta.env.DEV) return true;
  if (import.meta.env.VITE_FEATURE_UNIFY_CANDIDATE_FIND === 'false') return false;
  return true;
}

/**
 * 표기 통일 추천 — 2차 패턴 확장(@affix mismatch).
 * - `npm run dev`: 기본 켜짐 (`VITE_FEATURE_UNIFY_PHASE2_PATTERN=false`로만 끔)
 * - 프로덕션·Pages: 기본 꺼짐 — 1차 추천만 (`=== 'true'`일 때만 ON)
 * @see project-docs/unify-phase2-pattern-2026-07-31.md
 */
export function isUnifyPhase2PatternEnabled() {
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_FEATURE_UNIFY_PHASE2_PATTERN !== 'false';
  }
  return import.meta.env.VITE_FEATURE_UNIFY_PHASE2_PATTERN === 'true';
}

/**
 * 표기 통일 추천 — 조사·어간 2차 SLM 필터 (카나나 SLM + 추론 서버).
 * - 기본 꺼짐 (`VITE_UNIFY_JOSA_SLM=true` 일 때만)
 * @see project-docs/unify-josa-review-slm-sketch.md §0·§8
 */
export function isUnifyJosaSlmReviewEnabled() {
  return import.meta.env.VITE_UNIFY_JOSA_SLM === 'true';
}

/**
 * 표기 통일 — Kiwi 형태소로 끝 조사 어간 보조.
 * - 기본 꺼짐 (`VITE_UNIFY_KIWI_JOSA=true` 일 때만)
 * - ON이어도 모델 미로드면 heuristic 폴백
 * @see project-docs/kiwi-morph-boundary-plan-2026-08-02.md §P1
 */
export function isUnifyKiwiJosaEnabled() {
  return import.meta.env.VITE_UNIFY_KIWI_JOSA === 'true';
}

/**
 * 맞춤법/외래어 + 표기통일 칩·하이라이트 — Kiwi 형태소 경계로 복합어 부분일치 스킵.
 * - 기본 꺼짐 (`VITE_SPELLING_KIWI_BOUNDARY=true` 일 때만)
 * - ON이어도 모델 미로드·분석 실패면 현행(스킵 안 함)
 * - **공유 플래그:** `matchFilters`(맞춤법 매칭 후처리) + `unifyCandidateDiscover` enrich.
 *   이름에 SPELLING이 있어도 표기통일 enrich와 코드·플래그를 공유한다.
 *   ruleEngine 매칭 키/정규식은 건드리지 않음(게이트·prefetch만).
 * @see project-docs/kiwi-morph-boundary-plan-2026-08-02.md §P2
 */
export function isSpellingKiwiBoundaryEnabled() {
  return import.meta.env.VITE_SPELLING_KIWI_BOUNDARY === 'true';
}

/**
 * 표기 통일 — 후보 잡음 1차 리스트(denylist·패턴 꼬리·휴리스틱).
 * - 찾기 핫패스는 **리스트만** (동기 Kiwi 분석 없음).
 * - 로컬 `npm run dev`: 기본 ON (`VITE_UNIFY_KIWI_NOISE_FILTER=false`로만 끔)
 * - 프로덕션·Pages: 기본 OFF (`=== 'true'`일 때만)
 * - Kiwi 2차는 별도(후보 온디맨드). boot 조건에 넣지 않음.
 * - JOSA·BOUNDARY와 독립.
 * @see project-docs/unify-kiwi-noise-filter-b-design-2026-08-04.md
 */
export function isUnifyKiwiNoiseFilterEnabled() {
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_UNIFY_KIWI_NOISE_FILTER !== 'false';
  }
  return import.meta.env.VITE_UNIFY_KIWI_NOISE_FILTER === 'true';
}

/**
 * 표기 통일 추천 — 용언 여부 2차 SLM (목록에서 비용언 제거).
 * - 기본 꺼짐 (`VITE_UNIFY_PREDICATE_SLM=true` 일 때만)
 * @see project-docs/unify-predicate-review-slm-design-2026-07-30.md
 */
export function isUnifyPredicateSlmReviewEnabled() {
  return import.meta.env.VITE_UNIFY_PREDICATE_SLM === 'true';
}

/**
 * 표기 통일 추천 — 표준국어대사전 품사 2차 (규칙 후 보완, 목록 이동).
 * - 기본 꺼짐 (`VITE_UNIFY_STDICT=true` 일 때만)
 * @see project-docs/unify-stdict-pos-review-design-2026-07-31.md
 */
export function isUnifyStdictPosReviewEnabled() {
  return import.meta.env.VITE_UNIFY_STDICT === 'true';
}
