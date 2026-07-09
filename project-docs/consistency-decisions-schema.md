# 표기 통일 「확정 대장」스키마 (1페이지 초안)

**상태:** 합의 초안 (2026-07-09) · 구현 전  
**관련:** [`mypage-project-design.md`](./mypage-project-design.md) · [`mypage-wire-spec.md`](./mypage-wire-spec.md) · [`structure.md`](./structure.md) · [`criteria-count-model.md`](./criteria-count-model.md)  
**범위:** 통일형 📌 확정 이력 — MVP는 `kind: 'unify'`만

---

## 1. 정의

**확정 대장** = 프로젝트(`RuleSet`) 안에 쌓이는 **append-only 결정 레코드**.  
「제미니 · 제 미니 · 제미 니 → 제미나이」처럼 **어떤 변형들을 어떤 표기로 확정했는지**를 팀·공유자가 나중에 다시 볼 수 있게 한다.

| 저장소 | 역할 | 이 대장과의 관계 |
|--------|------|------------------|
| `workHistory[]` | 검수 **세션**마다 지적 **건수** (일지) | 성격 다름 — **합치지 않음** |
| `customRules` | **현재 활성** 통일형·찾기 규칙 (상한 3) | 대장은 **기억·경고**; 엔진이 실제로 잡는 건 여전히 활성 규칙 |
| `consistencyDecisions[]` | 확정 **결정** 이력 (대장) | **신규** — Firestore `userCriteria.ruleSets[]` 기존 경로 |

**공유의 핵심:** 확정 이력이 프로젝트에 쌓여 **같은 `ruleSets[]` 경로로 넘어가야** 다른 편집자가 「이미 제미나이로 확정됨」을 알 수 있다. 지금은 그 대장이 없어 같은 변형을 다시 잡을 수 있다.

---

## 2. 작업 이력 탭 — 합의한 이야기 (2026-07)

### 2.1 왜 「작업 이력」인가

편집자가 마이페이지에서 묻는 질문은 두 갈래다.

| 궁금한 것 | 자연스러운 위치 |
|-----------|----------------|
| 언제 검수했는지, 몇 건 나왔는지 | 작업 이력 — **검수 진행**(sparkline·건수) |
| 무엇을 무엇으로 통일하기로 **확정**했는지 | 작업 이력 — **확정 대장** |
| 지금 검수에 쓰는 규칙 on/off·등록 | 맞춤법 / 표기 통일 / 본보조 **설정** 탭 |

「제미나이로 이미 확정했나?」는 **프로젝트의 시간 축** 이야기이므로 설정 탭이 아니라 **작업 이력**이 맞다.

### 2.2 같은 탭, 데이터는 두 층 (저장도 분리)

```
┌─ 작업 이력 (UI) ─────────────────────────────┐
│  [검수 진행]  sparkline — 건수 추이            │  ← workHistory[] (일지)
│  [표기 통일]  4분류 칩 + (선택) 최근 1회 분해   │  ← customRules 스냅샷 (현재 기준)
│  [확정 대장]  📌 결정 목록 (시간순)             │  ← consistencyDecisions[] (신규)
└──────────────────────────────────────────────┘
```

- **`workHistory`에 대장을 얹지 않는다** — 세션 건수와 결정 레코드는 성격이 다르다.
- UI는 **한 탭**에 모으되, 도메인·저장은 **배열을 분리**한다.

### 2.3 지금 구현의 함정 — 「표기 통일(최근)」

현재 `ProjectWorkHistoryChart`의 「표기 통일(최근)」은 이름과 달리 **이력이 아니다**.

| | 검수 진행 (sparkline) | 표기 통일(최근) |
|--|----------------------|-----------------|
| 데이터 소스 | `workHistory[]` | **`customRules` 스냅샷** |
| 의미 | 검수 **세션**별 건수 추이 | **지금** 등록된 찾기·통일형·공통문자열·제외 |
| 통일형 📌 | — | `buildWorkHistoryUnifyCriteria()`로 variants + pinned 표시 |

검수를 하지 않아도 칩이 보일 수 있다(등록만 해도). MVP 이후 **확정 대장** 섹션을 추가하고, 「(최근)」 블록은 **현재 기준 스냅샷**임을 유지하거나 라벨을 조정한다.

### 2.4 기둥별 표시 방식 (합의)

출판 비유: **일지**(몇 건) vs **체크리스트**(무엇을 보는지) vs **교정 대장**(무엇으로 확정했는지).

