# 유료화 ID 등록 (운영자 관리 화면)

**상태:** 설계 합의 · 구현 전  
**날짜:** 2026-07-17  
**관련:** [`2026-07-16-paid-check-result-snapshot-design.md`](./2026-07-16-paid-check-result-snapshot-design.md), `src/lib/userPlan.js`, `src/lib/criteriaPresetLimit.js`, `src/lib/betaDailyQuota.js`

**비범위:** 결제·구독 UI, 초대 코드, 미가입 이메일 예약(가입 전 선등록), PDF 서버 업로드

---

## 1. 목표

운영자(로사)가 **관리자 전용 화면**에서 테스터 **이메일**을 등록하면 해당 계정의 `plan`이 `paid`가 되고, 아래 유료 혜택이 즉시 적용된다.  
일반 사용자는 자기 `plan`을 바꿀 수 없다.

---

## 2. 합의된 정책

### 2.1 등록 방식

| 항목 | 결정 |
|------|------|
| 주체 | 운영자만 (결제 없음) |
| UI | 앱 안 **관리자 전용 화면** (마이페이지) |
| 입력 | **이메일** |
| 관리자 판별 | 기존 `VITE_BETA_QUOTA_ADMIN_UIDS` / `VITE_BETA_QUOTA_ADMIN_EMAILS` |
| 권한 없는 접근 | 메뉴·API 모두 차단 |

### 2.2 무료 vs 유료 혜택

| 항목 | 무료 (`free`) | 유료 (`paid`) |
|------|---------------|---------------|
| 프로젝트 슬롯 | **1개** | **3개** |
| 검수 (맞춤법·표기통일 등) | 일일 한도 (기존 베타 쿼터) | **무제한** |
| 검수 결과 다운로드 (작업대 엑셀 등) | 일일 한도 | **무제한** |
| 검수 결과 자동 보관 | 없음 | 있음 (약 30일, 기존 스냅숏 설계) |
| 프로젝트 검수 이력 다운로드 | 불가 | **무제한** |
| 프로젝트 공유 | 불가 | **가능** (공유 본구현과 게이트를 같은 `isPaidPlan`에 연결) |

**코드 갭 (구현 시 맞춤):**

- 지금 `MAX_CRITERIA_PRESETS = 3`은 전원 3개 → **무료 1 / 유료 3**으로 분기.
- 일일 검수·export 한도는 `betaDailyQuota` → **유료면 면제** (`isPaidPlan`).
- 스냅숏·허브 다운은 이미 `isPaidPlan` 사용 중 → 유지·카피만 정리.
- 공유는 UI 일부만 있음 → 유료 게이트 + 최소 동작은 별도 구현 단위로 묶되, 혜택 표에는 포함.

### 2.3 무료 사용자가 유료 기능을 누를 때

기존처럼 「유료회원 전용입니다」 안내 + 확인.  
이번 범위에서 결제/신청 CTA는 넣지 않는다.

---

## 3. 현재 구조 (기준점)

- 판별: `src/lib/userPlan.js` — `normalizeUserPlan` / `isPaidPlan`
- 프로필 클라우드: `userCriteria/{uid}` 문서의 `profile.plan` (`userProfileCloud.js`)
- 프로젝트 슬롯: `criteriaPresetLimit.js` (`MAX_CRITERIA_PRESETS`)
- 일일 한도: `betaDailyQuota.js` (관리자 allowlist 면제는 이미 있음 — 유료와 **별축**, 둘 다 면제 가능)
- 스냅숏: `maybeSavePaidCheckResult.js` + 허브 `ProjectHubCheckResultsPanel.jsx`

---

## 4. 아키텍처

```
[관리자 마이페이지]
  이메일 입력 → 등록 / 해제
       │
       ▼
Callable Cloud Function (관리자 allowlist 검증)
  1) Auth에서 이메일 → uid 조회
  2) 계정 없으면 명확한 오류 반환
  3) userCriteria/{uid}.profile.plan = 'paid' | 'free'
       │
       ▼
클라이언트는 plan을 직접 setDoc 하지 않음
(기존 isPaidPlan 소비처가 혜택을 읽음)
```

