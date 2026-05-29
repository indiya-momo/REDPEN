# 안정화 이후 구조·회귀 재감사 리포트

| 항목 | 내용 |
|------|------|
| 작성일 | 2026-05-30 |
| 범위 | 안정화 1~5단계 + 2단계(husky/helpers) 이후 |
| 목적 | 회귀 검증, 구조 건강도, 데이터 무결성, 베타 운영 가능성 |
| 전제 | 기능 추가·UI 디자인 평가 제외 |
| 조치 | **분석만** — 자동 수정 없음 |

**기준 시점:** `main` (origin 대비 +4 commits), tag `v1.0.0-stabilized` → `b1165b6`  
**미커밋:** `MainScreen.jsx` helpers 분리, `src/utils/`  
**테스트:** `npm test` 88 passed (미커밋 helpers 테스트 포함 시)

---

## 목차

1. [안정화 6항목 달성도](#안정화-6항목-달성도-요약)
2. [구조 안정성 재감사](#1-구조-안정성-재감사)
3. [데이터 무결성 검증](#2-데이터-무결성-검증)
4. [CSS·레이아웃 영향 반경](#3-css-및-레이아웃-영향-반경-재검사)
5. [React 안정성 검증](#4-react-안정성-검증)
6. [AI 생성 코드 흔적](#5-ai-생성-코드-흔적-재감사)
7. [테스트·회귀 방지](#6-테스트-및-회귀-방지-체계-감사)
8. [운영 안정성](#7-운영-안정성-평가)
9. [최종 요약](#최종-요약)

---

## 안정화 6항목 달성도 요약

| # | 항목 | 상태 | 회귀 |
|---|------|------|------|
| 1 | localStorage persistence | **달성** | strip 제거, migrate 연결 |
| 2 | App ↔ MainScreen 계약 | **부분** | props 유지, UI 미배선 그대로 |
| 3 | mobile CSS 분리 | **달성** | welcome/momo `@media` 분리 |
| 4 | `useRuleSets()` | **달성** | App ~179줄, hook ~285줄 |
| 5 | JSON schema/sync | **달성** | validate + sync assert + CI |
| 6 | smoke test | **달성** | 8건 + storage round-trip |

---

## 1. 구조 안정성 재감사

### 1-1. App.jsx 책임 감소

| 필드 | 내용 |
|------|------|
| **파일명** | `src/App.jsx` |
| **문제 위치** | 전체 (~179줄, 이전 ~408줄) |
| **현재 상태** | 라우팅 + 토글 quota + `useRuleSets()` 소비만 |
| **이전 대비 개선** | **개선** — rule-set CRUD/autosave/normalize 이전 |
| **남은 위험성** | 토글 정책이 App inline handler에 잔존 |
| **실제 발생 가능한 버그** | quota 검사와 storage 정책 불일치 시 혼란 |
| **위험도** | **낮음** |
| **수정 권장 여부** | 선택 (토글 handler를 hook/정책 모듈로) |
| **지금 수정해도 안전한지** | **예** (동작 동일 추출만) |

### 1-2. useRuleSets 경계

| 필드 | 내용 |
|------|------|
| **파일명** | `src/hooks/useRuleSets.js` |
| **문제 위치** | `normalizeRuleSet` export (35–58), resync effect (171–190) |
| **현재 상태** | load/save/CRUD/autosave/migrate/resync 한 hook에 집중 |
| **이전 대비 개선** | **개선** — App에서 분리, 동작 동일 |
| **남은 위험성** | `normalizeRuleSet`이 hook 파일에 있어 lib·테스트가 hook에 결합 |
| **실제 발생 가능한 버그** | resync가 spelling fingerprint만 런타임 감시 — caution JSON만 바뀌면 세션 중 미반영 |
| **위험도** | **중간** |
| **수정 권장 여부** | caution resync 대칭 추가 또는 문서화 |
| **지금 수정해도 안전한지** | **조건부** — migration/fingerprint 건드리면 위험 |

### 1-3. MainScreen dead props (계약 미완)

> **상세 계약 문서:** [`app-mainscreen-contract.md`](./app-mainscreen-contract.md)

| 필드 | 내용 |
|------|------|
| **파일명** | `src/components/MainScreen.jsx` |
| **문제 위치** | 56–74 destructure — `ruleSets`, `activeSetId`, `onSelectRuleSet`, `onCreateRuleSet`, `onDuplicateRuleSet`, `onDeleteRuleSet`, `ruleSetSavedAt`, `onRuleSetNameChange`, `onSaveRules` |
| **현재 상태** | **본문 미사용** (JSDoc/destructure만) |
| **이전 대비 개선** | **변화 없음** — “계약 정리” 목표 대비 미달 |
| **남은 위험성** | App은 CRUD·저장 유지, UI는 “준비 중” — 문서·코드 불일치 |
| **실제 발생 가능한 버그** | `onSaveRules` 존재 착각, rule-set UI 복구 시 배선 누락 |
| **위험도** | **중간** |
| **수정 권장 여부** | UI 복구 또는 주석/문서로 “세션+autosave만” 명시 (props 제거는 원칙상 금지) |
| **지금 수정해도 안전한지** | **예** (문서/주석만) |

### 1-4. Hook 결합 (useWorkSession ↔ useRuleCheck)

| 필드 | 내용 |
|------|------|
| **파일명** | `src/components/MainScreen.jsx`, `src/hooks/useWorkSession.js` |
| **문제 위치** | `afterCheckRef` 우회 (MainScreen 98–99) |
| **현재 상태** | **변화 없음** |
| **이전 대비 개선** | **동일** |
| **위험도** | **중간** |
| **지금 수정해도 안전한지** | **아니오** |

### 1-5. import 순환

| 필드 | 내용 |
|------|------|
| **현재 상태** | `lib/` 프로덕션 그래프 순환 없음 |
| **신규 결합** | `stabilization.smoke.test.js` → `hooks/useRuleSets.js` |
| **위험도** | **낮음** (테스트만) |

### 1-6. MainScreen helpers (미커밋)

| 필드 | 내용 |
|------|------|
| **파일명** | `src/utils/main-screen-helpers.js`, `src/components/MainScreen.jsx` |
| **현재 상태** | 순수 연산 추출 + `useMemo` 추가, JSX 동일 |
| **이전 대비 개선** | **개선** (인지 부하), 동작 동일 |
| **위험도** | **낮음** |
| **지금 수정해도 안전한지** | **예** (커밋 권장) |

---

## 2. 데이터 무결성 검증

### 2-1. Toggle persistence

| 필드 | 내용 |
|------|------|
| **파일명** | `src/lib/ruleSetsStorage.js`, `src/hooks/useRuleSets.js` |
| **문제 위치** | load/save 53–67; `normalizeRuleSet` 43–57 |
| **현재 상태** | `builtInEnabled`/`cautionEnabled` 저장됨; migrate 함수 연결됨 |
| **이전 대비 개선** | **크게 개선** (strip 제거 전: 새로고침 시 토글 소실) |
| **실제 발생 가능한 버그** | strip 이전 사용자 데이터는 복구 불가 |
| **위험도** | **낮음** (현재 정책 기준) |
| **지금 수정해도 안전한지** | **예** |

### 2-2. scheduleRuleSetsSave 클로저

| 필드 | 내용 |
|------|------|
| **파일명** | `src/hooks/useRuleSets.js` |
| **문제 위치** | 89–100 |
| **현재 상태** | 타이머가 closure `sets` 사용; `ruleSetsRef` 병행 갱신 |
| **이전 대비 개선** | **동일 패턴** (App에서 이전) |
| **실제 발생 가능한 버그** | 400ms 내 연속 patch 시 이론적 stale flush (드묾) |
| **위험도** | **낮음** |
| **지금 수정해도 안전한지** | **조건부** |

### 2-3. Fingerprint resync

| 필드 | 내용 |
|------|------|
| **파일명** | `src/hooks/useRuleSets.js` |
| **문제 위치** | 171–190 |
| **현재 상태** | `spellingRulesFingerprint !== SPELLING_RULES_FP`일 때만 normalize |
| **실제 발생 가능한 버그** | caution만 변경 + fingerprint 불일치 시 페이지 유지 중 migrate 지연 |
| **위험도** | **중간** |
| **지금 수정해도 안전한지** | **아니오** |

### 2-4. JSON validation

| 필드 | 내용 |
|------|------|
| **파일명** | `src/lib/validateDataJson.js`, `scripts/validate-data-json.mjs`, `scripts/sync-*.mjs` |
| **현재 상태** | sync 전 assert; `npm test`에 validate-data; deploy-pages에 npm test |
| **이전 대비 개선** | **개선** |
| **실제 발생 가능한 버그** | 런타임 import JSON은 검증 없음 |
| **위험도** | **낮음** |
| **지금 수정해도 안전한지** | **예** |

### 2-5. duplicateRuleSet toggles

| 필드 | 내용 |
|------|------|
| **파일명** | `src/lib/ruleSetsStorage.js` |
| **문제 위치** | 89–103 |
| **현재 상태** | 복사 시 toggles·fingerprint 필드 포함 |
| **이전 대비 개선** | **개선** |
| **위험도** | **낮음** |

---

## 3. CSS 및 레이아웃 영향 반경 재검사

### 3-1. index.css monolith

| 필드 | 내용 |
|------|------|
| **파일명** | `src/index.css` (~5,148줄, 이전 ~5,271) |
| **현재 상태** | welcome/momo mobile `@media` 제거; PC + momo prefers-reduced-motion만 |
| **이전 대비 개선** | **개선** (~123줄 감소) |
| **위험도** | **중간** (여전히 monolith) |
| **지금 수정해도 안전한지** | **아니오** (PC 블록 동결 전제) |

### 3-2. Mobile 분리 일관성

| 파일 | breakpoint | 상태 |
|------|------------|------|
| `src/styles/welcome-gate-mobile.css` | 960, 640 | 분리됨 |
| `src/styles/momo-room-mobile.css` | 960 | 분리됨 |
| `src/main.jsx` | fonts→index→welcome→momo | 유지 |

**이전 대비:** welcome/momo 정책 일관 (960 기준).

### 3-3. PC 레이아웃 동결

| 필드 | 내용 |
|------|------|
| **현재 상태** | `b1165b6`: welcome PC = `5a5cb7a` JSX; index welcome PC는 HEAD 대비 복구 |
| **잔여 차이** | `5a5cb7a` 대비 워크스페이스·모모 PC grid 등 index 변경은 baseline에 포함 |
| **신규 global selector** | `.panel-left-work-scroll .results-panel--consistency` 등 — PC 동결 “완전” 아님 |
| **위험도** | **중간** |
| **지금 수정해도 안전한지** | **아니오** |

### 3-4. breakpoint

| **현재 상태** | welcome 960/640, momo 960만 — 신규 breakpoint 없음 |
| **이전 대비** | 720px momo `@media` 제거 → 960 파일로 통합 |

---

## 4. React 안정성 검증

### 4-1. useRuleSets resync effect

| **위험도** | **중간** — deps에서 ruleSets 제외는 의도적 |
| **조용한 동작 변경** | **없음** |

### 4-2. MainScreen useMemo (미커밋)

| **현재 상태** | tabCheckDone, showPdfViewer, centerRunLabel, spellingTabLayoutClassName 등 |
| **과잉 여부** | 일부 과잉에 가깝 — 동작 동일 |
| **위험도** | **낮음** |

### 4-3. visibleOnCurrentPage

| **파일명** | `MainScreen.jsx` 136–139 |
| **현재 상태** | 매 렌더 `ruleCheck.countVisibleOnPage` — 이전과 동일 |
| **위험도** | **낮음~중간** |

### 4-4. Session restore

| **파일명** | `useWorkSession.js`, `sessionStore.js` |
| **테스트** | smoke 3건 (mock IDB) — 통합/E2E 없음 |
| **위험도** | **높음** (운영) / **중간** (구조) |
| **지금 수정해도 안전한지** | **아니오** |

### 4-5. async / unmount

| **현재 상태** | dev autoload, session persist — baseline과 동일 |
| **위험도** | **중간** |

---

## 5. AI 생성 코드 흔적 재감사

### 5-1. Husky CSS “검증” (신규 기술부채)

| 필드 | 내용 |
|------|------|
| **파일명** | `.husky/pre-commit` (커밋 `f9c36bf`, `ebbbd60`) |
| **문제 위치** | `grep "{" && ! grep "}"` on `index.css` |
| **현재 상태** | 실질적 검증 거의 없음 |
| **이전 대비** | **악화** — `5079e83` 단순 npm test보다 허상 안전망 |
| **커밋 메시지** | `ebbbd60` “isolate welcome gate…” — 실제 변경은 husky만 |
| **위험도** | **중간** |
| **지금 수정해도 안전한지** | **예** |

### 5-2. normalizeRuleSet in hook + smoke import

| **패턴** | 테스트가 lib가 아닌 hooks/useRuleSets import |
| **위험도** | **낮음** |

### 5-3. Dead props 유지

| **패턴** | 의도적 freeze — 계약 정리 목표와 불일치 |
| **위험도** | **중간** |

---

## 6. 테스트 및 회귀 방지 체계 감사

| 영역 | 커버 | 평가 |
|------|------|------|
| lib/ruleEngine | 다수 | 양호 |
| toggle persistence | storage + smoke | 개선 |
| session restore | smoke mock | 최소 |
| hooks/components | 없음 | 취약 |
| PDF pipeline | gate + fitScale | 부분 |
| sync validation | assert + validate-data | 양호 |
| pre-commit | npm test (88) | 양호 |
| pre-commit CSS grep | 무의미 | 위험 |

**다음 수정 안전망:** lib·JSON·storage 가능; session·MainScreen 통합 불충분.

---

## 7. 운영 안정성 평가

| 수준 | 해당 |
|------|------|
| 개인 프로젝트 | **충족** |
| 비공개 베타 | **조건부** (known issues 문서화 시) |
| 제한적 공개 베타 | **미달** |
| 실사용 가능 | **미달** |

### 운영 리스크 TOP 10

| # | 리스크 | 위험도 |
|---|--------|--------|
| 1 | sessionStore / useWorkSession 테스트 부족 | 높음 |
| 2 | index.css monolith (~5,148줄) | 치명적(유지보수) |
| 3 | MainScreen dead props / onSaveRules 미배선 | 중간 |
| 4 | Husky CSS grep 허상 검증 | 중간 |
| 5 | caution fingerprint 런타임 resync gap | 중간 |
| 6 | useWorkSession ↔ useRuleCheck 결합 | 중간 |
| 7 | 미커밋 MainScreen helpers | 중간 |
| 8 | husky 커밋 메시지·내용 불일치 | 낮음 |
| 9 | scheduleRuleSetsSave closure | 낮음 |
| 10 | 런타임 JSON validate 없음 | 낮음 |

---

## 최종 요약

### 1. 안정화 성공률

**약 75%** — persistence·CSS 분리·useRuleSets·JSON gate·smoke **달성**. App↔MainScreen 계약·session hardening **미완**.

### 2. 구조 건강도 (10점)

**6.8 / 10** (이전 ~5.5 → **+1.3**)

### 3. 아직 위험한 핵심 영역

1. `sessionStore` / `useWorkSession`
2. `index.css` monolith
3. MainScreen↔App 문서·UI 계약
4. caution fingerprint resync gap

### 4. 지금 건드리면 안 되는 영역

- `ruleEngine.js`, `regexFromFind.js`
- `migrateCompoundRules.js` (버전 정책 없이)
- 대문 PC `WelcomeScreen.jsx` + index welcome base
- `pdfService` 하이라이트
- baseline 이후 index PC 블록 임의 수정

### 5. 다음 단계로 안전하게 가능한 작업

- MainScreen helpers **커밋**
- Husky pre-commit을 **npm test only**로 정리
- dead props **문서화** (제거 없이)
- `normalizeRuleSet` → `lib/ruleSetNormalize.js` 이동만 (동작 동일)
- session smoke 1~2건 추가

### 6. 지금 즉시 중단해야 할 위험 작업

- index.css PC selector/레이아웃 전면 수정
- MainScreen props 제거
- mobile JSX 이중화 / 새 breakpoint
- husky “검증” 추가 without 실제 linter
- ruleEngine / compound migration 임의 정리

### 7. 베타 운영 가능성

> **테스터용 가이드:** [`private-beta-guide.md`](./private-beta-guide.md)

**제한적 비공개 베타 가능** — 전제:

- toggle persistence·JSON sync는 신뢰 가능
- session 복원 실패·rule-set UI 혼란은 known issue로 공지
- PC CSS는 `v1.0.0-stabilized` / `b1165b6` 기준 동결

**공개 베타**는 session 테스트·계약 정리·husky 정리 후 권장.

---

## 회귀 판정

핵심 사용자 데이터(toggle persistence)와 CSS mobile 분리·rule-set hook 분리는 **회귀 없이 개선**.

**조용한 동작 변경** 징후는 helpers/memo 수준에서 **미미**.

**신규 부채:** husky CSS grep, 미커밋 4단계 작업.

---

## 검증 명령 (재현용)

```powershell
cd C:\Users\gikan\Documents\pdf-publish-proofread

npm test
git log -5 --oneline
git status -sb
git diff v1.0.0-stabilized --stat

# persistence
git show b1165b6:src/lib/ruleSetsStorage.js

# mobile CSS
grep "@media" src/index.css
dir src/styles/*mobile*.css
```

---

*본 문서는 구조 감사 결과물이며, 코드 자동 수정을 포함하지 않습니다.*