| 기둥 | 작업 이력 UI | 이유 |
|------|-------------|------|
| **맞춤법** | sparkline **2행** — 편집자 검토 / 맞춤법 | 검수 화면과 동일 분리. 한 줄로 합치면 「무엇이 줄었는지」 안 보임 |
| **본용언+보조용언** | sparkline 1행 | 기준 목록이 비교적 고정 → 추이 읽기 유효 |
| **표기 통일** | sparkline **없음** | 기준이 자주 바뀜(등록·📌·제외). 합계 꺾은선은 ↓=교정 효과로 **오해**하기 쉬움 |
| **표기 통일** | 4분류 칩(찾기 / 통일형 / 공통 문자열 / 제외) | 「이 프로젝트가 **무엇을 보고 있는지**」 스냅샷 |
| **표기 통일** | (선택) 최근 1회 **종류별 건수** 한 줄 | 합계만 두지 않고 find·unify·commonString 분해 |

`WorkHistoryEntry`는 위를 위해 `editorReview`·`spelling`·`consistencyFind`·`consistencyUnify`·`consistencyCommonString`·`bonBojo` 등 **건수 필드**를 갖는다. **매핑 문자열은 없다.**

### 2.5 확정 대장과 작업 이력 UI의 관계

| | 확정 대장 | 표기 통일(최근) 칩 |
|--|----------|-------------------|
| 시간 축 | ✅ append, 최신 우선 조회 | ❌ 현재 스냅샷만 |
| 📌 묶음 | `pinned` + `variants[]` 레코드 | UI상 variants → 📌 한 줄 |
| 공유 가치 | 「언제·무엇으로 확정」 | 「지금 무엇을 검사 중」 |

pin 시 스냅샷은 `buildWorkHistoryUnifyCriteria()`와 **동일 shape** — 등록은 낱개 rule이어도 📌 직후 `customRules`에서 묶음 전체를 읽을 수 있음 (코드 확인 완료).

---

## 3. RuleSet 확장 (스키마)

```ts
// ruleSetsStorage.RuleSet 에 optional 추가
consistencyDecisions?: ConsistencyDecision[]
```

### 3.1 판별 유니온 (kind별 필드)

호출부는 `kind`를 보고 필드를 읽는다. `pinned`를 모든 kind에 가정하지 않는다.

```ts
type ConsistencyDecisionBase = {
  id: string;
  at: string;           // ISO 8601
  byUid?: string;
};

type UnifyConsistencyDecision = ConsistencyDecisionBase & {
  kind: 'unify';
  pinned: string;       // 📌 확정 표기 (= pin 대상 tailWord)
  variants: string[];   // pinned 제외, 같은 통일 그룹의 나머지
};

type FindConsistencyDecision = ConsistencyDecisionBase & {
  kind: 'find';
  query: string;
};

type CommonStringConsistencyDecision = ConsistencyDecisionBase & {
  kind: 'commonString';
  pattern: string;
};

type ConsistencyDecision =
  | UnifyConsistencyDecision
  | FindConsistencyDecision
  | CommonStringConsistencyDecision;
```

**MVP:** `UnifyConsistencyDecision`만 append·열람·중복 경고.

### 3.2 pin payload — `variants[]` 확정

- 등록·오버레이는 correction 1개씩이지만, **📌 성공 직후** `listConsistencyUnifyEntries` + `getConsistencyUnifyPinnedTailWord`로 묶음 구성 가능.
- 📌 **설정** 시에만 append; 재클릭 **해제**는 기록하지 않음.
- `pinned`는 등록된 표기 **중 선택한 하나**(별도 4번째 canonical 문자열 아님).

### 3.3 조회 (MVP)

- 저장·비교: `normalizeConsistencyVariant()`
- 최신 우선: variant를 `variants[]`에 포함하는 레코드 중 **`at` 최대**의 `pinned` ( `supersededAt`은 2단계)

```ts
resolvePinnedForVariant(
  decisions: ConsistencyDecision[],
  rawVariant: string,
): string | null
```

---

## 4. 클린 아키텍처 — 계층 배치 (재확인)

이 repo는 **완전한 헥사곤은 아니지만**, [`structure.md`](./structure.md) · [`mypage-wire-spec.md`](./mypage-wire-spec.md)와 같은 **안쪽=도메인 / 바깥=UI·저장** 규칙을 따른다. 확정 대장도 **검수 로직(`ruleEngine`)과 분리**한다.

### 4.1 계층 표

