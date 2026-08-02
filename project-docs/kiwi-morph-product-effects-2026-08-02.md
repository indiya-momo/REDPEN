# Kiwi 형태소 분석 — 제품 반영 사항

- 날짜: 2026-08-02
- 역할 한 줄: **규범·교정 엔진이 아니라 “한국어 경계 센서”.**  
  맞춤법 사전/규칙은 인디야가 유지하고, Kiwi는 어간·조사·이다·나열·원자 명사 등 **형태소 경계**만 알려 준다.
- 관련: `kiwi-morph-boundary-plan-2026-08-02.md`, `kiwi-p2-boundary-2026-08-02.md`, `kiwi-server-c-2026-08-02.md`

## 0. 전제

| 항목 | 내용 |
|------|------|
| 미로드·분석 실패 | 해당 Kiwi 분기는 **안 탐** → heuristic / 현행 유지 |
| `typo.dict` | 미사용 (오타 교정 금지) |
| `ruleEngine` regex 코어 | 변경 없음 (베타 freeze). 맞춤법 쪽은 **매칭 후 필터**만 |
| 런타임 | 시나리오 C 서버 analyze 우선, DEV ping 실패 시 wasm 폴백 |
| **부트** | 표기통일 잡음 제외가 `isKiwiReady()`에만 의존하므로 **플래그와 무관하게** `bootKiwiIfNeeded` 시도. 통일 찾기(`buildUnifyOccurrenceIndexAsync`)에서도 한 번 더 await |

### 플래그

| 환경 변수 | 기본 | 영향 |
|-----------|------|------|
| (부트) | 항상 시도 | 서버 ping → DEV면 wasm. **없으면** 경제학상·경제학이 등이 heuristic으로 목록에 남음 |
| `VITE_UNIFY_KIWI_JOSA` | OFF | 조사 리뷰 등 **플래그 경로**의 Kiwi 조사 strip |
| `VITE_SPELLING_KIWI_BOUNDARY` | OFF | 맞춤법/외래어 히트 + 표기통일 **칩·하이라이트** 경계 게이트 |
| `VITE_KIWI_ANALYZE_ENDPOINT` | (선택) | 외부 analyze URL. 미설정 시 DEV `/api/kiwi/analyze` |

> 아래 **「Kiwi 준비 시 항상」** 항목은 플래그와 무관하게 `isKiwiReady()`일 때만 동작한다.

---

## 1. 맞춤법 / 외래어 / 주의 — 복합어 부분일치 스킵

**플래그:** `VITE_SPELLING_KIWI_BOUNDARY=true`  
**위치:** `matchFilters.shouldSkipMatch` → `shouldSkipMatchByKiwiBoundary`  
**파일:** `src/lib/kiwiMorph/boundaryGate.js`

| 상황 | 형태소 판정 | 결과 |
|------|-------------|------|
| `경제` ⊂ `경제학` (토큰 중간) | 어간이 화이트리스트 명사 계열 | **스킵** (오탐 하이라이트 제거) |
| `초콜렛` + `을` (어간 정확 스팬) | 매치 끝이 토큰 경계 | **유지** |
| 플래그 OFF / 미로드 / 1:1 실패 | — | 현행(스킵 안 함) |

**어간 태그 화이트리스트:**  
`NNG` `NNP` `NNB` `NR` `NP` `SL` `SH` `SN` `XSN` `XPN`  
(불규칙 접미 `-R` 등은 base 태그로 인정)

---

## 2. 표기통일 — 칩·하이라이트만 동일 경계 게이트

**플래그:** `VITE_SPELLING_KIWI_BOUNDARY=true` (맞춤법과 공유)  
**위치:** `enrichOccurrencesWithItemHits` 직전 `filterUnifyOccurrencesByKiwiBoundary`  
**파일:** `src/lib/unifyCandidateDiscover.js`

| 적용 | 미적용 |
|------|--------|
| occurrence → 칩·페이지 하이라이트 | **발견 스캔**(`accumulateUnifyPageOccurrences`) 자체 |

의도: 목록에 잡힌 뒤에도 `경제`⊂`경제학`처럼 복합어 안에 걸친 구간은 하이라이트하지 않음.

