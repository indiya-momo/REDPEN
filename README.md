# PDF 출판 교정 보조 툴

조판 PDF에서 맞춤법·표기 일관성 규칙을 **탐지**하고 위치를 **하이라이트**하는 브라우저 로컬 도구.

**기획 뼈대:** [docs/product-spine.md](docs/product-spine.md)

**와이어프레임 v0:** [docs/wireframe-screens.html](docs/wireframe-screens.html)

## 실행

```bash
npm install
npm run dev
```

**Windows에서 브라우저가 연결 거부일 때** (탐색기에서 더블클릭 또는 PowerShell):

```powershell
cd C:\Users\gikan\Documents\pdf-publish-proofread
npm run start:win
```

또는 `scripts\start-dev.cmd` 더블클릭 → 서버 켜지고 브라우저가 자동으로 열립니다.

### Cursor에서는 되는데 Chrome/Edge만 연결 거부일 때

```powershell
npm run open:browser
```

또는 `scripts\open-browser.cmd` 더블클릭 → **8080 포트**로 빌드본을 띄웁니다.  
`http://127.0.0.1:8080/` 로 접속하세요.

1. Chrome **설정 → 시스템 → 컴퓨터의 프록시 설정** 에서 프록시가 켜져 있으면 끄거나, `localhost;127.0.0.1` 예외 추가  
2. 여전히 안 되면 PowerShell **관리자** 로 `npm run open:browser` (방화벽 허용)

## 맞춤법 규칙 (Google 시트)

1. 시트 탭 `spelling_rules` — 컬럼 `find` · `replace` · `enabled` · `tip` · `memo` (tip=결과 안내, memo=관리용)  
2. `.env`에 `SPREADSHEET_ID` 설정 (`.env.example` 참고)  
3. `npm run sync-spelling` → 앱 새로고침  

자세한 절차: [`docs/sheet-spelling.md`](docs/sheet-spelling.md)

브라우저에서 표시된 주소로 접속합니다.

- 개발: **`http://localhost:5173`** 또는 **`http://127.0.0.1:5173`** (`npm run dev` 실행 중)
- 미리보기: `npm run build` 후 `npm run preview` → **`http://localhost:4173`**

### 「연결 거부」가 나올 때

1. 프로젝트 폴더에서 **`npm run dev`** 실행 (이미 켜져 있으면 터미널에서 `Ctrl+C` 후 다시 실행)
2. **`http://localhost:5173`** 이 안 되면 **`http://127.0.0.1:5173`** 시도
3. `https`가 아닌 **`http`** 인지 확인
4. PDF만 안 열리면 앱 안 **「PDF 열기」** 사용 (주소창에 `C:\...pdf` 경로 넣지 않음)

## v0.1 구현 상태

- Vite + React + `pdfjs-dist`
- 실제 PDF 업로드 · 페이지별 텍스트 추출
- 규칙 검사(공백 유연 regex) · 규칙별 결과 묶음
- 캔버스 PDF 뷰어 · 매칭 구간 하이라이트(overlay)
- 규칙 세트 localStorage 저장
- 작업 세션 IndexedDB 저장 (새로고침 복원 · 「작업 지우기」로 삭제)
