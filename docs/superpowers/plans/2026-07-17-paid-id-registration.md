# 유료화 ID 등록 — 구현 계획

**스펙:** [`docs/superpowers/specs/2026-07-17-paid-id-registration-design.md`](../specs/2026-07-17-paid-id-registration-design.md)  
**날짜:** 2026-07-17  
**상태:** 구현 대기 (스펙 확인 완료)

---

## 목표

1. 무료 **슬롯 1** / 유료 **슬롯 3**, 유료는 검수·결과 다운 **일일 한도 면제**
2. 관리자가 **이메일**로 `plan: paid|free` 등록·해제 (Callable + rules)
3. 마이페이지 **관리자 전용** UI
4. 공유는 유료만 (게이트 우선; 본구현은 있으면 연결)

---

## 작업 단위

### P0 — 혜택 게이트 (앱만, Function 없이 먼저 체감)

| # | 작업 | 파일 (예상) | 완료 기준 |
|---|------|-------------|-----------|
| 1 | 슬롯 상한: free=1, paid=3, admin exempt 유지 | `criteriaPresetLimit.js` (+ test), 호출부 `uid`/`email`/`plan` 전달 | 단위 테스트 free/paid/admin |
| 2 | `maxSlots` UI·게이지가 plan 반영 | `mypageProjectDisplay.js`, `MyPageWindowScreen` / library hooks | 무료 1/1, 유료 3/3 표시 |
| 3 | 유료 검수·export 쿼터 면제 | `betaDailyQuota.js` (+ `isPaidPlan` 또는 profile 인자), `useBetaDailyQuota` | paid면 tab/export 소진 안 함 |
| 4 | 프로필에서 plan 읽어 게이트에 넘기기 | `useUserProfileSync` / 마이페이지·MainScreen 경로 | 클라우드 plan 변경 후 리로드 반영 |

**수동 스모크 (P0):** Firestore에서 `profile.plan`을 잠깐 `paid`/`free`로 바꿔 슬롯·검수 한도 확인.

---

### P1 — Callable + Firestore rules

지금 레포에 `functions/` 없음 → **신규 패키지** 추가.

| # | 작업 | 내용 |
|---|------|------|
| 5 | `functions/` 부트스트랩 | Node 20, `firebase-functions` v2 `onCall`, Admin SDK |
| 6 | `setUserPlanByEmail({ email, plan })` | allowlist(호출자 uid/email ↔ env `BETA_QUOTA_ADMIN_*` 서버 쪽) → Auth `getUserByEmail` → `userCriteria/{uid}` merge `profile.plan` + `paidUpdatedAt`/`paidUpdatedBy` |
| 7 | `listPaidUsers` (최소) | paid 목록 — 구현 부담 크면 **등록/해제만** 먼저, 목록은 후순위 |
| 8 | `firestore.rules` | `profile.plan` (및 paid* 메타) **클라이언트 write 금지**; 나머지 프로필 필드는 기존 본인 write 유지 |
| 9 | 클라이언트 래퍼 | `src/lib/paidPlanAdminCloud.js` — `httpsCallable` |

**배포:** `firebase deploy --only functions,firestore:rules` (운영 메모를 스펙 §에 맞춤).

**환경 변수:** Functions에 관리자 uid/email 목록 (클라이언트 `VITE_*`와 동일 값, 서버 env로).

---

### P2 — 관리자 UI

| # | 작업 | 내용 |
|---|------|------|
| 10 | 관리자 여부 헬퍼 | 기존 `isBetaQuotaAdminExempt` 재사용 |
| 11 | 마이페이지 메뉴 | 관리자만 「유료 회원 등록」 |
| 12 | 패널 UI | 이메일 + 등록/해제, 결과·오류 메시지 (미가입 안내 포함) |
| 13 | 등록 후 | 대상이 본인이면 프로필 리로드; 목록이 있으면 갱신 |

스타일: 기존 `my-page.css` / 허브 패턴. 카드는 각진 모서리, 칩·뱃지는 둥글게 유지.

---

### P3 — 공유 게이트

| # | 작업 | 내용 |
|---|------|------|
| 14 | 「공유」클릭 | `isPaidPlan` false → 기존/통일 「유료회원 전용」 안내 |
| 15 | true | 현재 공유 동작(또는 TODO 스텁) 유지 |

공유 본구현이 미완이면 **게이트만** 넣고 본구현은 이 계획 밖.

---

## 테스트 체크리스트

- [ ] `criteriaPresetLimit`: free 1, paid 3, admin 무제한
- [ ] `betaDailyQuota`: paid 면제
- [ ] Function 모킹: 비관리자 deny, 없는 이메일 not-found, 등록/해제 멱등
- [ ] UI: 비관리자 메뉴 없음
- [ ] 회귀: 스냅숏·허브 다운 (기존 paid 경로)

---

## 구현 시 주의

- `saveUserProfileCloud`가 `plan: 'free'`로 **덮어쓰지 않게** (이미 기본값 처리 있으면 paid 유지 확인)
- CRLF-only 파일은 커밋하지 않음
- 결제 UI·초대 코드·미가입 예약 등록은 하지 않음

---

## 추천 진행 순서

**이번 대화/PR 1:** P0 (게이트) — 체감 빠름, Function 전에도 수동 plan으로 검증  
**PR 2:** P1 + P2 (Callable + 관리자 UI)  
**PR 3:** P3 (공유 게이트)

---

## 다음 액션

구현 시작 시 **P0부터** 진행. 승인 후 코드 작업 시작.
