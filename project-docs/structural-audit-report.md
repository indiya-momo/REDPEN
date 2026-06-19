# PDF 출판 교정 보조 툴 — 구조 안정성·유지보수성 감사 리포트

| 항목 | 내용 |
|------|------|
| 작성일 | 2026-05-29 |
| 범위 | `src/` React 앱 전반 (기능 개발·UI 디자인 평가 제외) |
| 전제 | React + JSON 중심, **PC 우선**, 모바일은 **최소 mock** (`@media`만), PDF UI 포함 |
| 금지 방향 | 모바일 풀 반응형 리팩토링, PC 레이아웃 전면 개편 |
| 조치 | **분석만** — 본 문서는 수정 권고이며 자동 적용하지 않음 |

---

## 목차

1. [프로젝트 구조 분석](#1-프로젝트-구조-분석)
2. [React 구조 분석](#2-react-구조-분석)
3. [JSON 데이터 구조 분석](#3-json-데이터-구조-분석)
4. [CSS 및 레이아웃 구조](#4-css-및-레이아웃-구조)
5. [AI 생성 코드 흔적 분석](#5-ai-생성-코드-흔적-분석)
6. [유지보수성 및 기술부채](#6-유지보수성-및-기술부채)
7. [최종 요약](#7-최종-요약)
8. [신뢰 회복용 검증 명령](#8-신뢰-회복용-검증-명령)

---

## 1. 프로젝트 구조 분석

### 1-1. `index.css` 단일 모놀리스

| 필드 | 내용 |
|------|------|
| **파일명** | `src/index.css` (~5,271줄) |
| **문제 위치** | 파일 전체 — 워크스페이스·검사 결과·PDF·대문(PC)·모모의 방(PC+mobile `@media`) |
| **왜 위험한지** | 스타일 변경의 영향 반경이 화면 단위로 격리되지 않음. 한 기능 수정이 다른 화면 레이아웃·z-index·overflow를 깨뜨릴 수 있음 |
| **실제 발생 가능한 버그** | 대문 수정 후 작업 화면 패널 겹침, PDF 뷰어 스크롤 클리핑, 모달이 패널 뒤로 숨음 |
| **위험도** | **치명적** (유지보수·회귀 관점) |
| **추천 리팩토링 방향** | feature 단위 CSS 분리. 모바일은 `@media`만 별도 파일(`welcome-gate-mobile.css` 패턴). **PC 기본 블록은 동결** |

---

### 1-2. 폴더·책임 분리

| 필드 | 내용 |
|------|------|
| **파일명** | `src/lib/` vs `src/hooks/` vs `src/components/` |
| **문제 위치** | `lib/`는 테스트·도메인 분리 양호. `hooks/` 6개는 오케스트레이션 집중·**테스트 0**. `components/`는 `consistency/`만 하위 분리, 나머지 평면 |
| **왜 위험한지** | UI 변경 시 비즈니스 로직 위치를 추측해야 함. 훅 무테스트는 회귀를 수동 검증에 의존 |
| **실제 발생 가능한 버그** | 세션 복원·검사 후 페이지 이동 등 엣지에서만 터지는 버그가 PR에서 놓침 |
| **위험도** | **중간** |
| **추천 리팩토링 방향** | 당장 폴더 대이동 불필요. `useWorkSession`·`useRuleCheck`에 통합 테스트 1~2개만 추가해도 리스크 급감 |

---

### 1-3. 비대 컴포넌트

#### `MainScreen.jsx` (~446줄)

| 필드 | 내용 |
|------|------|
| **문제 위치** | hooks 조합(~79–120줄), `panel-right` PDF·탭·검사 UI 전체 |
| **왜 위험한지** | PDF·탭·검사·세션·레이아웃·피드백이 한 화면에 결합 |
| **실제 발생 가능한 버그** | props/훅 한 곳 변경 시 탭·하이라이트·세션 복원 연쇄 오류 |
| **위험도** | **높음** |
| **추천 리팩토링 방향** | 경계만 분리(PDF pane / 결과 패널). PC 그리드 구조는 유지 |

#### `App.jsx` (~408줄)

| 필드 | 내용 |
|------|------|
| **문제 위치** | `normalizeRuleSet`, rule-set CRUD, `MainScreen` props(~299–406줄) |
| **왜 위험한지** | 앱 루트 = 라우팅 + 도메인 정책 + UI 핸들러 |
| **실제 발생 가능한 버그** | 규칙 세트·fingerprint·autosave 상호작용 시 예상 밖 normalize |
| **위험도** | **높음** |
| **추천 리팩토링 방향** | `useRuleSets()` 훅 또는 Context로 rule-set만 분리(PC 동작 동일) |

#### 기타

| 파일 | 줄(대략) | 위험도 |
|------|----------|--------|
| `MomoRoomScreen.jsx` | ~403 | 중간 |
| `ConsistencyPanel.jsx` | ~327 | 중간 |

---

### 1-4. App ↔ MainScreen 계약 붕괴 (dead props)

| 필드 | 내용 |
|------|------|
| **파일명** | `src/components/MainScreen.jsx`, `src/App.jsx` |
| **문제 위치** | `MainScreen.jsx` 45–63줄 destructure — `ruleSets`, `activeSetId`, `onSelectRuleSet`, `onCreateRuleSet`, `onDuplicateRuleSet`, `onDeleteRuleSet`, `ruleSetSavedAt`, `onRuleSetNameChange`, `onSaveRules` **본문 미사용** |
| **왜 위험한지** | App은 규칙 세트 상태·저장·CRUD를 유지하지만 UI는 "준비 중" 문구만 표시(`pdf-work-pane__notice`, ~361–363줄) |
| **실제 발생 가능한 버그** | `onSaveRules`/`handleSaveRules`가 있다고 믿고 연결했으나 **저장 UI 없음**. JSDoc·타입과 실제 UI 불일치로 리팩터 시 잘못 배선 |
| **위험도** | **높음** |
| **추천 리팩토링 방향** | (A) UI 복구 또는 (B) App에서 rule-set props 제거 + orphan CSS 정리 — **둘 중 하나만** 명확히 |

---

### 1-5. import 순환·파일 의존성

| 필드 | 내용 |
|------|------|
| **파일명** | `src/lib/**` |
| **문제 위치** | 프로덕션 import 그래프 |
| **왜 위험한지** | lib 간 **순환 import 없음**(양호). 대신 `MainScreen`에서 `useRuleCheck` ↔ `useWorkSession`이 `afterCheckRef`로 우회 결합 |
| **실제 발생 가능한 버그** | 검사 완료 후 세션 저장 타이밍 오류, 복원 시 결과·페이지 불일치 |
| **위험도** | **중간** |
| **추천 리팩토링 방향** | 순환 해소보다 "검사 완료 → 세션 갱신" 계약을 한 함수/훅으로 문서화 |

---

## 2. React 구조 분석

### 2-1. State 중복·불일치

| 이슈 | 파일 | 위치 | 위험도 | 가능 버그 |
|------|------|------|--------|-----------|
| `ruleSets` + `ruleSetsRef` | `App.jsx` | 76–85, 92–104 | 중간 | debounce 클로저와 ref 타이밍 어긋남(드묾) |
| 토글 in-memory vs disk | `ruleSetsStorage.js` | 53–67 | **높음** | 새로고침 후 맞춤법/주의 토글 초기화 — [3-2](#3-2-localstorage와-json-불일치) |
| `screen` vs URL | `App.jsx` | 66–74 | 낮음 | 북마크/새로고침 시 welcome 복귀(의도일 수 있음) |

---

### 2-2. useEffect

| 파일 | 위치 | 역할 | 위험도 | 비고 |
|------|------|------|--------|------|
| `App.jsx` | 106–123 | 초기 load + normalize | 낮음 | |
| `App.jsx` | 125–133 | unmount flush | 낮음 | |
| `App.jsx` | 174–193 | fingerprint resync | 중간 | `ruleSets` deps 제거, `ruleSetsRef` 사용 — 무한루프는 아님 |
| `useWorkSession.js` | 전반 | mount restore, debounced persist, pagehide | **높음** | 테스트 없음 |
| `MainScreen.jsx` | 158–192 | dev PDF autoload | 낮음 | DEV만 |

#### `normalizeRuleSet` + compound migration

| 필드 | 내용 |
|------|------|
| **파일명** | `src/App.jsx` (~37–42), `src/lib/migrateCompoundRules.js` |
| **왜 위험한지** | resync·로드마다 `applyCompoundRuleMigrations` 실행 가능 |
| **실제 발생 가능한 버그** | 마이그레이션 버전 상승 시 `customRules` 예상 외 재작성 |
| **위험도** | **중간~높음** |
| **추천 리팩토링 방향** | 마이그레이션 버전 정책 문서화. 무분별 "정리" 금지 |

---

### 2-3. Re-render·memo

| 필드 | 내용 |
|------|------|
| **파일명** | `App.jsx`, `useRuleCheck.js` (~505줄) |
| **문제 위치** | `ruleSets.map` 등 매 렌더 새 참조 전달 가능 |
| **왜 위험한지** | `useRuleCheck` 무거움, 대형 PDF 검사 중 UI 버벅 가능 |
| **위험도** | **중간** |
| **추천 리팩토링 방향** | 성능 이슈 재현 후에만 `useMemo`/`React.memo` — 선제 전면 memo 금지 |

---

### 2-4. 비동기·언마운트

| 필드 | 내용 |
|------|------|
| **파일명** | `useRuleCheck.js`, `sessionStore.js` |
| **문제 위치** | `runRuleCheckAsync`, OPFS/IDB/Cache/FileHandle 폴백 |
| **왜 위험한지** | 검사 중 화면 전환·언마운트 시 stale update 가능. 세션 저장 경로 복잡·**테스트 없음** |
| **실제 발생 가능한 버그** | 검사 완료 후 결과가 안 보임, 세션 복원 실패(브라우저·용량 의존) |
| **위험도** | **높음** (session), **중간** (rule check) |

---

### 2-5. key·conditional rendering

| 이슈 | 위험도 | 가능 버그 |
|------|--------|-----------|
| `groupKey` / `resultVisibilityKey` | 중간 | 규칙 id 변경 시 선택·가시성 상태 꼬임 |
| `!rulesReady \|\| !activeSet` 로딩 | 낮음 | — |

---

## 3. JSON 데이터 구조 분석

### 3-1. Schema·sync

| 필드 | 내용 |
|------|------|
| **파일명** | `src/data/spelling-rules.json`, `caution-rules.json`, `bon-bojo-rules.json`, `scripts/sync-*.mjs` |
| **문제 위치** | 런타임 JSON Schema·validate **없음** |
| **왜 위험한지** | 시트 sync 오류 row가 빌드는 통과하나 런타임에서 규칙 누락·정규식 예외 |
| **실제 발생 가능한 버그** | 특정 규칙만 검사 안 됨, 전체 체크 크래시 |
| **위험도** | **높음** |
| **추천 리팩토링 방향** | sync 스크립트에서 validate + CI. 앱은 최소 assert |

#### `SPELLING_RULES_FP`

| 필드 | 내용 |
|------|------|
| **파일명** | `src/lib/builtInRules.js` |
| **문제 위치** | fingerprint 변경 → `App` resync effect |
| **실제 발생 가능한 버그** | JSON 변경 시 내장 맞춤법 ON/OFF가 시트 기본값으로 리셋 (`builtInEnabledFromSheet`, migrate 미연결) |
| **위험도** | **높음** |

---

### 3-2. localStorage와 JSON 불일치

| 필드 | 내용 |
|------|------|
| **파일명** | `src/lib/ruleSetsStorage.js` |
| **문제 위치** | `loadRuleSets` / `saveRuleSets` 53–67줄 — `builtInEnabled`, `cautionEnabled` **strip** |
| **왜 위험한지** | JSDoc·`RuleSet` 타입에는 토글이 있으나 디스크에는 저장 안 됨 |
| **실제 발생 가능한 버그** | 새로고침 후 맞춤법·주의 체크 상태가 시트 기본값으로 복귀. 사용자는 "저장됐다"고 인식 |
| **위험도** | **높음** |
| **추천 리팩토링 방향** | (A) strip 제거 + `migrateBuiltInEnabled` / `migrateCautionEnabled`를 `normalizeRuleSet`에 연결 **또는** (B) "토글은 세션만" 문서화 + dead migrate 삭제. **현재 (A)(B) 동시 미적용이 최악** |

#### migrate 함수 미연결

| 함수 | 정의 | 호출 |
|------|------|------|
| `migrateBuiltInEnabled` | `builtInRules.js` | 테스트만 |
| `migrateCautionEnabled` | `cautionRules.js` | **없음** |

| **위험도** | **높음** |

---

### 3-3. PDF 입력

| 필드 | 내용 |
|------|------|
| **파일명** | `pdfPublishGate.js`, `pdfService.js` |
| **위험도** | 게이트 **낮음**(테스트 있음). 추출·조판 **중간**(도메인 한계) |
| **추천** | PDF 파이프라인 구조 변경 최소화 |

---

## 4. CSS 및 레이아웃 구조

### 4-1. 스타일 로드 순서

```
src/main.jsx:
  fonts.css → index.css → welcome-gate-mobile.css
```

| 필드 | 내용 |
|------|------|
| **위험도** | mobile 파일이 index **뒤** — 의도된 cascade. index에 welcome `@media` 재삽입 시 **분리 무력화** |

---

### 4-2. PC / 모바일 분리 상태

| 영역 | PC (`index.css`) | Mobile `@media` |
|------|------------------|-----------------|
| 대문 welcome | ~3907–4404 (`—— 대문`) | `src/styles/welcome-gate-mobile.css` (960/640) |
| 모모의 방 | ~4405–5148 (`—— 비밀 페이지`) | **`index.css` 5151–5271** (`max-width: 960px`) |

| 필드 | 내용 |
|------|------|
| **왜 위험한지** | mock 전략이 화면마다 다름 → "대문만 분리하면 됨" 착각 |
| **위험도** | **높음** |
| **추천** | `momo-room-mobile.css`로 5151–5271만 이동. **PC momo 블록 1바이트도 변경 금지** |

---

### 4-3. 전역 selector·z-index·position

| 항목 | `index.css` | 위험도 |
|------|-------------|--------|
| `html, body, #root`, 패널 전역 input/checkbox | 다수 | 중간 |
| `z-index` | ~23곳, 고정 스케일 없음 | 중간 |
| `position: absolute\|fixed` | ~44건 | 중간 |

**가능 버그:** 모달·툴팁·PDF 레이어 겹침, `overflow:hidden` 부모에서 클리핑

---

### 4-4. Orphan CSS

| 클래스 | 위치(대략) | 위험도 |
|--------|------------|--------|
| `.rule-set-name` | ~1603 | 중간 — rule-set UI 제거 잔재 |
| `.panel-right-placeholder` | ~1560 | 낮음 |
| `.ruleset-panel__*` 대부분 | — | 중간 — feedback 등 일부만 사용 |

---

### 4-5. 대문 PC 동결 기준

| 항목 | 내용 |
|------|------|
| JSX 기준 커밋 | `5a5cb7a` (`WelcomeScreen.jsx`) |
| PC CSS | `index.css` `—— 대문` 블록 — mobile `@media` 없어야 함 |
| 검증 | `git diff 5a5cb7a -- src/components/WelcomeScreen.jsx` |

---

## 5. AI 생성 코드 흔적 분석

| 징후 | 위치 | 위험도 | 비고 |
|------|------|--------|------|
| git 해시 주석 | `welcome-gate-mobile.css` | 낮음 | 문서용 |
| CSS **반씩만** 분리 | welcome O, momo X | **높음** | patch 반복 패턴 |
| App↔MainScreen dead props | §1-4 | **높음** | |
| migrate 미연결 | `builtInRules.js`, `cautionRules.js` | **높음** | |
| `@deprecated` API 다수 | `printedPageDisplay.js` | 중간 | |
| PDF 목업 주석/클래스 | `index.css` PdfCenterStage 근처 | 낮음 | |

**양호:** 현재 `WelcomeScreen.jsx`에 PC/mobile 이중 마크업 + `display:none` 패턴 **없음**

---

## 6. 유지보수성 및 기술부채

### 6-1. 지금 수정해도 되는 것 (PC 안정 + mock 유지)

1. Dead props/CSS 정리 — App↔MainScreen 계약 (A) UI 복구 vs (B) props 삭제
2. 규칙 토글 persist 정책 확정 (§3-2)
3. 모모 room `@media`만 별도 파일 이동
4. `scheduleRuleSetsSave`에서 `ruleSetsRef.current` flush (선택, 낮은 리스크)

### 6-2. 지금 건드리면 위험한 것

| 영역 | 이유 |
|------|------|
| `ruleEngine.js`, `regexFromFind.js` | 검사 정확도 핵심, 테스트 있음 |
| `migrateCompoundRules.js` | 버전 8, 로드마다 영향 |
| `sessionStore.js`, `useWorkSession.js` | 복원 경로 복잡, 테스트 없음 |
| `pdfService.js` 하이라이트 좌표 | PDF UI 핵심 |
| 대문 PC `WelcomeScreen.jsx` + `index.css` welcome 기본 블록 | 최근 분리·복구 경계 |
| `MainScreen` 레이아웃 그리드 전면 변경 | PC 작업 화면 전체 |

### 6-3. 기능 추가 시 터질 가능성 높은 영역

1. 규칙 세트 UI를 App props만 보고 복구할 때 (MainScreen 미배선)
2. `index.css`에 welcome/momo `@media` 재통합
3. 시트 sync + `SPELLING_RULES_FP` 변경 without migrate 연결
4. compound migration 버전 올리기 without 사용자 공지
5. 세션 저장 포맷 변경 without migration

### 6-4. 리팩토링 우선순위 (구조만, PC 유지)

| 순위 | 항목 | 이유 |
|------|------|------|
| P0 | localStorage toggles 정책 (§3-2) | 데이터 신뢰 |
| P0 | App↔MainScreen 계약 (§1-4) | 드리프트 제거 |
| P1 | `index.css` 경계 분리 (momo mobile 파일화) | 회귀 반경 축소 |
| P2 | `useRuleSets` 추출 | App.jsx 축소 |
| P3 | hooks 통합 테스트 | session + afterCheck |
| P4 | sync validate | JSON 파이프라인 |

---

## 7. 최종 요약

### 7-1. 구조 건강도 평가

**종합: 5.5 / 10 — "도메인(lib)은 단단, UI·CSS·저장 계약은 취약"**

| 강점 | 약점 |
|------|------|
| 규칙 엔진·compound·맞춤법 JSON 파이프라인 | monolithic CSS |
| `src/lib/**` 테스트 다수 | App/MainScreen 계약 붕괴 |
| PDF publish gate | localStorage가 toggles 미저장 |
| | hooks·session 무테스트 |
| | 모바일 CSS 분리 절반만 완료 |

---

### 7-2. 기술부채 TOP 10

| # | 항목 | 위험도 |
|---|------|--------|
| 1 | `index.css` 단일 파일 (~5,271줄) | 치명적 |
| 2 | `ruleSetsStorage` toggles strip → 새로고침 설정 소실 | 높음 |
| 3 | `migrateBuiltInEnabled` / `migrateCautionEnabled` 미연결 | 높음 |
| 4 | `MainScreen` dead rule-set props + `onSaveRules` 미사용 | 높음 |
| 5 | `useRuleCheck` + `useWorkSession` 강결합, 테스트 없음 | 높음 |
| 6 | `sessionStore` 복원 경로, 테스트 없음 | 높음 |
| 7 | 모바일 CSS 분리 불일치 (welcome만 분리) | 높음 |
| 8 | `App.jsx` god component | 중간 |
| 9 | JSON/sync 런타임 validation 없음 | 중간 |
| 10 | orphan CSS + deprecated `printedPageDisplay` | 중간 |

---

### 7-3. 가장 위험한 CSS 구조

1. **`src/index.css` monolith** — 변경 영향 반경 불명확
2. **대문 PC 블록** (`—— 대문` ~ `—— 비밀 페이지` 직전) — mobile 작업 시 base selector 오염
3. **모모의 방 mobile `@media` in index** (5151–5271) — welcome과 정책 불일치
4. **전역 `.panel-left input` 등** — 컴포넌트 격리 없음

---

### 7-4. 모바일 mock 전략 유지 시 최소 수정 권장안

1. **고정:** `WelcomeScreen.jsx` + `index.css` 대문 PC + `welcome-gate-mobile.css`만 mobile 수정
2. **다음 1건:** `momo-room-mobile.css`로 5151–5271만 잘라내기 (PC momo 블록 변경 X)
3. **금지:** JSX 이중 span, `data-dev-layout` 트릭, base `.welcome-gate` 전역 변경, 새 breakpoint
4. **breakpoint:** 960px / 640px만 유지
5. **검증:** PC 1215px+ + `git diff 5a5cb7a -- WelcomeScreen.jsx`

---

### 7-5. 지금 절대 건드리면 안 되는 영역

- `src/lib/ruleEngine.js`, `regexFromFind.js`
- `src/lib/migrateCompoundRules.js` (버전 전략 없이)
- `src/lib/sessionStore.js`, `src/hooks/useWorkSession.js`
- `src/lib/pdfService.js` (하이라이트)
- 대문 **PC** JSX/CSS (모바일 파일만)
- `scripts/sync-spelling.mjs` 등 (fingerprint 연쇄)

---

### 7-6. AI가 계속 수정하면 망가지기 쉬운 영역

1. 잘못된 git 커밋으로 PC/모바일 "복구"
2. `index.css`에 `@media` 재삽입 → mobile 파일 분리 무력화
3. Welcome에 mobile-only JSX + `display:none`
4. `normalizeRuleSet` / compound migration "정리"
5. App rule-set 로직만 정리하고 MainScreen과 불일치 악화
6. 전역 CSS 리네임 without 전체 grep

---

## 8. 신뢰 회복용 검증 명령

```powershell
cd C:\Users\gikan\Documents\pdf-publish-proofread

# 대문 PC JSX 고정
git diff 5a5cb7a -- src/components/WelcomeScreen.jsx

# App resync 등 최근 변경
git diff HEAD -- src/App.jsx

# mobile 분리 파일 상태
git status -- src/styles/welcome-gate-mobile.css src/index.css src/main.jsx

# lib 회귀
npm test
```

---

## 부록: 주요 파일 줄 수 (감사 시점)

| 파일 | 줄 수 |
|------|-------|
| `src/index.css` | 5,271 |
| `src/App.jsx` | 408 |
| `src/components/MainScreen.jsx` | 446 |
| `src/hooks/useRuleCheck.js` | 505 |

---

*본 문서는 구조 감사 결과물이며, 코드 자동 수정을 포함하지 않습니다.*
