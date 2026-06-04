# 베타 분석 (PostHog) — 조용한 행동 수집

출판·교열 베타는 **말로 피드백을 잘 안 주는** 경우가 많아, **익명 행동 이벤트**만 수집합니다.  
PDF 원고·검사 문구·규칙 find/replace·피드백 본문은 **보내지 않습니다**.

---

## 설정 (가입 후 — wizard 없이도 됨)

이 저장소에는 **이미** `src/lib/analytics.js` 로 PostHog가 붙어 있습니다.  
`npx @posthog/wizard` 는 **새 프로젝트용 자동 설치**이고, 지금은 **키만 넣으면** 동작합니다.

### 1. PostHog에서 키 복사

1. [PostHog](https://eu.posthog.com) (또는 US) → 프로젝트 선택  
2. **Project settings** → **Project API key** (`phc_…` 로 시작)

EU에서 가입했으면 호스트도 EU를 씁니다.

### 2. `.env` (git에 올리지 않음)

```env
VITE_PUBLIC_POSTHOG_KEY=phc_여기에_붙여넣기
VITE_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

US 프로젝트면 호스트는 `https://us.i.posthog.com` (또는 PostHog가 안내하는 ingest URL).

### 3. dev 서버 재시작

```bash
npm run dev
```

대문에 베타 통계 안내가 보이고, PDF 열기·검사 실행 시 이벤트가 쌓입니다.  
PostHog **Live events** 탭에서 `session_start` 등이 오는지 확인하세요.

### wizard를 쓰고 싶을 때

터미널에서 프로젝트 루트:

```bash
npx -y @posthog/wizard@latest --region eu
```

- **대화형**으로 React/Vite를 고르면 `@posthog/react`·autocapture 설정을 **추가**할 수 있습니다.  
- **이 프로젝트는 autocapture OFF·이벤트 6개만** 쓰도록 맞춰 두었으므로, wizard로 코드를 덮어쓰지 말고 **키만 .env에 넣는 쪽**을 권장합니다.  
- 점검만: `npx -y @posthog/wizard@latest events-audit` (로그인/API 키 필요)

키가 없으면 SDK는 **로드하지 않습니다** (로컬·Pages 빌드 그대로 동작).

**Vercel 배포:** Marketplace에서 PostHog를 연결하면 `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` · `NEXT_PUBLIC_POSTHOG_HOST` 가 들어가며, 앱이 자동으로 읽습니다. 절차는 `project-docs/vercel-posthog.md`.

---

## 이벤트 6개 (수동 capture만, autocapture OFF)

| 이벤트 | 시점 | 속성 (예) |
|--------|------|-----------|
| `session_start` | 세션당 1회 (탭) | `app_version`, `build_id`, `deploy_mode` |
| `pdf_opened` | PDF 로드·추출 완료 | `page_count_bucket`, `size_mb_bucket`, `text_extracted` |
| `check_run` | 맞춤법/일관성 검사 끝 | `scope`, `finding_count_bucket`, `active_rule_count_bucket` |
| `result_viewed` | 검사 완료 직후 (결과 패널로 전환) | `scope`, `finding_count_bucket` |
| `ruleset_saved` | 규칙 세트 「저장」 클릭 | `builtin_bucket`, `spacing_bucket`, `consistency_bucket` |
| `feedback_opened` | 피드백 모달 열기 | — |

**버킷 예:** 페이지 `1-50` / `51-150` / `151-300` / `301+`, 규칙 수·발견 건수도 구간만.

---

## PostHog 대시보드 (처음에 만들 것)

1. **퍼널:** `session_start` → `pdf_opened` → `check_run`  
2. **이탈:** `pdf_opened` 있는데 `check_run` 없음  
3. **탭:** `check_run` by `scope` (spelling / consistency)

---

## 사용자 안내

대문 `welcome-gate__analytics-note` 문구 + 「수집 안 함」 → `localStorage` opt-out.

---

## 금지

- Session replay (기본 OFF)  
- Autocapture  
- PDF 파일명·본문·매칭 문자열·피드백 텍스트  
- 이메일 `identify` (로그인 없음)

---

## 코드

- `src/lib/analytics.js` — 초기화·capture·버킷·opt-out  
- `src/main.jsx` — `initAnalytics()`  
