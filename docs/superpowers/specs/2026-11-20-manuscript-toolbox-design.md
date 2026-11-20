# 원고 작업대(검색·수정 추가) 설계

**작성:** 2026-11-20  
**상태:** 합의 · 구현 (검토 8항목 반영)  
**상위:** 원고창 하단 툴박스 계획 (OCR 범위 밖)

---

## 0. 한 줄 원칙

지금은 찾기(탭·엔진) → 목록/하이라이트 → `collectAnnotFindings` → PDF 주석 내보내기가 이미 있다. 툴박스는 **새 파이프를 만들지 않고**, 사용자가 고른 구간을 발견으로 넣는 입구와 본문 검색·선택만 깊은 모듈로 둔다.

---

## 1. 합의된 전제

| 항목 | 결정 |
|------|------|
| 수정 추가 | 세션 발견과 **동일 경로** (왼쪽 목록 · 하이라이트 → 검수 결과 다운로드의 교정/인디자인 PDF에 함께) |
| 검색 | 원고 본문(`pageTexts`)만 |
| 텍스트 긁기 | 기존 PDF 텍스트 레이어만 화면에 선택 가능 |
| UI 위치 | 원고창 하단, 「페이지 맞추기」 왼쪽. 모드 슬롯은 확장 가능 |
| OCR | 범위 밖. 텍스트 없는 페이지는 선택 불가·안내만 |
| 한도·로그인 | 검색·수정 추가는 검수 실행이 아니다. **일일 검수 한도를 쓰지 않는다.** 로그인 필수 대상도 아니다. |
| 원고 조각 | `matchedText`·`replace`는 **로컬 메모리(세션)만**. Firestore·PostHog 속성으로 보내지 않는다. IndexedDB 복원은 1차 밖. |

## 2. 계층 · 모듈

| 모듈 | 하는 일 (인터페이스만) | 구현이 숨기는 것 |
|------|------------------------|------------------|
| `ManuscriptTextIndex` | `search(query) → TextHit[]` | 페이지 순회, 정규화 |
| `PageGeometry` | `hitToRects` / `selectionToRange` | itemRefs · 글리프 · 뷰포트 |
| `FindingsSink` | `addManualFinding(manual)` | 그룹 키 · 카테고리 · 목록 병합 |
| `SearchManuscript` / `AddManualFinding` | 유스케이스 한 줄 호출 | 모드 전환 · 검증 |
| `ManuscriptToolbox` (UI) | 모드 칩 + 검색창 / 추가 폼 | 도메인 규칙 없음 |

**도메인 최소 형태**

- `TextHit`: `{ pageNum, start, end, matchedText }`
- `ManualFinding`: `TextHit` + `{ replace, tip?, source: 'manual' }` — 엔진 `MatchInstance`/`GroupedResult`로 **어댑터가 매핑**해 기존 목록에 합침

베타 freeze: `ruleEngine` 매칭 로직은 건드리지 않는다. 수동 항목은 **엔진 밖에서 주입**.  
카테고리는 `manual`(검토 `caution`이 아님) — 고침이 있으면 인디자인 Replace(strike/caret)로 나간다.

### 2.1 오프셋 (못 박음)

`start`/`end`는 그 페이지 원문 **`page.text`의 반열린 구간 `[start, end)`** 이다.

- 지금 코드에서 `page.text`와 `page.visualText`는 **같은 문자열**이다. 스펙 기준 이름은 `page.text`다.
- 검색이 안에서 공백·유니코드를 접더라도 **돌려주는 오프셋은 원문 `page.text` 기준**이다. 접은 문자열 인덱스를 hit로 쓰지 않는다.
- 넣을 때 `matchedText === page.text.slice(start, end)` 가 아니면 **넣지 않는다.**

### 2.2 `selectionToRange`

화면 텍스트 레이어 선택(item 인덱스 + 글자 오프셋)을 `page.text` 인덱스로 바꾼다. 기준은 **`itemRefs`**. 뒤집힌 드래그는 start/end를 맞바꾼다. `end <= start`이면 null.

위험: 한글 조합, 줄 끝 공백, 두 줄에 걸친 선택. 같은 구간이 **하이라이트와 내보내기에서 같은 사각형**이어야 한다.

## 3. 기존 코드에 붙는 지점

