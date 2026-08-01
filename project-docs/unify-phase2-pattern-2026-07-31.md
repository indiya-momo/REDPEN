# 표기 통일 추천 — 1차 / 2차 순차 플로우 (pattern 확장)

**상태:** 1차 플로우 구현됨 · **추천 엔진(Score/Explain/Preview)은 미구현 — 아래 §4 로드맵**  
**날짜:** 2026-07-31  
**개정:** 2026-08-01 — Discover는 유지, 패턴 단계를 추천 엔진으로 보강하는 우선순위 합의  
**관련:** `unify-pattern-rule-session-2026-07-31.md` (초기 세션 confirm 안 — **본 문서로 대체**)

## 의도 (한 줄)

1차는 검수권으로 산 **본작업**이라 목록 완결을 유도하고, 2차는 확정 정책을 **편측(접두·접미)까지 확장**하는 **부가 단계**라 미선택·중도 종료를 허용한다.  
Discover(발견)는 이미 성숙했고, 다음 체감 개선은 **Score → Explain(메타) → Preview**로 “왜 추천하는지 / 적용하면 무엇이 바뀌는지”를 보여주는 것이다.

---

## §1 — 사용자 플로우

1. **찾기 결과 진입**  
   안내: 「1차 표기 통일을 완료하면 2차 표기 통일이 진행됩니다」  
   (기존 「표준국어대사전 검토 결과」자리. DEV 사전 상세는 접혀 아래로 둘 수 있음.)

2. **1차**  
   붙임/띄움·계열 일괄로 보이는 목록의 **모든 키**를 채운다.  
   → 팝업 「2차 표기 통일을 진행합니다」  
   - **네** → 2차-A (패턴 선택)  
   - **아니오** → 1차 유지 + 패널에 「2차 표기 통일」버튼 (언제든 2차-A 재진입)

3. **2차**  
   1차 확정에서 뽑은 접두·접미 패턴을 바로 **1차와 같은 계열 UI**로 보여 준다.  
   항목마다 붙임/띄움 선택. **안 고른 것 = 예외**.  
   2차 목록 키를 **모두** 고르면 팝업 「2차 표기 통일을 완료하시겠습니까?」→ **예**로 종료.  
   「완료」「2차 표기 통일」버튼·DEV 사전 상세 UI는 두지 않음.

5. **리스트 품질**  
   공통 항목 원시 매치 ≠ 최종 목록.  
   최종 후보는 1차와 **같은 정규화·제외 파이프**를 통과한다.

**UI 구조:** 같은 추천 패널에서 `phase`만 전환 (`primary` → `pattern_pick` → `secondary_pairs`).  
매 1차 선택 직후 patternRule confirm·인라인 미리보기 구역은 **본 플로우로 대체**.  
※ 현재 구현은 2차 진입 시 패턴을 **전부 자동 선택**하고 `secondary_pairs`로 바로 갈 수 있다. §4 Preview/Explain이 붙으면 2차-A(또는 동등 UI)에서 이유·영향 범위를 보여 주는 쪽으로 보강한다.

---

## §2 — 데이터·필터·정규화

### 세션 상태

| 필드 | 설명 |
|------|------|
| `phase` | `primary` \| `pattern_pick` \| `secondary_pairs` |
| `registeredVariants` | 1·2차 공통 — key → 선택 표기 |
| `patternCandidates` | 2차-A용 패턴 목록 (건수·예시 포함) |
| `selectedPatternIds` | 2차-A에서 체크한 패턴 |
| `secondaryClusters` | 2차-B용 쌍(클러스터) 목록 |

### 1차 완료 트리거

- **분모:** 현재 화면에 보이는 목록의 cluster key (계열 일괄로 채운 키 포함).
- **숨김·제외 키는 분모에 넣지 않음.**
- 모든 분모 key에 `registeredVariants`가 있으면 팝업.

### 패턴 후보 생성 (2차-A)

1차 확정 `(key, chosenVariant)`마다:

- **접미:** template `@affix`, direction(`glued` \| `spaced`), `confirmedFrom`
- **접두:** template `head@`, direction, `confirmedFrom`

동일 `template` + `direction`은 하나로 합친다. `confirmedFrom`은 대표 1개.

### 매칭 → 최종 mismatch (건수·예시·2차-B)

1. 공통 항목(`phrase-slot`) 엔진으로 원시 매치.
2. **공유 정규화·제외 (복제 금지)** — `unifyCandidateDiscover` 등 1차와 같은 export 호출:  
   `stripUnifyPunctuationNoise`, `isExcludedUnifyCandidateRaw`, 조사 끼임/맨조사 제외, `unifySpacingKey` 등.
3. **접미만** `PATTERN_RULE_HEAD_BLACKLIST` 및 head 음절 수 가드 (관형·수식 앞말 제외).  
   **접두(`미국@`)의 변수(tail):** 별도 TAIL 블랙리스트는 두지 않음. 조사 끼임·맨조사·기호 등은 **공유 정규화(2번)로 커버**한다고 본다.  
   베타 후 “조사가 아닌데 의미상 안 붙어야 하는 tail”이 보이면 대칭 가드를 추가한다.  
   **§4 P1:** 2음절 미만을 무조건 탈락시키지 말고, 증거가 충분하면 허용(아래 로드맵).
