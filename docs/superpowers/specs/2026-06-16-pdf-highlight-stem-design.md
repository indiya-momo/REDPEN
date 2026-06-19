# PDF 하이라이트 어간 정확도 — 설계

**작성일:** 2026-06-16  
**상태:** 검토 대기  
**범위:** 검수 결과는 맞는데 PDF 오버레이만 어긋나는 문제 (증상 B)

---

## 1. 문제 정의

### 증상

- 결과 목록에는 매칭이 잡히지만, PDF 위 하이라이트 **위치·길이**가 틀림.
- **짧은 어간**에서 특히 심함: `만큼` → `만` 또는 `큼`(+α), `같이` → `이가` 등.
- **같은 페이지·같은 규칙**에서도 줄마다 맞기도 하고 틀리기도 함.

### 대표 재현 (사용자 보고)

| 규칙 | 페이지 | 기대 | 실제 (오류) | 문맥 |
|------|--------|------|-------------|------|
| 만큼 (편집자 검토) | — | `만큼` | `만` / `큼`(+다른 글자) | `…회상할 만큼…` |
| 같이 (편집자 검토) | 24p | `같이` | `이가` (`같` 제외) | `…같이 가…` (띄어 쓰기) |

### 비목표

- 매칭 규칙·regex·`ruleEngine` 탐지 로직 변경 (베타 freeze; 별도 승인 없음)
- AI 교정, 자동 수정, 스캔 PDF
- 목차 검사·규칙 세트 UI

### 성공 기준

1. 편집자 검토 항목에서 `highlightText`(어간)와 **동일한 글자열**만 PDF에 칠해짐.
2. `같이 가` 문맥에서 `같이`만 칠하고 `가`는 칠하지 않음.
3. `만큼`이 한 PDF 항목·분리 항목·합성 공백(`만 큼`) 모두에서 `만큼`만 칠함.
4. 기존 `pdfHighlightRange.test.js`·`cautionRules.test.js` 전부 통과 + 신규 회귀 테스트 추가.
5. 맞춤법 기준(`find → replace`)에서도 동일 파이프라인으로 **칠 범위 ≤ matched 구간** 유지 (회귀 없음).

---

## 2. 현재 파이프라인 (요약)

```
ruleEngine
  → index, matchedText, [highlightText, highlightIndex]  (caution: cautionHighlightSpan)
pdfHighlightRange.resolveHighlightRange
  → page.text 상의 [start, end)
pdfService.highlightRectsForTextRange
  → itemRefs + viewportBoxForTextItem → overlay 박스
```

### 약한 지점

1. **`resolveHighlightRange` fallback**  
   span 안에서 phrase를 못 찾으면 `highlightIndex` 추정 또는 `anchorIndex + phrase.length`로 그림 → **한 글자 밀림**.

2. **`itemRefs` ↔ `page.text` 불일치**  
   `pdfPageText`가 항목 사이에 합성 공백·줄 조립을 넣음. 인덱스는 맞아도 **PDF 항목 내 localStart/localEnd**가 틀어질 수 있음.

3. **`viewportBoxForTextItem` 폭 추정**  
   균등 자간 가정·비균등 조판에서 **시작 오프셋**이 한 글자 어긋남 → `같` 빠지고 `이가`처럼 보임.

4. **다음 항목 침범**  
   `같이` + 다음 항목 `가`일 때 박스가 인접 항목까지 넓어질 수 있음.

---

## 3. 설계 방향 (채택)

**② 글자↔항목 정확 매핑 + ③ 근처 PDF 항목 재탐색**을 함께 적용.  
① 범위 clamp는 ②③의 안전망으로만 사용 (단독 해결책 아님).

### 3.1 `resolveHighlightRange` — 어간 우선·엄격

**규칙**

- `highlightText`가 있으면 **반드시** `[matchIndex, matchIndex + matchedText.length)` 안에서만 구간을 잡는다.
- `findPhraseInSpan`(합성 공백 무시)으로 phrase 위치를 찾고, 실패 시:
  - `highlightIndex`가 span 안이면 그걸 사용.
  - 그래도 실패하면 **페이지 전체 재검색 금지**; 해당 인스턴스는 `null` 반환 + 개발 모드 경고 (오칠보다 미칠 낫다).
- 구간 길이는 **항상 `phrase.length`** (정규화 NFKC 후 글자 수).

**`같이 가` 특수 clamp**

- phrase 끝 다음 문자가 공백이 아닌 한글 등이면 **phrase 길이로 절대 넘지 않음**.
- phrase 직후 공백 + `가` 패턴: end를 phrase 끝에 고정 (다음 항목 `가` 미포함).

### 3.2 `highlightRectsForTextRange` — 항목 경계 정확 매핑

**신규 헬퍼 (예: `highlightRectsForCharRange`)**

입력: `pageData`, `start`, `end` (page.text 인덱스)

동작:

1. `itemRefs`를 순회하며 `[start, end)`와 겹치는 ref만 선택.
2. 각 ref에 대해 `localStart = max(0, start - ref.start)`, `localEnd = min(ref.end - ref.start, end - ref.start)` — **글자 인덱스 기준** (현 로직 유지하되 검증 강화).
3. ref가 여러 개면 박스 배열 반환 후 **같은 줄이면 merge** (기존 `mergeHighlightBoxes`).
4. 겹치는 ref가 없으면 → **3.3 근처 재탐색**으로 폴백.

**검증**

- 반환 전 `pageData.text.slice(start, end)`와 phrase 일치 assert (테스트·dev only).

### 3.3 근처 PDF 항목 재탐색 (폴백)

`itemRefs` 매핑 실패 시:

1. `matchIndex` 근처(±80자) 같은 줄의 `itemRefs`만 모음.
2. 연속 항목 `str`을 이어 붙여 NFKC 정규화 후 `phrase` 검색.
3. 찾은 위치를 항목별 `localStart/localEnd`로 환산해 박스 생성.
4. 실패 시 `highlightRectsFromLineContext` (기존) → 그래도 실패 시 **빈 배열** (전체 줄 칠하기 금지, standalone 예외는 기존 정책 유지).

### 3.4 `viewportBoxForTextItem` — 짧은 span 보정

- `localEnd - localStart ≤ 4` (한국어 어간)일 때:
  - 가능하면 `item.width / strLen` 균등 분할 **우선** (조판 PDF에서 비율 오차 줄임).
  - `scaledItemWidth`와 `uniformAdvance` 불일치가 크면 **한글 음절 단위**로만 offset 계산 (공백 문자 제외 카운트 옵션 검토).

변경은 **짧은 구간에만** 적용해 맞춤법 긴 구문 회귀 최소화.

---

## 4. 테스트 전략

### 단위 테스트 (`pdfHighlightRange.test.js`)

| 케이스 | PDF items 형태 | 기대 slice |
|--------|----------------|------------|
| 만큼 (기존) | `회상할` + `만큼` | `만큼` |
| 만큼 분리 | `회상할` + `만` + `큼` | `만큼` |
| 만큼 붙임 | `회상할` + `만큼은` | `만큼` (은 제외) |
| 같이 가 | `…` + `같이` + `가` | `같이` |
| 같이 가 분리 | `같` + `이` + ` ` + `가` | `같이` |
| 같이 가 붙임 | `같이가` (오탐 방지용 matchedText는 `같이`만) | `같이` |

### 통합 (`highlightRectsForTextRange`)

- 위 각 케이스에서 `rects` 합산 width ≤ 단일 항목 `만큼`/`같이` width × scale + ε.
- `같이 가`: 두 번째 항목 `가`의 x와 겹치지 않음 (left 비교).

### 회귀

- 기존 389 tests + subtitle·바라·한 번 등 기존 하이라이트 테스트 유지.
- **24p 실제 PDF** 확보 시 `src/test/fixtures/` 스모크 1건 추가 (선택, P1).

---

## 5. 구현 순서

1. **테스트 추가 (RED)** — 같이 가·만큼 분리/붙임 케이스.
2. **`resolveHighlightRange` 엄격화** — fallback 축소·clamp.
3. **`highlightRectsForCharRange` + 재탐색 폴백** — `pdfService.js`.
4. **짧은 span 박스 보정** — `viewportBoxForTextItem`.
5. **수동 확인** — 사용자 24p PDF, 만큼·같이 규칙 ON 후 결과 클릭.

예상 터치 파일:

- `src/lib/pdfHighlightRange.js`
- `src/lib/pdfHighlightRange.test.js`
- `src/lib/pdfService.js`
- (필요 시) `src/lib/pdfPageText.js` — ref.start/end 검증만

---

## 6. 위험·완화

| 위험 | 완화 |
|------|------|
| 베타 freeze (`ruleEngine`) | 탐지 로직 무변경; 하이라이트·rect 경로만 |
| standalone 제목 줄 전체 칠하기 | `isStandaloneTitleOnLine` 분기 유지, 어간 모드와 분리 |
| 성능 | 페이지당 인스턴스 수 제한 기존과 동일; 재탐색은 실패 시만 |
| 미칠 증가 | phrase 못 찾으면 null; 목록에는 남고 PDF만 무하이라이트 (기존보다 나쁘지 않게 모니터) |

---

## 7. 이후 (범위 밖)

- Web Worker 검사
- 24p PDF fixture 자동화 (사용자 제공 시)
- 맞춤법 긴 구문 proportional width 전면 개선

---

## 8. 승인 체크리스트

- [ ] 문제·성공 기준이 맞는가
- [ ] `같이 가` / `만큼` 우선순위 동의
- [ ] fallback 시 미칠 허용 여부
- [ ] 구현 순서·파일 범위 동의

승인 후 → **writing-plans** 스킬로 구현 계획 작성.