서버 모드에서는 통일 찾기 시 표면 prefetch (`prefetchKiwiAnalyze`)로 경계·제외 판정 지연을 줄인다.  
PDF 준비 직후·찾기 클릭 시 배치를 **최대 3병렬**로 돌리고, remote/로컬 analyze 캐시는 prefetch 상한(1200)을 담도록 키운다.  
DEV는 서버 모드일 때 스캔 앞단 wasm 강제 로드를 하지 않는다(서버 실패 시에만 로컬 폴백).

---

## 3. 표기통일 발견 — 끝 조사 strip (형태소)

**조건:** `isKiwiReady()` (발견 경로에서는 **플래그 무관**)  
**파일:** `stripTrailingJosaKiwi` → `addOccurrence`

| 표면형 | 분석 예 | 반영 |
|--------|---------|------|
| `경제학이` | `경제학/NNG` + `이/JKS` | 어간 `경제학`으로 키 정규화 |
| `초콜렛을` | 명사 + 목적격 | 어간만 후보 키 |

실패 시 heuristic `stripTrailingJosaHeuristic` 유지.

**플래그 `VITE_UNIFY_KIWI_JOSA`:**  
`unifyJosaReview` 등 **조사 리뷰 보조 경로**에서 같은 strip을 쓸 때 ON. 발견 `addOccurrence`와는 별개.

---

## 4. 표기통일 발견 — 잡음 제외 (형태소)

**조건:** `isKiwiReady()`  
**파일:** `src/lib/kiwiMorph/unifyExclude.js` + `addOccurrence`

### 4.1b 명사+동사화/연결 (`isKiwiNounVerbalConnectiveSurface`)

| 표면형 | 태그 패턴 | 결과 |
|--------|-----------|------|
| `상환하기` / `예측하고` | `NNG` + `하/XSV` + 어미 | **제외** |
| `가치있다고` / `가치 있다고` | `NNG` + `있/VV` + `다고/EC` | **제외** |
| `구성되며` / `구성되고` | `NNG` + `되/XSV` + 어미 | **제외** |
| `환경하고` | `NNG` + `하고/JC` | **제외** |
| `경제성장` | 명사 복합 | 제외하지 않음 |

`구성되므`처럼 OCR로 한 덩어리 명사(`closed`)인 경우 위성에서 거부.

### 4.1 「이다」종결·연결 (`isKiwiCopulaEndingSurface`)

| 표면형 | 태그 패턴 | 결과 |
|--------|-----------|------|
| `경제다` / `경제다라` | `NNG` + `이/VCP` + `다/EF` (+ `라/EC`) | **후보 제외** |
| `경제성장` | 명사 복합 | 제외하지 않음 |

휴리스틱 보완: 한글 사이 문장부호(`경제다!라`)는 Kiwi 없이도 `isExcludedUnifyCandidateRaw`로 제외.

### 4.2 가운데점 나열 (`isKiwiEnumerationSurface`)

| 표면형 | 태그 패턴 | 결과 |
|--------|-----------|------|
| `경제학·철학` | `NNG` + `·/SP` + `NNG` | **후보 제외** |
| `경제학` | 단일 명사 | 제외하지 않음 |

(원시 문자열에 가운데점이 있으면 휴리스틱 제외도 병행.)

### 4.4 이형태 없는 위성만 — 동종 복합 (`filterSeriesSatellitesByMorphPos`)

**대상:** `single-form` 위성만 (진짜 붙임·띄움 충돌은 비대상)  
**시점:** 계열 위성 필터. 분석 실패는 fail-open.

| 띄움형 | 판정 | 결과 |
|--------|------|------|
| `주식 시장` / `사실상 시장`(NNG+XSN) | 명사+명사 | **유지** |
| `안에 시장` / `점을 시장` / `후의 시장`(NNG+조사) | 조사 부착 → 명사복합 아님 | **제외** |
| `보통 시장` / `또는 시장` / `말해 시장` / `손쉽게 시장` | 둘 다 아님 | **제외** |
| dictPos=`noun` | 명사+명사만 | 동사+동사 위성도 제외 |
| dictPos=`predicate` | 동사+동사만 (`VV`/`VX`/`XSV`, 형용사 VA 제외) | 명사+명사 위성도 제외 |
| 어절 분석 실패(unknown) | — | **유지**(fail-open). 명사·동사 양쪽에 fail-open을 겹치지 않음 |

