# 마이페이지 「나의 프로젝트」— 2026-06-24 합의·백로그

**상태:** 진행 중 (베타)  
**관련 문서:** [`mypage-project-design.md`](./mypage-project-design.md) (A+B·projectContext), [`mypage-wire-spec.md`](./mypage-wire-spec.md) (Library 카드 UX·ViewModel)  
**관련 커밋:** `a9d69d8` (v0.912) — Library 카드 로컬 연동·표시 2칸·프로젝트 저장 안정화

---

## 1. 오늘(2026-06-24) 확정한 정책

| 주제 | 결정 | 코드·비고 |
|------|------|-----------|
| **저장 쿼터** | 계정당 저장 가능 프로젝트 상한은 **기존 유지** (`MAX_CRITERIA_PRESETS = 1`). 오늘 변경 없음. | `src/lib/criteriaPresetLimit.js` |
| **마이페이지 그리드 표시** | 「나의 프로젝트」창(`?window=mypage`)에서 **보이는 칸만 최대 2개** (저장 카드 + 빈 슬롯 합산). 저장 쿼터와 **분리**. | `MYPAGE_PROJECT_CARD_DISPLAY_MAX = 2` — `src/lib/mypageProjectDisplay.js` |
| **3개 이상 저장 시** | 관리자·면제 계정 등 실제 저장은 3개 이상 가능하나, 마이페이지에는 **최근 `savedAt` 2개만** 노출. 나머지 접근 UX는 **미정**. | `planMyPageProjectGrid()` |
| **프로젝트 저장 UX** | 고정 N초 로딩 **없음**. 저장 버튼만 **실제 완료까지** 스피너 (localStorage + 클라oud `await`). | `MainScreen` + `handleSaveCriteriaPreset` |
| **데이터 유실 방지** | 로그아웃·대문 이동 전 `flushPendingRuleSetsSave()`. 저장 직전에도 pending flush. | `App.jsx`, `useRuleSets.js` |
| **실마이페이지 카드 UI** | 목업 `ProjectLibraryCard`(sheet-card)를 **로컬 RuleSet**에 연결. 목업 전용 URL은 `?window=mypage-mock` 유지. | `MyPageWindowScreen`, `ruleSetProjectCard.js` |
| **카드 파일 모양** | 태그 없어도 **저장일(또는 「프로젝트」) 탭** + `--sheet-*` 변수를 `.mypage__project-hub`에 적용. | `ProjectLibraryCard`, `mypage-prototype.css` |
| **준비중 문구** | 「프로젝트를 관리하고…(준비중)」 **제거**. | `MyPageWindowScreen` |

### 같이 반영된 UI (나의 프로젝트 범위 밖)

- 좌측 패널 기본 너비 **500px**
- 일관성 embed 2열 — 공통 문자열 ↔ 검수 제외 간격
- 검수 제외 예시 `'소녀시대'`만

---

## 2. 오늘 구현된 아키텍처 (요약)

```
RuleSet (localStorage / Firestore userCriteria)
    │
    ├─ buildProjectCardSummary()     … 구 spec dl/dt 요약 (테스트·호환)
    │
    └─ buildProjectCardViewModelFromRuleSet()  … Library 카드 Presenter
            │
            └─ ProjectLibraryCard (sheet-card UI)
                    │
MyPageWindowScreen ─ planMyPageProjectGrid() … 표시 2칸 슬라이스
```

| 파일 | 역할 |
|------|------|
| `src/presentation/ruleSetProjectCard.js` | RuleSet → `ProjectCardViewModel` (칩·counts·headline) |
| `src/lib/mypageProjectDisplay.js` | 마이페이지 그리드 **표시** 2칸 |
| `src/lib/projectCardSummary.js` | 활성 항목만 집계 (검수 팝업과 동일 기준) |
| `src/presentation/projectCardViewModel.js` | 카드 UI 계약·pillar 칩 미리보기 |
| `src/hooks/useRuleSets.js` | 저장·autosave·cloud·flush |
| `src/hooks/useMyPageProjects.js` | 마이페이지 read-only 로드·**저장 쿼터** 게이지 |

---

## 3. 내일(우선) 점검 — 스모크

**환경:** `http://127.0.0.1:5173` · PC ≥960px · 마이페이지 `?window=mypage`

### A. 저장 · 동기화 (최우선)

- [ ] 일관성 / 공통 문자열 / 검수 제외 `+` → **프로젝트 저장** → 알림
- [ ] **로그아웃 → 재로그인** → 검수 화면·마이페이지 모두 항목 유지
- [ ] 저장 **직후 즉시** 로그아웃해도 유지 (flush)
- [ ] **동일 이름** 저장 → 덮어쓰기 (카드 중복 생성 없음)

### B. 마이페이지 카드

- [ ] sheet-card 테두리·탭 보임
- [ ] 그리드 2칸 규칙 (0→빈2, 1→카드1+빈1, 2→카드2)
- [ ] 「이 프로젝트 작업하기」→ active 프로젝트 일치
- [ ] **비활성** 규칙은 칩·건수에서 제외
- [ ] mock vs real 레이아웃 동일 (`mypage-mock` / `mypage`)

### C. 정책·카피 확인

- [ ] 상단 **슬롯 1/1** vs 그리드 **2칸** — 사용자 혼란 없는지
- [ ] 면제 계정 3개+ 저장 시 2개만 보임 — **의도 확인** (아래 4단계 backlog)

**판정:** A 실패 시 → 카드 UI 작업 전에 `useRuleSets` / merge / cloud 만 수정.

---

## 4. 이후 해야 할 일 (백로그)

### 4-1. 1단계 — 실사용 가능 (베타 1차)

