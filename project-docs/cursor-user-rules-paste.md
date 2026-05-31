# Cursor User Rules — 복사용

> **UI 이름이 버전마다 다릅니다.** 「Rules → User」가 없으면 아래 경로를 시도하세요.

## 여는 방법 (Windows)

1. **`Ctrl + Shift + P`** → **`Rules`** 입력  
   → **「Rules, Skills and Subagents」** 또는 **「Cursor Settings: Rules」** 선택  
2. 또는 **`Ctrl + Shift + J`** (Cursor Settings) → 왼쪽에서  
   **「Rules, Commands」** / **「Rules, Skills, Subagents」**  
3. 화면에 **User** / **Project** / **All** 탭이 있으면 **User** 또는 **New user rule** 클릭

없으면 **User Rules 생략 가능** — 메인·모바일 worktree의 `.cursor/rules/*.mdc` (`alwaysApply: true`) 가 이미 더 강합니다.

---

## User Rules에 붙여넣을 내용

```
- 답변은 항상 한국어로 한다.
- 작업 시작 전 workspace 루트 경로와 git status를 확인하고, 그 폴더·범위만 수정한다.
- 사용자가 「모바일」이라고 명시하지 않으면 welcome-mo / src/welcome/mobile/** 를 건드리지 않는다.
- 사용자가 「PC」라고 명시하지 않으면 welcome-pc / src/welcome/pc/** 를 건드리지 않는다 (모바일 worktree에서).
- welcome-pc와 welcome-mo CSS·클래스를 공유·합치지 않는다.
- git commit, push, worktree add/remove/move는 사용자가 요청할 때만 한다.
- 요청 범위 밖 리팩터와 불필요한 테스트 추가는 하지 않는다.
```

프로젝트별 상세: 각 worktree `.cursor/rules/README.md`