### 4.1 왜 Callable인가

클라이언트가 `plan`을 쓰면 누구나 유료로 올릴 수 있다.  
이메일→uid 조회도 Admin SDK가 필요하다.  
따라서 **등록/해제는 서버(Callable)만** 수행한다.

### 4.2 관리자 화면 (마이페이지)

관리자 allowlist에 해당하는 로그인 사용자만:

- **유료 회원 등록**
  - 이메일 입력 + **등록** / **해제**
  - 현재 `paid` 목록 (이메일·등록 시각 — Function이 조회 가능하게 하거나, 별도 `paidMembers` 인덱스 문서는 구현 시 최소로)
- 미가입·미온보딩 이메일: 「해당 이메일로 가입·로그인(온보딩) 후 다시 등록」

### 4.3 클라이언트 게이트 (혜택 연결)

단일 진입점 유지: `isPaidPlan(profile)`.

| 모듈 | 유료일 때 |
|------|-----------|
| `criteriaPresetLimit` | 상한 3 (무료 1) |
| `betaDailyQuota` (검수·export) | 쿼터 미적용(면제) |
| `maybeSavePaidCheckResult` / 허브 다운 | 기존대로 허용 |
| 공유 진입점 | 유료만 진행, 무료는 안내 |

관리자 env 면제와 유료 면제는 **OR**: 관리자이거나 유료이면 해당 한도 면제.

---

## 5. 데이터

`userCriteria/{uid}` (기존):

```text
profile.plan: 'free' | 'paid'
profile.paidUpdatedAt?: number   // 등록/해제 시각 (선택, 목록·감사에 유용)
profile.paidUpdatedBy?: string   // 관리자 uid (선택)
```

클라이언트 `saveUserProfileCloud` 경로에서는 `plan` 필드를 **덮어쓰지 않거나**, 서버만 쓰도록 rules로 막는다.

### Firestore rules (필수)

- 본인: nickname 등 온보딩 필드는 기존처럼 본인 write
- `profile.plan` (및 paid* 메타): **클라이언트 write 금지** (Function Admin SDK만)
- Callable은 Admin SDK로 갱신하므로 rules와 충돌하지 않음

---

## 6. 오류·엣지

| 상황 | 동작 |
|------|------|
| 비관리자가 Function 호출 | permission-denied |
| 이메일 형식 오류 | invalid-argument + 안내 |
| Auth에 사용자 없음 | not-found + 「가입·로그인 후 등록」 |
| 이미 paid인데 재등록 | 성공(멱등) 또는 「이미 유료」 |
| 해제 시 이미 free | 멱등 성공 |
| Function 실패 | 토스트/다이얼로그로 재시도 유도 |

---

## 7. 테스트

- `userPlan` / 슬롯 상한 분기 단위 테스트 (free=1, paid=3, admin exempt)
- 쿼터: paid면 `canRunTabCheck`·export가 막히지 않음
- 관리자 UI: 비관리자에게 메뉴 미노출 (컴포넌트/헬퍼 테스트)
- Function: allowlist·이메일 조회·plan 기록 모킹 테스트 (functions 패키지 기준)

---

## 8. 구현 순서 (제안)

1. **혜택 게이트:** 슬롯 1/3 분기 + 유료 쿼터 면제 (`isPaidPlan`)
2. **Callable + rules:** 이메일 등록/해제, plan 클라이언트 write 차단
3. **관리자 마이페이지 UI:** 등록·해제·목록(최소)
4. **공유 게이트:** 유료만 (본구현이 뒤처져 있으면 게이트만이라도 먼저)
5. 스모크: 무료 1슬롯·유료 3슬롯·유료 무제한 검수·허브 다운·관리자 이메일 등록

---

## 9. 성공 기준

- 관리자가 테스터 이메일로 등록하면 재로그인 없이(또는 프로필 리로드 후) `isPaidPlan` true
- 무료는 프로젝트 1개, 유료는 3개
- 유료는 일일 검수·결과 다운 한도에 안 막힘
- 비관리자·일반 클라이언트는 `plan`을 유료로 올릴 수 없음
- 결제 UI 없음