4. 이미 1차에서 같은 key·같은 방향으로 확정된 항목 제외.
5. 그 결과로 **건수·예시·2차-B 카드**를 만든다.  
   → 블랙리스트에 걸린 것은 2차-A 숫자·예시에도 **포함하지 않음**.

### 블랙리스트 ↔ 미리보기 매핑

| 합의 | 위치 |
|------|------|
| 블랙리스트 (접미 head) | 매칭 후 후보 생성 시 제거 → 2차-B에 안 나옴, 2차-A N건에도 미반영 |
| 미리보기 | **2차-B 쌍 카드** = 사람이 오탐·예외를 고르는 마지막 방어선 · **§4 P0**에서 패턴 단위 영향 범위 Preview도 연결 |

### 접두·접미 이중 key

같은 key가 접두·접미에 동시에 걸리면 **등록은 key당 한 번**.  
우선순위: **접미 확정 > 접두** — **결정론적 기본값**(논의 출발점이 접미 `@정부`였고, 한·영 복합에서 뒷말이 핵인 경우가 많다는 약한 직관).  
측정된 오탐률 근거는 아님. **베타 이후 데이터로 재검토 가능.** 이후 사용자 선택이 덮어씀.  
**§4 P2:** 장기적으로는 한쪽을 버리기보다 Pattern Tree / 다중 계열 병존을 검토.

### seriesTendencyHint

층 C 힌트와 `patternRule` / 2차 데이터·함수를 **섞지 않음**.

---

## §3 — UI 디테일

### 진입 안내

- 문구: 「1차 표기 통일을 완료하면 2차 표기 통일이 진행됩니다」
- 2차 배너: 「2차 표기 통일 — 청자@(붙여쓰기) · 백자@(띄어쓰기)」처럼 **1차 확정 조건형**을 나열
- DEV 「표준국어대사전 검토 결과」상세는 접힌 채 하단에 둘 수 있음.

### 팝업

- 「2차 표기 통일을 진행합니다」— 네 / 아니오  
- 아니오: 「2차 표기 통일」버튼 유지.

### 2차-A (패턴 선택)

- **시각 구분:** 「뒷말 계열」(접미) / 「앞말 계열」(접두) 그룹 헤더.
- 행: 체크 + 템플릿(`@정부` / `미국@`) + **N건** + **예: …, …**
- 「다음」: 1개 이상 체크 시. 「취소」: `primary` + 2차 버튼.
- **§4:** 행에 score·추천 이유(`support` 메타)·적용 Preview 요약을 붙이는 방향.

### 2차-B (쌍 목록)

- 1차와 동일한 variant 카드 UI. 패턴별 소제목 가능.
- 선택 → `registeredVariants` + PDF 미리보기. **미선택 = 예외.**
- 「완료」/「닫기」— 강제 항목별 완료 없음.
- PDF는 2차-B에 올라온(또는 이미 고른) 틀린 표기 기준.

### 폐기·이전 구현

- 1차 variant 확정 **직후** patternRule confirm + 패널 하단 인라인 mismatch 미리보기 → **본 플로우로 대체**.
- `unifyPatternRule.js` 유틸(블랙리스트, 접미 draft, phrase-slot 매칭 등)은 **재사용·접두/정규화 연동으로 확장**.

---

## §4 — 추천 엔진 로드맵 (2026-08-01 합의)

### 진단

| 강함 | 약함 |
|------|------|
| 1차 Discover / 2차 pattern 단계 분리 | 후보가 `mismatchCount` 중심 → **추천**이라기보다 **규칙 확장** |
| `collectPatternRulesFromRegistrations` → `collectPatternRuleCandidates` → `buildSecondaryGroupsFromCandidates` | head 다양성·발생 하한·score·Explain 메타 없음 |
| Discover 테스트 촘촘함 | Pattern/score 회귀·패턴 Preview UI 연결 부족 |

목표 파이프라인 (기존 구조에 무리 없이 얹음):

```
Discover → Normalize → Candidate → Score → Rank → Explain → Preview
```

현재는 Candidate까지에 가깝다. 다음 보강 축은 **Score · Explain 데이터 · Preview**.

### P0 — 체감 최대 (먼저)

순서:

```
증거 하한 → Score → Rank → Reason(Explain 데이터) → Preview
```

