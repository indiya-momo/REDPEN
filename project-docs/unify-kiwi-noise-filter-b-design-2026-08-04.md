# 표기통일 잡음 제외 — Kiwi 후보 어절만 (B안)

- 날짜: 2026-08-04
- 상태: **구현 반영** (2026-08-04) · D3는 §8 후속
- 관련:
  - `kiwi-morph-product-effects-2026-08-02.md`
  - `kiwi-server-c-2026-08-02.md`
  - `kiwi-morph-boundary-plan-2026-08-02.md`
  - `src/lib/kiwiMorph/unifyExclude.js`

## 0.0 전제 (2026-08-04 정리)

1. **1차 = 정적 리스트만** (`src/data/unify-noise-list.json` + `src/lib/unifyNoiseList.js`).
   - 예외 어절 · verbal/copula/hago 꼬리 · 본보조 라벨 휴리스틱 · 기존 조사/하다 키.
   - 찾기 discover / 위성 필터에서 **Kiwi boot·동기 analyze 금지**.
2. **2차 = 후보만 · 비동기** (`src/lib/unifyNoisePhase2.js`).
   - 목록 표시 **이후**, `isKiwiReady()`일 때만.
   - NOISE만으로 wasm boot 하지 않음. 없으면 배지.
3. **금지**: 활용형 단어장(기록하다·기록하여…), 전량 sync analyze.

수확: `npm run kiwi:harvest-noise-list` (꼬리·예외만).

---

## 0. 한 줄 목표

**표기통일 후보를 형태소 기반으로 검증하는 기능** (Morphological Validation).  
플래그 이름 `NOISE_FILTER`는 제품·env 식별용이며, 책임은 “잡음 한 종류”가 아니라 아래 검증 전체다.

표기 통일 목록에서 **명사 복합(명사+명사 / 허용된 동종 복합)이 아닌** 후보를 제거하고,  
하다/이다 **꼬리 함수를 늘리는 방식은 접는다.**  
분석기는 **Kiwi 유지**. 운영 안정은 **서버 C 호스트**로 푼다 (형태소기 교체 비범위).

### 0.1 `NOISE_FILTER` 책임 (검증 범위)

| 검증 | 예 | 결과 |
|------|-----|------|
| 조사 부착 어절 | 곳에서·글은·것도 (+ 명사) | 제외 |
| 용언·동사화 활용 | 가정하고·기록하라·단합하여 | 제외 |
| 이다 연결/종결 | 것이고·과학자였던 | 제외 |
| 명사+명사 (동종 복합) | 주식 시장·경리 업무 | **유지** |

즉 역할은 좁은 “명사+명사 판정”이 아니라 **후보가 표기통일 대상(형태소적으로 타당한 복합)인지 검증**하는 것이다.

### 대표 제외 예 (목표 동작)

| 띄움 예 | 왼쪽 어절 | 판정 |
|---------|-----------|------|
| 가정하고 공무원 | 가정하고 | 용언 연결 → 제외 |
| 것도 공무원 / 글은 공무원 | 것+도 / 글+은 | 조사 부착 → 제외 |
| 것이고 공무원 | 것+이고 | 이다 연결 → 제외 |
| 곳에서 공무원 | 곳+에서 | 조사 부착 → 제외 |
| 주식 시장 / 경리 업무 | 명사+명사 | **유지** |

공무원·시장 등 **오른쪽 명사 자체는 중요하지 않다.** 앞·뒤 어절이 명사 복합 성분인지만 본다.

---

## 1. 배경 · 회귀 원인

1. 이미 `isKiwiNounCompoundEojeol` / `shouldRejectUnifySatelliteSpacedByPos` 등으로 **명사+명사 판정**이 있다.
2. 찾기 속도·heuristic 베이스라인을 위해 `VITE_UNIFY_KIWI_JOSA` / `VITE_SPELLING_KIWI_BOUNDARY`를 끄며 `shouldBootKiwi()`가 false가 됨 → `isKiwiReady()` false → morph 경로 **fail-open** → 휴리스틱만 남음.
3. 그 공백을 `isUnifyHadaConjugationKey` / `isUnifyIdaConjugationKey` 꼬리 확장으로 메우기 시작 → **활용형마다 예외 추가** 악순환.
4. prod는 서버 C upstream·endpoint가 없어 Kiwi 잡음 제외가 **실질적으로 거의 안 켜진** 상태일 수 있음 (`resolveKiwiAnalyzeEndpoint` prod 기본 `''`).

