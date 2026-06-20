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
| `pdf_opened` | PDF 로드·추출 완료 | `page_count_bucket`, `size_mb_bucket`, `text_extracted`, `upload_index_bucket` (1/2/3/4+), `is_return_upload` |
| `check_run` | 맞춤법/일관성 검사 끝 | `scope`, `finding_count_bucket`, `active_rule_count_bucket` |
| `result_viewed` | 검사 완료 직후 (결과 패널로 전환) | `scope`, `finding_count_bucket` |
| `ruleset_saved` | 규칙 세트 「저장」 클릭 | `builtin_bucket`, `spacing_bucket`, `consistency_bucket` |
| `feedback_opened` | 피드백 모달 열기 | — |

**버킷 예:** 페이지 `1-50` / `51-150` / `151-300` / `301+`, 규칙 수·발견 건수도 구간만.

---

## PostHog 대시보드 (자동 생성)

한 번만 실행하면 **코호트(내부 제외·재업로드 2회+) + 인사이트 + 대시보드**가 만들어집니다.

1. [PostHog](https://us.posthog.com) → **Settings → Personal API keys** → `phx_…` 발급 (`cohort:write`, `insight:write`)
2. 브라우저 주소 `https://us.posthog.com/project/12345/…` 의 **숫자** = project id
3. PowerShell:

```powershell
$env:POSTHOG_PERSONAL_API_KEY="phx_여기"
$env:POSTHOG_HOST="https://us.posthog.com"
$env:POSTHOG_PROJECT_ID="12345"
npm run posthog:setup-beta
```

`project:read` 권한이 없으면 **2번 PROJECT_ID는 필수**입니다.

생성물: 대시보드 **「인디야 오픈베타」** — 방문 / 로그인 전환 / 로그인 후 검수 / `check_run` identify 연결 / **PDF 업로드·재업로드** / 재방문 후 업로드 퍼널.  
필터: Person **`is_internal` is not true** (내부 테스트 계정 제외). 재업로드 지표는 `pdf_opened`의 `is_return_upload`·`upload_index_bucket` 및 person `pdf_upload_count` 사용.

**6/9 이후** 로그인·검수 지표만 제품 판단에 쓰세요. 그 이전은 identify 미연결로 참고만.

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
