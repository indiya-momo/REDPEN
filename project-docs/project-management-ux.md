# 프로젝트 관리 UX 설계 노트 (마이페이지 · Library / Workbench / Share Preview)

> 목적: "나의 프로젝트(검수 기준)"를 마이페이지에서 어떻게 보고·편집·공유하게 할지에 대한 합의 내용.
> 이 문서는 새 대화(작업 공간)에서 이 기능을 이어가기 위한 출발점이다.
> 작성 시점 기준: "카드 표시 개편"은 이미 배포 완료(머지됨). 이 문서는 그 다음 단계.

## 0. 핵심 원칙

데이터를 어떻게 나누느냐보다, **편집자가 한 장의 카드 · 한 작업대 · 한 미리보기로
표기 기준을 이해하고 손대게 하느냐**가 먼저다. 슬롯·폴더·공유·과금은 포장이고,
사용자가 실제로 만지는 화면이 제품의 본체다. 아키텍처는 이 세 화면을 떠받치도록
설계하고, 폴더·공유는 사용자가 이미 쓰는 "시각적 묶음"에서 뒤늦게 승격시킨다.

출판 비유: 카드 = 책의 명함 + 목차, 작업대 = 스타일 시트를 펴서 손보는 자리,
미리보기 = 외주·감수에게 보여줄 한 장.

## 1. 세 화면 = 세 Port (클린아키텍처 골격)

화면은 저장소·Firebase를 직접 모르고 Port(애플리케이션 경계)에만 의존한다.

- **Library Port** (마이페이지): `listGrouped`, `rename`, `setMeta(메모·태그)`,
  `duplicate`, `delete`, `selectForWork`. → 가벼운(메타) 편집 담당.
- **Workbench** (기존 검수 화면, ConsistencyPanel 등): 규칙 자체(칩 on/off·추가·삭제)
  같은 무거운 편집 담당. 카드는 여기로 들어가는 입구일 뿐.
- **Share Preview Port** (나중): `getReadOnlyView(token)`. 지금은 화면만,
  백엔드(읽기 토큰)는 뒤따라온다.

### 표현(Presentation)을 두 겹으로

- **표시 규칙 레이어** = 기존 `src/lib/projectCardSummary.js`
  (데이터 → 활성 개수·대표 단어). 검수 시작 팝업과 숫자가 일치하도록 같은 함수 재사용.
- **Presenter** = `projectCardViewModel` (신규). 위 수치를 받아 "사람이 읽는 문장"을
  만든다. 도메인 수치와 문장 표현을 분리한다.

## 2. 카드 와이어 (접힘 / 펼침 / 액션 3)

카드는 통계판이 아니라 **명함 + 목차**다.

### 접힘 (3줄, 건수는 숨김)

1. 명함: `[문학총서 · 2권째]` 《해는 지지 않았다》 기준
2. 목차: `띄어쓰기·외래어 표기 강화 · "그러나" 통일 · 본보조 8쌍` (Presenter 문장, 대표 3~5개)
3. 메타: `마지막 작업 6/18 · 원고 312p`

### 펼침

- 카테고리별 대표 규칙 3~5개(맞춤법 검수 / 일관성 검수 / 본용언+보조용언)와 그때 개수 노출.

### 카드 액션 3 (불러온 뒤가 아니라 카드에서 바로)

1. 이름 변경 (인라인)
2. 메모·태그 (칩 입력)
3. 「이 기준으로 작업」 → 작업대 전환

→ "불러온 다음 어디서 이름·메모 고치지?" 문제가 사라진다.
**가벼운 편집 = 라이브러리 / 무거운 편집 = 작업대** 로 분리.

## 3. 지금 고정할 계약 — `projectCardViewModel`

```
ProjectCardViewModel {
  id
  title            // 《프로젝트명》
  tags: string[]   // 명함 줄 칩 (총서·권차) — 그룹의 씨앗
  headline: string // 목차 줄: 대표 규칙 요약 문장 (Presenter)
  highlights: { category, label, count }[]   // 펼침: 카테고리별 대표 3~5
  counts: { editorReview, spelling, find, commonString, auxiliary } // 펼침/툴팁
  lastWork?: { date, manuscriptPages? }       // 메타 줄
  savedDate
  isActive
  dirty?: boolean              // '마지막 저장 이후 규칙 변경됨' → 저장·공유 유도
  shareScope?: 'project' | 'folder'  // 미래 공유 단위 — 필드만 예약
}
```

### 데이터 출처 / 신규 저장 필요 여부 (정직한 비용)

