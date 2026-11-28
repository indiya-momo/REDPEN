# 설계 핑퐁 규칙 (인디야 · Cursor Grok × Claude)

작성: 2026-11-25. 자동 스크립트 전에 **파일로 루프를 고정**하는 규칙이다.
앱 `src/` 구현과 무관. 이 문서·STATUS·라운드 산출물만 이 폴더에 둔다.

## 역할

| 단계 | 담당 | 하는 일 | 하지 않는 일 |
|------|------|---------|--------------|
| 1 조사 | Grok (Cursor CLI) | 관련 파일·제약·데이터·영향 범위. **경로·근거 포함** | 설계 확정, `src/` 수정 |
| 2 최초 설계 | Claude | 구조·데이터 흐름·예외·부작용·테스트 | 구현, STATUS 변경 |
| 3 구현 반론 | Grok | 구현 가능·범위·충돌·더 싼 경로·조사 오해 | `src/` 수정, 설계 단독 확정 |
| 4 설계 수정 | Claude | 최종 설계·쟁점 표 | 구현 |
| 5 승인 | **사람** | `approved` / `stop` / 범위 결정 | — |
| 6 구현 | Grok | **승인 후**에만 코딩 | 승인 전 `src/` |

**Claude를 쓰는 작업:** 새 아키텍처, 데이터 구조 변경, 여러 컴포넌트, PDF/스캔 구조, 구조적 버그, 리팩터.  
**Grok만:** UI 세부, 단순 버그, 확정된 설계의 작은 추가, 문구·스타일.

루트 `CLAUDE.md`는 hero 워크트리용이다. 이 규칙에 쓰지 않는다. Cursor 잠금은 `.cursor/rules/*.mdc`. 클로드 채팅·Claude Code에는 이 폴더(또는 해당 라운드 파일)를 넘긴다.

## ① STATUS — 스크립트만 변경

파일: `handoff/STATUS.md`

- AI는 STATUS를 **읽기만** 한다. 쓰거나 “STATUS에 …라고 써라”는 프롬프트도 넣지 않는다.
- 상태 전이는 **오케스트레이션 스크립트**(또는 사람이 스크립트 대신 수동으로 같은 규칙 적용)만 한다.
- 허용 값: `idle` → `investigating` → `designing` → `critiquing` → (`designing`/`critiquing` 반복, 아래 ③) → `awaiting-approval` → `approved` → `implementing` | `awaiting-human` | `stop`
- STATUS 필수 칸: `brief`, `run_dir`, `last_artifact`, `blocker`(사람 대기 시), `grok_model`, `claude_bin`, `approved_at`/`approved_by`(승인 시).
- `awaiting-approval`이면 스크립트는 **종료**한다. 사람이 승인한 뒤에만 `approved`로 바꾸고 구현 단계를 연다.
- `awaiting-human`이면 `blocker`에 이유(라운드 초과·같은 쟁점 반복·모순)를 적고 종료한다.
- `stop`이면 즉시 종료. 재개하지 않는다.
- 작업 시작: `BRIEF.template.md` → `runs/<run_id>/BRIEF.md` 복사·작성. softwrap 전용 숫자(205 등)는 **전역 RULES가 아니라 BRIEF**에만.

## ② 권한 분리 (설계·검토 라운드)

설계·검토가 끝날 때까지 **프로그램 코드(`src/` 등)는 두 AI 모두 수정하지 않는다.**

| 주체 | 도구 권한 (설계 라운드) | 산출물 |
|------|-------------------------|--------|
| Grok | `--mode plan` 또는 workspace write deny. 조사·반론만 | stdout → 스크립트가 `NN-investigate.md` / `NN-critique.md`로 저장 |
| Claude | `Read`·`Glob`·`Grep`(및 읽기 전용)만. Write/Edit/Shell 쓰기 없음 | stdout → 스크립트가 `NN-design.md`로 저장 |

- AI에게 “파일을 직접 써라”고 시키지 않는다. **스크립트가 CLI 출력을 파일로 저장**한다. (Read만 허용한 채 critique.md를 쓰라는 방식은 쓰지 않는다.)
- 구현 단계(`state: approved` 이후 별도 실행)에서만 Grok에 쓰기·`--force`를 연다. 그때도 잠금 파일·커밋·푸시는 deny 또는 사람 요청 시에만.
- 잠금 예(이 프로젝트): 요청 없이 `pdfPageText` 휴리스틱 본문·`ruleEngine`·독립 어절 목록에 `건`/Y 상위 음절 추가·기존 `it.fails` 고치기·커밋·푸시 금지. (작업별 잠금은 해당 라운드 지시서에 적는다.)

## ③ 왕복 상한 · 비용

- 기본 **`max_round: 3`** (설계↔반론 왕복). STATUS의 `round`는 스크립트가 올린다.
- 3회 안에 합의되지 않거나 **같은 쟁점이 반복**되면 AI끼리 맞추지 않는다. `awaiting-human`으로 두고 사람에게 넘긴다.
- 라운드마다 사용량·소요는 사람이 실험 기록에 남긴다 (아래 「실험」).

## ④ 이력 보존

- 최신안만 덮어쓰지 않는다. 라운드마다 **번호 파일**을 남긴다.

```text
handoff/runs/<run_id>/
  01-investigate.md      # Grok stdout 저장
  02-design.md           # Claude stdout 저장
  03-critique.md         # Grok stdout 저장
  04-design.md           # Claude 수정안 (있으면)
  …
  design-final.md        # 승인용 최종본 (스크립트 또는 사람이 복사·정리)
  issues.md              # 제기된 문제 / 반영 / 미반영+이유
```

- `design-final.md`와 `issues.md`에는 최소한 다음 표를 둔다.

| 제기된 문제 | 반영 여부 | 이유 |
|-------------|-----------|------|
| … | 반영 / 미반영 | … |

- 측정·diff·원본 JSON은 요약만 옮기지 말고 **원본 경로 또는 복사본**을 같은 run 폴더(또는 softwrap 차수 폴더)에 둔다.

## 사람이 매 라운드 할 일

1. 작업 지시(목표·성공 기준·잠금)를 run 폴더에 둔다.
2. 스크립트를 돌리거나, 수동으로 같은 순서(조사→설계→반론→…)를 지킨다.
3. `awaiting-approval` / `awaiting-human`에서 **승인·범위·중단**만 정한다.
4. `approved` 이후에만 구현을 시킨다.

채팅 전문을 복사하지 않는다. **이 폴더(또는 softwrap 차수 폴더)만** 넘긴다.

## 실험 (처음 5작업)

자동화 완성 전에 실제 작업 5개에 적용하고 기록한다.

- Claude 사용량
- 설계↔반론 횟수
- 구현 중 설계 변경 횟수
- 구현 후 설계상 오류
- 전체 소요 시간

기록 파일 예: `handoff/experiments/log.md` (작업마다 한 블록).

## 하지 않는 것 (현재)

- AI가 STATUS를 고치게 하기
- 설계 라운드에서 `src/` 수정
- 왕복 상한 없이 AI끼리 합의 강제
- 루트 `CLAUDE.md`에 이 규칙 넣기
- 구독만으로 “자동 핑퐁”이 된다고 가정하기

스크립트(`handoff/pingpong.ps1` 등)는 이 규칙이 확정된 뒤, Claude Code 설치·로그인 후에 만든다.
