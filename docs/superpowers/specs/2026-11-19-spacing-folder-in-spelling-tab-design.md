# 맞춤법 탭 「띄어쓰기」 폴더 — 세종 띄어쓰기 모듈 편입

**날짜:** 2026-11-19  
**상태:** 설계 초안 (검토용 · 구현 전)  
**관련:** `VITE_SPACING_CATEGORY`, `src/lib/spacingCategoryRegistry.js`, `src/components/SpacingCategoryPanel.jsx`

## 문제

세종 띄어쓰기 모듈(숫자·단위, 의존명사·-ㄹ까 보다, 장소 접미사)은 `ruleEngine`·맞춤법 시트 밖 코드로 이미 존재한다.  
지금은 실험용 `SpacingCategoryPanel`(별도 탭 진입)에만 연결되어 있어, 「기준 검수」 흐름·프로젝트 저장·결과 목록과 한 줄로 이어지지 않는다.

## 합의된 목표

1. 맞춤법 탭에 **폴더 하나 「띄어쓰기」** + **하위 검사 3개**를 둔다.
2. 켠 항목은 **「기준 검수」**에 포함되어, 맞춤법 검수 한 번에 모듈도 돈다.
3. 시트 규칙 행을 추가하지 **않는다** (폴더·모듈 단계 없음).
4. 본조 전용 탭 분리는 **나중** — 이번 범위에서 세 번째 탭을 띄우지 않는다.
5. 플래그 `VITE_SPACING_CATEGORY`가 꺼지면 **UI와 실행 경로 모두**에서 모듈이 돌지 않는다.

## 비목표 (이번 범위 밖)

- `ruleEngine` / 맞춤법·caution 시트 행 추가·정규식 변경
- 본조(보조용언) 탭·본조 모듈 편입
- 「한 번」「다음 날」 등 이미 caution/시트에 있는 유형 재구현
- `SpacingCategoryPanel`을 “미사용으로 남겨 두는” 선택 (이번은 **제거**)
- 클라우드/서버 측 검수

---

## 1. UI · 폴더 · 문구

### 위치

- **맞춤법** 탭 안, 기존 built-in / caution 폴더와 같은 아코디언 계열.
- 폴더 제목: **「띄어쓰기」** (고정).
- 폴더 안 안내(한 줄): **앱 내장 검사 · 시트 규칙과 별개 · 일부 유형만**.

### 하위 검사 3개 (묶음 = bundle)

| 저장 키 = `bundleId` | UI 라벨 | 모듈 출처(요지) |
|----------------------|---------|-----------------|
| `numberUnit` | 숫자·단위 | 숫자+단위 띄어쓰기 |
| `dependentRieulKka` | 의존명사·-ㄹ까 보다 | 의존명사 계열 + `-ㄹ까 보다` (**용언 경계 예외**는 모듈 쪽 기존 규칙 유지) |
| `placeAffix` | 장소 접미사 | 장소 접미사 띄어쓰기 |

- **옛 이름 `adnominalEtc`는 쓰지 않는다.** 문서·코드·주석에 남지 않게 한다.
- **키와 `bundleId`는 동일 문자열**이다. `spacing:{bundleId}`의 `bundleId` = 위 저장 키. 별도 매핑 표를 두지 않는다.

### 폴더 헤더 체크

- 헤더 체크는 **하위 3개의 파생 상태**다. **저장하지 않는다.**
  - 전부 켬 → checked  
  - 전부 끔 → unchecked  
  - 일부만 켬 → **indeterminate**
- 헤더 클릭: 전부 켬 ↔ 전부 끔 토글(구현 시 관례에 맞춤).

### 플래그 off 시 UI

- `VITE_SPACING_CATEGORY`가 꺼지면 「띄어쓰기」 폴더를 **숨긴다.**
- UI 숨김만으로 끝내지 않는다 → **§3 실행 차단** 참고.

---

## 2. 저장 · 기본값 · 불러오기

### 프로젝트 저장 필드

- 키 이름(안): `spacingFolderEnabled` (또는 동등한 프로젝트 설정 객체).
- 값: `{ numberUnit: boolean, dependentRieulKka: boolean, placeAffix: boolean }`

### 기본값

| 경우 | 기본 |
|------|------|
| **기존 프로젝트** (필드 없음) | 세 키 모두 **끔** (`false`) |
| **새로 만드는 프로젝트** | 세 키 모두 **끔** (`false`) |

사용자가 켠 뒤에만 검수에 포함된다.

### 「알 수 없는 키는 무시」의 의미

| 시점 | 동작 |
|------|------|
| **불러올 때** | 알 수 없는 키는 **읽지 않는다**(UI·실행에 반영하지 않음). 알려진 세 키만 적용. |
| **저장할 때** | 알려진 세 키만 쓴다. **플래그를 껐다가 다시 켜도** 프로젝트에 남아 있던 알려진 키 값은 **보존**한다. 저장 경로가 플래그 off 때문에 필드를 지우거나 `false`로 덮어쓰지 않는다. |

