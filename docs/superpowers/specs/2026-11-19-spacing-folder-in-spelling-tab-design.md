# 맞춤법 탭 「띄어쓰기」 폴더 — 세종 띄어쓰기 모듈 편입

**날짜:** 2026-11-19  
**상태:** 설계 확정 (승인)  
**관련:** `VITE_SPACING_CATEGORY`, `isSpacingCategoryEnabled()`, `src/lib/spacingCategoryRegistry.js`, `src/components/SpacingCategoryPanel.jsx`

## 문제

세종 띄어쓰기 모듈(수·단위, 의존명사·-ㄹ까 보다, 지명·접미)은 `ruleEngine`·맞춤법 시트 밖 코드로 이미 존재한다.  
지금은 실험용 `SpacingCategoryPanel`(별도 탭 진입)에만 연결되어 있어, 「기준 검수」 흐름·프로젝트 저장·결과 목록과 한 줄로 이어지지 않는다.

## 합의된 목표

1. 맞춤법 탭에 **폴더 하나 「띄어쓰기」** + **하위 검사 3개**를 둔다.
2. 켠 항목은 **「기준 검수」**에 포함되어, 맞춤법 검수 한 번에 모듈도 돈다.
3. 시트 규칙 행을 추가하지 **않는다**.
4. 본조 전용 탭 분리는 **나중** — 이번 범위에서 세 번째 탭을 띄우지 않는다.
5. 플래그가 꺼지면 **UI와 실행 경로 모두**에서 모듈이 돌지 않는다. 두 경로는 같은 헬퍼 `isSpacingCategoryEnabled()`만 본다.

## 비목표 (이번 범위 밖)

- `ruleEngine` / 맞춤법·caution 시트 행 추가·정규식 변경
- **시트 행으로 모듈 승격**
- **모듈별(개별 detector) 토글** — 묶음 단위 on/off만
- **용언 경계 폴더** (명사+용언 등 별도 폴더 UI)
- **보조용언 일반** 모듈(`official-aux`) 편입 — 본조 탭·나중 범위
- **caution이 모듈을 이기는** 겹침 규칙 (이번은 caution과 겹쳐도 모듈 유지)
- **Punctuation(S6)** 계열
- 「한 번」「다음 날」 등 이미 caution/시트에 있는 유형 재구현
- `SpacingCategoryPanel`을 미사용으로 남기기 (이번은 **제거**)
- 클라우드/서버 측 검수

---

## 1. UI · 폴더 · 문구

### 위치

- **맞춤법** 탭 안, 기존 built-in / caution 폴더와 같은 아코디언 계열.
- 폴더 제목: **「띄어쓰기」** (고정).
- 폴더 안 안내(한 줄): **앱 내장 검사 · 시트 규칙과 별개 · 일부 유형만**.

### 묶음 → 모듈 매핑 (단일 정의)

- **정의 위치 (한 곳):** `src/lib/spacingFolderBundles.js` (신규).  
  UI 폴더·툴팁·`runCheckScope('spelling')` 실행 **모두 이 파일만** import한다. 표·툴팁을 컴포넌트에 복제하지 않는다.
- 배열 순서 = **모듈 간 겹침 순차 순서** (묶음 간 · 묶음 안 모두). 시트·loanword 필터와의 선후는 §3.

| `bundleId` (저장 키) | UI 라벨 | `moduleIds` (이 순서) |
|----------------------|---------|------------------------|
| `numberUnit` | **수·단위** | `numeral` → `man-eok-jo` → `digit-unit` |
| `dependentRieulKka` | **의존명사·-ㄹ까 보다** | `adnominal-dep` → `n-ji` → `n-ba` → `rieul-kka` |
| `placeAffix` | **지명·접미** | `place-affix` |

**묶음 안 순서 (코드 확인):**

- 현행 표면만 보면 `adnominal-dep`는 수·걸까·거·것, `n-ji`/`n-ba`는 지·바 전용이라 **같은 구간을 잡을 가능성은 낮다.**
- 그래도 표면이 늘어나거나 부분 겹침이 생기면 표시 제목이 바뀌므로, **위 `moduleIds` 순서로 순차 제거**한다. 앞선 모듈 hit 유지 · 뒤쪽만 제거.
- 묶음 간 순서: `numberUnit` → `dependentRieulKka` → `placeAffix` (같은 순차 규칙).

**범위 경계 (묶음 2 · 확정):**

