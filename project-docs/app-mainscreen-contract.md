# App ↔ MainScreen 컴포넌트 계약 (Dead Props)

**마지막 갱신:** 2026-05-30  
**관련 코드:** `src/App.jsx`, `src/components/MainScreen.jsx`, `src/hooks/useRuleSets.js`

앱은 **규칙 세트 UI를 “준비 중”**으로 두고, `MainScreen`에는 향후 UI 복구를 대비한 props 배선을 **의도적으로 유지**합니다.  
안정화 단계(Phase 1~2)에서는 **props 제거·JSX 구조 변경을 금지**합니다.

---

## 한 줄 요약

> **규칙 데이터는 `useRuleSets` + `updateActiveSet` 경로로 세션 중 자동 저장되지만, 규칙 세트 선택·이름·명시 저장 UI는 MainScreen에 아직 연결되어 있지 않다.**

---

## Props 분류

### A. MainScreen에서 **사용 중** (12개)

| Prop | App에서의 공급 | MainScreen 사용처 |
|------|----------------|-------------------|
| `builtInEnabled` | `activeSet.builtInEnabled` | `useRuleCheck`, `ResizableBuiltinSpelling`, `ConsistencyPanel` |
| `customRules` | `activeSet.customRules` | `useRuleCheck`, `ConsistencyPanel` |
| `globalExcludePhrases` | `activeSet.globalExcludePhrases` | `useRuleCheck`, `ConsistencyPanel` |
| `cautionEnabled` | `activeSet.cautionEnabled` | `useRuleCheck`, `ResizableBuiltinSpelling`, `ConsistencyPanel` |
| `onBuiltInToggle` | quota 검사 후 `updateActiveSet({ builtInEnabled })` | `ResizableBuiltinSpelling` |
| `onBuiltInSetAll` | quota 검사 후 `updateActiveSet({ builtInEnabled })` | `ResizableBuiltinSpelling` |
| `onCautionToggle` | quota 검사 후 `updateActiveSet({ cautionEnabled })` | `ResizableBuiltinSpelling` |
| `onCautionSetAll` | quota 검사 후 `updateActiveSet({ cautionEnabled })` | `ResizableBuiltinSpelling` |
| `onCustomRulesChange` | `updateActiveSet({ customRules })` | `ConsistencyPanel` |
| `onGlobalExcludePhrasesChange` | `updateActiveSet({ globalExcludePhrases })` | `ConsistencyPanel` |
| `onOpenWelcome` | `setScreen('welcome')` | 대문(책) 버튼 |
| `initialWorkTab` | `mainWorkTab` state | 탭 초기값 (`useState` + `useEffect`) |

**데이터 흐름:** 토글·일관성 규칙 변경 → App inline handler → `updateActiveSet` → `useRuleSets.scheduleRuleSetsSave` → `localStorage` (400ms debounce).

---

### B. **Dead props** — destructure만, 본문 미사용 (9개)

| # | Prop | App에서 전달하는 값 | App 측 동작 (살아 있음) | MainScreen UI |
|---|------|---------------------|-------------------------|---------------|
| 1 | `ruleSets` | `ruleSets.map(({ id, name }) => …)` | `useRuleSets` 상태 | **미연결** |
| 2 | `activeSetId` | `activeSetId` | `useRuleSets` 상태 | **미연결** |
| 3 | `onSelectRuleSet` | `handleSelectRuleSet` | 세트 전환 + `saveActiveSetId` | **미연결** |
| 4 | `onCreateRuleSet` | `handleCreateRuleSet` | 새 세트 생성 | **미연결** |
| 5 | `onDuplicateRuleSet` | `handleDuplicateRuleSet` | 현재 세트 복제 | **미연결** |
| 6 | `onDeleteRuleSet` | `handleDeleteRuleSet` | confirm 후 삭제 | **미연결** |
| 7 | `ruleSetSavedAt` | `activeSet.savedAt` | `handleSaveRules` 시 갱신 | **미연결** |
| 8 | `onRuleSetNameChange` | `(name) => updateActiveSet({ name })` | 이름 patch + autosave | **미연결** |
| 9 | `onSaveRules` | `handleSaveRules` | 명시 저장 + analytics + alert | **미연결** |

