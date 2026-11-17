# 구현 플랜 — 본조 non-aeo 띄어쓰기 필수

**스펙:** [2026-11-18-bonbojo-non-aeo-space-design.md](../specs/2026-11-18-bonbojo-non-aeo-space-design.md)  
**날짜:** 2026-11-18  
**상태:** Step 1–3·말다 시드·제47항 방어 목록·픽스처 후보 검증 완료. 실제 PDF 스모크는 사용자 허락 후.  
**제약:** 1차 `ruleEngine`/stem 찾기 비용 불변 · beta freeze(regex 맞춤법 엔진) 비침 · 다른 PDF는 허락 후에만

## 목표

`space-required-non-aeo` 줄을 **전용 게이트**로 분리하고, 켠 보조용언 꼬리의 **닫힌 비아/어 연결어미 + 붙임** 표면만 2차로 모아 사전 미등재면 띄어쓰기 필수로 올린다.

## 아키텍처 (한 줄)

```text
게이트 item on
  → 켠 보조 꼬리로 page.text 붙임 스캔 (어절 경계)
  → 직전 ∈ 닫힌 연결어미 ∩ ∉ 아/어·축약
  → dict solid? 합성어 : 띄움 필수 그룹에 merge
```

배선은 기존과 같이 `enrichAuxiliaryGluedFromSpaced` → `enrichAuxiliaryDictSolid` **직후**에 thin pass 하나.

## Step 0 — 구현 전 상수·규정 (코드 전)

1. **닫힌 연결어미 초안** (음절 단위, 붙여쓰기 직전):  
   `지`, `게`, `고`, `도록`(2음절은 직전 슬라이스), 필요 시 `진`/`질` 등 활용은 **1차 릴리스에 넣지 않거나** 최소만.  
   → `NON_AEO_CONNECTIVE_ENDINGS` 상수로 고정 (플랜 Step 2).
2. **제47항 계열 제외** (`ㄴ듯하`/`ㄹ만하` 등): 국어원 페이지 확인 후 `NON_AEO_ALLOW_GLUE_SURFACES` 또는 앞조각 제외 목록. 미확인이면 **빈 목록 + TODO 주석**, 음성 테스트는 skip/예정.
3. **아/어·축약 집합:** 시트 stem 공백 앞토큰 유니온 + 명시 보완 `해|봐|줘|와|워|써|켜|펴|…` (시트에 이미 있는 것 중복 OK).
4. (선택) 사용자 허락 받은 PDF 1건으로, 켠 꼬리 기준 **어미 필터 전/후 후보 수** 로그 — 오탐 가늠. 허락 없으면 픽스처 문자열만.

## Step 1 — 전용 게이트 itemId (UI·저장)

**파일:** `src/lib/bonBojoRules.js`, `src/lib/auxiliaryVerbRegister.js`, `src/lib/auxiliaryVerbBundles.test.js`, 필요 시 `defaultAuxiliaryVerbs.js` / JSON

1. 상수 추가:  
   `BON_BOJO_NON_AEO_SPACE_ID = 'verb-non-aeo-space'`  
   (logic-only에 가깝게: **1차 find 규칙 생성 안 함** 또는 enabled 플래그만 있는 더미 rule).
2. `listBonBojoBundleDefinitions`:  
   - `SPACE_REQUIRED_NON_AEO`의 `itemIds` = `[BON_BOJO_NON_AEO_SPACE_ID]`만.  
   - **삭제:** SPACE_REQUIRED와 item 공유하는 `set(...)` 블록.
3. `bonBojoUiGroupForItemId`: 해당 id → `SPACE_REQUIRED_NON_AEO`.
4. **기본 off:** 새 프로젝트·시드에서 게이트 disabled.
5. **마이그레이션:** 예전에 non-aeo 줄이 long-compound와 같이 켜져 있던 저장본이 있어도, 게이트 id가 없으면 **off로 두고** long-compound enabled는 유지. (갑자기 non-aeo 스캔이 켜지지 않게.)
6. 테스트: 번들 정의 분리 · toggle non-aeo ≠ toggle 3음절 · 기본 off.

## Step 2 — 2차 모듈 (순수 로직)

**새 파일 (가칭):**  
`src/lib/auxiliaryNonAeoSpace.js`  
`src/lib/auxiliaryNonAeoSpace.test.js`

### 2a. 판정 helpers (동기, 테스트 먼저)

| 함수 | 역할 |
|------|------|
| `listAeoConnectiveFrontsFromSheet()` | 시트 stem → 아/어·축약 앞조각 Set |
| `isNonAeoConnectiveBefore(text, tailStart)` | `tailStart` 직전이 닫힌 어미인가 (도록 등 긴 것 우선) |
| `isAeoFrontBefore(text, tailStart)` | 직전이 아/어·축약 집합인가 |
| `isWordBoundedTail(text, start, end)` | 짧은 꼬리 부분일치 방지 (한글/영숫자 경계) |

### 2b. 후보 수집

```text
enrichAuxiliaryNonAeoSpace(groups, pageTexts, { rules, globalExcludePhrases })
```

1. 게이트 rule/item **off** → groups 그대로 반환.
2. `rules`에서 `patternKind === 'auxiliary-verb' && enabled` 이고 게이트·long-compound·logic-only **아닌** item의 꼬리 집합  
   (`auxiliarySearchTailsFromBonBojoItem` / 동일 facade — **활용 표면이 꼬리에 없으면** 말다 계열 등 시트 stems의 말·말ㄹ 조각만 우선; 부족분은 Step 5).