생성 시점(`buildSingleFormCluster`)과 계열 필터에서 모두 적용. DEV 찾기는 wasm을 올려 어절 단독 분석이 실제로 돌게 함.

### 4.3 닫힌 명사 — **위성만** 거부 (발견 raw는 유지)

**위치:** `buildSingleFormCluster`만 (`addOccurrence`에서 닫힌 명사 삭제 금지)  
**이유:** 이형태가 문서에 없는 정상 후보(0회 반대형 위성)까지 raw에서 빼면 목록이 통째로 비게 됨.

| 표면형 | 분류 | 결과 |
|--------|------|------|
| `경제학상` / `경제학이`(strip 후) | `closed` | **위성 거부** (목록 미편입) |
| `세계화` | `closed` (NNG+XSN) | 위성 거부 · `세계 화`는 1음절로도 거부 |
| `개인사정` 등이 `multi` | 복합 | 위성 **허용** (0회 이형태 유지) |
| 분석 실패 `unknown` | — | 위성 **유지** (fail-open) |

`경제학이` → 반대형 `경제 학이`는 Kiwi 없이도 조사 잔해 heuristic으로 위성 거부.

---

## 5. 한눈에 보기 (표기통일)

```
PDF 텍스트
  → (스캔) 토큰·n-gram 발견
       ├─ Kiwi ready: 나열(·) 제외
       ├─ Kiwi ready: 끝 조사 strip (경제학이 → 경제학, 세계화가 → 세계화)
       ├─ Kiwi ready: 이다 종결·연결 제외 (경제다라, 세계최초이자)
       └─ Kiwi ready: 닫힌 명사 글루 제외 (세계화·경제학상)
  → 위성·단일형 클러스터
       └─ Kiwi ready: 닫힌 명사·이다 연결이면 위성 거부
  → enrich (칩·하이라이트)
       └─ VITE_SPELLING_KIWI_BOUNDARY: 복합어 부분일치 스킵
```

---

## 6. 형태소가 아닌 인접 보완 (참고)

아래는 **Kiwi가 아니라** 휴리스틱이다. 통일 칩 오결합과 겹쳐 보이므로만 기록.

| 규칙 | 예 | 파일 |
|------|-----|------|
| 1음절 독립 어절(`간` `및` `등` …) 뒤 soft-wrap 금지 | `물가 간`\\n`악순환` → 붙이지 않음 (`물가 간악순환` 칩 방지) | `pdfPageText.js` `isLikelyHangulEojeolBoundary` |
| 단어 중간 soft-wrap만 이음 | `명`\\n`지 계곡` → `명지 계곡` | `isUnifyHangulMidWordSoftWrap` |

---

## 7. 코드 지도

| 모듈 | 역할 |
|------|------|
| `src/lib/kiwiMorph/analyze.js` | `analyzeLine` · 캐시 |
| `src/lib/kiwiMorph/boundaryGate.js` | 맞춤법·통일 enrich 경계 |
| `src/lib/kiwiMorph/unifyExclude.js` | 이다 / 나열 / 원자 명사 |
| `src/lib/kiwiMorph/stripTrailingJosa.js` | 끝 조사 strip |
| `src/lib/kiwiMorph/runtime.js` | ready · 서버 모드 |
| `src/lib/unifyCandidateDiscover.js` | 발견·enrich 훅 |
| `src/lib/unifyCandidateSatellites.js` | 원자 명사 위성 거부 |
| `src/lib/matchFilters.js` | 맞춤법 후단 게이트 |
| `src/lib/featureFlags.js` | 플래그 |

테스트: `boundaryGate.test.js`, `unifyCandidateDiscover.test.js`, `unifyCandidateSatellites.test.js`, `kiwiMorph.test.js`

---

## 8. 의도적으로 하지 않는 것

- 사용자 사전에 NNG/NNP로 **등록**해 후보를 늘리는 방식 (제외·경계만)
- Kiwi로 맞춤법 **정답 표기**를 바꾸기
- soft-wrap 줄바꿈 복원을 Kiwi에 전면 위임 (아직 heuristic)
- `ruleEngine` 내부 매칭 로직 교체