- `counts`, `highlights` — 기존 함수 재사용(저장 변경 없음).
  `countConsistencyCheckActiveRules`, `listConsistencyEntries`,
  `listPhraseSlotEntries`, `listAuxiliaryVerbEntries`,
  `countBuiltInActiveRules`, `countSpacingReviewActiveRules`.
- `tags`, 메모 — **RuleSet에 필드 추가 필요**(저장 스키마·마이그레이션·클라우드 동기화).
- `lastWork`(날짜·원고 페이지수) — 검수 이력/projectContext에서. 작업 시 기록 필요.
- `dirty` — **새 저장 없이 가능**. 기존 지문(`spellingRulesFingerprint`,
  `cautionRulesFingerprint`)을 저장 시점 스냅샷과 비교.
- `shareScope` — 지금은 필드만 예약(공유 단계에서 사용).

## 4. 공유 미리보기 = 같은 ViewModel의 읽기 전용 모드

「공유 미리보기」 = 펼친 카드를 그대로 `readOnly`로 잠그고(+/× 비활성),
PDF·검수 결과는 빼고("기준만" 공유 — 기존 프라이버시 약속과 동일),
"외주 교정자에게는 이렇게 보입니다" 카피만 고정.

B-0(읽기 링크)는 이 미리보기 URL을 토큰으로 여는 것뿐.
**Presenter 하나, 모드 둘** — 편집·공유·잠금이 같은 컴포넌트의 모드 차이로 정리된다.

## 5. 단계 로드맵 (사용자안 + 검토 의견)

- **1차 (개인 Pro)**: A-1 슬롯+복제 · A-2 메모/태그 · C-2 내보내기/가져오기 ·
  마이페이지 불러오기·삭제·슬롯 CTA. 포지셔닝 = "슬롯 판매"가 아니라
  **"책·시리즈별 기준을 복제·분류·백업하는 솔로 워크벤치."**
- **2차 (공유 맛보기)**: B-0 읽기 전용 링크 · projectContext 타임라인(C-1 얕은 버전).
- **3차 (팀)**: B-1 org · B-2 viewer/editor · A-4 얕은 이력 → 공유 단위 리비전 승격.
- **4차 (Enterprise)**: B-3 잠금 · B-4 제안/승인 · A-3 폴더 · C-3 템플릿 라이브러리.

### 검토 의견 (이어서 결정할 것)

1. 1차 수익성은 약할 수 있음 → 1차 영웅 유스케이스를 **"시리즈/리스트물의 기준 복제"**로
   날카롭게.
2. B-0의 payload를 **"기준만"으로 못 박기**(검수 결과 공유는 프라이버시 약속과 충돌).
   공개 링크 = 제품 최초의 보안 경계(Firestore 규칙·토큰)라 가볍지 않음.
3. 2차 "타임라인"과 3차 "얕은 이력"을 **하나의 이벤트 로그 계보**로(중복 방지).
4. 진짜 돈(B-1 좌석제)이 3차라 멀다 → **B-0을 1차로 당겨** 매출 타이밍을 앞으로 고려.

## 6. 그룹/폴더 (나중)

폴더 엔티티를 미리 만들지 않는다(YAGNI). 대신 UI는 `전체 | 태그 칩`으로 시작하고,
드래그로 태그 부여(A-2만으로 "시각적 그룹" 달성), 슬롯이 많아지면 접히는 섹션 헤더
(`○○총서 (3)`). 백엔드는 `listProjectsGrouped`(유스케이스 경계)만 먼저 두고,
공유(B)가 들어올 때 `Folder` 엔티티로 승격. ShareScope = `Project | Folder`는
체크박스 한 줄로 노출.

## 7. 다음 단계

카드(접힘+펼침+액션3)를 **클릭 가능한 시각 목업**으로 먼저 그려 눈으로 맞춘다.
그 목업이 곧 `projectCardViewModel` 필드를 확정한다. 폴더·공유는 같은 UI 틀에 얹는다.

## 8. 현재 코드베이스 연결점

- 카드 렌더링: `src/components/MyPageWindowScreen.jsx`
- 카드 표시 함수: `src/lib/projectCardSummary.js` (+ 테스트)
- 프로젝트 로드 훅: `src/hooks/useMyPageProjects.js`
- RuleSet 저장/타입: `src/lib/ruleSetsStorage.js` (`duplicateRuleSet` 존재)
- 슬롯 제한: `src/lib/criteriaPresetLimit.js` (로컬 dev 면제 적용됨)
- 활성 규칙 수: `src/lib/activeRuleCount.js`, `src/lib/consistencyCheckConfirm.js`
- 등록 항목 목록: `compoundPairRegister.js`(일관성), `phraseSlotRegister.js`(공통 문자열),
  `auxiliaryVerbRegister.js`(본용언+보조용언)
