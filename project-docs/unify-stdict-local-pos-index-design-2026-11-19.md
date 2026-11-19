# 표준국어대사전 품사 2차 — 로컬 색인 (API 대체)

**상위:** `unify-stdict-pos-review-design-2026-07-31.md`  
**상태:** 합의 · **A 구현됨** (색인 + 로컬 `fetchStdictExact`, API 폴백 없음) · 2026-11-19  
**결정:** 접근 **A** — 품사 전용 색인으로 `/api/stdict` exact 조회를 대체.  
**플래그:** `VITE_UNIFY_STDICT` (기본 off) — 플래그 on일 때만 2차 호출; 호출 시 로컬 색인만 사용.  
**비범위:** GoldenDict/`stdict-full` 본문, `ruleEngine`, 우리말샘, 뜻·예문 UI.

---

## 0. 목표

표기 통일 품사 2차(`unifyStdictPos`)가 쓰는 조회는 **「문자열 exact → 품사 목록」** 뿐이다.  
Open API·키·프록시 없이, 내려받기 JSON에서 만든 **로컬 색인**으로 같은 판정 파이프라인을 돌린다.

성공 기준:

| 항목 | 기준 |
|------|------|
| 조회 | bare 한글 exact → `{ word, pos }[]` (반환 모양이 `parseStdictSearchHits`와 호환) |
| 폴백 | **없음** — 색인 미스·로드 실패 시 API로 넘기지 않음 (`missing` 또는 기능 비활성) |
| 사전 범위 | **표준국어대사전**만 (API·`stdict.korean.go.kr`와 동일). 우리말샘 혼입 금지 |
| verdict | 동형·다품사 ≤ API 10건 상한인 표본: API와 일치. 동형 > 10: 로컬 전량이 더 완전할 수 있음(의도) |
| freeze | `ruleEngine` 불변. `VITE_UNIFY_STDICT` 뒤에서만 동작 |
| 용량 게이트 | 단일 gzip 전송 ≤ ~12MB이면 A 유지. 초과 시 B(첫 음절 샤드) |
| **측정 (2026-11-19)** | bareKey **362 629** · JSON **22.57 MB** · gzip9 **3.43 MB** → **A 통과** (동형 word>10인 키 546) |

설계 근거: 로컬 조회로 원고에서 나온 단어가 `/api/stdict`로 나가지 않게 한다. (프록시 로그와 PRD 「원고 본문 서버 저장 금지」의 법적 동일 여부는 단정하지 않음.)

---

## 1. 조회 패턴 (현행 → 유지)

구현: `src/lib/unifyStdictPos.js`.

| 항목 | 내용 |
|------|------|
| 진입 | `fetchStdictExact(q)` — **로컬** `/data/stdict-pos-index.json` (API 미사용) |
| 키 | `hangulOnlyKey` (NFC, 비한글 제거). 붙임표/`^`는 조회 키에서 제거 |
| 용언 | `lemmaCandidatesForConjugation` 후 사전형 우선, 실패 시 원형 |
| 판정 | `verdictFromStdictHits` — 동사·형용사·보조 / 명사·대명사·수사·의존명사 → noun · predicate · mixed · missing |
| UI | 용언이면 목록 이동(A). 삭제 없음 |

로컬 교체 지점은 **`fetchStdictExact`와 색인 로더**뿐. `enqueueStdictPosTargets` · `buildStdictQueryList` · `verdictFromStdictHits` · 목록 이동 로직은 그대로.

---

## 2. 합의 결정 (스펙 전제)

### 2.1 API 폴백 — 없음

`VITE_UNIFY_STDICT=true`이고 로컬 경로가 켜지면:

- 색인에 키 없음 → hits `[]` → `missing` (자리 유지, 기존과 동일 취급)
- 색인 로드 실패 → API로 되돌리지 않음. 2차를 건너뛰거나 전부 `missing`으로 두고, DEV에 로드 실패를 드러냄

제품 런타임에 `/api/stdict`·`STDICT_API_KEY` 의존을 남기지 않는다.  
**개발·측정 스크립트**에서 API와 이중 조회해 비교하는 것은 허용 (런타임 폴백 아님).

### 2.2 결과 건수 상한 — 로컬 전량

| | API (`api/stdict.js`) | 로컬 색인 |
|--|----------------------|-----------|
| 상한 | upstream `num=10` (item) | **상한 없음** — bareKey의 품사 전부 |
| 의도 | 업스트림 제한 | API 잘림으로 숨겨지던 혼재·품사를 드러낼 수 있음 |

검증:

- (a) 동형·다품사 item ≤ 10인 키: API verdict와 일치해야 함  
- (b) item > 10인 키: 로컬이 더 풍부할 수 있음 → 개선으로 문서화 (`compare-hyphen-homograph-truncation.mjs`와 같은 문제 의식)

완전 API 패리티가 나중에 필요하면 **조회 시 item 10 절단 옵션**(기본 off)만 추가. 색인 자체는 전량 보관.

### 2.3 원천 데이터

- 디렉터리: `전체 내려받기_표준국어대사전_JSON_20261106` (로컬 dic, 레포 밖)
- 내려받기일: **2026-11-06** (`stdict-verb-forms` meta와 맞춤)
- 산출 meta 필수: `source`, `downloaded`, `license`, `licenseUrl`, `generatedAt`, `entryCount`(또는 bareKey 수)
- StarDict 참고 규모: `wordcount≈362836` (표시용 `stdict-full`, 색인과 역할 분리)

