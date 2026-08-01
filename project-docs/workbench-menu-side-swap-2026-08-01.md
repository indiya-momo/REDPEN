# 작업창 메뉴·원고 자리 바꾸기 (2026-08-01)

## 목표

검수 작업창에서 **메뉴 패널**과 **원고(PDF) 패널**의 좌우 자리를 사용자가 바꿀 수 있게 한다.  
내용은 그대로이고, 보이는 위치만 바뀐다.

## 합의된 요구사항

| 항목 | 결정 |
|------|------|
| 형태 | 사용자 토글 + 기억 |
| 진입점 | 가운데 리사이즈 바(`⋮`) **우클릭** → 컨텍스트 메뉴 한 줄 |
| 메뉴 문구 | 「메뉴·원고 자리 바꾸기」(또는 현재 상태에 맞춘 동등 문구) |
| 기본값 | 메뉴 왼쪽 · 원고 오른쪽 (`menuSide: 'start'`) |
| 기억 | **세션만** — 패널 너비(`panelLeftWidthSession`)와 동일. F5·대문 왕복 유지, 로그아웃(uid 클리어) 시 `start`로 리셋 |
| 범위 밖 | 마이페이지 토글, 더블클릭 단축, `panel-left` 전면 rename, 모바일 welcome |

## 접근법 (채택)

**셸 방향 클래스 + flex 뒤집기**

- DOM 순서 유지: `aside.panel-left` → 리사이즈 핸들 → `main.panel-right`
- `.layout-main__workspace`에 수정자 클래스(예: `layout-main__workspace--menu-end`)를 두고 `flex-direction: row-reverse`로 시각적 좌우만 반전
- 클래스명 `panel-left` / `panel-right`는 **역할**(메뉴 / 원고)로 유지 — AppDialog 등 `.panel-right` 셀렉터 호환
- 리사이즈 드래그 시 `menuSide === 'end'`이면 가로 `delta` 부호 반전

채택하지 않은 대안:

- DOM 순서 조건부 — MainScreen diff·포커스 순서 비용 큼
- `menu-pane` 등으로 전면 rename — 베타 범위 밖

## UX 상세

1. 리사이즈 바에서 **우클릭** → 브라우저 기본 메뉴 대신 앱 컨텍스트 메뉴
2. 항목 클릭 → `menuSide` 토글 → 즉시 레이아웃 반영, **너비 값(px)은 유지**
3. 좌클릭 드래그로 너비 조절은 기존과 동일(자리 바뀐 뒤에도 “메뉴 쪽을 넓히면 메뉴가 넓어짐”이 되게 delta 보정)
4. 기존 툴팁 「드래그하여 너비 조절」유지. 우클릭 안내는 1차에 넣지 않음(필요 시 후속)

기존 결과 인스턴스 컨텍스트 메뉴(`result-instance-context-menu`) 스타일을 재사용하거나 동일 패턴의 작은 메뉴로 맞춤.

## 상태·저장

```text
menuSide: 'start' | 'end'
  start = 메뉴가 워크스페이스 시작쪽(기본, 보통 왼쪽)
  end   = 메뉴가 워크스페이스 끝쪽(보통 오른쪽)
```

**결정 (착수 고정):** 세션·토글은 **얇게 분리**, 너비 훅은 **소비만** 한다.

| 층 | 역할 |
|----|------|
| `src/lib/panelMenuSideSession.js` | uid 맵 sessionStorage 읽기/쓰기 (`panelLeftWidthSession`과 동일 수명) |
| `src/hooks/usePanelMenuSide.js` | `menuSide` state + `toggleMenuSide` / `setMenuSide`, uid 변경 시 세션 재로드·로그아웃 시 `start` |
| `useResizablePanelWidth(authUid, { menuSide })` | **너비만** 소유. `menuSide`는 인자로 받아 드래그 `delta` 부호에만 사용. `menuSide`를 세션에 쓰지 않음 |
| `MainScreen` | `usePanelMenuSide` → workspace class·우클릭 메뉴·`useResizablePanelWidth`에 `menuSide` 전달 |

채택하지 않음: `menuSide` persistence를 `useResizablePanelWidth` 안에 합치기 — 너비와 자리 선호가 한 훅에 섞여 테스트·수명이 헷갈림.

## 코드 터치 포인트

| 파일 | 변경 |
|------|------|
| `src/lib/panelMenuSideSession.js` (신규) | 읽기/쓰기 |
| `src/hooks/usePanelMenuSide.js` (신규, + test) | 세션 연동 state·토글 |
| `src/hooks/useResizablePanelWidth.js` (+ test) | 두 번째 인자 `menuSide`로 drag delta 부호 |
| `src/components/MainScreen.jsx` | workspace className, 핸들 `onContextMenu`, 컨텍스트 메뉴 UI·토글, 훅 연결 |
| `src/styles/main-screen.css` | `--menu-end` 시 `row-reverse` (소수 규칙) |
| `src/components/AppDialog.jsx` | 원칙적으로 변경 없음(`.panel-right` = 원고 유지) |

베타 freeze: ruleEngine·MainScreen props 시그니처 대량 변경은 하지 않는다. 레이아웃 class·핸들 이벤트·세션만 최소 diff.

## 테스트·스모크

- 단위: `panelMenuSideSession` / `usePanelMenuSide` round-trip, `useResizablePanelWidth` delta 부호(`start`/`end`)
- 수동: 우클릭 토글 ↔ 드래그 너비 ↔ F5 유지 ↔ 로그아웃 후 기본(`start`) ↔ 팝업이 원고 중앙에 뜨는지

## 성공 기준

- 우클릭 한 번으로 메뉴↔원고 자리가 바뀐다
- 너비 드래그가 뒤바뀐 배치에서도 직관적으로 동작한다
- 세션 기억이 패널 너비와 같은 수명을 가진다
- 원고 기준 팝업 위치가 깨지지 않는다