- **보조용언 일반은 제외**한다 (`official-aux`는 이 폴더·매핑에 넣지 않음).
- `rieul-kka`는 `rieulKkaBodaSpacing.js`의 **ROWS 닫힌 목록에 한함**.  
  현재 표면: `할까보다`, `갈까보다`, `볼까보다`, `줄까보다`, `올까보다`, `살까보다`, `될까보다`, `가는가보다`, `오려나보다`, `했나보다`, `인가보다`  
  (−ㄹ까 보다 · −나 보다 · −ㄴ가 보다 계열이 ROWS에 포함).  
  목록 밖 구문은 이 묶음 범위가 아니다. 일반 보조용언·용언 경계 검사가 아니다.
- **UI 라벨** 「의존명사·-ㄹ까 보다」는 **짧은 표시명**으로 유지한다. −나/−ㄴ가 보다 등 전체 범위는 툴팁·위 ROWS 문구로 보완한다 (체크줄 제목을 길게 바꾸지 않음).
- `noun-pred`(명사+용언)·용언 경계 폴더는 **이번 비목표**.

**묶음 2 툴팁** (`spacingFolderBundles`의 모듈 순서·라벨에서 생성 · 한 줄씩):

```text
관형사형+의존명사
-ㄴ지 기간
-ㄴ바
보다 구문 (rieul-kka ROWS 목록에 한함 · 보조용언 일반 제외)
```

- **키와 `bundleId`는 동일 문자열**이다. `spacing:{bundleId}`의 `bundleId` = 위 저장 키.
- 옛 초안에서 쓰던 다른 묶음 id는 **쓰지 않는다.** (확인은 `src/`만 — §4)

### 폴더 헤더 체크

- 헤더 체크는 **하위 3개의 파생 상태**다. **저장하지 않는다.**
  - 전부 켬 → checked  
  - 전부 끔 → unchecked  
  - 일부만 켬 → **indeterminate**
- 헤더 클릭: 전부 켬 ↔ 전부 끔 토글(구현 시 관례에 맞춤).

### 플래그 off 시 UI

- `isSpacingCategoryEnabled()`가 false이면 「띄어쓰기」 폴더를 **숨긴다.**
- UI 숨김만으로 끝내지 않는다 → **§3 실행 차단** 참고.

---

## 2. 저장 · 기본값 · 불러오기 · sync

### 저장 필드 · 층위

- 필드 이름: **`spacingFolderEnabled`** (확정).
- 값: `{ numberUnit: boolean, dependentRieulKka: boolean, placeAffix: boolean }`
- **층위:** `builtInEnabled` / `cautionEnabled`와 **같다** — **활성 기준 세트(active rule set)** 에 붙는다.

### 기본값

| 경우 | 기본 |
|------|------|
| **기존 세트** (필드 없음) | 세 키 모두 **끔** (`false`) |
| **새로 만드는 프로젝트·세트** | 세 키 모두 **끔** (`false`) |

### 「알 수 없는 키는 무시」

| 시점 | 동작 |
|------|------|
| **불러올 때** | 알 수 없는 키는 읽지 않음. 알려진 세 키만 적용. |
| **저장할 때** | 알려진 세 키만 씀. 플래그 off여도 알려진 키를 지우거나 `false`로 덮지 않음. |

(이후 버전이 키를 늘리면 구버전이 저장 시 새 키를 버릴 수 있음. 이번 범위의 의도된 단순화.)

### 시트 sync · 복제 · 내보내기/가져오기

| 경로 | `spacingFolderEnabled` |
|------|-------------------------|
| **맞춤법/caution 시트 sync** | **바꾸지 않는다.** 시트에서 오는 것은 규칙 행·`builtInEnabled` 키 보정 등이며, 띄어쓰기 묶음 on/off는 시트 대상이 아니다. |
| **세트 복제(다른 이름으로 저장 등)** | `builtInEnabled`처럼 **함께 복사**한다. |
| **공유 패키지·기준 내보내기/가져오기** | 세트 criteria에 **포함**한다. 없으면 §2 기본값. 알려진 키의 값이 **boolean이 아니면 `false`**로 둔다. |

### 마이그레이션

- `SpacingCategoryPanel` persist 키 없음 → 옮길 키 없음.
- 필드 없는 기존 세트 → 전부 끔.

---

## 3. 검수 파이프라인 · 결과 그룹 · 겹침 · 플래그

### 실행 위치

- 진입: `useRuleCheck.js`의 **`runCheckScope('spelling')`** (`runSpellingCheck`는 얇은 래퍼).
- 시트·built-in·caution·loanword 결과 산출 **이후**, `spacingFolderBundles`에서 **켠 묶음만**·**표의 moduleIds 순서**로 모듈을 돌리고 `spellingResults`에 병합한다.
- 세 묶음이 **모두 꺼져 있으면** 모듈 단계를 **호출하지 않는다.**

### 플래그 · 단일 헬퍼

