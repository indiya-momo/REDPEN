# 한글 PDF soft-wrap 재결합 (2026-08-01)

> **상위 정책 (2026-08-02):**  
> soft-wrap을 추출 문자열에 eager로 굽는 가정은  
> `visual-semantic-text-layers-2026-08-02.md` 로 대체한다.  
> Visual = 줄 유지(canonical), Semantic = 연결 후보만. 충돌 시 새 문서를 따른다.  
> 본 문서는 1차 휴리스틱·기하 실험 기록으로 유지한다.

## 목표

한글(한컴 등) PDF에서 어절 **중간**에만 끼는 강제개행(`내자\n리는`)을 읽어 `내자리는`처럼 복원한다.  
문장·어절이 genuinely 바뀌는 줄바꿈은 유지한다. (워드 PDF 읽기 이슈는 범위 밖)

## 구조 (유지보수 방향)

`pdfService.js` → `pdfPageText.js` → 테스트 → 이 설계 문서가 서로 대응한다.

| 층 | 파일 |
|----|------|
| 진입·re-export | `src/lib/pdfService.js` |
| 텍스트 조립·soft-wrap | `src/lib/pdfPageText.js` |
| 단위 테스트 | `src/lib/pdfService.buildPageText.test.js` |
| 설계 | `project-docs/hangul-soft-wrap-rejoin-2026-08-01.md` |

`pdfPageText.js`로 조립 로직을 분리한 것은 장기 유지보수에 유리한 방향으로 채택·유지한다.

## 넣는 위치

| 경로 | 역할 |
|------|------|
| `buildPageText` | 줄 조립 시 `hangulSoftWrapSeparator`로 `\n` 삽입 여부 결정 (운영 경로) |
| `rejoinHangulSoftLineBreaks` | 이미 `\n`이 있는 문자열 후처리 + `itemRefs` offset 보정 (유틸·테스트) |

줄 **나누기**(`shouldStartNewTextLine`)는 그대로 둔다.

## 1차(베타) 확정 규칙

다음을 **모두** 만족할 때만 `\n`을 제거하고 붙인다.

1. 직전 글자 `L`·직후 글자 `R`이 모두 **한글 음절** (`가`–`힣`)
2. 글자 크기 비 ≤ `FONT_LINE_SPLIT_RATIO`(1.18) — 소제목·본문 보호
3. `buildPageText`에서 y 간격이 soft-wrap 행간 범위 안 (`0.4`–`1.85` × font)
4. 앞줄이 너무 짧지 않음(단음절·쪽번호 보호, 최소 **2**자 — 연속 soft-wrap 조각 허용)
5. **같은 왼쪽 여백** — `nextStartX`≈`prevStartX`(≤0.5em). 목록 들여쓰기·다른 열은 위치가 다르므로 붙이지 않음
6. **붙이지 않음(예외)** — `isLikelyHangulEojeolBoundary`
   - 다음 줄이 `“ ‘ ( [ 「` 등으로 시작
   - 빈 줄(`\n\n`) — 단락
   - 조사·어미 경계(아래 절)
   - 문장부호 뒤(애초에 `L`이 음절이 아님)
   - 다음 줄이 앞줄 끝보다 오른쪽(지도 라벨 등)

공백 처리:

- `\n`만 제거(사이에 스페이스를 **새로 넣지 않음**)
- 줄끝에 이미 공백이 있으면 유지 → `내 \n자리는` → `내 자리는`
- 줄머리 가로 공백은 strip (아래 유니코드 절)

## 조사/어미 경계 (`isLikelyHangulEojeolBoundary`)

단음절 `다`만 보면 `바다`도 과차단·과결합 위험이 있다. 1차에서도 **형태 패턴**을 쓴다.

| 규칙 | 예 | 결과 |
|------|-----|------|
| 2~3음절 접미 (`한다` `진다` `으로` `습니다` …) | `보인다\n그래서` | `\n` 유지 |
| 좁은 조사 한 음절 (`은는이가을를의만와과도`) | `그는\n사과를` | `\n` 유지 |
| 줄끝 임의 음절 + 다음 줄이 조사로 시작 | `바다\n가 아름답다` | `\n` 유지 |
| 종결 후보 `다/요/까/네` + 다음 줄 2음절+ | `좋다\n그래서` | `\n` 유지 |
| 어간 조각 + 어간 조각 | `바라보\n다보니` | soft wrap 결합 |
| 앞줄 띄어쓰기 + 끝 어절≥2 + 다음이 어간≥2·조사/접미 | `… 고상`\n`가옥을…` · `…가 반드시`\n`행복감의…` | `\n` 유지 |
| (위와 달리) 다음이 접미 없는 조각·같은 여백 | `그래서 한글중`\n`간강제` | soft wrap 결합 |

### 공백 복원(후속)