| 계층 | 역할 | 확정 대장·작업 이력 관련 파일 (현재·추가) |
|------|------|------------------------------------------|
| **Entity** | 프로젝트에 붙는 데이터 shape | `ruleSetsStorage` (`RuleSet`, `workHistory`, `consistencyDecisions`) |
| **Domain / use case** | 순수 함수·규칙, React/Firebase 무관 | `projectWorkHistory.js` (일지 append·상한) · **신규** `consistencyDecisions.js` (append·resolve) · `consistencyUnifyRegister.js` (pin **도메인** 연산) |
| **Presentation** | RuleSet → 화면용 DTO·좌표 | `workHistorySparkline.js` · `workHistoryConsistencyCriteria.js` · (대장) `workHistoryDecisionLedger.js` 등 **읽기 전용** 매퍼 |
| **Adapter** | 영속·동기화 | `ruleSetsStorage.js` · `ruleSetsCloud.js` · `ruleSetNormalize.js` |
| **UI** | 렌더·이벤트, 저장 직접 호출 금지 | `ProjectWorkHistoryChart.jsx` · `ConsistencyUnifySection.jsx` → **Port/훅** 경유 |

**의존 방향:** `UI → presentation → domain → entity 타입` · `adapter → domain 호출` · **`ruleEngine`은 1단계에서 `consistencyDecisions`를 읽지 않음** (freeze).

### 4.2 Port (마이페이지 패턴과 정합)

[`mypage-wire-spec.md`](./mypage-wire-spec.md)의 Library Port와 같이, 화면은 저장소를 직접 모르게 한다.

| Port (개념) | 책임 | 확정 대장 |
|-------------|------|-----------|
| **Library / Project hub** | 메타·기준 토글·작업 이력 **표시** | `useMyPageProjects` / `updateProjectCriteria` 경로 |
| **Workbench** | 규칙 편집·📌 | pin 성공 → **domain** `appendUnifyDecision` → `persistProjectSets` |
| (2단계) **Share preview** | 읽기 전용 | `consistencyDecisions` 포함 스냅샷 |

UI(`ConsistencyUnifySection`)는 `onApplyRules` 콜백만 호출하고, **append는 use case 한곳**에서 처리한다 (pin 훅 후 `buildWorkHistoryUnifyCriteria` 스냅샷 → `appendUnifyDecision`).

### 4.3 하지 말 것 (YAGNI·freeze)

- `workHistory` 배열에 매핑 문자열 필드 추가 — **금지** (일지·대장 혼합).
- `ProjectWorkHistoryChart`가 `localStorage` / Firestore 직접 접근 — **금지**.
- 1단계에서 `ruleEngine`이 대장을 읽어 자동 교정 — **2단계·별도 합의**.
- Presentation이 pin·append 수행 — **금지** (읽기 매퍼만).

### 4.4 대장 ≠ 활성 상한 3

`MAX_CONSISTENCY_UNIFY_SLOTS = 3`은 **활성 검수 기준** 상한. 대장은 **기억·경고**용이며 상한을 대체하지 않는다. 검수 시 실제로 잡는 것은 여전히 활성 `customRules` 최대 3건.

---

## 5. 적재·UI·freeze 단계

| 시점 | 동작 |
|------|------|
| `applyConsistencyUnifyPin` 성공 후 | domain `appendUnifyDecision` → `consistencyDecisions` 1건 |
| 저장 | 기존 `saveRuleSets` / `saveRuleSetsCloud` |
| 작업 이력 탭 | 일지(sparkline) + 현재 기준 칩 + **확정 대장** 섹션 분리 |

| 단계 | 내용 | freeze |
|------|------|--------|
| **1단계 MVP** | append, 대장 열람, 동일 variant **읽기 전용 경고** | ruleEngine·regex **미변경** |
| **2단계** | 검수 자동 차단, 공유·엑셀 | 별도 합의 |

---

## 6. 용량·상한 (방향)

- append-only → Firestore 1MB·비용. 수십~수백 건은 MVP에 충분.
- 장기: `MAX_CONSISTENCY_DECISIONS` 또는 아카이빙 검토.
- 통일형 활성 상한 3의 배경(성능·UI·문서 크기)은 유지 — 대장 도입이 이를 **풀지 않음**.

---

## 7. 구현 체크리스트 (스키마 합의 → MVP)

1. `ruleSetsStorage` / `ruleSetNormalize` — `consistencyDecisions` optional
2. **`lib/consistencyDecisions.js`** — `appendUnifyDecision`, `resolvePinnedForVariant` (domain)
3. pin 성공 경로 — domain append → 기존 persist
4. **`presentation/workHistoryDecisionLedger.js`** — decisions → 탭용 DTO (읽기)
5. `ProjectWorkHistoryChart` — 확정 대장 섹션 추가 (일지·칩과 분리)
6. (1단계) variant 재📌 시 경고

## 비범위

- `workHistory`에 매핑·결정 레코드 합치기
- 1단계 검수 엔진 연동
- ruleEngine / regex / spelling 매칭 변경
