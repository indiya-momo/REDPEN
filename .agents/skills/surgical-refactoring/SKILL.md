---
name: surgical-refactoring
description: >-
  Execute one planned structural refactor at a time with no behavior change, no
  new features, and no drive-by cleanup. Use after an approved refactoring-plan
  when the user asks for Surgical Refactoring, 수술적 리팩터, or 계획대로 리팩터
  한 단계만.
---

# Surgical Refactoring

승인된 `refactoring-plan`의 **한 단계만** 실행한다.

관련: `refactoring-plan`(필수 선행), `architecture-audit`, `minimal-path`, `codebase-design`.

## HARD-GATE

한 번에 하나의 구조적 문제만 수정한다.

- 신규 기능을 추가하지 않는다.
- 기존 기능의 동작을 개선하지 않는다.
- 관련 없어 보이는 코드도 정리하지 않는다.
- 계획에 없는 파일은 수정하지 않는다.

계획·승인이 없으면 시작하지 않는다. “구조가 복잡해 보여서”만으로 착수하지 않는다 — 적격은 `architecture-audit` 기준을 따른다.

## 착수 전 체크

- [ ] 이번 Step의 감사 항목 ID / 계획 제목이 대화에 명시됨
- [ ] 파일 화이트리스트가 계획과 일치
- [ ] 검증 명령·수동 시나리오가 계획에 있음
- [ ] 동작 변경·기능 추가·성능 “개선”이 이번 Step 목표가 아님

하나라도 없으면 사용자에게 확인만 하고 **코드를 쓰지 않는다.**

## 절차

1. 계획에서 **이번 Step만** 인용해 범위를 고정한다.
2. 화이트리스트 파일만 읽고, 최소 패치로 구조 문제 하나을 해소한다.
3. 계획의 검증을 실행한다.
4. 검증 실패 시: 같은 Step 안에서만 고친다. 범위를 넓히지 않는다.
5. 보고: 바꾼 파일 / 의도 / 검증 결과 / **다음 Step은 실행하지 않음** (사용자가 지시할 때까지).

## 완료 판정

- 계획한 구조 문제 하나만 해소됨
- 공개 동작·계약이 계획상 “동일”로 유지됨
- 화이트리스트 밖 파일 변경 없음
- 포맷/임포트/이름 정리 등 드라이브바이 없음 (필수로 같은 hunk에 묶인 경우만 예외, 보고에 명시)

## 금지

- Step N 끝난 뒤 승인 없이 Step N+1 진행
- 테스트 추가를 구실로 제품 동작 변경
- “같은 파일에 있으니” 인접 냄새 코드 정리
- 커밋·푸시 (사용자가 명시할 때만, 레포 규칙 따름)

## 보고 템플릿

```text
Step: …
파일: …
의도: (구조만, 동작 동일)
검증: 통과 | 실패(요약)
다음: 사용자 지시 대기 (자동 진행 안 함)
```