**UI 대체 문구:** `MainScreen` 우측 상단 `pdf-work-pane__notice` — *「사용자의 기준을 저장하는 기능을 준비 중입니다」*

---

## 왜 dead props를 유지하는가

1. **계약 동결:** Phase 1~2 안정화 원칙 — App↔MainScreen props 시그니처를 깨지 않음.
2. **향후 UI 복구:** 규칙 세트 패널(선택·생성·복제·삭제·이름·저장 버튼) 재도입 시 배선 재사용.
3. **App 측 로직은 이미 동작:** `useRuleSets` CRUD·autosave·fingerprint resync는 App/훅에서 계속 실행됨.

---

## 흔한 오해 (문서화 목적)

| 오해 | 사실 |
|------|------|
| “저장이 안 된다” | 토글·일관성 규칙은 **`updateActiveSet` autosave**로 `localStorage`에 persist됨 (Policy A, `b1165b6` 이후). |
| “`onSaveRules`를 호출해야 저장된다” | 현재 UI는 **`onSaveRules`를 호출하지 않음**. 명시 저장(alert·`trackRulesetSaved`)은 UI 복구 후 `onSaveRules` 배선 시에만 발생. |
| “dead props는 제거해도 된다” | **안정화 기간 금지.** 제거는 규칙 세트 UI 설계·QA 완료 후 별도 작업. |
| “`ruleSets`가 없으면 검수가 안 된다” | 검수는 **`activeSet`의 `builtInEnabled` / `cautionEnabled` / `customRules`** 만 사용. `ruleSets` 목록 UI만 없음. |

---

## 실제 저장 경로 (데이터 정합성)

```
사용자 토글/규칙 편집
  → App: onBuiltInToggle / onCautionToggle / onCustomRulesChange / …
  → useRuleSets.updateActiveSet(patch)
  → scheduleRuleSetsSave (400ms)
  → ruleSetsStorage.saveRuleSets + saveActiveSetId
  → localStorage
```

**명시 저장 경로 (UI 미배선):**

```
onSaveRules (= handleSaveRules)
  → savedAt 갱신, flushRuleSets, trackRulesetSaved, alert
  → 현재 MainScreen에서 트리거 없음
```

**세트 CRUD 경로 (UI 미배선):**

```
onCreateRuleSet / onDuplicateRuleSet / onDeleteRuleSet / onSelectRuleSet
  → useRuleSets handlers
  → applyRuleSets / saveActiveSetId
  → 현재 MainScreen에서 트리거 없음
```

---

## 규칙 세트 UI 복구 시 체크리스트

- [ ] 좌측 또는 상단에 세트 선택 UI — `ruleSets`, `activeSetId`, `onSelectRuleSet`
- [ ] 생성·복제·삭제 — `onCreateRuleSet`, `onDuplicateRuleSet`, `onDeleteRuleSet`
- [ ] 세트 이름 편집 — `onRuleSetNameChange`, `ruleSetSavedAt` 표시
- [ ] 명시 저장 버튼 — `onSaveRules` (autosave와 UX 정책 합의 필요)
- [ ] “준비 중” notice 제거 또는 문구 변경
- [ ] dead props 목록을 **사용 중**으로 재분류 후 본 문서 갱신

---

## 변경 금지 (안정화 원칙)

- MainScreen JSX 그리드·렌더 트리 변경
- 위 9개 dead props **destructure 제거** 또는 App 전달 중단
- `useRuleSets` autosave / migrate / fingerprint 로직 임의 “정리”

---

## 관련 감사 문서

- `project-docs/structural-audit-report.md` — §1-4 App ↔ MainScreen 계약 붕괴
- `project-docs/post-stabilization-audit-report.md` — §1-3 MainScreen dead props
