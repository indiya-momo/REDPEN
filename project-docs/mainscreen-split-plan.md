# MainScreen 비즈니스 로직 · UI 분리 방향 (베타 이후)

**상태:** 방향만 정리 — 베타 중 구현·리팩터 금지  
**관련:** `src/components/MainScreen.jsx`, `project-docs/app-mainscreen-contract.md`  
**마지막 갱신:** 2026-06-05

---

## 한 줄 요약

검사·quota·PDF 같은 **무거운 도메인은 이미 훅/lib로 분리**되어 있다.  
베타 이후에는 `MainScreen`에 남은 **기준 UI 오케스트레이션·실행 게이트·탭/결과 라우팅·거대 JSX**를 훅·하위 컴포넌트로 쪼개 **조립(composition)만 남긴다.**

---

## 베타 중 하지 않는 것

- `MainScreen` dead props 제거·props 시그니처 변경 (`app-mainscreen-contract.md` 계약 유지)
- `ruleEngine` / 검수 매칭 로직 변경
- 대규모 파일 분해로 회귀 위험이 큰 일괄 리팩터

---

## 이미 분리된 것 (유지)

| 영역 | 위치 |
|------|------|
| PDF | `usePdfDocument`, `usePdfZoom` |
| 맞춤법·일관성 검사 | `useRuleCheck` |
| 작업 세션 persist | `useWorkSession` |
| 베타 1일 1회 | `useBetaDailyQuota` |
| 작업 가이드 체인 | `useWorkGuideChain` |
| 탭 엔트리·라벨 등 | `utils/main-screen-helpers.js` |
| 기준 삭제 계획 | `lib/criteriaPresetDelete.js` |

---

## MainScreen에 아직 섞여 있는 것

### 1. 기준(프리셋) picker 오케스트레이션

- `savedRuleSets` 필터·정렬, `handleSaveCriteria` / `handleDeleteCriteria` / `selectSavedCriteria`
- 입력창·드롭다운·저장/삭제 버튼 JSX와 한 덩어리

**이후:** `useCriteriaPresetPicker` + `CriteriaPresetToolbar.jsx`

### 2. 검수 실행 게이트

- `checkAuthBlocked`, `checkQuotaBlocked`, `criteriaRunBlocked`, `criteriaRunDisabledReason`
- PDF phase·로그인·quota 조합 규칙

**이후:** `useCheckRunGate` 또는 `lib/resolveCheckRunGate.js` (순수 함수 + 테스트)

### 3. 탭 · 결과 패널 표시

- `switchTab`, `clearSpellingTabWork`, `clearConsistencyTabWork`
- `showTocResultsPanel` / `showConsistencyResultsPanel` / `consistencyFocus`

**이후:** `useWorkTabState`

### 4. 하이라이트 · 페이지 이동 라우팅

- `highlights` (toc vs rule), `goToPdfPage` 분기

**이후:** `useActiveCheckView`

### 5. 인사말 문자열

- `getUserProfile` + displayName, 기준명 15자 말줄임

**이후:** `lib/workspaceGreeting.js` (표시 문자열만; 프로필 sync는 `useUserProfileSync` 유지)

### 6. 가이드 dismiss + 검수 실행

- `handleCriteriaSpellingCheck` (1번 dismiss + `runSpellingCheck`)

**이후:** `useWorkGuideChain` 래퍼 또는 `useMainScreenActions`에 흡수

### 7. DEV `devPdf` 자동 로드

- URL 쿼리 → fetch → `loadPdfFromFile`

**이후:** `useDevPdfBootstrap` (dev 전용 파일)

### 8. 레이아웃 상수 · 거대 JSX

- `WORK_GUIDE_*_ALIGN_*` 상단 상수, ~1000줄 마크업

**이후:** `workGuideMainScreenLayout.js`, `components/main-screen/*` 패널 분할

---

## 목표 구조 (베타 이후)

```
MainScreen.jsx                    ← 훅 연결 + 레이아웃 조립만
hooks/
  useCriteriaPresetPicker.js
  useCheckRunGate.js
  useWorkTabState.js
  useActiveCheckView.js
lib/
  workspaceGreeting.js
  resolveCheckRunGate.js          ← 순수 함수, vitest
components/main-screen/
  CriteriaPresetToolbar.jsx
  MainScreenHeader.jsx
  SpellingTabPane.jsx
  ConsistencyTabPane.jsx
  PdfWorkPane.jsx
```

**원칙**

1. 순수 규칙 → `lib/` + 단위 테스트  
2. 여러 훅 엮기 → `hooks/`  
3. 마크업·이벤트만 → `components/main-screen/`  
4. App ↔ MainScreen **dead props 계약**은 UI 복구 설계가 끝날 때까지 유지

---

## 우선순위 (베타 종료 후)

| 순위 | 작업 | 이유 |
|------|------|------|
| 1 | 기준 picker → `useCriteriaPresetPicker` + Toolbar | UI·로직 결합, 최근 변경 많음 |
| 2 | 검수 실행 게이트 | 조건·메시지 중복·분산 방지 |
| 3 | 탭/결과 + active check view | 규칙 복잡, 버그 여지 |
| 4 | JSX 분할 + 가이드 레이아웃 분리 | 가독성·수정 사고 예방 |
| 5 | DEV bootstrap | 영향 작음 |

---

## 완료 기준 (한 덩어리씩 PR)

- 동작·UI 동일 (스모크: PDF 업로드 → 기준 검수 → 결과 → 기준 저장/삭제)
- `npm test` 통과
- 새 순수 함수는 vitest 1파일 이상
- dead props·beta freeze 규칙 위반 없음