「붙인 뒤 조사 끝이면 공백 삽입」은 1차에 넣지 않는다. 베타 관측 후 **별도 단계**로 분리.

| 방식 | 예 | 1차 |
|------|-----|-----|
| `\n` 유지 | `그는\n사과를` | ✅ 채택 |
| 붙인 뒤 공백 | `그는 사과를` | 후속 후보 |

## 줄 조립 성능

`buildBuiltLinesFromEntries` → dedupe 후 `materializeBuiltLine`에서 줄마다

- `text` / `textLayout`
- `lineRefs` / `lineRefsLayout`
- `startFont` / `endFont`

을 **한 번만** 만든다. `buildPageText`는 미리 만든 문자열을 이어 붙이고 separator만 결정한다.  
(이전: 줄마다 `appendBuiltLine`을 peek·emit으로 최대 6회 호출 — 500페이지급에서 불필요 문자열 생성이 커질 수 있어 제거)

## 줄머리 들여쓰기(유니코드 공백)

- strip 대상: ASCII 공백·탭·NBSP + U+2000–200A·U+202F·U+205F·U+3000·U+200B 등 **가로 공백**
- **`\s` 전체는 쓰지 않음** — `\n`까지 삼켜 단락 경계를 깨뜨릴 수 있음
- 구현: `isInlineSpaceChar` / `INLINE_SPACE_RE`

## itemRefs 보정

| 경로 | 방식 |
|------|------|
| `buildPageText` | 줄 단위 refs를 base offset에 더해 누적 (soft-wrap 구간 `\n` 미삽입) |
| `rejoinHangulSoftLineBreaks` | 삭제 인덱스 누적 당김 (`shiftItemRefsAfterRemovals`) — 현재 O(refs×삭수), 필요 시 prefix-sum·이진 탐색 후속 |

## 코드 리뷰 반영 (2026-08-01)

기능 구현은 거의 완성 단계로 보고, **성능·가독성·회귀 안정성**을 다듬는 리팩터링으로 정리했다.

### 지금 수정함 ✅

| # | 지적 | 반영 |
|---|------|------|
| 1 | `appendBuiltLine()` 줄당 최대 6회 호출 | `materializeBuiltLine`으로 줄당 text/layout/refs/font 1회 조립 |
| 2 | `HANGUL_LINE_END_KEEP` 단음절 과차단 (`바다`의 `다` 등) | `isLikelyHangulEojeolBoundary` — 2~3음절 접미 + 좁은 조사 + 다음 줄 조사/종결 패턴 |
| 3 | soft-wrap 회귀 테스트 부족 | 연속 soft-wrap, 빈 줄(`가\n\n나다`), 줄머리 다중·Thin Space, `바다\n가` 등 추가 |

### 나중에 (보류)

| # | 지적 | 메모 |
|---|------|------|
| 3′ | `shiftItemRefsAfterRemovals` O(refs×삭수) | 삭제가 많지 않아 우선순위 낮음 → prefix-sum/이진 탐색 |
| 4 | `appendBuiltLine` 책임 과다 (문자열·refs·공백·newline) | `joinEntries` → `buildText` 2단계로 나누기 |
| 6 | `OVERLAY_POS_BUCKET_PT = 2` 고정 | PDF 종류별 1/2/3 최적값이 다를 수 있음 → 설정 분리 |
| 7 | `buildPageText`가 김 | 역할은 uniqueLines → separator → text/layout; `emitLine`만 분리해도 가독성↑ |
| — | 100페이지급 랜덤 PDF regression | 베타 이후 |

### 이미 좋았던 점 (유지)

- overlay / spread / subtitle / soft wrap 테스트가 구현 의도를 설명함
- `pdfService` · `pdfPageText` · 테스트 · 설계 문서 1:1 대응

## 범위 밖

- 워드 PDF 읽기 순서·과분절
- 주의 규칙 오탐(`같` 어간, `던지` 등) — 추출과 별개
- 작업창 메뉴·원고 좌우 교체 — `workbench-menu-side-swap-2026-08-01.md`

## 검증

- 단위: `src/lib/pdfService.buildPageText.test.js`
  - overlay / spread / subtitle / soft wrap
  - 연속 soft-wrap, 빈 줄, 줄머리 다중·Thin Space, `바다\n가`, `바라보\n다보니`
- 회귀: 소제목 폰트 분리, 펼침면, 쪽번호 단면, `pdfTextAudit`
- 베타 수동: 한글 샘플에서 `자\n리`류 결합, 조사·명사 경계는 줄바꿈 유지

## 구현 파일

- `src/lib/pdfPageText.js` — 핵심
- `src/lib/pdfService.js` — re-export (`isLikelyHangulEojeolBoundary` 포함)
- `src/lib/pdfService.buildPageText.test.js`