병목 구분 (설계 전제):

| 종류 | 성격 | B안에서의 대응 |
|------|------|----------------|
| 부트(초기화) | 세션당 1회 고정비 | warm singleton |
| 대량 prefetch(≤1200 표면) | 분석량 비례 | **잡음 제외용으로는 안 씀** |
| 후보 어절 소수 분석 | 가변·작음 | **본선** |

---

## 2. 비범위

- mecab-ko 등 **다른 형태소 분석기 도입**
- LLM / 카나나 SLM 호출
- `ruleEngine` 매칭·regex 변경 (베타 freeze)
- 하다/이다 꼬리표 **추가 확장** (기존 표는 폴백만, 신규 키우지 않음)
- GitHub Pages에 Kiwi API 올리기 (정적 배포 한계 — C는 Vercel+upstream 또는 전용 호스트)

---

## 3. 플래그 (합의 고정)

### 3.1 세 개 분리

| env | getter | 역할 |
|-----|--------|------|
| `VITE_UNIFY_KIWI_JOSA` | `isUnifyKiwiJosaEnabled` | 조사 strip / 조사 리뷰 보조 |
| `VITE_SPELLING_KIWI_BOUNDARY` | `isSpellingKiwiBoundaryEnabled` | 맞춤법·칩 **경계** 게이트 (+ 필요 시 대량 prefetch) |
| **`VITE_UNIFY_KIWI_NOISE_FILTER`** (신규) | `isUnifyKiwiNoiseFilterEnabled` | 표기통일 후보 **형태소 검증** (§0.1) |

JOSA나 BOUNDARY만 꺼도 **NOISE_FILTER는 독립**으로 살아 있어야 한다.  
(이번 회귀: 경계/조사를 끄니 잡음 제외까지 같이 꺼짐.)

### 3.2 부트 OR

```
shouldBootKiwi() =
  isUnifyKiwiJosaEnabled()
  || isSpellingKiwiBoundaryEnabled()
  || isUnifyKiwiNoiseFilterEnabled()
```

셋 중 하나라도 ON → 세션당 1회 boot, 이후 싱글톤 재사용. 부트 이중 실행 없음.

### 3.3 기본값 — 오픈베타 (웹앱 OFF)

| 단계 | 정책 |
|------|------|
| **오픈베타 (지금)** | 웹앱 `NOISE_FILTER` **기본 OFF** (`=== 'true'`일 때만 ON). 사용자 찾기·검수 경로에서 Kiwi **미사용**. |
| **시스템/배치** | Node·CI·골든·denylist 보강 등 **리스트 등록·품질 공장**에서만 Kiwi 사용 |
| **유료·서버 C 후** | 웹앱 실시간 morph 재연결 (D3에 가깝게 기본 ON 검토) |

근거: 브라우저 wasm·동기 analyze는 무한 로딩·메인 스레드 동결을 유발. 서버 C 비용은 유료화 이후.

```js
export function isUnifyKiwiNoiseFilterEnabled() {
  return import.meta.env.VITE_UNIFY_KIWI_NOISE_FILTER === 'true';
}
```

---

## 4. 런타임 동작 (B)

### 4.1 Warm singleton

1. App 기동 또는 PDF 준비 시 `bootKiwiIfNeeded()` (OR 조건 충족 시).
2. 찾기 클릭마다 wasm/모델 재로드 금지. 이미 ready면 no-op.
3. DEV: 서버 C ping 성공 → server mode. 실패 시 wasm 폴백 (기존).
4. prod: endpoint 없으면 boot 실패 → §5 fail-open 가시화. **브라우저 wasm 배포 경로 사용 안 함** (법무·기존 방침).

### 4.2 분석 범위 — 후보 어절만

**하지 않음 (잡음 제외 목적):**

- `collectUnifyKiwiPrefetchSurfaces` 기반 **문서 표면 ≤1200** prefetch를 NOISE_FILTER만으로는 돌리지 않음.
- BOUNDARY가 ON일 때의 경계 prefetch는 **BOUNDARY 전용**으로 유지·분리 (기존 대량 경로와 혼동 금지).

**함:**

- 위성/목록에 올라갈 **띄움 쌍**의 왼쪽·오른쪽 어절만 `analyzeLine` / `classifyKiwiSpacedEojeolPos`.
- 기존 API 재사용:
  - `shouldRejectUnifySatelliteSpacedByPos`
  - `isKiwiNounCompoundEojeol`
  - (글루) `shouldExcludeUnifyGluedByKiwi` / `shouldRejectUnifySatelliteGlued`
