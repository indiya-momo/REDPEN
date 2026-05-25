# PDF 출판 교정 보조 툴

> **배포 사이트:** https://indiya-momo.github.io/REDPEN/

### GitHub Pages 배포 (한 번만 설정)

**제목만 바뀌고 화면이 안 뜨면** Pages가 **소스 루트(`/(root)`)** 를 쓰고 있는 상태입니다. 루트의 `index.html`은 개발용(`/src/main.jsx`)이라 브라우저에서 앱이 안 뜹니다.

1. GitHub **REDPEN** → **Settings** → **Pages**
2. **Source: Deploy from a branch** (그대로)
3. **Branch: `main`** · **Folder: `/docs`** → **Save**  
   (**`/(root)`가 아니라 `/docs`로 바꿔야 합니다.**)
4. push 후 Actions **Deploy to GitHub Pages** 가 빌드 결과를 `docs/`에 올립니다.
5. 1~2분 후 https://indiya-momo.github.io/REDPEN/ 에서 **Ctrl+Shift+R**. 페이지 소스에 `/REDPEN/assets/...js` 가 보이면 성공입니다.

기획·시트 문서는 [`project-docs/`](project-docs/) 에 있습니다.

조판 PDF에서 맞춤법·표기 일관성 규칙을 **탐지**하고 위치를 **하이라이트**하는 브라우저 로컬 도구.

**기획 뼈대:** [project-docs/product-spine.md](project-docs/product-spine.md)

**와이어프레임 v0:** [project-docs/wireframe-screens.html](project-docs/wireframe-screens.html)

## 실행

```bash
npm install
npm run dev
```

터미널에 표시된 **Local** 주소로 접속하세요 (예: `http://localhost:5173/`). 포트가 이미 쓰이면 5174, 5175… 로 바뀝니다. 연결 거부면 서버가 꺼진 것이니 `npm run dev`를 다시 실행하세요.

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

자세한 절차: [`project-docs/sheet-spelling.md`](project-docs/sheet-spelling.md) · 주의 `match_mode`: [`project-docs/caution-match-mode.md`](project-docs/caution-match-mode.md)

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
