# Vercel × PostHog 연결

이 저장소는 **Vite + `posthog-js`** 로 베타 분석을 쓰고, Vercel Marketplace 연동 시 넣어 주는 환경 변수 이름도 그대로 읽습니다.

---

## 1. Vercel Marketplace에서 PostHog 연결

1. [Vercel Marketplace — PostHog](https://vercel.com/marketplace/posthog) 열기  
2. 배포할 **Vercel 프로젝트** 선택  
3. 이미 EU PostHog가 있으면 **Link Existing Account** (권장)  
   - Production / Preview / Development에 쓸 PostHog 프로젝트 매핑  
4. 연결 후 Vercel 프로젝트 **Settings → Environment Variables**에 아래가 자동 추가됨:
   - `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` (`phc_…`)
   - `NEXT_PUBLIC_POSTHOG_HOST` (예: `https://eu.i.posthog.com`)

코드는 위 이름과 로컬용 `VITE_PUBLIC_POSTHOG_*` 를 모두 인식합니다 (`src/lib/posthogEnv.js`).

---

## 2. Vercel 빌드·배포 설정

| 항목 | 권장 |
|------|------|
| Framework | Vite (루트 `vercel.json` 참고) |
| Build | `npm run build` |
| Output | `dist` |
| `VITE_BASE` | Vercel 도메인 **루트** 배포면 `/` (기본). GitHub Pages와 같이 `/REDPEN/` 이면 `VITE_BASE=/REDPEN/` |
| Firebase 로그인 | `.env.example` 의 `VITE_FIREBASE_*` 를 Vercel Production/Preview에 동일 등록 |

Vercel에서 빌드되면 `session_start` 의 `deploy_mode` 속성은 **`vercel`** 로 기록됩니다 (Pages는 `pages`).

---

## 3. 로컬 개발

Marketplace 변수는 Vercel에만 있으므로, 로컬에서는 다음 중 하나를 쓰면 됩니다.

**A. Vercel CLI로 당겨오기**

```bash
npx vercel link
npx vercel env pull .env.local
```

**B. `.env.local`에 직접 (git 제외)**

```env
VITE_PUBLIC_POSTHOG_KEY=phc_…
VITE_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

그다음 `npm run dev` 재시작 → PostHog **Live events**에서 `session_start` 확인.

---

## 4. 수집 정책 (변경 없음)

- autocapture · session replay **OFF**
- 이벤트 6개만 수동 전송 (`project-docs/analytics-beta.md`)
- 대문 「수집 안 함」 → `localStorage` opt-out

---

## 5. 확인 체크리스트

- [ ] Vercel Production 배포 URL에서 앱 로드
- [ ] PostHog Live events에 `session_start`, `deploy_mode: vercel`
- [ ] PDF 열기 후 `pdf_opened` 유입
- [ ] 키가 없으면 SDK 미로드 (오류 없이 동작)

---

## 6. Feature flags (선택)

Marketplace 연동은 **Feature flags ↔ Vercel Flags** 동기화도 지원합니다.  
현재 앱은 flags 없이 이벤트만 씁니다. 나중에 쓰려면 PostHog 대시보드와 [Vercel Flags 문서](https://posthog.com/docs/integrations/vercel-marketplace)를 참고하세요.