- 호출 조건: `isUnifyKiwiNoiseFilterEnabled() && isKiwiReady()`.

적용 시점 (구현 시 코드로 고정):

1. `buildSingleFormCluster` / 위성 생성 — 이미 morph 게이트 있음 → **NOISE_FILTER 플래그로 게이트** (지금은 `isKiwiReady()`만).
2. 계열 위성 필터 (`filterSeriesSatellitesByMorphPos` 등) — 동일.
3. (선택·권장) 목록에 남는 **충돌 클러스터**의 띄움형도 동일 판정으로 한 번 더 걸러, `@공무원` 계열에 `가정하고 공무원`이 남지 않게.

### 4.3 어절 분석 캐시 (필수)

같은 어절이 후보에 여러 번 나와도 Kiwi를 반복 호출하지 않는다.

예: `가정하고`가 문서·목록에 300회여도 **unique surface 1회 분석**.

| 계층 | 역할 |
|------|------|
| `analyzeLine` 메모리 캐시 | 이미 `Map` + 상한(≈2048) 존재. 후보 경로는 **이 API만** 타서 자동 공유 |
| 서버 `remoteCache` | 시나리오 C에서 동일 문자열 재사용 |
| 찾기 1회 전처리 (권장) | 해당 찾기에서 검증할 어절을 `Set`으로 unique 한 뒤 분석 → 판정은 캐시 hit |

구현 시 확인:

- 위성/목록 필터가 `analyzeLine`을 우회해 raw `kiwi.analyze`를 부르지 않을 것.
- bench에 `morphAnalyzeCalls` / `morphCacheHits`(가능하면)를 남겨 캐시 효과를 볼 것.

### 4.4 휴리스틱 폴백

| Kiwi | 동작 |
|------|------|
| ready + NOISE_FILTER ON | morph 우선. 하다/이다 꼬리는 **중복 제외용 폴백으로만** (신규 꼬리 추가 금지) |
| 미ready / NOISE_FILTER OFF | 기존 휴리스틱(`isUnifyJosaGluedNoiseKey` 등) + §5 가시화 |

---

## 5. Fail-open 가시화 (같은 배포에 포함)

NOISE_FILTER는 ON인데 Kiwi가 없으면 **조용히 휴리스틱만** 돌리지 않는다.

| 채널 | 내용 |
|------|------|
| `unifyFindBench` / `__UNIFY_FIND_BENCH__` | `morphMode`: `kiwi-noise` \| `heuristic-fallback` \| `heuristic-baseline`(플래그 OFF). `kiwiReady`, `noiseFilterEnabled`, (가능하면) `morphSkipCount` |
| DEV 콘솔 | 찾기 완료 시 `[unify-kiwi-noise] fallback — kiwi not ready` 한 줄 |
| UI (최소) | 찾기 완료 팝업 또는 목록 헤더 근처 **짧은 배지**: 「형태소 필터 미적용」 — NOISE_FILTER ON && !kiwiReady 일 때만 |

prod에서 D2(플래그 OFF)면 배지 불필요. D3 전환 후에는 배지가 C 장애를 드러내는 센서가 된다.

---

## 6. 서버 C (운영 안정 — 분석기 교체 아님)

목표: **운영에서 안 꺼짐**. 품질 센서는 Kiwi 유지.

| 환경 | 기대 |
|------|------|
| DEV | Vite `kiwiAnalyzeDevPlugin` + `tmp/kiwi-models` |
| Vercel | `api/kiwi/analyze.js` + **`KIWI_ANALYZE_UPSTREAM`** (cong 모델 있는 Node 호스트). 모델 바이너리를 서버리스에 넣지 않음 |
| 클라이언트 | 필요 시 `VITE_KIWI_ANALYZE_ENDPOINT` |
| Pages | API 없음 → Kiwi OFF. D2/D3와 별개로 Pages는 heuristic (+ 배지는 D3·플래그 ON일 때만) |

상세 배포 절차는 `kiwi-server-c-2026-08-02.md`를 따른다. 본 스펙은 **“C 없으면 D3 금지”**만 고정한다.

---

## 7. 구현 단계 (승인 후)

