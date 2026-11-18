# 맞춤법 탭 「띄어쓰기」 폴더 — 세종 띄어쓰기 모듈 편입

**날짜:** 2026-11-19  
**상태:** 설계 개정 (검토용 · 구현 전)  
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

### 하위 검사 3개 (묶음 = bundle)

| 저장 키 = `bundleId` | UI 라벨 | 포함 모듈 id (`SPACING_CATEGORY_DEFS`) | 비고 |
|----------------------|---------|----------------------------------------|------|
| `numberUnit` | **수·단위** | `numeral`, `man-eok-jo`, `digit-unit` | |
| `dependentRieulKka` | **의존명사·-ㄹ까 보다** | `adnominal-dep`, `n-ji`, `n-ba`, `rieul-kka` | 아래 범위 경계 |
| `placeAffix` | **지명·접미** | `place-affix` | |

**범위 경계 (묶음 2 · 확정):**

- **보조용언 일반은 제외**한다 (`official-aux` 등 이 폴더에 넣지 않음).
- `rieul-kka`는 **`-ㄹ까/나 보다` 등 닫힌 구문만** 포함한다 (모듈 기존 표면 목록). 일반 보조용언·용언 경계 검사가 아니다.
- `noun-pred`(명사+용언)·용언 경계 폴더는 **이번 비목표**.

**묶음 2 툴팁** (네 모듈 · 한 줄씩):

```text
관형사형+의존명사
-ㄴ지 기간
-ㄴ바
-ㄹ까/나 보다 (닫힌 구문만 · 보조용언 일반 제외)
```

- **키와 `bundleId`는 동일 문자열**이다. `spacing:{bundleId}`의 `bundleId` = 위 저장 키. 별도 매핑 표를 두지 않는다.
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

## 2. 저장 · 기본값 · 불러오기

### 저장 필드 · 층위

- 필드 이름: **`spacingFolderEnabled`** (확정).
- 값: `{ numberUnit: boolean, dependentRieulKka: boolean, placeAffix: boolean }`
- **층위:** `builtInEnabled` / `cautionEnabled`와 **같다** — **활성 기준 세트(active rule set)** 에 붙는다. 프로젝트 메타 단독 필드가 아니라, 세트를 저장·불러올 때 함께 간다.

### 기본값

| 경우 | 기본 |
|------|------|
| **기존 세트** (필드 없음) | 세 키 모두 **끔** (`false`) |
| **새로 만드는 프로젝트·세트** | 세 키 모두 **끔** (`false`) |

사용자가 켠 뒤에만 검수에 포함된다.

### 「알 수 없는 키는 무시」의 의미

| 시점 | 동작 |
|------|------|
| **불러올 때** | 알 수 없는 키는 **읽지 않는다**(UI·실행에 반영하지 않음). 알려진 세 키만 적용. |
| **저장할 때** | **알려진 세 키만** 쓴다. 플래그 off 동안에도 세트에 남아 있던 알려진 키 값은 **지우거나 `false`로 덮지 않는다** (다시 on 하면 이전 설정 유지). |

### 마이그레이션

- `SpacingCategoryPanel`은 세션/로컬 전용만 쓰고 세트에 persist 키가 없다 → 옮길 저장 키 없음.
- 기존 세트에 `spacingFolderEnabled`가 없으면 §2 기본값(전부 끔)으로 취급.

---

## 3. 검수 파이프라인 · category · 출처 · 겹침 · 플래그

### 실행 위치

- 실제 진입은 `useRuleCheck.js`의 **`runCheckScope('spelling')`** 이다. (`runSpellingCheck`는 이를 부르는 얇은 래퍼.)
- 시트·built-in·caution 결과 산출 **이후**에, 켠 묶음의 모듈만 돌리고 `spellingResults`에 병합한다.
- 세 묶음이 **모두 꺼져 있으면** 모듈 단계를 **호출하지 않는다.**

### 플래그 · 단일 헬퍼 (필수)

- UI 표시와 실행 차단 **모두** `isSpacingCategoryEnabled()` (`featureFlags.js`)만 본다.
- `VITE_SPACING_CATEGORY`는 빌드 시점 값이므로, 수용 테스트는 **헬퍼를 모킹**해 on/off를 검증한다 (env를 런타임에 껐다 켰다 하지 않음).
- 헬퍼가 false이면: 폴더 숨김 + `runCheckScope('spelling')`에서 모듈 **미호출**.  
  (UI만 숨기면 예전에 켠 채 저장된 세트에서 폴더는 안 보이는데 모듈만 도는 상태가 된다.)

### 조기 반환 (현행과의 충돌)

현행 `runCheckScope`:

```text
runSpelling && spellingActiveRules.length === 0
  → alert('맞춤법 검수를 진행할 기준을 등록해주세요')
  → return
```

**개정:**

- `spellingActiveRules.length === 0`이더라도, `isSpacingCategoryEnabled()` + `spacingFolderEnabled` 중 **하나라도 true**이면 검수를 **진행**한다.
- 시트 규칙도 없고 띄어쓰기 묶음도 모두 꺼져 있을 때만 기존 안내 후 return.
- 띄어쓰기만 켠 경우에는 위 alert가 뜨지 않아야 한다.

### 결과 `category` · 라벨 · 출처

- 모듈 hit/그룹의 `category`: **`spacing:{bundleId}`**  
  예: `spacing:numberUnit`, `spacing:dependentRieulKka`, `spacing:placeAffix`
- **결과 그룹 제목(`label`):** 해당 **모듈**의 레지스트리 `label` (예: 「관형사형+의존명사」, 「숫자·단위 띄어쓰기」).
- **출처 표시 (필수):** 결과 목록에서 시트 규칙과 구분되도록, 그룹에 **「띄어쓰기」**(폴더명) 출처를 보이게 한다.  
  - 예: tip·부가 문구·배지 중 하나로 「띄어쓰기 · 앱 내장」, 또는 제목 앞에 폴더명을 붙임.  
  - 1단 칸은 builtin이어도 **출처 없이는 안 된다** (톤만 같으면 시트와 구분 불가).
- 내보내기: `spacing:*` 행이 빠지지 않게 하고, 구분/출처에 「띄어쓰기」 또는 「띄어쓰기 · {묶음 UI 라벨}」을 쓴다 (구체 문자열은 구현 시 §4 누락만 없으면 수용).

### `category` 소비처 (스펙에 고정 · 구현 시 전부 인식)

| 소비처 | 파일/영역 (현행 기준) | 기대 |
|--------|----------------------|------|
| 결과 1단 분류 | `partitionSpellingResultEntries` (`checkResultsAccordion.js`) | `spacing:*` → **맞춤법 규칙(builtin) 칸** (caution/loanword 아님) |
| 결과 카드·톤·출처 | `CheckResultsPanel.jsx` | builtin 톤 + **띄어쓰기 출처** 표시 |
| 하이라이트 | `useHighlights.js` | caution이 아니면 일반 spelling. `spacing:*` 동일 |
| 검수 확인/집계 | `spellingCheckConfirm.js`, 프로젝트 카드 건수 | caution/loanword 외 spelling/builtin 집계에 포함 |
| 내보내기 | `exportResults.js` | 누락 없이 행 생성 + 출처/구분에 띄어쓰기 반영 |
| 게스트/데모 정책 | `guestBrowsePolicy.js` 등 | `spacing:*`를 caution이 아닌 쪽으로 취급 |

**모르는 category → 조용히 버리기 금지.** 구현 중 추가 소비처가 보이면 이 표에 보강한다.

### 겹침 좌표계 (필수 전제)

시트 결과와 모듈 hit의 「문자 구간」비교는 **같은 텍스트 기준**이어야 한다.

- 기준: 검수에 넘긴 **`pageTexts`와 동일한 문자열** 위의 **시작·끝 오프셋**.
- 모듈이 내부 정규화 문자열만 쓰면, 비교 전에 **동일 좌표계로 환산**하거나 처음부터 동일 기준 오프셋을 낸다.
- 공백·줄바꿈이 있는 페이지에서도 시트 hit와 모듈 hit 오프셋 기준이 같아야 한다 (§4).

### 시트 · caution · 모듈 간 겹침

| 규칙 | 동작 |
|------|------|
| 모듈 hit ↔ **시트/built-in** hit | **부분 겹침 포함** 겹치면 **시트 쪽 유지**, 모듈 hit **조용히 제거** |
| 모듈 hit ↔ **caution** hit | caution과 겹쳐도 모듈 hit **유지** |
| 모듈 hit ↔ **다른 모듈** hit | §1 표 순서(`numberUnit` → `dependentRieulKka` → `placeAffix`)로 **순차** 처리. **이미 남긴 앞쪽 hit와 겹치는 뒤쪽 hit만 제거** |

순차: A∩B, B∩C이고 A∩C=∅이면 A 유지·B 제거 후 **C는 남는다.**

### 기존 `SpacingCategoryPanel`

- **제거**한다. import·탭 진입·전용 테스트도 함께 정리.
- 플래그 on일 때 맞춤법 탭 폴더만 진입점.

---

## 4. 수용 조건 (확인 기준)

구현 완료 판정은 아래를 만족할 때다.