### 마이그레이션

- `SpacingCategoryPanel`은 **세션/로컬 전용 상태만** 쓰고 프로젝트에 별도 persist 키가 없다 → 옮길 저장 키 없음.
- 기존 프로젝트에 `spacingFolderEnabled`가 없으면 §2 기본값(전부 끔)으로 취급.

---

## 3. 검수 파이프라인 · category · 겹침 · 플래그

### 실행 위치

- `runSpellingCheck` / `runCheckScope('spelling')` 경로에서, 시트·built-in·caution 결과 산출 **이후**에 켠 모듈을 돌리고 병합한다.
- 모듈 결과는 맞춤법 결과 목록(`spellingResults`)에 **같은 검수 결과**로 합친다.

### 플래그 off 시 실행 차단 (필수)

- 확인 위치:
  1. UI: 폴더 숨김  
  2. **`runSpellingCheck` / `runCheckScope('spelling')`**: `VITE_SPACING_CATEGORY`가 꺼져 있으면 모듈을 **호출하지 않는다.**
- UI만 숨기면, 예전에 `spacingFolderEnabled`가 켜진 채 저장된 프로젝트에서 **폴더는 안 보이는데 모듈만 도는** 상태가 된다. 사용자는 끌 방법이 없으므로 **실행 쪽 차단이 필수**다.

### 조기 반환 (현행 코드와의 충돌)

현행:

```text
runSpelling && spellingActiveRules.length === 0
  → alert('맞춤법 검수를 진행할 기준을 등록해주세요')
  → return
```

이 분기는 **「built-in/caution이 모두 꺼져 있어도 켠 띄어쓰기 모듈은 돈다」** 규칙을 깨뜨린다.

**개정:**

- `spellingActiveRules.length === 0` **이더라도**, 플래그 on + `spacingFolderEnabled` 중 **하나라도 true**이면 검수를 **진행**한다 (모듈만 도는 경우 허용).
- 시트 규칙도 없고 띄어쓰기 묶음도 모두 꺼져 있을 때만 기존과 같이 안내 후 return.
- 안내 문구는 「기준을 등록해주세요」 계열을 유지하되, 띄어쓰기만 켠 경우는 뜨지 않아야 한다.

### 결과 `category`

- 모듈 hit/그룹의 `category` 값: **`spacing:{bundleId}`**  
  예: `spacing:numberUnit`, `spacing:dependentRieulKka`, `spacing:placeAffix`
- `bundleId` = §1·§2 저장 키와 **동일**.

### `category` 소비처 (스펙에 고정 · 구현 시 전부 인식)

모르는 `category`를 만나면 누락·오분류·내보내기 오류가 날 수 있다. 다음을 **알고 있게** 고친다(필요 시 `spacing:` 접두로 분기).

| 소비처 | 파일/영역 (현행 기준) | 기대 |
|--------|----------------------|------|
| 결과 1단 분류 | `partitionSpellingResultEntries` (`checkResultsAccordion.js`) | `spacing:*` → **맞춤법 규칙(builtin) 칸**에 포함 (caution/loanword가 아님) |
| 결과 카드·톤 | `CheckResultsPanel.jsx` | caution/loanword가 아니면 builtin 톤. `spacing:*`도 동일 |
| 하이라이트 | `useHighlights.js` | caution이 아니면 일반 spelling 하이라이트. `spacing:*` 동일 |
| 검수 확인/집계 | `spellingCheckConfirm.js`, 프로젝트 카드 건수 | caution/loanword 외는 spelling/builtin 집계에 포함 |
| 내보내기 | `exportResults.js` | caution이 아니면 「맞춤법 규칙」 계열 라벨. `spacing:*`도 누락 없이 행 생성 |
| 게스트/데모 정책 | `guestBrowsePolicy.js` 등 | 필요 시 `spacing:*`를 caution이 아닌 쪽으로 취급 |

구현 중 추가 소비처가 보이면 이 표에 보강한다. **모르는 category → 조용히 버리기 금지.**

### 겹침 좌표계 (필수 전제)

시트 결과와 모듈 hit의 「문자 구간」비교는 **같은 텍스트 기준**이어야 한다.

- 기준: 검수에 넘긴 **페이지 텍스트(`pageTexts`)와 동일한 문자열** 위의 **시작·끝 오프셋** (정규화·공백 접기 전후가 어긋나면 안 됨).
- 모듈이 내부에서 정규화한 문자열로만 오프셋을 쓰면, 시트 hit와 비교하기 전에 **동일 좌표계로 환산**하거나, 처음부터 동일 기준 오프셋을 낸다.
- 기준이 다르면 부분 겹침 판정이 틀어져 모듈 hit가 잘못 지워지거나 중복된다.

### 시트 · caution · 모듈 간 겹침