1. **플래그** — `featureFlags.js` + 테스트 + `shouldBootKiwi` OR 확장.
2. **게이트 분리** — 위성/잡음 경로는 `isUnifyKiwiNoiseFilterEnabled()`, 경계 prefetch는 BOUNDARY만.
3. **찾기 prefetch** — NOISE_FILTER alone일 때 대량 surface prefetch 스킵; 후보 어절 unique만 분석(§4.3 캐시).
4. **목록 잔여 잡음** — `@공무원`류 single-form / series에 morph 재적용 확인 (테스트: 가정하고·곳에서·글은 공무원).
5. **가시화** — bench + DEV 로그 + UI 배지 (+ morph 캐시/소요 메트릭).
6. **문서** — `kiwi-morph-product-effects-2026-08-02.md` §플래그·§4에 NOISE_FILTER 반영.
7. **하다/이다** — 신규 꼬리 추가 중단. 기존 함수는 폴백 유지 (삭제 여부는 후속, 이번 필수 아님).

베타 freeze: `ruleEngine` 매칭 로직·regex는 건드리지 않음.

---

## 8. D3 전환 체크리스트 (후속)

서버 C prod 검증 완료 후에만 `isUnifyKiwiNoiseFilterEnabled`를 **기본 ON**으로 바꾼다.

- [ ] `KIWI_ANALYZE_UPSTREAM`(또는 동등 호스트) 설정·문서화
- [ ] prod에서 `GET …/api/kiwi/analyze` → `{ ready: true }` (재시도·타임아웃 정책 합의)
- [ ] §9 성능 수치 충족 확인 (벤치 1회 이상: 추가 ≤300ms · 후보 100 unique ≤500ms)
- [ ] fail-open 배지/로그가 C 장애 시 실제로 보이는지 확인
- [ ] D3: DEV·prod 모두 기본 ON (`!== 'false'`) 또는 prod도 opt-out만
- [ ] Pages 정책 한 줄 고지 (API 없음 → 필터 미적용 가능)

---

## 9. 성공 기준

### 9.1 품질

- DEV + NOISE_FILTER(기본 ON) + Kiwi ready: `가정하고 공무원`·`곳에서 공무원`·`글은 공무원`·`기록하라`류가 **목록/위성에서 사라짐**.
- `주식 시장`·`경리 업무` 등 명사+명사는 **유지**.
- BOUNDARY·JOSA OFF + NOISE_FILTER ON: 형태소 검증은 **동작**, 부트는 1회.
- NOISE_FILTER ON + Kiwi 미ready: 휴리스틱 폴백 + **배지/로그** (조용한 회귀 없음).
- 하다/이다 꼬리 **신규 추가 없이** 위 제외가 morph로 커버됨.

### 9.2 성능 (숫자 목표)

찾기 **본연 discover 시간 제외**, NOISE_FILTER morph 검증 단계만:

| 지표 | 목표 |
|------|------|
| morph 검증 **추가** 벽시계 | **≤ 300ms** (일반 PDF·후보 규모, 웜 싱글톤·캐시 hit 포함 세션) |
| unique 후보 어절 **100개** 기준 분석+판정 | **≤ 500ms** (콜드 캐시여도; 동일 어절 반복은 캐시로 증가하지 않음) |

초과 시: unique 전처리·캐시 hit율·서버 배치를 점검. “느리다”의 기준은 위 수치로 삼는다.

---

## 10. 합의 메모 (2026-08-04)

| 주제 | 결정 |
|------|------|
| 접근 | B — 후보 어절만 Kiwi 분석 |
| 분석기 | Kiwi 유지. 교체 비범위. 운영=서버 C |
| 플래그 | 신규 `VITE_UNIFY_KIWI_NOISE_FILTER` 분리 |
| 부트 | 3플래그 OR |
| 기본값 | D2 → C 검증 후 D3 (§8) |
| fail-open | 가시화 필수·동시 배포 |
| 꼬리 확장 | 접기 |
| 책임 문구 | Morphological Validation (§0·§0.1) — 검토 반영 |
| 캐시 | unique 어절 + `analyzeLine` Map (§4.3) — 검토 반영 |
| 성능 수치 | 추가 ≤300ms · 100 unique ≤500ms (§9.2) — 검토 반영 |

---

## 11. 다음 단계

1. 이 문서 사용자 검토·수정.
2. 승인 후 §7 순서대로 구현 (커밋은 요청 시에만).
3. C prod 준비되면 §8 → D3.