- UI·실행 **모두** 현행 `isSpacingCategoryEnabled()` (`featureFlags.js`)만 본다.
- 수용 테스트는 **헬퍼 모킹**으로 on/off 검증 (`VITE_`는 빌드 시점 값).
- 헬퍼 false → 폴더 숨김 + 모듈 미호출.

### 조기 반환

현행: `spellingActiveRules.length === 0`이면 alert 후 return.

**개정:** 플래그 on + 묶음 하나라도 true이면 진행. 시트도 없고 묶음도 모두 꺼져 있을 때만 기존 alert.

### 결과 그룹 단위 (확정)

**모듈 단위로 나눈다.** (`category`는 묶음, 그룹·제목은 모듈)

| 필드 | 값 |
|------|-----|
| `category` | `spacing:{bundleId}` — 1단 칸·필터·집계·내보내기 구분용 |
| `moduleId` | 레지스트리 모듈 id (예: `adnominal-dep`) — **그룹과 instance 모두 필수** (하이라이트·내보내기가 instance만 받아도 모듈명을 얻도록) |
| `label` (그룹 제목) | 해당 **모듈**의 레지스트리 `label` |
| 출처 | 「띄어쓰기」 (폴더명 · 시트와 구분, 필수) |

- 같은 `category` 아래 **모듈이 다른 그룹이 여러 개** 있어도 된다. 한 그룹에 제목이 다른 모듈 hit를 섞지 않는다.
- 내보내기: `spacing:*` 누락 금지. 구분/출처에 「띄어쓰기」 또는 「띄어쓰기 · {묶음 UI 라벨}」. 모듈명은 기준/설명 열 등에 `label`로.

### `category` 소비처

| 소비처 | 파일/영역 | 기대 |
|--------|-----------|------|
| 결과 1단 분류 | `partitionSpellingResultEntries` | `spacing:*` → builtin 칸 |
| 결과 카드·톤·출처 | `CheckResultsPanel.jsx` | builtin 톤 + 띄어쓰기 출처 + **모듈 `label` 제목** |
| 하이라이트 | `useHighlights.js` | caution 아니면 일반 spelling |
| 검수 확인/집계 | `spellingCheckConfirm.js` 등 | spelling/builtin 집계에 포함 |
| 내보내기 | `exportResults.js` | 누락 없이 + 출처 반영 |
| 게스트/데모 | `guestBrowsePolicy.js` 등 | caution이 아닌 쪽으로 취급 |

**모르는 category → 조용히 버리기 금지.**

### 겹침 좌표계

- 기준: **`pageTexts`와 동일한 문자열**의 시작·끝 오프셋.
- 모듈 내부 정규화 시 비교 전 동일 좌표계로 환산.
- 공백·줄바꿈 페이지에서도 시트와 동일 기준 (§4).

### 시트 · loanword · caution · 모듈 간 겹침

**처리 순서 (확정):**

1. **시트·built-in·loanword 필터** — 이들과 부분 겹침인 모듈 hit를 먼저 제거한다.  
2. **남은 모듈 hit끼리** `spacingFolderBundles` 순서로 순차 제거 (앞선 hit 유지 · 겹치는 뒤쪽만 제거).

| 규칙 | 동작 |
|------|------|
| 모듈 ↔ **시트/built-in** | 부분 겹침 포함 · **시트 유지** · 모듈 조용히 제거 |
| 모듈 ↔ **loanword** | 시트와 **동일** · **loanword 유지** · 모듈 조용히 제거 |
| 모듈 ↔ **caution** | 겹쳐도 모듈 **유지** (위 1단계 필터 대상 아님) |
| 모듈 ↔ **다른 모듈** | 2단계 · 배열 순서 순차 · 앞선 hit 유지 |

**순서 예시:** 모듈 A가 시트와 겹치고, B가 A와만 겹치면 → 1단계에서 A 제거 → 2단계에서 B는 살아 있는 앞선 hit가 없으므로 **B 남음**.  
(모듈 간을 먼저 하면 B가 A에 지워진 뒤 A도 시트에 지워져 둘 다 사라지므로, 그 순서는 쓰지 않는다.)

순차 사슬(시트와 무관): A∩B, B∩C, A∩C=∅ → C **남음**.

### 기존 `SpacingCategoryPanel`

- **제거**. 플래그 on 시 맞춤법 탭 폴더만 진입점.

---

## 4. 수용 조건 (확인 기준)

