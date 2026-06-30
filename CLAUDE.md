# 작업 지침 (Cowork)

## 작업 환경
- 작업 대상: `C:\Users\gikan\Documents\pdf-publish-proofread-hero` (localhost:7777, `feat/system-update` 브랜치)
- 이 폴더는 메인 워크트리와 **물리적으로 분리된 워크트리**다.
- `C:\Users\gikan\Documents\pdf-publish-proofread` (localhost:5173)는 **절대 수정하지 않는다.**
- 커서(Cursor)에서 다른 작업이 **동시에 병행**되고 있다.

## 작업 단위
- 한 대화(작업 공간)에서는 **기능 하나만** 다룬다.
- 그 기능만 `feat/system-update` 브랜치에 반영하고, 해당 부분만 메인 워크트리로 합친다.

## 역할 분담
- Claude는 이 워크트리 안에서 **파일 변경(조판/교정)까지만** 한다.
- `git commit`, `git merge` 등 **커밋·머지 명령은 Claude가 실행하지 않는다.** 커밋은 로사 님이 커서 터미널에서 직접 명령어로 처리한다.
- 변경을 마치면 **무엇을 / 어떤 파일을 / 어떤 의도로** 바꿨는지 정리해 보고한다. (커밋 메시지는 로사 님이 그걸 보고 직접 작성)
- 메인 워크트리로 합치기 전에는 로사 님이 커서에게 확인을 받는다.

## 협업 규칙
- 시키기 전에 절대로 먼저 행동하지 않는다.
- 코드 생성 전 충분한 설명과 논의를 먼저 진행한다.
- 클린 아키텍처 구조로 코드를 작성한다.
- 바이브코딩 초보 + 출판인이므로, 설명은 구체적으로 하고 가능하면 출판 과정에 비유한다.
- 같은 파일을 커서와 동시에 건드려 충돌이 나지 않도록 주의한다.

## 단축 명령
- **"브라우저 열기"** → hero 개발 서버를 켜는 아래 명령어를 그대로 보여준다(로사 님이 직접 자기 컴퓨터 터미널에서 실행). 서버가 뜬 뒤 알리면 Claude가 브라우저로 `localhost:7777`을 열어 확인한다.

  ```
  cd C:\Users\gikan\Documents\pdf-publish-proofread-hero
  npm run dev
  ```

  - Vite + `.env.local`의 `DEV_PORT=7777` 설정으로 `http://localhost:7777`에 뜬다. 서버는 로사 님 컴퓨터 터미널에서만 켜진다(Claude는 명령어만 제시). 터미널 창은 켜둔 채로 둔다.

- **"머지하자"** → hero(feat/system-update)가 main보다 뒤처질 수 있으므로, "hero를 main 최신으로 따라잡기 → main에 합치기" 순서로 명령어를 안내한다(Claude는 실행하지 않음, 커밋·머지·충돌 해결은 로사 님이 커서에서 직접).

  1. hero에서 변경 커밋:
     ```
     cd C:\Users\gikan\Documents\pdf-publish-proofread-hero
     git status
     git add <바뀐 파일들>
     git commit -m "메시지는 로사 님이 직접"
     ```
  2. hero를 main 최신으로 따라잡기(충돌은 커서로 해결):
     ```
     git fetch
     git merge main      # 원격이면 git merge origin/main
     ```
  3. main 워크트리로 가서 합치기:
     ```
     cd C:\Users\gikan\Documents\pdf-publish-proofread
     git status
     git merge feat/system-update
     ```