1. **부분 겹침 제거:** 시트 hit와 문자 구간이 일부만 겹쳐도 모듈 hit가 결과 목록·하이라이트에 남지 않는다.
2. **caution과 겹칠 때 유지:** 동일 구간에 caution hit가 있어도, 켠 모듈 hit는 남는다.
3. **플래그 off (`isSpacingCategoryEnabled` 모킹 false):** 폴더가 안 보이고, 세트에 예전에 켠 값이 있어도 모듈이 **실행되지 않는다.**
4. **기본 끔:** 필드 없는 기존·신규 세트 모두 세 묶음 기본값 `false`. 켜지 않으면 모듈 hit가 없다.
5. **헤더 indeterminate:** 하위 중 일부만 켜면 폴더 헤더가 indeterminate다. 헤더 자체는 저장되지 않는다.
6. **모듈만 켠 검수:** built-in/caution을 모두 끈 채 띄어쓰기 묶음만 켜고 「기준 검수」하면, 「기준을 등록해주세요」로 **막히지 않고** 모듈 결과가 나온다.
7. **키 = bundleId:** 저장 키와 `spacing:{bundleId}`의 id가 같다. 옛 초안 묶음 id 문자열이 **`src/`에 없다.**
8. **패널 제거:** `SpacingCategoryPanel` 및 단독 탭 진입이 코드베이스에 없다.
9. **category·출처 소비:** `spacing:*` 결과가 맞춤법 규칙 칸·하이라이트·내보내기에 누락 없이 나타나고, **「띄어쓰기」 출처**로 시트 결과와 구분된다.
10. **플래그 토글 보존 (`isSpacingCategoryEnabled` 모킹):** 켠 상태로 저장 → 헬퍼 false → 다시 true여도 세트의 `spacingFolderEnabled` 알려진 키 값이 유지된다(false 동안 실행만 안 됨).
11. **모듈 간 사슬 겹침:** A∩B, B∩C이고 A∩C=∅일 때 순차 제거 후 **C가 남는다.**
12. **좌표계:** 공백·줄바꿈이 있는 `pageTexts`에서 시트 hit와 모듈 hit 오프셋이 **같은 문자열 기준**이다 (어긋난 비교로 오삭제·중복이 나지 않음).
13. **전부 끔:** 세 묶음이 모두 꺼져 있으면 모듈 단계가 **호출되지 않는다.**
14. **알 수 없는 키:** 불러올 때 무시되고, 저장 시 **알려진 세 키만** 쓰인다.

---

## 결정 요약

| 항목 | 결정 |
|------|------|
| 위치 | 맞춤법 탭 · 폴더 「띄어쓰기」 |
| 검수 포함 | 「기준 검수」에 포함 |
| 시트 행 | 추가하지 않음 |
| 세 번째 탭 | 이번엔 없음 (본조는 나중) |
| UI 라벨 | 수·단위 / 의존명사·-ㄹ까 보다 / 지명·접미 |
| 묶음 2 범위 | 보조용언 일반 제외 · `rieul-kka`는 닫힌 `-ㄹ까/나 보다`만 |
| 저장 | **`spacingFolderEnabled`** · active rule set (`builtInEnabled`와 동층) · 키=`bundleId` |
| 기본값 | 기존·신규 모두 전부 끔 |
| category | `spacing:{bundleId}` |
| 결과 출처 | 「띄어쓰기」 표시로 시트와 구분 |
| 시트 겹침 | 부분 겹침 포함 · 시트 승 · 모듈 조용히 드롭 |
| caution 겹침 | 모듈 유지 |
| 모듈↔모듈 | 표 순서 순차 · 앞선 hit 유지 |
| 플래그 | `isSpacingCategoryEnabled()` 단일 헬퍼 · UI + `runCheckScope('spelling')` |
| 구 패널 | **제거** |

## 열린 구현 세부 (설계 불변 · 코딩 시 정하면 됨)

- 폴더를 기존 `dividerGroup` UI에 붙일지, 맞춤법 탭 전용 블록으로 둘지 (동작·문구는 §1 고정).
- 출처 UI 형태(배지 / tip / 제목 접두)와 내보내기 구분 문자열의 미세한 문구.

## 참고 코드 (현행)

- 조기 반환·실행: `src/hooks/useRuleCheck.js` — **`runCheckScope`** (`spellingActiveRules.length === 0`)
- 플래그 헬퍼: `src/lib/featureFlags.js` — **`isSpacingCategoryEnabled()`**
- 모듈 레지스트리: `src/lib/spacingCategoryRegistry.js`
- 실험 UI: `src/components/SpacingCategoryPanel.jsx` (제거 대상)
- 결과 분류: `src/lib/checkResultsAccordion.js` — `partitionSpellingResultEntries`
)