| 항목 | 합의 |
|------|------|
| **증거 하한** | head(고유 앞말/계열) 수·전체 occurrence에 문턱. 예: 베타 초안 `uniqueHeads ≥ 2` AND `occurrence ≥ 3` (상수로 분리; 리뷰 제안 3/5는 원고 길이에 따라 조정). `경제성장`/`경제 성장` 한 쌍만으로 `@성장`을 만들지 않음. |
| **Score** | `≈ occurrence + w1·uniqueHeads − w2·exceptions` (식은 상수·테스트로 고정). `mismatchCount`만으로 정렬하지 않음. |
| **Rank** | score 내림차순. |
| **Explain 데이터** | UI 문자열이 아니라 **Rule/후보 메타**. 예: `support: { occurrenceCount, uniqueHeads, examples[] }`. UI는 이걸로 「27회 · 8개 계열 · 예: 경제성장…」을 조립. |
| **Preview** | **반드시 P0.** 출판 편집자는 “추천”보다 “적용하면 어디가 바뀌는가”를 본다. 기존 `buildPatternRulePreviewGroups`(또는 동등)를 **호출·노출** — ROI 큼. |

### P0.5 — Reason ID (메타 안정화 후)

추천 이유를 하드코딩 문장이 아니라 **코드**로 관리.

| ID 예 | 의미 |
|-------|------|
| R101 | 빈도 우세 |
| R102 | 다양한 head 확인 |
| R103 | 사용자 등록 기반 |
| R104 | 예외 없음 |

Rule 예: `{ score, support, reasons: ['R101','R102','R104'] }`  
P0에서는 `support` 숫자로 UI를 조립하고, 카피·점수식이 안정된 뒤 Reason ID를 도입하면 점수식을 바꿔도 UI를 덜 건드린다.

### P1 — 회귀·가드 완화

| 항목 | 합의 |
|------|------|
| **Pattern 회귀 테스트** | 다 head → `@성장` 생성; prefix/suffix 충돌; 조사 strip; secondary → preview → replace 통합 |
| **Score 회귀 테스트** | fixture 입력 → **상대 순위·허용 대역**(절대 90 고정만 고집하지 않음). 점수 드리프트 = 품질 회귀 |
| **1음절 = 증거 기반 허용** | `hangulSyllableCount < 2` → 무조건 `false`가 아니라, short이면 `support ≥ threshold`일 때만 통과. 블랙리스트는 관형·지시 등 **거의 항상 틀린 것**만 유지 |

### P2 — 만족도·구조

| 항목 | 합의 | 순서 |
|------|------|------|
| **Always Ignore** | 「이건 추천하지 마」→ 프로젝트에 저장, 다음 검수에서 제외. **미선택(이번 목록 예외)** 과 구분. 출판은 정확도보다 **같은 오탐이 다시 안 나오는 경험**을 높게 평가 | Pattern Tree보다 **먼저** |
| **Pattern Tree / 다중 계열** | `AI@`와 `@센터`처럼 서로 다른 계열을 하나만 버리지 않고 병존·트리로 제시 | Always Ignore 다음 |

### 구현 시 건드릴 곳 (예정)

- `src/lib/unifyPatternRule.js` — 하한, score, `support` 메타, (이후) reasons
- `src/components/consistency/UnifyCandidateFindPanel.jsx` — Explain·Preview UI 연결
- `src/lib/unifyPatternRule.test.js` — pattern + score 회귀
- Discover(`unifyCandidateDiscover.js`)는 **원료 공장으로 유지**, 불필요한 대규모 개편 없음

---

## 합의 요약 (체크리스트)

### 플로우 (기존)

- [x] 결과 진입 안내 문구 (1차 완료 → 2차)
- [x] 1차 완료 = 보이는 키 전부 등록 (계열 일괄 포함, 숨김 제외)
- [x] 팝업 후 아니오 → 「2차 표기 통일」버튼
- [x] 2차-A: 패턴 일괄 선택 → 「다음」→ 2차-B
- [x] 2차-A: 건수 + 예시 1~2개
- [x] 2차-A: 접두/접미 시각 분리
- [x] 2차-B: 1차와 같은 카드, 미선택 = 예외, 강제 완료 없음
- [x] 블랙리스트 = 후보 생성 시 / 미리보기 = 2차-B
- [x] 정규화 = 1차 공유 함수 재사용 (복제 금지)
- [x] 이중 key: 접미 > 접두
- [x] 1차 완결 유도 / 2차 느슨 — 의도적

### 추천 엔진 (§4)

- [ ] P0: 증거 하한
- [ ] P0: Score + Rank
- [ ] P0: `support` 메타 (Explain 데이터)
- [ ] P0: 패턴 Preview UI 연결
- [ ] P0.5: Reason ID
- [ ] P1: Pattern·Score 회귀 테스트
- [ ] P1: 1음절 증거 기반 허용
- [ ] P2: Always Ignore → Pattern Tree

## 구현 시 주요 파일

- `src/lib/unifyPatternRule.js` — 확장 (접두, 공유 필터, 건수·예시 · §4 score/support)
- `src/components/consistency/UnifyCandidateFindPanel.jsx` — phase UI · Preview/Explain
- `src/components/consistency/UnifySecondaryReviewPanel.jsx` — 안내 문구 교체(또는 상단 배너)
- `src/styles/main-screen.css`
- 테스트: `unifyPatternRule.test.js` 등