| 규칙 | 동작 |
|------|------|
| 모듈 hit ↔ **시트/built-in** hit | **부분 겹침 포함** 겹치면 **시트 쪽 유지**, 모듈 hit **조용히 제거** (사용자 알림 없음) |
| 모듈 hit ↔ **caution** hit | caution과 겹쳐도 모듈 hit **유지** (caution이 모듈을 억제하지 않음) |
| 모듈 hit ↔ **다른 모듈** hit | §1 표 순서(`numberUnit` → `dependentRieulKka` → `placeAffix`)로 **순차** 처리. **이미 남긴 앞쪽 hit와 겹치는 뒤쪽 hit만 제거**. 앞선 쪽 유지 |

순차 방식 명시: A∩B, B∩C이고 A∩C=∅일 때, A를 남기고 B를 지우면 C는 A와 안 겹치므로 **C는 남는다**. (한 번에 클러스터 전체를 지우는 방식이 아님.)

### 기존 `SpacingCategoryPanel`

- **제거**한다 (미사용으로 남기지 않음).
- 관련 import·탭 진입·전용 테스트도 함께 정리한다.
- 플래그 on일 때 맞춤법 탭 폴더만 진입점.

---

## 4. 수용 조건 (확인 기준)

구현 완료 판정은 아래를 만족할 때다.

1. **부분 겹침 제거:** 시트 hit와 문자 구간이 일부만 겹쳐도 모듈 hit가 결과 목록·하이라이트에 남지 않는다.
2. **caution과 겹칠 때 유지:** 동일 구간에 caution hit가 있어도, 켠 모듈 hit는 남는다.
3. **플래그 off:** `VITE_SPACING_CATEGORY` off이면 폴더가 안 보이고, 프로젝트에 예전에 켠 값이 있어도 모듈이 **실행되지 않는다.**
4. **기본 끔:** 필드 없는 기존 프로젝트·새 프로젝트 모두 세 묶음 기본값 `false`. 켜지 않으면 모듈 hit가 없다.
5. **헤더 indeterminate:** 하위 중 일부만 켜면 폴더 헤더가 indeterminate다. 헤더 자체는 저장되지 않는다.
6. **모듈만 켠 검수:** built-in/caution을 모두 끈 채 띄어쓰기 묶음만 켜고 「기준 검수」하면, 「기준을 등록해주세요」로 **막히지 않고** 모듈 결과가 나온다.
7. **키 = bundleId:** 저장 키와 `spacing:{bundleId}`의 id가 같고, `adnominalEtc` 문자열이 코드·스펙에 없다.
8. **패널 제거:** `SpacingCategoryPanel` 및 단독 탭 진입이 코드베이스에 없다.
9. **category 소비:** `spacing:*` 결과가 맞춤법 규칙 칸·하이라이트·내보내기에 누락 없이 나타난다.
10. **플래그 토글 보존:** 켠 상태로 저장 → 플래그 off → 다시 on 해도 프로젝트의 `spacingFolderEnabled` 알려진 키 값이 유지된다(off 동안 실행만 안 됨).

---

## 결정 요약

| 항목 | 결정 |
|------|------|
| 위치 | 맞춤법 탭 · 폴더 「띄어쓰기」 |
| 검수 포함 | 「기준 검수」에 포함 |
| 시트 행 | 추가하지 않음 |
| 세 번째 탭 | 이번엔 없음 (본조는 나중) |
| 저장 | `spacingFolderEnabled` · 키=`bundleId` |
| 기본값 | 기존·신규 모두 전부 끔 |
| category | `spacing:{bundleId}` |
| 시트 겹침 | 부분 겹침 포함 · 시트 승 · 모듈 조용히 드롭 |
| caution 겹침 | 모듈 유지 |
| 모듈↔모듈 | 표 순서 순차 · 앞선 hit 유지 |
| 플래그 | UI + `runSpellingCheck` 모두 차단 |
| 구 패널 | **제거** |

## 열린 구현 세부 (설계 불변 · 코딩 시 정하면 됨)

- 폴더를 기존 `dividerGroup` UI에 붙일지, 맞춤법 탭 전용 블록으로 둘지 (동작·문구는 §1 고정).
- 내보내기 엑셀에 `spacing:*` 표시 문자열을 「맞춤법 규칙」과 동일하게 둘지, 「띄어쓰기 · {라벨}」로 조금 나눌지 (누락만 없으면 수용).

## 참고 코드 (현행)

- 조기 반환: `src/hooks/useRuleCheck.js` — `runCheckScope` 내 `spellingActiveRules.length === 0`
- 모듈 레지스트리: `src/lib/spacingCategoryRegistry.js`
- 실험 UI: `src/components/SpacingCategoryPanel.jsx` (제거 대상)
- 결과 분류: `src/lib/checkResultsAccordion.js` — `partitionSpellingResultEntries`
)