3. 각 `page.text`에서 꼬리 문자열 검색 → 붙여 쓴 문맥(꼬리 앞에 공백 없음) · 어절 경계 · 닫힌 어미 · not 아/어.
4. 전역 제외·기존 matchFilters와 맞출 수 있으면 재사용.
5. 인스턴스 초안: `matchedText` = 연결어미+꼬리 또는 합의된 하이라이트 스팬, `suggestedText` = 띄운 형태 (`지 말라`), `bonBojoItemId`, 안정 `find` 키.

### 2c. 사전

- 후보에 대해 기존 `auxiliaryDictSolid` 판정 facade 재사용 (가능하면 enrich 안에서 호출하거나, dict enrich **이후**에 non-aeo를 돌리지 말고 **non-aeo가 만든 띄움 제안 인스턴스에 solid 플래그**를 같은 세션 캐시로 붙임).
- 등재 → 필수 띄움 그룹에 넣지 않음 / 합성어 표시만 (스펙 A).
- `말라→말다` 기본형: dict 모듈 기존 lemma 경로와 **동일 facade** — 위임 실패 시 테스트로 드러나게.

### 2d. 그룹 merge

- `patternKind: 'auxiliary-verb'`, 구분 가능한 `bonBojoItemId` 또는 `auxNonAeo: true`.
- **안정 그룹 키:** `caution:` 식과 같이 `auxiliary:non-aeo:${itemId}` 또는 find 고정 문자열 — 재실행 시 수락/무시 유지.
- displayLabel: 기존 본조 관례 + 「띄어쓰기 필수」 뉘앙스 (최소 문구).

## Step 3 — useRuleCheck 배선

**파일:** `src/hooks/useRuleCheck.js` (두 곳: 전체 검사 ~372, subset ~590)

```text
enrichAuxiliaryDictSolid(
  enrichAuxiliaryGluedFromSpaced(...),
)
→ enrichAuxiliaryNonAeoSpace(..., { rules, pageTexts, globalExcludePhrases })
```

또는 dict를 non-aeo 후보에도 적용하려면:

```text
glued → nonAeo(미등재·등재 미판정 인스턴스 포함) → dictSolid
```

**권장:** `glued → nonAeo(표면만) → dictSolid` 한 줄로 합성어 표시까지 통일.  
1차 비용 변화 없음(동기 스캔은 2차; stdict는 기존 dict와 캐시 공유).

게이트 off / 보조 꼬리 0개면 no-op.

## Step 4 — UI·집계 회귀

**파일:** `AuxiliaryVerbBundleChecklist.jsx`, `consistencyCheckConfirm*`, `auxiliaryVerbBundles.test.js`

- non-aeo 줄 단독 체크 동작.
- 결과 요약·원고/검사 띄움 숫자에 non-aeo 필수 띄움이 **본조 패널**에만 잡히는지 (표기통일 비연동 유지).
- CSS/카피 최소 — 새 탭 없음.

## Step 5 — 꼬리·말다 활용 구멍

시트의 `말다` item이 없으면:  
- 첫 릴리스는 **켜진 item 꼬리만** (말다 미등록이면 뛰지말라 미검출 — 스펙상 OK).  
- 필요 시 별도 이슈로 시트에 말다 item 추가 (1차 stem이 아니라 **꼬리 목록**만).  
플랜에 “말다 시드 여부”를 구현 직전 한 줄로 확인.

## Step 6 — 테스트 매트릭스

| 구분 | 사례 | 기대 |
|------|------|------|
| 양성 | `뛰지말라` + 말다(또는 해당 꼬리) on + 게이트 on + 미등재 | 띄움 필수 |
| 합성어 | 등재 붙임 표면 | 필수 띄움 아님 |
| 음성 | `공부하다` | 없음 |
| 음성 | 의존명사+하다 (목록 확정 후) | 없음 |
| 음성 | `해봐`/`줘봐` | non-aeo 오탐 없음 |
| 사각 | 아/어 제외 표면 | 기존 glued/1차 경로 또는 의도적 비대상 |
| 게이트 | 게이트 off | 후보 0 |
| 꼬리 | 해당 보조 off | 후보 0 |
| 1차 | 동일 fixtures | glued/dict 전후 1차 건수 동일 |

## Step 7 — 완료 판정

- [ ] 스펙 성공 기준(양·음) 테스트 통과  
- [ ] non-aeo ↔ 3음절 번들 item 분리 · 기본 off · 마이그레이션  
- [ ] useRuleCheck 두 경로 배선  
- [ ] 1차 비용/건수 불변  
- [ ] 커밋은 사용자 요청 시에만  

## 구현 순서 (권장)

1. Step 1 게이트 분리 (UI 안전)  
2. Step 2 helpers + 테스트  
3. Step 2 enrich + Step 3 배선  
4. Step 4·6 회귀  
5. Step 0 규정 목록·(허락 시) 원고 스모크  

## 하지 않음

- 1차 stem/`ruleEngine` 변경  
- 연결어미 전면 개방  
- Kiwi 아/어 판정  
- PDF 교정본 정렬  
- 표기통일 시드/배지  
`}