1. **부분 겹침 제거:** 시트 hit와 일부만 겹쳐도 모듈 hit가 목록·하이라이트에 없음.
2. **caution과 겹칠 때 유지:** caution과 같은 구간이어도 켠 모듈 hit 남음.
3. **플래그 off (`isSpacingCategoryEnabled` 모킹 false):** 폴더 숨김 + 모듈 미실행.
4. **기본 끔:** 필드 없는 기존·신규 세트 모두 `false`.
5. **헤더 indeterminate:** 일부만 켜면 indeterminate. 헤더는 비저장.
6. **모듈만 켠 검수:** built-in/caution 꺼도 묶음만 켜면 alert에 안 막히고 모듈 결과 나옴.
7. **키 = bundleId:** 저장 키와 `spacing:{bundleId}` 일치. 옛 묶음 id 문자열 **`src/`에 없음.**
8. **패널 제거:** `SpacingCategoryPanel`·단독 탭 진입 없음.
9. **category·출처:** `spacing:*`가 builtin 칸·하이라이트·내보내기에 누락 없이 + 「띄어쓰기」 출처.
10. **플래그 토글 보존 (헬퍼 모킹):** off 동안 실행만 막고, 다시 on 해도 알려진 키 값 유지.
11. **모듈 간 사슬 겹침:** A∩B, B∩C, A∩C=∅이면 C 남음.
12. **좌표계:** 공백·줄바꿈 `pageTexts`에서 시트·모듈 오프셋 동일 기준.
13. **전부 끔:** 세 묶음 모두 off면 모듈 단계 미호출.
14. **알 수 없는 키:** 로드 시 무시, 저장 시 알려진 세 키만.
15. **loanword 겹침:** loanword hit와 겹치면 모듈 hit 제거 · loanword 유지.
16. **묶음 안 겹침·제목:** 묶음 2에서 모듈 hit가 겹치면 `moduleIds` 순서상 **앞선 하나만** 남고, 그 그룹 제목은 **남은 모듈의 레지스트리 `label`**. 그룹·instance에 `moduleId`가 있음. (현행 표면이 갈라져 실문장으로 재현이 어려우면 **합성 hit**로 검증.)
17. **시트 sync 비파괴:** 시트 sync 후에도 사용자가 켠 `spacingFolderEnabled`가 유지됨.
18. **복제·공유:** 세트 복제·내보내기/가져오기에 `spacingFolderEnabled`가 포함됨(없으면 기본 끔). 가져올 때 비-boolean 값은 `false`.
19. **필터 선후:** 모듈 A∩시트, B∩A만( B∩시트=∅ )이면 A만 제거되고 **B는 남음** (시트·loanword 필터 → 모듈 순차).

---

## 결정 요약

| 항목 | 결정 |
|------|------|
| 위치 | 맞춤법 탭 · 폴더 「띄어쓰기」 |
| 매핑 정의 | **`spacingFolderBundles.js` 한 곳** (UI·툴팁·실행 공유) |
| 결과 그룹 | **모듈 단위** · `category`=묶음 · 그룹·instance에 `moduleId` · 모듈 `label` |
| 겹침 순서 | **시트·loanword 필터 → 남은 모듈 순차** |
| loanword 겹침 | 시트와 동일 · loanword 승 · 모듈 드롭 |
| 시트 sync | `spacingFolderEnabled` **변경 안 함** |
| 복제·공유 | 필드 **포함** · 비-boolean → `false` |
| `rieul-kka` | ROWS 목록에 한함 · UI 라벨은 짧은 「의존명사·-ㄹ까 보다」유지 |
| 저장 | `spacingFolderEnabled` · active rule set |
| 플래그 | `isSpacingCategoryEnabled()` · UI + `runCheckScope('spelling')` |
| 구 패널 | **제거** |

## 열린 구현 세부 (코딩 중 정해도 됨)

- 폴더를 `dividerGroup` UI에 붙일지 전용 블록으로 둘지.
- 출처 UI 형태(배지 / tip / 제목 접두)와 내보내기 구분 문자열.
- 모듈 hit와 caution hit가 같은 구간에 둘 다 남을 때 하이라이트 겹침 그리는 방식.
- 게스트/데모에서 폴더를 켜고 끌 수 있는지.
- (`isSpacingCategoryEnabled`는 **이미 있는** 헬퍼 — 새로 만들지 않음.)

## 참고 코드 (현행)

- 조기 반환·실행: `src/hooks/useRuleCheck.js` — **`runCheckScope`**
- 플래그 헬퍼: `src/lib/featureFlags.js` — **`isSpacingCategoryEnabled()`**
- 모듈 레지스트리: `src/lib/spacingCategoryRegistry.js`
- `rieul-kka` 표면: `src/lib/rieulKkaBodaSpacing.js` — `ROWS`
- 실험 UI: `src/components/SpacingCategoryPanel.jsx` (제거 대상)
- 결과 분류: `src/lib/checkResultsAccordion.js` — `partitionSpellingResultEntries`
- 세트 복제·criteria: `src/hooks/useRuleSets.js`, `src/lib/sharePackage.js`
