# 구현 플랜 — 맞춤법 탭 「띄어쓰기」 폴더

**스펙:** [2026-11-19-spacing-folder-in-spelling-tab-design.md](../specs/2026-11-19-spacing-folder-in-spelling-tab-design.md)  
**날짜:** 2026-11-19  
**상태:** 플랜 작성 · 구현 대기  
**제약:** `ruleEngine`/시트 행 비침 · beta freeze 준수 · `isSpacingCategoryEnabled()` 단일 게이트 · 모듈은 2차(검수 후 병합)만

## 목표

세종 띄어쓰기 모듈 3묶음을 맞춤법 탭 「띄어쓰기」 폴더로 편입하고, 「기준 검수」(`runCheckScope('spelling')`)에 포함시킨다. 실험용 `SpacingCategoryPanel`·spacing 탭은 제거한다.

## 아키텍처 (한 줄)

```text
isSpacingCategoryEnabled()
  → UI: 맞춤법 탭 폴더 (spacingFolderEnabled)
  → runCheckScope('spelling'):
       sheet/caution/loanword 결과
       → 켠 묶음 모듈 hit (spacingFolderBundles 순서)
       → 시트·loanword 겹침 드롭
       → 남은 모듈 순차 드롭
       → spellingResults에 병합 (category=spacing:{bundleId}, moduleId)
```

## Step 1 — 묶음 정의 · persist 정규화

**새 파일:** `src/lib/spacingFolderBundles.js` (+test)

1. `SPACING_FOLDER_BUNDLES` 배열 (스펙 §1 순서·라벨·moduleIds).
2. helpers: `listSpacingFolderBundles()`, `defaultSpacingFolderEnabled()`, `normalizeSpacingFolderEnabled(raw)`, `isAnySpacingFolderEnabled(map)`, `moduleIdsForEnabledBundles(map)`.
3. `normalizeSpacingFolderEnabled`: 알려진 3키만 · 비-boolean → `false` · 알 수 없는 키 무시.

**수정:** `src/lib/ruleSetNormalize.js`

- `spacingFolderEnabled: normalizeSpacingFolderEnabled(set.spacingFolderEnabled)` 포함.
- `buildCriteriaCheckpoint`에 넣을지: 체크포인트 지문에 포함하면 sync/복제와 일관. **포함** (builtIn과 동층).

**수정:** `src/hooks/useRuleSets.js`, `src/lib/sharePackage.js`

- 새 세트 기본값 · 복제 `structuredClone` · share criteria에 `spacingFolderEnabled` 포함.
- 시트 sync/`normalizeRuleSet` 경로가 필드를 지우지 않는지 확인 (…set 스프레드 유지).

**테스트:** 기본 끔 · 비-boolean · 알 수 없는 키 · 복제/정규화 보존.

## Step 2 — UI 폴더

**새 파일 (가칭):** `src/components/SpacingFolderChecklist.jsx` (+ 최소 CSS는 `main-screen.css`에 기존 caution/builtin 패턴 재사용)

1. `isSpacingCategoryEnabled()` false면 렌더 안 함 (부모에서도 가드).
2. 폴더 「띄어쓰기」 + 안내 한 줄 + 하위 3체크 + 헤더 indeterminate.
3. props: `spacingFolderEnabled`, `onToggle(bundleId, on)`, `onSetAll(on)`.

**수정:** `ResizableBuiltinSpelling.jsx` (또는 맞춤법 스크롤 영역)에 폴더 삽입 — built-in 목록 **아래** 또는 caution과 spelling 사이. 스펙은 위치만 「맞춤법 탭 안」; **spelling rules scroll 맨 아래**에 두는 것을 1차 선택.

**수정:** `App.jsx` / `useRuleSets` 토글 핸들러 — `builtInToggle`과 동일하게 active set patch.

## Step 3 — 검수 파이프라인

**새 파일 (가칭):** `src/lib/spacingFolderCheck.js` (+test)

```text
collectSpacingFolderGroups(pageTexts, spacingFolderEnabled) → groups[]
filterSpacingAgainstSheet(groups, sheetGroups) → groups  // sheet+loanword만; caution 제외
dedupeSpacingModulesSequential(groups) → groups         // bundles 순서
```

1. 모듈 호출은 레지스트리 `findHits` / 페이지 루프 재사용.
2. 그룹 shape: `category: spacing:{bundleId}`, `moduleId`, `label`(모듈), `tip`에 출처 「띄어쓰기」, instance에 `moduleId`.
3. 좌표계: `pageTexts[].text` 인덱스 그대로.

**수정:** `src/hooks/useRuleCheck.js` — `runCheckScope`

1. 조기 반환: `spellingActiveRules.length===0`이어도 `isSpacingCategoryEnabled() && isAnySpacingFolderEnabled(...)`이면 진행.
2. sheet 결과 만든 뒤, 플래그·켠 묶음 있으면 모듈 수집 → **시트·loanword 필터** → **모듈 순차** → `sortSpellingResultsForDisplay`에 합쳐 `setSpellingResults`.
3. 세 묶음 모두 off 또는 플래그 off → 모듈 단계 호출 없음.

**테스트 (합성 hit 포함):**

- 시트 부분 겹침 드롭 · caution 유지 · loanword 드롭  
- A∩시트, B∩A만 → B 남음 (수용 19)  
- A∩B, B∩C, A∩C=∅ → C 남음  
- 묶음 안 앞선 moduleId 유지 (합성)  
- 모듈만 켜도 조기 반환 안 함 (훅 단위 또는 helper로)

## Step 4 — 소비처 · 패널 제거 · export

1. `partitionSpellingResultEntries`: `spacing:*`는 이미 else→builtin. 동작 확인 테스트 추가.
2. `CheckResultsPanel` / tip: 「띄어쓰기」 출처 표시 (배지 또는 tip 접두).
3. `exportResults.js`: caution이 아닌 경로로 행 생성 · 구분에 띄어쓰기 반영.
4. `MainScreen.jsx`: spacing 탭·`SpacingCategoryPanel`·관련 CSS 클래스 제거.
5. `SpacingCategoryPanel.jsx` 삭제 (또는 re-export 금지). 전용 테스트·import 정리.
6. `spacingHitsToGroups` 등 레지스트리 helper는 폴더 파이프라인이 쓰도록 `moduleId`/`category` 맞게 확장 또는 `spacingFolderCheck`에서 직접 그룹 생성.

## Step 5 — 수용 스모크

스펙 §4 1–19를 테스트·수동 체크리스트로 대응. 플래그는 `isSpacingCategoryEnabled` 모킹.

## 비목표 (플랜에서도 하지 않음)

시트 행 · 모듈별 토글 · noun-pred · official-aux · S6 · caution 우선 겹침 · 본조 탭

## 구현 순서

Step 1 → 2 → 3 → 4 → 5. 각 Step 끝에서 관련 테스트 통과 후 다음.
