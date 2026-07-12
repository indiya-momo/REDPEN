# 둘러보기 PostHog Product Analytics

**날짜:** 2026-07-12  
**상태:** 구현됨 (2026-07-12)

## 목표

PostHog에서 **일별**로 아래 두 지표를 본다.

1. 「먼저 둘러보기」를 누른 **사람 수** (Unique users)
2. 둘러보기 **7번 말풍선(`WORK_EXIT`)까지 완료**한 사람 수 (Unique users)

중간 단계 퍼널·로그인 전환은 이번 범위 밖이다.

## 이벤트

| 이벤트 | 시점 | 조건 |
|--------|------|------|
| `guest_browse_started` | 대문 「먼저 둘러보기」→ `beginGuestBrowse()` | 1회 클릭당 1회 capture |
| `guest_browse_completed` | `WORK_EXIT` 말풍선 dismiss | **둘러보기 세션 중**일 때만 |

속성(최소):

- `source`: `'welcome'` (시작) / `'work_exit_guide'` (완료) — 나중에 확장용
- 기존 공통 규칙 준수: 이메일·원고 내용 등 PII 미전송

## PostHog에서 보는 법 (Product analytics)

코드 이벤트 → **Product analytics** Insights. Web analytics 탭이 아님.

1. 사이드바 **Product analytics** → **New insight** (Trends)
2. 이벤트: `guest_browse_started`, `guest_browse_completed`
3. Aggregation: **Unique users** · Interval: **Daily**
4. Save 후 대시보드에 추가

또는 Personal API 키로 `npm run posthog:setup-beta` → 대시보드 「인디야 오픈베타」에 둘러보기 Trends·Funnel 자동 추가 (`project-docs/analytics-beta.md`).

## 구현 요지

- `src/lib/analytics.js`에 `trackGuestBrowseStarted` / `trackGuestBrowseCompleted` 추가 (`captureAnalytics` 경유, opt-out·큐 기존 동작 유지).
- 시작: `App.jsx` `onBrowse`에서 `beginGuestBrowse()` 직후(또는 직전) 호출.
- 완료: `MainScreen`에서 `WORK_EXIT` dismiss 시 `isGuestBrowsing()`(또는 동등 API)이면 completed 호출.
- 로그인 온보딩의 `WORK_EXIT`는 둘러보기가 아니므로 **보내지 않음**.
- `person_profiles: 'identified_only'` 유지 — 익명도 event + `distinct_id`로 Unique 집계 가능.

## 비범위

- 가이드 1~6 단계별 이벤트
- 둘러보기 → 구글 로그인 전환 이벤트
- Session replay / autocapture 재활성
- PostHog 대시보드 JSON 자동 생성(수동 Trends면 충분)

## 테스트

- unit: track 함수가 `captureAnalytics`에 올바른 이벤트명을 넘기는지(기존 analytics 테스트 패턴).
- 정책: 둘러보기 아닐 때 completed가 호출되지 않음(가드 로직 테스트 가능하면).

## 성공 기준

- PostHog Live events에 started / completed가 보인다.
- Daily Unique로 「시작 수」와 「7번 완료 수」를 나란히 비교할 수 있다.