### 2.4 파일 형식

- 배포: `public/data/stdict-pos-index.json` (평문 JSON)
- 출처: `public/data/stdict-pos-index.md` (`stdict-verb-forms.md`와 같은 표기)
- **`.json.gz`를 저장소에 두지 않음.** Vercel 등 정적 호스팅의 gzip/brotli에 맡김
- 런타임: `fetch` + `JSON.parse` (기존 verb-forms 로더 패턴)

### 2.5 메모리 · A/B 게이트 — **A 확정**

실측 (`scripts/build-stdict-pos-index.py --sample`, 2026-11-19):

| 지표 | 값 |
|------|-----|
| item | 436 588 |
| bareKey | 362 629 |
| hit | 439 516 |
| JSON | 22.57 MB |
| gzip9 | **3.43 MB** (게이트 12MB **통과**) |
| word>10 동형 키 | 546 |

→ **A 단일 파일**. B·콤팩트 포맷은 보류. 플래그 on 시 1회 로드·모듈 캐시.

### 2.6 freeze · 플래그

- `ruleEngine` / 맞춤법 regex **변경 금지** (베타 freeze)
- 플래그: 기존 `VITE_UNIFY_STDICT` (기본 off)
- 변경 파일 후보: `unifyStdictPos.js`(조회부), 신규 로더(예: `stdictPosIndex.js`), 빌드 스크립트, `public/data/stdict-pos-index.*`, 테스트
- `api/stdict.js`는 당장 삭제하지 않아도 됨(측정·하위 호환). 제품 경로에서는 호출하지 않음

---

## 3. 색인 스키마 (초안)

논리 모델:

```text
bareKey → [ { word, pos }, … ]
```

- `bareKey`: 조회 키와 동일 규칙 (`hangulOnlyKey` / 붙임표·어깨번호 제거와 빌드 시 일치)
- `word`: 표시용 표제어(붙임표·`^` 유지 가능). `headwords` 경로와 맞출지 빌드 시 확정
- `pos`: 표준국어대사전 품사 문자열 (판정 정규식과 동일하게 쓸 수 있는 값)
- 동형·다품사: 배열에 모두. 빌드 시 word|pos 중복 제거

직렬화는 단일 JSON 객체 또는 `{ meta, index }` 형태.  
verb-forms처럼 lazy `fetch('/data/stdict-pos-index.json')` + 메모리 캐시.

---

## 4. 빌드

- 입력: 표준국어대사전 JSON 전체 (레포 밖 경로 인자)
- 출력: `public/data/stdict-pos-index.json` + md 출처(스크립트가 md 라이선스 문단을 덮어쓰지 않거나, verb-forms와 동일 정책)
- GoldenDict/`stdict-full` 재빌드와 **독립**. 품사 맵만 갱신
- 샘플 → 허락 → 전체: 표제어 1~2개(및 동형 다수 키 1개) 미리보기 후 전량 1회

---

## 5. 검증 계획

1. **단위:** `parse`/`verdict` 불변 테스트 유지. 로더·exact 목으로 noun/predicate/mixed/missing
2. **표본 대조:** 동일 q에 대해 구 API hits vs 로컬 hits  
   - ≤10 item: verdict 일치  
   - >10 item: 차이 목록화(기대)
3. **용량:** 산출 바이트·gzip 추정 → A/B 게이트 기록
4. **플래그 off:** 기존과 동일(2차 미호출)
5. **플래그 on·색인 없음/실패:** API 호출 0회

---

## 6. 라이선스

- **정본 고지:** `public/data/STDICT-NOTICE.md` (도움말 `reference/stdict-license`)
- 출처: 국립국어원 표준국어대사전 · 가공·배포: 인디야  
- 라이선스: [CC BY-SA 2.0 KR](https://creativecommons.org/licenses/by-sa/2.0/kr/)  
- 추출본 md·README·로컬 `stdict-full`은 정본을 가리키거나 동일 문구 사용  
- 공개 정적 호스팅 의무의 세부는 약관 원문으로 재확인 (이 문서에서 법적 결론을 단정하지 않음)

---

## 7. 역할 분리

| 자산 | 역할 |
|------|------|
| `stdict-pos-index.json` | 앱 품사 exact (이 스펙) |
| `stdict-verb-forms.json` | 용언 활용·붙임표 게이트 등 (기존) |
| `stdict-full` (StarDict) | 사람용 GoldenDict 조회 |
| `/api/stdict` | 로컬 전환 후 제품 경로에서 미사용 (측정용 잔존 가능) |

---

## 8. 구현 순서 (합의 후)

1. ~~표본 빌드 → **A 확정**~~ ✅
2. ~~로더 + `fetchStdictExact` 로컬~~ ✅ (`stdictPosIndex.js`, `unifyStdictPos.js`)
3. ~~단위·표본 스모크~~ ✅ (동형 `가교`/`사` 전량)
4. ~~전량 색인 + md~~ ✅ (`public/data/stdict-pos-index.json` · `.md`)
5. B 샤드 — **불필요(A 확정)**
6. (선택) 구 API와 표본 verdict 대조 스크립트 — 측정용, 제품 경로 아님

---

## 9. 비범위

- 뜻풀이·예문·문법 정보 앱 노출
- 우리말샘·기타 사전 병합
- `ruleEngine` / MainScreen props / 규칙 시트
- 모바일 전용 최적화 (필요 시 별도)
- API 라우트 즉시 삭제
)
