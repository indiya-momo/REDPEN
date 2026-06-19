# 피드백 — Google Form 연동·제출 검증

앱은 브라우저에서 Form에 `POST` (`mode: no-cors`)만 보냅니다.  
**HTTP 응답을 읽을 수 없어**, 앱 화면의 「보냈습니다」만으로는 **실제 수신을 보장할 수 없습니다.**  
연결 후에는 반드시 **Form 응답 탭**에서 한 번 확인하세요.

---

## 1. Form 필드 (현재 REDPEN Form)

| 질문 | 유형 | entry ID | 앱에서 보내는 값 |
|------|------|----------|------------------|
| 어떤 부분이 **불편한가?** | 체크박스(기타) | `entry.2074090186` | `[버그/기능 요청/기타] {본문}` → **기타** |
| 어떤 부분이 **편한가?** | 체크박스(기타) | `entry.944707313` | `앱에서 피드백 전송` → **기타** |

공유 링크: https://forms.gle/f6FpybKZHC5yAR817

### (참고) 단답·장문 2필드 Form

| 순서 | 질문 유형 | 제목 예 | 앱에서 보내는 값 |
|------|-----------|---------|------------------|
| 1 | **단답형** 또는 **강조형** | 분류 | `버그` / `기능 요청` / `기타` |
| 2 | **장문형** | 내용 | 사용자가 입력한 본문 |

- Form 설정 → **응답** 탭 → **스프레드시트에 연결** (응답 확인용)
- **로그인 없이 응답 받기** 켜기 (내부 테스트·외부 사용자 모두)

---

## 2. `.env`에 넣을 값 찾기

프로젝트 루트 `.env` (`.env.example` 복사 후 수정). **변경 후 `npm run dev` 재시작.**

### 2-1. `VITE_FEEDBACK_FORM_ACTION_URL`

1. Form 편집 화면 → **보내기**(Send) → **링크** 탭  
2. 공유용 URL 예:  
   `https://docs.google.com/forms/d/e/1FAIpQLSc.../viewform`  
3. 앱에는 **`viewform` → `formResponse`로 바꾼 URL**을 넣습니다:  
   `https://docs.google.com/forms/d/e/1FAIpQLSc.../formResponse`

> `/d/e/…/` 형태(게시 URL)를 쓰는 경우가 많습니다. `viewform`이 붙은 주소를 그대로 `formResponse`로만 바꾸면 됩니다.

### 2-2. 체크박스 2질문 (REDPEN Form)

`.env` 예시:

```env
VITE_FEEDBACK_FORM_VIEW_URL=https://forms.gle/f6FpybKZHC5yAR817
VITE_FEEDBACK_FORM_ACTION_URL=https://docs.google.com/forms/d/e/1FAIpQLSchUzVmBmu1zGiFH_tPDmiv0mY6C6oq-Y4ZxjCiU-oAoE5WPA/formResponse
VITE_FEEDBACK_FORM_ENTRY_INCONVENIENT=entry.2074090186
VITE_FEEDBACK_FORM_ENTRY_CONVENIENT=entry.944707313
```

- `VIEW_URL`만 있으면 모달에서 Form을 새 탭으로 엽니다.
- `ACTION_URL` + `ENTRY_INCONVENIENT` + `ENTRY_CONVENIENT`가 모두 있으면 앱에서 **보내기**로 POST합니다.
- entry ID는 Form HTML 또는 **⋮ → 미리 채운 URL**에서 확인합니다.

### 2-3. 단답·장문 2필드 (`ENTRY_TYPE` · `ENTRY_MESSAGE`)

**방법 A — 미리 채우기 링크 (가장 쉬움)**

1. Form 편집 → 우측 **⋮** → **미리 채운 URL 가져오기**  
2. 분류·내용에 아무 값이나 넣고 **링크 받기**  
3. 브라우저 주소창 URL 예:  
   `https://docs.google.com/.../viewform?entry.111=테스트&entry.222=본문`  
