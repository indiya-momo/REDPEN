---
name: refactoring-plan
description: >-
  Turn an Architecture Audit into a minimal, behavior-preserving refactor
  plan: select only valuable P0/P1 items, order steps, and define verification
  per step. Use after architecture-audit when the user asks for Refactoring
  Plan, 리팩터 계획, or 리팩토링 계획. Does not edit application code.
---

# Refactoring Plan

1단계(`architecture-audit`) 결과를 보고 나서만 진행한다.  
감사가 없으면 먼저 `architecture-audit`을 수행하거나, 사용자가 붙인 감사 보고서를 입력으로 쓴다.

이 단계는 **계획만** 작성한다. 애플리케이션 코드를 수정하지 않는다.

관련: `architecture-audit`(입력), `surgical-refactoring`(실행), `minimal-path`, `codebase-design`.

## HARD-GATE

P0/P1 중 **실제로 리팩토링할 가치가 있는 것만** 선정한다.

- 기능 동작을 변경하지 않는 **최소 변경** 계획을 작성한다.
- 변경 순서를 정한다.
- 각 단계마다 기존 동작을 검증할 방법을 정의한다.
- `architecture-audit` 적격 조건을 충족하지 않은 항목은 계획에 넣지 않는다.
- 단순히 파일이 크거나 코드가 길다는 이유만으로 넣지 않는다.

## 선정 기준

포함할 것:

- 감사의 **P0**, 그리고 가치가 분명한 **P1**
- 적격 조건(중복 3곳+, 변경 전파 3영역+, 회귀 위험, 책임 3+, 검증 곤란, 실제 속도 저하) 중 1개 이상

제외할 것:

- P2 (기본) — 사용자가 명시할 때만
- 비후보 관찰
- “깔끔해 보임” / “나중에 편할 듯”만 있는 항목
- 동작 개선·기능 추가가 섞인 항목 (리팩터가 아님)

## 절차

1. 감사 보고서의 후보 목록을 입력으로 고정한다.
2. 각 P0/P1에 대해: **가치** (안 하면 무슨 비용?) / **최소 변경으로 가능한가?** / **검증 가능한가?**
3. 가치 없거나 검증 불가면 탈락시키고 이유를 적는다.
4. 남은 항목만 **의존 순서**로 정렬한다 (한 번에 하나 원칙 → `surgical-refactoring`).
5. 단계별 검증 방법을 구체화한다 (기존 테스트 명령, 수동 시나리오, 가드 테스트 경로).
6. 계획을 사용자에게 제출하고 **승인 전 코드 수정 금지**.

## 계획 템플릿

```markdown
# Refactoring Plan — [범위] — [날짜]

## 입력
- 감사: [링크/요약]
- 선정: … / 탈락: … (이유)

## 원칙
- 동작 변경 없음
- 단계당 구조 문제 하나
- 계획 밖 파일 수정 없음

## 단계
### Step N — [한 줄 제목]
- 해결할 문제: [감사 항목 ID]
- 만지는 파일: (화이트리스트)
- 하지 않는 것: …
- 변경 요지: (최소, 동작 동일)
- 검증:
  - 자동: `…`
  - 수동: …
- 완료 판정: …

## 순서 근거
- Step1 → Step2 이유: …

## 비범위
- …
```

## 금지

- 계획 작성 중 리팩터 실행
- “顺便” 동작 개선·성능·UI를 단계에 섞기
- 한 단계에 여러 구조 문제 묶기
- 감사에 없는 새 문제를 계획에 몰래 추가 (필요하면 감사 보완을 먼저)
