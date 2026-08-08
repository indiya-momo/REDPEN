---
name: minimal-path
description: >-
  Forces minimal-change design before coding: ask whether work is needed at all,
  prefer zero new cost on hot paths, keep phase-1 (1차) find/list unchanged and
  attach only to phase-2 (2차) when required. Use when designing features, fixing
  unify/consistency find bugs, adding filters/scans/passes, refactoring "just in
  case", or when the user mentions 최소, YAGNI, 가볍게, 1차, 2차, 핫패스, or
  webapp latency.
---

# Minimal Path (웹앱 · 최소 경로)

이 제품은 **설치 프로그램이 아니라 웹앱**이다. 사용자가 매 찾기마다 메인 스레드·대기 시간을 낸다. 설계·구현 전에 **일을 붙일지부터** 강구한다. “고칠 수 있다” ≠ “1차에 넣는다”.

관련: `brainstorming`(YAGNI·승인 게이트), `codebase-design`(깊은 모듈·삭제 테스트), `grill-me`(가지 검증).

## HARD-GATE

코드를 쓰기 전에 아래를 **사용자에게 짧게 제시**하고 승인을 받는다.  
“급하다 / 버그다 / 간단하다”여도 예외 없음. 승인 없이 핫패스에 패스·증인 수집·필터·상태 관통을 추가하지 않는다.

## 필수 질문 (순서 고정)

한 턴에 몰아쓰지 말고, 설계 요약에 **답변을 적어** 둔다.

1. **이 일이 필요한가?** — 안 하면 사용자 피해가 무엇인가? (없으면 STOP)
2. **지금 당장인가?** — 문서·로드맵·2차로 미루면? (미루면 STOP 또는 이슈만)
3. **어디에 붙는가?**
   - **1차(찾기·목록·discover·group·prune 기본 경로)** → 기본 **금지**. 1차는 그대로 두고 동작·비용을 늘리지 않는다.
   - **2차(위성 판정·Kiwi noise phase2·패턴 2차 등)** → 허용 후보. **하나만** 얇게.
   - **UX만**(로딩 표시 등, 찾기 CPU와 무관) → 별도. 찾기 로직과 섞지 않는다.
4. **더 싼 대안은?** — 기존 facade 재사용, 리스트/플래그, 호출부 한 줄, 리팩터로 중복 제거. **새 스캔·새 Set·새 상태·이중 텍스트 패스**는 최후.
5. **삭제 테스트** — 이 추가를 지우면 복잡도·대기 시간이 사라지는가? 사라지면 붙이지 말 것.

## 표기 통일 · 찾기 (이 레포 기본값)

| 층 | 하는 일 | 새 일 |
|----|---------|--------|
| **1차** | 문서에 있는 띄움·붙임 이형태 선별 | **추가 금지** (비용↑ 금지) |
| **2차** | 위성·형태소·앞잘림 등 판정 | **필요할 때만 하나** |
| 조립 | panel / pipeline | 인자·상태 관통으로 정책 키우지 말 것 |

잘못된 예 (하지 말 것):

- 1차 prune/스캔에 `page.text` 재순회·증인 보강·adjacent 2배 적재
- 1차 위성 생성에 DocSuffix·Kiwi·문서 전수 판정
- “로딩이 멈춘다”고 1차 CPU를 더 돌리기 (표시는 CSS/양보와 찾기 로직을 분리)

올바른 예:

- 1차 동작·비용 **동일** 유지
- 앞잘림·layout/text 불일치는 **2차 한곳**에 최소 판정
- 공유 정책은 **완전 facade 하나** (`shared-policy-functions` mdc) — 호출부마다 반쪽 구현 금지

## 설계 제시 형식 (승인용 · 짧게)

```text
필요성: …
미루기: … (가능/불가)
부착 층: 1차 금지 | 2차(어디) | UX만
최소안: …
탈락시킨 무거운 안: …
1차 비용 변화: 없음 (필수)
```

승인 후에만 구현. 구현 중 범위가 커지면 **다시 이 게이트**.

## 구현 중 자가 점검

- 새 `for` 페이지/토큰 스캔, 새 `Set`/`Map` 전문서 수집, panel 새 state 관통 → 게이트 재실행
- “顺便” 최적화·인덱스·async 양보를 핫패스에 끼워 넣지 말 것 (별 요청·별 승인)
- 리팩터 목표는 **같은 동작·더 얇은 경로**이지, 경로 추가가 아니다
