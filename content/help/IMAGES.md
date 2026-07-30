# 도움말 스크린샷 — 폴더·MD 문법

이미지 파일은 **워크스페이스** `public/help/images/` 아래에 둡니다.  
MD는 `content/help/` 아래 해당 글 파일을 수정합니다.

---

## 1. 폴더 규칙

**폴더 경로 = 도움말 글 slug** (MD 파일 경로와 같음, `index.md`는 상위 폴더명)

```
public/help/images/
  getting-started/
    first-check/          ← content/help/getting-started/first-check.md
      01-upload.png
      02-run-check.png
    panels/
  spelling/
    highlights/           ← spelling/highlights/index.md
      01-overview.png
    highlights/
      overview/
      spacing/
    export/
  consistency/
    tabs/
    unify/
  project/
    what-is-project/
  account/
    quota/
  reference/
    privacy/
    supported-pdf/
```

### 파일 이름 권장

| 패턴 | 예 |
|------|-----|
| 단계 번호 + 짧은 설명 | `01-upload.png`, `02-run-check.png` |
| 소문자, 하이픈 | `03-result-panel.png` |
| 형식 | PNG 또는 WebP (JPG도 가능) |

나중에 영상으로 바꿀 때 같은 폴더·같은 번호만 `mp4`로 교체하면 됩니다.

---

## 2. MD 삽입 문법

### (1) 같은 글 — 짧게 (추천)

글 slug가 `getting-started/first-check`일 때:

```markdown
![PDF 업로드 화면](help-image:01-upload.png)
```

→ 실제 URL: `/help/images/getting-started/first-check/01-upload.png`

### (2) 다른 글 이미지 가리키기

```markdown
![하이라이트 예시](help-image:spelling/highlights/overview/01-context.png)
```

### (3) 전체 경로 (그대로 써도 됨)

```markdown
![PDF 업로드](/help/images/getting-started/first-check/01-upload.png)
```

### (4) 캡션 (선택)

이미지 **바로 다음 줄**에 한 줄:

```markdown
![02 — 기준 검수](help-image:02-run-check.png)
*왼쪽 맞춤법 탭에서 기준을 확인한 뒤 기준 검수를 누릅니다.*
```

---

## 3. `first-check.md` 예시

```markdown
## 기본 순서

1. 작업 화면에서 PDF를 업로드합니다.
2. 왼쪽에서 맞춤법 탭과 검수 기준을 확인합니다.

![01 — PDF 업로드](help-image:01-upload.png)
*업로드 직후 작업 화면*

3. 기준 검수를 실행합니다.

![02 — 기준 검수](help-image:02-run-check.png)

4. 왼쪽에 검수 결과, 오른쪽에 반영 원고가 표시됩니다.
```

---

## 4. 확인

1. PNG를 `public/help/images/...`에 저장  
2. MD에 `help-image:파일명` 한 줄 추가  
3. 브라우저: `http://127.0.0.1:5173/?window=guide&help=글-slug` 새로고침  

이미지가 안 보이면 **파일 이름·폴더(slug)·확장자** 세 가지를 먼저 확인하세요.
