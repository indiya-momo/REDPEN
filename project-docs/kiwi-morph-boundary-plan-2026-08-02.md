# Kiwi 형태소 경계 — 인디야 도입 계획

- 날짜: 2026-08-02
- 개정: 2026-08-02 (원본 소스 대조·검토 반영)
- 참고:
  - [bab2min/Kiwi README](https://github.com/bab2min/Kiwi) (확인일 2026-08-02)
  - [WASM 바인딩 README](https://github.com/bab2min/Kiwi/blob/main/bindings/wasm/README.md)
  - [API 문서](https://bab2min.github.io/Kiwi/kiwi-nlp/)
  - [웹 데모](https://kiwi.bab2min.pe.kr/)
  - [v0.23.1 릴리즈](https://github.com/bab2min/Kiwi/releases/tag/v0.23.1) (2026-04-04)
  - npm `kiwi-nlp` ([registry](https://www.npmjs.com/package/kiwi-nlp); jsDelivr 캐시 관측 예: 0.22.1)
- 전제: PDF **자동 치환 없음**(매칭·하이라이트·제안만). 베타 freeze — `ruleEngine`/regex 매칭 코어는 승인 없이 건드리지 않음.

## 0. 원본 대조로 확정한 사실관계

| 항목 | 원본 | 계획서 반영 |
|------|------|-------------|
| 문어 ~94% / 웹 ~87% | Kiwi README 자체 평가 데이터 | 유지. **저자 벤치**임을 명시. CoNg부터 모호성 해소가 추가로 향상되었다고 README에 별도 표기 → P0에서 **base vs CoNg** 중 무엇을 잴지 고정 |
| 오타 교정 | 0.13.0+ | **1차 도입 금지**. 구현은 옵션 플래그보다 **`typo.dict` 미로드**를 기본 정책으로 |
| 코어 라이선스 | GitHub: **LGPL v3** | 법무 항목에 코어=v3 명시 |
| npm 라이선스 | `kiwi-nlp`: **LGPL-2.1-or-later** | 코어와 **서로 다름** → 둘 다 법무 검토 |
| 최신 코어 | **v0.23.1** (2026-04-04) | P0 스파이크 메모에 실제 사용 `kiwi-nlp`/모델 버전 **고정 기록** (재현성) |
| analyze 토큰 필드 | WASM 예제: `str`,`tag`,`position`,`length` + `score`,`typoCost`,`typoFormId`,`sentPosition`,`subSentPosition`,`wordPosition`,`lineNumber`,`pairedToken` | 래퍼에서 **보존/폐기 필드**를 명시 (§1.1) |
| Match 옵션 | 공식 예제 `Match.allWithNormalizing` | 정규화 시 `str`≠원문 가능 → PDF 정렬 전제 위험. P0에서 **비정규화 옵션**으로 1:1 검증 (§3 P0) |
| 모델 파일 | v0.23.1 **base tgz = CoNg** (`cong.mdl`, `multi.dict`, `nounchr.mdl`, `sj.morph`, `default.dict`, …). 고전 knlm 8파일 목록과 다름. **typo.dict는 기본 미로드** | P0 측정 ≈104MB(typo 제외). P3 캐시. 상세: `kiwi-p0-spike-2026-08-02.md` |

## 1. Kiwi에서 가져올 것

| Kiwi 기능 | 인디야에 쓰는 방식 |
|-----------|-------------------|
| 세종 품사 태그 (`NNG`/`NNP`/`JX`/`JKO`/`VV`+`EP`+`EF`, 불규칙 `-R`/`-I` …) | 어간 vs 조사·어미 **경계 센서** |
| `analyze()` 토큰 (아래 §1.1) | 표면형 구간 ↔ PDF `matchedText` / soft-wrap 좌표 매핑 |
| 문어 ~94% / 웹 ~87% (README, 저자 평가) | 출판 원고(문어)에 상대적으로 유리. CoNg는 P0에서 별도 측정 |
| 문장 분리 | 페이지 텍스트를 문장 단위로 잘라 분석 단위 축소 |
| 오타 교정 (0.13+) | **금지** — `typo.dict` 미로드 + typo Match 미사용 |
| WASM (`kiwi-nlp` wasm ≈3.6MB + 모델 8파일) | 브라우저/Vite 가능, **지연 로딩·Worker** 필수 |
| LGPL v3 (코어) / LGPL-2.1-or-later (npm) | 법무: 고지 + **WASM/Emscripten 정적 링크가 동적 링크 예외에 해당하는지** 별도 확인 |

역할 한 줄: **규범 엔진이 아니라 “한국어 경계 센서”.**  
`초콜렛→초콜릿` 사전/규칙은 인디야가 유지하고, Kiwi는 “여기가 명사 어간이고 뒤에 조사가 붙었다”만 알려 준다.

### 1.1 래퍼가 다루는 토큰 필드

WASM 예제 기준 토큰에 포함되는 필드와 인디야 정책:

| 필드 | P0~P1 | 비고 |
|------|-------|------|
| `str`, `tag`, `position`, `length` | **필수 보존** | 경계·정렬의 최소 단위 |
| `score` | **보존** (내부) | 모호성·동점 시 나중에 임계값에 사용 가능. UI 비노출 |
| `sentPosition`, `wordPosition`, `lineNumber` | 보존 권장 | 문장/어절 단위 캐시·디버그 |
| `subSentPosition`, `pairedToken` | 보존하되 미사용 | 스키마만 유지 |
| `typoCost`, `typoFormId` | **폐기/무시** | typo.dict 미로드와 일치. 값이 와도 쓰지 않음 |

`analyzeLine(text, opts) → Token[]` 공개 시그니처는 최소 4필드(+선택 `score`)로 문서화하고, 원본 객체는 모듈 내부 WeakMap/캐시에만 둘 수 있다.

### 1.2 Match·표면형 정렬 (핵심 전제)

- PDF 좌표 정렬은 **`position`/`length`가 입력 문자열(복원된 줄) 기준 바이트/코드유닛 오프셋**이고, **`str`이 그 구간의 원문 슬라이스와 동일**할 때만 성립한다.
- 공식 예제의 `Match.allWithNormalizing`은 정규화로 `str`≠원문일 수 있음 → **P0에서 정규화 없는 Match 옵션**으로 1:1을 검증한 뒤에만 P1 진행.
- 정규화가 불가피하면: `position`/`length`만 쓰고 `str`은 `input.slice(pos, pos+len)`으로 재구성 — 이 전략을 P0 메모에 적고 채택 여부를 결정.

## 2. 인디야 현재 파이프라인과 꽂을 자리

```
[맞춤법/주의/외래어]
useRuleCheck → runRuleCheckAsync → ruleEngine.applyRuleToPages
  → (후단) matchFilters.shouldSkipMatch
  → useHighlights / pdfHighlightRange

[표기 통일]
discoverSpacingUnifyCandidates(Async)
  → stripTrailingJosa / unifyJosaReview
  → (옵션) unifyJosaReviewSlm
  → UnifyCandidateFindPanel
```

### 2.1 soft-wrap·좌표 매핑 (순서 재정의)

복원된 줄만 Kiwi에 넣으면, morph 결과의 `position`은 **복원 문자열 좌표**이다. PDF 하이라이트·칩은 **item / page.text(visual) 좌표**가 필요하다.  
따라서 “하이라이트를 나중”으로만 두면 P1 조사 strip 결과를 UI에 못 붙인다.

**매핑 책임 (명시)**

| 계층 | 담당 | 산출 |
|------|------|------|
| `pdfPageText` / unify soft-wrap merge | 줄 복원 + **`absIndex(i)` / itemRefs** (이미 unify 스캔에 존재) | `restoredLine` ↔ layout/visual offset |
| `kiwiMorph.analyzeLine(restoredLine)` | morph 토큰 (`position` in restoredLine) | 어간·조사 경계 (restored offset) |
| 얇은 어댑터 `mapRestoredToVisual(page, restoredOffset)` | unify의 `mapLayoutIndexToVisualIndex`·`itemRefs` 재사용 | visual index / itemIndexes |
| `pdfHighlightRange` / `pdfItemPhraseFind` | 최종 박스 | P1부터 **어댑터 경유**로 사용 (4순위가 아니라 **P1 병행 필수**) |

플러그 순위 (수정):

1. **좌표 어댑터 + 표기통일 조사 strip·리뷰** — morph 경계 → restored offset → visual/item  
2. **매칭 후 필터** (`matchFilters.shouldSkipMatch`) — ruleEngine freeze 우회  
3. **PDF soft-wrap 경계 보조** (`pdfPageText` heuristic을 Kiwi 신호로 보강)  
4. 하이라이트 세밀 튜닝 (어댑터가 동작한 뒤)

**넣지 말 것(초기):** `ruleEngine` 내부 regex 컴파일·`compileRuleRegex` 교체.

## 3. 단계 계획

### P0 — 스파이크 (1~2일, 제품 기능 OFF) — **조건부 완료 2026-08-02**

결과 메모: [`kiwi-p0-spike-2026-08-02.md`](./kiwi-p0-spike-2026-08-02.md)

- [x] 버전 고정: npm `kiwi-nlp@0.23.0`, 모델팩 `kiwi_model_v0.23.1_base.tgz` → 실제 **`cong`** (`models/cong/base`)
- [x] base vs CoNg: 이번 팩이 CoNg라 **cong만** 측정 (고전 knlm 팩 미다운로드)
- [x] 모델 파일별 용량 (합 ≈104MB, typo 제외) + wasm ≈3.6MB
- [x] `typo.dict` 미로드
- [x] `Match.all` / `allWithNormalizing` / `none` 표면형 1:1 → **전부 통과** (문어 샘플)
- [x] `초콜렛/NNG`+`을/JKO` 확인
- [x] `명지 계곡` → `명/NNB 지/NNG 계곡` **오분리** 관측 (user dict 필요)
- [ ] LGPL/WASM 법무 확인 (미결)

**통과 기준:** 조건부 통과 — P1은 플래그 OFF + heuristic 폴백 + user dict 전제.

### P1 — 표기통일 조사 경계 (플래그 OFF 기본) — **완료 2026-08-02**

목표: `stripTrailingJosa` / josa review에 Kiwi 보조 + **restored→visual 매핑**.
방식: **Node/테스트 우선** (≈104MB 브라우저는 나중). ON이어도 미로드 시 heuristic.

- [x] `src/lib/kiwiMorph/` 래퍼: §1.1 필드 정책 준수 (`typo*` 폐기)
- [x] `mapRestoredToVisual` 어댑터 (absIndex + mapLayoutToVisual bridge)
- [x] `stripTrailingJosaKiwi(surface)`: 끝 토큰 `J*` → 어간, 실패 시 heuristic
- [x] `unifyJosaReview`에 `kiwiStemKey` / `kiwiAgrees` 신호 (SLM 대체 아님)
- [x] `VITE_UNIFY_KIWI_JOSA=true` (`isUnifyKiwiJosaEnabled`)
- [x] 골든 테스트 (모델 없으면 skipIf)
- [x] user dict 초안 (`명지`, `명지계곡`)
- [ ] 브라우저 lazy 모델 로드 (P1 범위 밖 — 권장 방식 1)

**통과 기준:** ON+Node 로드에서 조사 strip 골든 통과, OFF 현행 동일, 어댑터 경로 존재.
### P2 — 맞춤법/외래어 후단 필터 (플래그) — **진행 2026-08-02**

목표: 조사 붙은 표면은 잡고, 복합어 내부 부분 일치는 스킵.
방식: Node/테스트 · `VITE_SPELLING_KIWI_BOUNDARY` · `ruleEngine` 본문 변경 없음.

- [x] `shouldSkipMatch` optional Kiwi gate (`matchFilters`)
- [x] find 어간 ↔ Kiwi 토큰 경계 + **태그 화이트리스트** 승인분 반영  
      (`NNG`/`NNP`/`NNB`/`NR`/`NP`/`SL`/`SH`/`SN`/`XSN`/`XPN`)
- [x] 외래어·명사: 뒤 조사 허용(어간 토큰 정확 스팬), 부분일치는 skip
- [x] `ruleEngine` 본문 미변경 (호출은 기존 `shouldSkipMatch`만)

**통과 기준:** OFF·미로드 회귀, ON+Node에서 `경제⊂경제학` skip·`초콜렛`+조사 keep.
### P3 — 운영 (선택)

- [ ] 페이지 캐시: `pageNum + text hash → tokens`
- [ ] **모델 8파일** 브라우저 캐시 (Cache API / IndexedDB; SW는 선택)
- [ ] Worker 풀 / `analyze` 배치
- [ ] 출판 고유명사 user dict
- [ ] soft-wrap 복원 문장만 analyze (깨진 줄은 heuristic)

## 4. 아키텍처 스케치

```
PDF items / page.text
        │
        ▼
 soft-wrap·줄 복원 + absIndex/itemRefs 매핑 테이블
        │  restoredLine + offset bridge
        ▼
┌───────────────────┐
│ kiwiMorph (lazy)  │  wasm + 모델(typo.dict 제외), Worker
│ Match: 비정규화   │  tokens (str/tag/pos/len/score…)
└─────────┬─────────┘
          │ mapRestoredToVisual
    ┌─────┴──────┐
    ▼            ▼
 unify josa    matchFilters
 strip/review  (spelling hit)
    │            │
    ▼            ▼
 칩·하이라이트   하이라이트 유지
```

**하지 않음**

- Kiwi로 `suggestedText` 자동 생성
- 전 문서 동기 analyze
- PDF 바이너리 수정
- typo 교정 경로 활성화

## 5. 리스크

| 리스크 | 완화 |
|--------|------|
| wasm+8모델 용량·첫 로드 | 플래그 ON + lazy load; 파일별 캐시 (P3) |
| 정규화로 표면형 불일치 | P0에서 비정규화 검증; 실패 시 slice 재구성 |
| PDF 깨진 문장 | 복원 줄만 analyze; 매핑 테이블 필수 |
| OOV·고유명사 | heuristic 폴백 → user dict |
| LGPL v3 vs 2.1-or-later + WASM 정적 링크 | 법무 질문지 구체화 후 채택 |
| beta freeze | P1·P2는 unify / matchFilters / 어댑터만 |
| 태그 화이트리스트 자의성 | §7 승인 게이트에 포함 |

## 6. 성공 지표

- P0: 스파이크 메모(버전·base/CoNg·Match 옵션·파일 용량·1:1 검증) + 벤치 숫자
- P1: 조사 오분리 감소, §6.1 골든 통과, OFF 회귀
- P2: 합의 오탐 N건 중 M건 감소, freeze 영역 diff 없음

### 6.1 골든 테스트 최소 세트 (P1/P2 정량화용)

P1 착수 전 아래를 픽스처로 고정한다 (건수는 하한).

**조사 경계 (각 태그 ≥2건, 총 ≥12건)**

- `JX` 보조사: 은/는/도/만 …
- `JKO` 목적격: 을/를
- `JKG` 관형격: 의
- `JKS`/`JKB`: 이/가, 에/에서/으로 …
- 어간+조사 붙임 vs 띄움 (`명지계곡`/`명지 계곡` 류는 **띄움 정책**과 충돌하지 않게 표기통일 케이스만)

**활용·파생 (각 ≥1건, 총 ≥4건)**

- `VV`/`VA` + `EP`/`EF` (먹/었/다)
- 가능하면 `-R`/`-I` 불규칙 표지가 보이는 용언 1건 (없어도 P1 차단은 아님 — 관측 시 기록)

**부정·회귀 (각 ≥2건)**

- 복합어 내부 부분일치 (`경제` ⊂ `경제학`) → P2에서 skip
- Kiwi 실패/빈 토큰 → heuristic 폴백과 동일

**PDF 좌표 (P1 ≥3건)**

- soft-wrap로 갈라진 어절에서 strip 결과가 visual/item과 일치

## 7. 다음 액션 (승인 게이트)

1. **법무:** LGPL v3(코어) vs 2.1-or-later(npm), **WASM/Emscripten 정적 링크 해당 여부**, 고지 문구
2. **P0 스파이크** (UI 미연결) → 버전·모델·Match·용량 메모
3. P0 통과 후 **P1 플래그·좌표 어댑터** 설계 확정
4. **P2 태그 화이트리스트** (`NNG`/`NNP`/… 허용 목록) — **사용자(로사) 승인 후**에만 코드 반영
5. `ruleEngine` 본문 변경은 **별도 승인** 전까지 금지
