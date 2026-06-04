# 오픈베타 피드백 (Google Form)

베타는 **Google Form이 기본 채널**입니다. 앱 「베타 소감 남기기」는 Form을 새 탭으로 엽니다.

## Form URL

- 기본: `https://forms.gle/XGxKjjyWZiYDnqrm8`
- 코드: `src/lib/feedbackConfig.js` → `DEFAULT_FEEDBACK_FORM_VIEW_URL`
- 다른 Form으로 바꿀 때: `.env` / Vercel `VITE_FEEDBACK_FORM_VIEW_URL`

## 앱 동작

- 작업 화면 **베타 소객 남기기** → 안내 모달 → **Google Form에서 작성하기**
- PostHog `feedback_opened` (모달을 연 시점)
- 앱 내 짧은 textarea 제출은 사용하지 않음 (Form에 섹션·첨부·장문 수집)

## (선택) 앱에서 POST로 일부만 보내기

`.env.example` 의 `VITE_FEEDBACK_FORM_ACTION_URL` + entry ID — 예전 2문항 체크박스용.  
베타 Form이 섹션·파일 업로드 위주면 **설정하지 않는 것**을 권장.

## Vercel

```
VITE_FEEDBACK_FORM_VIEW_URL=https://forms.gle/XGxKjjyWZiYDnqrm8
```

(생략해도 코드 기본값과 동일)

## Form 관리

- **응답** → 스프레드시트 연결
- 파일 업로드 문항: 응답자 Google 로그인 필요할 수 있음
- 원고·PDF 전체 업로드는 Form 설명에서 금지 안내
