# 마이페이지 「나의 프로젝트」A+B 설계

**상태:** 합의 (2026-06-20) · 구현 진행 — 일정별 백로그는 [`mypage-project-backlog-2026-06-24.md`](./mypage-project-backlog-2026-06-24.md)  
**범위:** 베타 — 기준 프리셋 + PDF 메타(로컬), PDF 본문 서버 업로드 없음

## 정의

**프로젝트** = `savedAt`이 있는 RuleSet + 선택적 `projectContext`(PDF 메타).

| 축 | 내용 |
|----|------|
| A (핵심) | 맞춤법·일관성 규칙, 제외어, `name`, `savedAt` |
| B (맥락) | `pdfFileName`, `pdfPageCount`, `pdfSizeBytes`, `lastWorkedAt`, (선택) 마지막 검수 건수 |

PDF 바이너리·검수 결과 전체는 클라우드에 올리지 않는다.

## 저장 정책 (합의)

- **(1) PDF 없이도 저장 허용** — 「출판사 공통 기준」 템플릿용.
- PDF가 열려 있을 때 저장하면 `projectContext`에 메타 스냅샷을 붙인다.
- PDF 없이 저장하면 `projectContext` 생략 또는 `pdfLinked: false` — 카드에 `원고: 미연결`.

## `projectContext` 스키마 (RuleSet 확장)

```ts
projectContext?: {
  pdfFileName?: string;
  pdfPageCount?: number;
  pdfSizeBytes?: number;
  lastWorkedAt?: string; // ISO
  lastSpellingFindingCount?: number;
  lastConsistencyFindingCount?: number;
}
```

- `normalizeRuleSet`에서 optional 필드만 통과.
- Firestore `userCriteria.ruleSets[]` 기존 배열에 포함 (새 컬렉션 없음).

## 저장·갱신 시점

### 1안 — 저장 순간 스냅샷 (필수)

`handleSaveCriteriaPreset` 성공 시:

- 열린 PDF 있음 → 위 메타 + `lastWorkedAt = now`
- PDF 없음 → `projectContext` 없음

### 2안 — 활성 저장 프로젝트 작업 갱신 (권장, 1안과 함께)

현재 active set이 `savedAt` 있을 때 맞춤법/일관성 검수 완료 후:

- `lastWorkedAt`, `lastSpellingFindingCount` / `lastConsistencyFindingCount`만 갱신
- debounce 후 기존 `flushRuleSets` / cloud 경로

### 3안 — 로컬 세션 재연결 힌트 (후순위)

IndexedDB 세션 `fileName`+`pageCount`가 프로젝트 메타와 일치하면 이어하기 배너. 베타 범위 밖.

## 마이페이지 UI

- `*준비중인 기능입니다` 제거.
- 카드: 이름, `원고: {fileName|미연결}`, 페이지·작업일, 규칙 요약, 「검수에 불러오기」.
- 슬롯 게이지 `N/M` 유지; 상한 시 유료 슬롯 안내 문구만 (결제 없음).
- 빈 상태: 「검수 화면에서 프로젝트 이름을 저장하세요」.

## 유료화 (방향만)

| 축 | 무료(베타) | 유료 v1 |
|----|-----------|---------|
| 프로젝트 슬롯 | 1 | 3 / 10 / … |
| 슬롯 내용 | 기준 + 메타 | 동일 |
| 일일 검수 횟수 | 기존 쿼터 | 슬롯과 **분리** |

## 구현 체크리스트 (베타 1차)

1. `ruleSetsStorage` / `ruleSetNormalize` — `projectContext` 타입·통과
2. `useRuleSets.handleSaveCriteriaPreset` — PDF 메타 스냅샷 (인자 또는 콜백으로 MainScreen에서 전달)
3. (2안) 검수 완료 시 active saved set 메타 갱신
4. `summarizeProjectRuleSet` / `useMyPageProjects` — 카드용 원고·작업일 표시
5. `MyPageWindowScreen` — 준비중 문구 제거, 카드 copy
6. `my-page.css` — 원고 줄 스타일
7. smoke: 저장 → 마이페이지 목록에 표시 (메타有/無)

## 비범위

- PDF 서버 업로드
- 검수 결과 클라우드 동기화
- ruleEngine / regex 변경
- 결제 연동
