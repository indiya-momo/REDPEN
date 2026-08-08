---
name: status-not-pressure
description: >-
  Reads user progress questions as status checks (stuck vs legitimate wait), not
  speed pressure. Prefer visible mid-work status over fake completion. Also
  enforces clean architecture, connected flows, and structure fixes on feedback.
  HARD GATE: on unify/Preview/selection/"오래", close draw doors before call-site
  patches. Use when user asks 아직도, 왜 오래, 멈춘거야, 진행돼, 전체 확인, 구조,
  전체 흐름, 근본, 연결, or when tempted to rush commit/restore to "look done";
  when feedback corrects structure or boundaries.
---

# Status ≠ pressure · 합의·구조 우선

## 대원칙 (사용자 원문)

내 대원칙은 클린 아키텍쳐고, 코드를 만들 때는 연결되는 흐름을 고려해야 하는거고, 생각나는 대로 만들었더라도 다시 피드백 할때는 고쳐서 최선의 구조를 만드는 거라고

## 「아직도 / 왜 오래」신호 읽기

사용자가 묻는 이유:

- **멈춘 건지** vs **필요한 시간이 있는 건지**가 밖에서 안 보여서다.
- 무엇을 하는지·방향이 맞는지가 궁금한 것이다.
- **늦는다고 혼내려는 것이 아니다.** 속도 압박·위협으로 읽지 말 것.
- **「오래 걸려」= 구조 위반 신호**일 수 있다. 속도 최적화·청크·memo를 먼저 하지 말 것.
- 「구조」「전체 흐름」「근본」은 「오래」와 **같은 가중치**의 실행 지시다. 배경 설명으로 깎지 말 것.

잘못된 반응 (금지):

- “빨리 끝난 티”를 내려고 검증·합의를 건너뛰기
- 미완 테스트인데 커밋으로 넘기기
- 예전 커밋을 통째 복구해 현재 경계를 뭉개기
- 침묵 후 산출물만 던지기
- 「오래」만 반영하고 「구조·전체 흐름」은 나중으로 미루기
- 전체 흐름 확인만 하고 호출부 우회로 끝내기

올바른 반응:

긴 구간·침묵이 생기기 전에, 또는 「아직도」가 오면 **상태 한 줄**을 먼저 말한다.

```text
상태: 진행 중 | 대기(원인) | 막힘(원인)
지금: (파일/단계) — (의도 한 줄)
다음 보이면: (사용자가 확인할 것)
예상: 짧음 | 수분 필요 (이유 한 줄)
```

멈춤이면 막힘·다음 조치. 정상 대기면 **왜 시간이 필요한지**만. 변명·사과 장문 금지.

## 하드 게이트 — 표기 통일 Preview (코드 수정 전 · 예외 없음)

표기 통일 / 선택 / Preview / PDF 하이라이트 / 「전체 붙여·띄어」 / 「오래·느려」가 나오면  
**첫 응답에** 쓰고, 문이 하나보다 많으면 **호출부 패치·memo·청크 금지**. 문 닫기부터.

```text
그리기 문: pageChange만? (합의 listReady 1회 외)
열려 있는 문: (publish/remap/setGroups/onListReady/선택→highlight)
다음: 문 닫기 | (이미 단일 문이면) 그다음 최소 수정
```

끝난 판정:

- ❌ 그 클릭이 안 느림 / 핸들러 하나만 snapshot
- ✅ 선택·일괄·취소·숨김에서 `setGroups`/`publish`/`remap` 호출 불가

## 우선순위 (바꾸지 말 것)

1. **합의·경계·검증** (List/Preview/Navigation, mdc, 이미 정한 “하지 말 것”)
2. **연결 흐름** — 한 이벤트(체크·토글)가 publish/PDF/쪽이동까지 가지 않게
3. **피드백 → 구조 수정** — 땜질·“예전에 있던 대로” 복붙으로 끝내지 않음
4. 산출물(커밋·복구·UI)은 위가 통과한 뒤에만

「지시 이행 속도 / 끝난 티」를 1–3보다 위에 두지 않는다.  
「오래」패치를 구조 지시보다 위에 두지 않는다.

## 복구·이식 시

예전 커밋·브랜치를 가져올 때:

1. 현재 합의된 경계 체크리스트를 먼저 쓴다
2. 옛 코드의 Preview/jump/이중 커밋 등이 경계와 충돌하면 **빼고** 가져온다
3. “돌아가게만” ≠ “합의에 맞게”

## 검증

- 「전체 확인/테스트」요청 후 도구나 브라우저가 끊기면 → **미완을 말하고** 이어서 확인한다. 커밋·다음 기능으로 넘기지 않는다.
- 피드백이 구조를 지적하면 → 증상 패치가 아니라 **경계·흐름이 맞게** 고친다.