4. `entry.111` → `VITE_FEEDBACK_FORM_ENTRY_TYPE`  
   `entry.222` → `VITE_FEEDBACK_FORM_ENTRY_MESSAGE`

**방법 B — 개발자 도구**

1. Form을 일반 브라우저에서 제출  
2. Network 탭에서 `formResponse` 요청의 **Form Data** 확인  
3. `entry.xxxxx` 이름을 그대로 `.env`에 복사

---

## 3. `.env` 예시 (단답·장문)

```env
VITE_FEEDBACK_FORM_ACTION_URL=https://docs.google.com/forms/d/e/1FAIpQLSxxxxxxxx/formResponse
VITE_FEEDBACK_FORM_ENTRY_TYPE=entry.1234567890
VITE_FEEDBACK_FORM_ENTRY_MESSAGE=entry.0987654321
```

`VIEW_URL` 또는 POST용 entry 세트 중 **하나 이상**이 설정되면 대문 「피드백 보내기」가 Form과 연결됩니다.

---

## 4. 제출 검증 체크리스트 (필수)

연결 직후 **한 번** 아래를 진행합니다.

- [ ] `.env` 저장 후 dev 서버 **재시작** (`npm run dev`)  
- [ ] 대문 → **피드백 보내기** → 모달 상단에 「Google Form 연결 전」 문구가 **안 보임**  
- [ ] 분류 **버그**, 내용에 고유 문구 입력 (예: `연동테스트 2026-05-23 14:30`)  
- [ ] **보내기** 클릭  
- [ ] Google Form → **응답** 탭(또는 연결된 스프레드시트)에 **같은 문구**가 들어왔는지 확인  

### 통과 기준

| 확인 | 의미 |
|------|------|
| 응답 1행 추가됨 | URL·entry ID **정상** |
| 분류·본문 칸이 비어 있음 | **entry ID가 다른 필드**를 가리킴 → 미리 채우기 URL로 다시 확인 |
| 아무 응답도 없음 | `formResponse` URL 오타, Form 비공개, 네트워크 차단 등 |

---

## 5. 브라우저만으로 빠른 POST 테스트 (선택)

Form이 맞는지 앱 없이 확인할 때:

1. Form 편집 화면에서 **미리보기** 열기  
2. 개발자 도구 → Console:

```javascript
const body = new URLSearchParams();
body.append('entry.1234567890', '버그');        // TYPE entry
body.append('entry.0987654321', '콘솔 테스트'); // MESSAGE entry
fetch('https://docs.google.com/forms/d/e/…/formResponse', {
  method: 'POST',
  mode: 'no-cors',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: body.toString(),
});
```

3. Form **응답**에 `콘솔 테스트`가 보이면 entry·URL이 맞습니다.

---

## 6. 제한 사항 (앱 동작)

| 항목 | 내용 |
|------|------|
| `no-cors` | 제출 성공·실패를 코드로 구분 불가 → **응답 시트로만 검증** |
| 앱 성공 메시지 | 「전송 요청」 수준이며, **수신 확인은 운영자가 Form에서** |
| PDF·규칙·파일명 | 전송하지 않음 (피드백 텍스트·분류만) |
| 미설정 | 클립보드 복사 (기존과 동일) |

---

## 7. 자주 하는 실수

1. **`viewform` URL을 그대로 넣음** → 반드시 `formResponse`  
2. **dev 서버 재시작 안 함** → Vite는 `.env` 변경 시 재시작 필요  
3. **분류 필드를 선택형(드롭다운)으로 만들고 선택지가 `버그`와 다름** → Form 선택지를 앱 라벨과 맞추거나, 분류를 **단답형**으로 변경  
4. **entry ID에 `entry.` 없이 숫자만** → `entry.123…` 전체를 넣을 것  

---

## 8. 관련 파일

| 파일 | 역할 |
|------|------|
| `src/lib/feedbackConfig.js` | env 읽기 · POST |
| `src/components/FeedbackModal.jsx` | UI |
| `.env.example` | 변수 이름 참고 |
| `project-docs/product-spine.md` | 제품 정책 요약 |