[`mypage-project-design.md`](./mypage-project-design.md) 구현 체크리스트와 연동.

| # | 작업 | 상세 | 상태 |
|---|------|------|------|
| 1 | `projectContext` 스키마 | `ruleSetsStorage` / `normalizeRuleSet` optional 필드 | ⬜ |
| 2 | 저장 시 PDF 메타 스냅샷 | `handleSaveCriteriaPreset` — MainScreen에서 PDF 메타 전달 | ⬜ |
| 3 | 검수 완료 시 메타 갱신 | active + `savedAt` 있을 때 `lastWorkedAt`·건수 debounce | ⬜ |
| 4 | ViewModel 메타 매핑 | `lastWork`, `formatProjectCardMetaLine` (원고 Np · 교차 · 판형) | ⬜ |
| 5 | 일정 줄 | `createdDate` / `lastWork.date` on card | ⬜ |
| 6 | 카드 ↔ 데이터 정합 | headline·칩 라벨 다듬기 (맞춤법 find→replace, 제외어 표현 등) | ⬜ |
| 7 | **이름 변경** | 카드 인라인 편집 → RuleSet `name` persist | ⬜ (현재: 준비 중 alert) |
| 8 | 준비중 문구 제거 | 나의 프로젝트 허브 | ✅ |
| 9 | Library 카드 UI 연동 | RuleSet → sheet-card | ✅ |
| 10 | smoke | 저장 → 마이페이지 칩·건수 일치 | ⬜ (내일 A·B) |

### 4-2. 2단계 — 카드 액션 · IA

[`mypage-wire-spec.md`](./mypage-wire-spec.md) Library 시나리오 중 **실데이터** 연결.

| # | 작업 | 비고 |
|---|------|------|
| 1 | **복제** | duplicate RuleSet → 새 이름 저장 |
| 2 | **공유 미리보기** | `SharePreviewModal` + `readOnly` (URL 토큰 B-0는 후순위) |
| 3 | **삭제** | 카드 vs 검수 화면만 — UX 결정 후 |
| 4 | **3개+ 프로젝트** | 2칸 초과분 — 「더 보기」/스크롤/페이지 중 택1 |
| 5 | **dirty 뱃지** | autosave 후 저장 전 변경 표시 (`card.dirty`) |
| 6 | **태그·메모** | ViewModel 필드 persist (RuleSet 확장 또는 별도 메타) |
| 7 | **태그 필터** | wire-spec Library 상단 (목업에만 있음) |
| 8 | **회원 혜택 카피** | `MyPageWindowScreen` MEMBER_BENEFIT_TIERS 「슬롯 1개」 vs UI 2칸 — **표시 정책 확정 후** 통일 |

### 4-3. 3단계 — 구조 정리

| # | 작업 | 이유 |
|---|------|------|
| 1 | `ProjectLibraryCard` 이동 | `mock/` → `components/` (실마이페이지가 사용 중) |
| 2 | CSS 분리 | `sheet-card` 스타일을 `my-page.css` 또는 전용 파일로 (prototype CSS 의존 제거) |
| 3 | Presenter 테스트 | `ruleSetProjectCard`·`projectCardSummary` 회귀 세트 |
| 4 | `?window=mypage-mock` | DEV 유지 vs 퇴역 시점 결정 |

### 4-4. 4단계 — 설계·유료 (나중)

- **저장 쿼터** 숫자 확정 (현재 1) — [`criteria-count-model.md`](./criteria-count-model.md), [`PRD.md`](./PRD.md)
- Workbench Port (와이어) — 규칙 편집은 당분간 **검수 화면**이 Workbench
- Folder·드래그·실시간 협업 — wire-spec 비범위
- 모바일 `welcome-mo` — **PC worktree에서 하지 않음**

---

## 5. 아직 연결 안 된 카드 액션 (현재 동작)

| UI | `?window=mypage` 동작 |
|----|------------------------|
| 이 프로젝트 작업하기 | ✅ `saveActiveSetId` + `returnToWorkspace` |
| 이름 클릭 편집 | ⛔ alert 「이름 변경 준비 중」 |
| 복제 | ⛔ alert |
| 공유 | ⛔ alert |
| 메모·태그 | ⛔ 미구현 |

---

## 6. 알려진 리스크 · 열린 질문

1. **표시 2칸 vs 저장 1개** — UI는 2칸 그리드, 쿼터 게이지는 1/1. 카피·교육 필요.
2. **2개 넘는 저장분** — 마이페이지에서 보이지 않음. 검수 화면 프로젝트 picker만 접근 가능한지 확인.
3. **클라oud merge** — `savedAt` 있는 로컬은 cloud가 덮지 않음 (`ruleSetsMerge.js`). 기기 간 동기화 시나리오 별도 smoke.
4. **칩 라벨 품질** — 맞춤법은 find/replace 축약, 목업 mock 카드보다 거칠 수 있음 (1단계 #6).
5. **`projectCardSummary` vs ViewModel** — 구 dl 요약은 코드에 남아 있으나 마이페이지 UI는 ViewModel 경로만 사용.

---

## 7. 추천 진행 순서 (한 줄)

**내일 스모크(A·B) → 1단계(projectContext·메타·rename) → 2단계(복제·공유·3개+ UX) → 3단계(컴포넌트·CSS 이사) → 4단계(쿼터·유료)**

---

## 8. 문서 갱신 규칙

- **정책·스키마 변경** → `mypage-project-design.md` 본문 수정
- **카드 UX·ViewModel 필드** → `mypage-wire-spec.md` 수정
- **일정별 합의·완료 체크** → **이 파일** (`mypage-project-backlog-YYYY-MM-DD.md`)에 추가하거나 새 날짜 파일 생성