- 본문·좌표: `src/lib/pdfService.js` `PageData` (`text`/`visualText`, `items`, `itemRefs`)
- 화면: `PdfViewer` 텍스트 레이어/선택 오버레이 — **수정 추가 모드에서만** 선택 가능
- 하단 바: `PdfPreviewBar` actions, 「페이지 맞추기」 왼쪽 `ManuscriptToolbox`
- 목록·하이라이트: `spellingResults`에 manual 그룹 **useMemo 병합** (`setGroups`/`publish` 없음)
- 내보내기: `collectAnnotFindings`가 합쳐진 엔트리를 읽음. 인디자인은 그다음 `prepareIndesignReplaceFindings`

## 4. UI 동작 (1차)

- **검색 모드**: 질의 → `TextHit` 목록 → 클릭 시 해당 페이지·구간 하이라이트/스크롤 (미리보기 오버레이. 목록에 넣지 않음)
- **수정 추가 모드**: 텍스트 레이어에서 구간 선택(또는 검색 hit 채택) → 고침·메모 입력 → **원문과 고침을 함께 보여 준 뒤 확인** → `FindingsSink` → 왼쪽 목록·PDF 하이라이트에 즉시 반영
- 모드 레지스트리: 1차는 `search` / `manual-add`
- 새 PDF를 열면 수동 항목은 비운다

### 4.1 추가 거부 (표현 불가 · 확인)

아래는 **추가 자체를 막는다.** 인디자인 「제외 N건」으로 나중에 빼지 않는다.

- 고침(`replace`)이 빈 문자열 — 삭제 유형. Acrobat Replace 샘플 없음
- 구간 길이 0에 글자를 넣는 삽입 (`end <= start`)
- `matchedText !== page.text.slice(start, end)`

확인 전에는 목록에 넣지 않는다. 엔진 자체점검(`slice` vs `found`)은 수동 항목에 거의 보호가 되지 않으므로, **추가 시점 확인이 방어선**이다.

## 5. 그리기 문

그리기 문 = PDF 하이라이트를 **다시 그리는 입구**.

합의된 입구는 둘뿐이다.

1. **쪽을 바꿀 때** (`pageChange`)
2. **목록이 한 번 준비됐을 때** (`listReady` 1회)

툴박스의 검색·선택·추가·취소는 `setGroups`/`publish`/`remap`을 호출하지 않는다. 수동 목록은 `useMemo`로 합친 결과만 보여 준다. 하이라이트는 쪽 이동(또는 합의된 listReady) 때 그린다.

## 6. 인디자인 · 겹침

수동 항목도 엔진과 **같은 세션 경로**를 탄다. 인디자인용에서 수동을 통째로 빼지 않는다.

흐름: 합쳐진 목록 → `collectAnnotFindings` → `prepareIndesignReplaceFindings`

이미 있는 제외만 쓴다.

| 제외 | 안내 |
|------|------|
| 고침 없음 | `noReplacement` |
| 검토만 | `reviewOnly` (`caution` 등 — 수동 카테고리 `manual`은 여기 안 탐) |
| 원문 불일치 | `textMismatch` |
| 겹침(긴 구간 우선) | `overlap` |

겹치면 긴 구간이 남고, 빠진 수는 안내의 「겹침 N」에 들어간다. **화면 목록에서는 빠진 항목도 그대로 보인다.** 내려받기 인디자인용에서만 빠진다.

## 7. 비범위

- 스캔본 OCR
- 표기 통일 1차 찾기 변경
- ruleEngine/시트 매칭 변경
- 목업 픽셀 디자인
- 빈 고침(삭제)·길이 0 삽입
- 수동 항목 Firestore/PostHog/IndexedDB 저장
- 인디자인에서 수동만 따로 빼는 분기

## 8. 검증 목록

- 한글 선택, 두 줄에 걸친 선택, 뒤집힌 드래그
- 텍스트 없는 페이지 — 선택 불가·안내만
- 같은 구간: 화면 하이라이트 사각형 = 내보내기 사각형
- `matchedText === page.text.slice(start, end)` 아니면 추가 거부
- 빈 고침·길이 0 삽입은 추가 거부
- 엔진 항목과 겹침 — 화면에는 둘 다, 인디자인용은 긴 구간만, 안내에 겹침 N
- 검색·수정 추가 후 일일 검수 한도 불변
- 새 PDF 열면 수동 항목 소멸
