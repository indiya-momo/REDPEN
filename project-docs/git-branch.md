# Git 브랜치 — `main` 만 사용

## 왜 헷갈렸는지

- GitHub 기본 브랜치·Pages 설정: **`main`** + `/docs`
- 최근 개발·push: **`master`** 에만 쌓임
- Actions: `main` / `master` **둘 다** push 시 각각 `docs/` 배포 → 서로 다른 JS 파일명

그래서 파란 체크는 떠도, 사이트는 예전 `main` 빌드(`index-BIMK7npE.js` 등)가 보일 수 있었습니다.

## 지금 규칙

| 항목 | 값 |
|------|-----|
| 작업 브랜치 | **`main`** 만 |
| Pages | **main** · **/docs** |
| Actions | `push` → **main** 일 때만 배포 |

`master`는 더 이상 push·배포하지 않습니다.

## 로컬에서 main 으로 맞추기

```bash
git checkout main
git pull origin main
```

이후 커밋·push는 모두 `main`에서 합니다.
