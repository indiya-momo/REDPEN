# Visual / Semantic 텍스트 레이어 분리 (2026-08-02)

## 상태

- **합의:** 설계 방향 확정 · **P0-1 구현** (Visual eager soft-wrap 제거, `visualText`)
- **리뷰 반영:** canonical 명칭·offset 투영·P0 세분화·Semantic graphs (2026-08-02)
- **우선순위:** 가짜 붙임 방지 > 어절 중간 개행 미복원 허용
- **관련 기존 문서:** `hangul-soft-wrap-rejoin-2026-08-01.md`  
  → 1차 soft-wrap **복원 휴리스틱** 기록. 본 문서의 **관심사 분리·철학**이 상위 정책이며, 충돌 시 본 문서를 따른다.  
- **찾기 순서·벤치:** `reading-order-find-benchmark-2026-08-02.md`  
  → 리더 vs 인디야 Find/칩 순서 (`명지` 사례), S1 정렬 실험, freeze 범위, 베타에서 XY-cut 제외.

## 한 줄 요약

soft-wrap은 **문자열이 아니라 관계(edge)** 다.  
Visual layer는 줄을 보존하고, Semantic layer(들)만 필요한 기능에서 후보로 연결한다.  
**유지가 기본. 붙일 근거가 있을 때만 연결하며, 연결은 원문 문자열을 덮지 않는다.**

---

## 1. 문제 정의

### 1.1 표면 증상

PDF에서 위치가 다른 텍스트가 한 단어로 읽혀 표기 통일 이형태·하이라이트 오류가 난다.

| 예 | 실제 | 잘못 읽힌 결과 |
|----|------|----------------|
| 본문 어절 줄바꿈 | `반드시` / `행복감의` | `반드시행복감` |
| 목록 배치 | `시간적` / `관점` | `시간적관점` |
| 지도 라벨 | `동해` / `태평양` | `동해태평양` |

어절 중간 강제개행(`내자`/`리는` → `내자리는`) 복원은 필요하지만, **같은 추출 파이프라인에서 “기본 붙임 + 예외 제거”** 로 처리해 온 것이 한계다.

### 1.2 근본 원인 (구조)

핵심은 soft-wrap **판정 정확도**가 아니라:

> **하나의 원문 문자열에 서로 다른 목적의 텍스트 해석이 섞여 있다.**

현재(문제) 구조:

```
PDF 글리프
  → 줄 조립
  → soft-wrap 복원          ← 여기서 이미 “해석” 확정
  → 완성 문자열 (page.text)
  → 맞춤법 / 표기 통일 / 하이라이트 / 찾기 전부 사용
```

soft-wrap 판단 하나가 틀리면 맞춤법·표기 통일·하이라이트가 **연쇄**로 깨진다.  
병목은 “추출 단계에서 이미 해석된 결과를 원본처럼 취급”하는 것이다.

### 1.3 왜 휴리스틱 패치로는 안 끝나는가

| 원인 | 원하는 동작 |
|------|-------------|
| 어절 중간 강제개행 | Semantic에서만 연결 후보 |
| 본문 어절 줄바꿈 | 줄 유지 |
| 목록·제목 세로 배치 | 줄 유지 |
| 지도·콜아웃 | 줄 유지 |

로컬 신호만으로 구분되지 않아, 임계값·조사·접미·들여쓰기 예외를 늘릴수록 **예외 레이스**가 된다.

### 1.4 제품 트레이드오프 (확정)

| 순위 | 선택 |
|------|------|
| **1순위** | 가짜로 붙는 것 방지 (표기 통일·시스템 신뢰) |
| 2순위 | 어절 중간 개행 복원 (불편은 허용 가능) |

표기 통일 추천이 제품 차별점이면, 정확하지 않은 연결로 규칙을 만드는 것보다 **놓치는 쪽**이 복구 가능하다.

---

## 2. 목표 / 비목표

### 목표

1. Visual layer: **시각 줄·좌표·오프셋의 단일 원본(canonical)** — 이름은 `visualText` (아래 3.1)
2. Semantic layer(들): 복원 **문자열**이 아니라 Visual 위의 **해석 그래프(edge 집합)**
3. 표기 통일: Visual line만 (soft-wrap edge 사용 안 함) — **테스트로 고정**
4. 맞춤법/찾기: SoftWrapGraph 후보만 내부 연결; 결과는 `HighlightRange[]`로 Visual 투영
5. 철학: **판을 채운 증거가 없으면 줄바꿈은 줄바꿈**

### 비목표

- 워드 PDF 읽기 순서 전면 재설계
- 사전/형태소로 soft-wrap 판정
- Visual에 조사·접미 휴리스틱 재확대
- measure를 **전역 붙임 정책**으로 강제

---

## 3. 목표 구조

```
PDF 원본 (글리프·좌표)
        ↓
 Visual Text Layer              ← canonical (visualText, lines, offsets)
        ↓
 Semantic Layers (해석 그래프 집합)
   ├─ SoftWrapGraph             ← P1
   ├─ ReadingOrderGraph         ← (향후; 단 분할 등과 연계 가능)
   └─ NormalizationGraph        ← (향후; ligature·OCR 등)
        ↓
 검사 엔진
   ├─ 표기 통일     → Visual only
   ├─ 맞춤법 / 찾기 → Visual + SoftWrapGraph (선택)
   └─ 하이라이트    → HighlightRange[] (항상 Visual)
```

> **Semantic layer는 특정 복원 문자열이 아니라, Visual layer 위의 해석 그래프 집합이다.**  
> 지금 구현 대상은 SoftWrapGraph뿐이나, 개념 슬롯은 복수로 둔다.

### 3.1 Visual Text Layer · canonical 명칭

**역할:** 보이는 줄·문자·좌표를 보존한다. “해석”하지 않는다.

| 이름 | 의미 | 비고 |
|------|------|------|
| **`visualText`** | 줄 경계를 `\n`으로 남긴 페이지 문자열 | **canonical 원문** |
| **`lines` / `VisualLine[]`** | 줄 단위 메타·절대 오프셋 | P0-2 |
| **`page.text` (기존)** | 레거시 필드명 | **deprecated** — “완성·복원된 본문”으로 오해되기 쉬움. 이행기에는 `visualText`와 동일 내용을 넣을 수 있으나, 신규 코드는 `visualText`만 사용. `replace(/\n/g,'')` 등으로 줄을 지우는 사용은 금지. |

```text
VisualLine {
  lineId: number
  pageNum: number
  text: string                 // 이 줄만 (줄 사이 eager soft-wrap 없음)
  startX, endX, y, fontSize
  absStart, absEnd             // visualText 기준 절대 문자 오프셋
  itemRefs: ...
}

VisualPageText {
  lines: VisualLine[]
  visualText: string           // lines를 \n 으로 join — 줄 경계 보존
  // deprecated alias: text === visualText (이행기)
}
```

줄 관계 예:

```text
{ text: "내자", lineId: 101, nextLineId: 102, visualBreak: true }
{ text: "리는", lineId: 102, ... }
```

**금지:** eager 한글 soft-wrap으로 `visualText` 변형 · Visual 경로에 형태 휴리스틱으로 `\n` 삭제  
**허용:** 줄 나누기(단·x-gap), 항목 gap **공백 삽입**, PDF에 있는 공백 글리프 유지

### 3.2 SoftWrapGraph (Semantic · P1)

복원 문자열을 굽지 않고 **edge만** 둔다.

```text
SoftWrapCandidate {
  pageNum, leftLineId, rightLineId
  join: ''                       // 1차: 붙임
  signals: {
    sameLeftMargin?, nearMeasureRight?, noTrailingSpace?
    confidence: 'high' | 'low'
  }
}
```

- 후보 없어도 Visual만으로 검사 가능 (fail-closed)
- measure 모호 → 후보 없음
- 형태 휴리스틱은 있다면 Semantic **필터**만

필요한 엔진만 edge를 따라 “내자리는”처럼 **볼 수 있음**. Visual은 그대로 `내자` / `리는`.

### 3.3 HighlightRange[] (offset 투영)

Canonical은 항상 **Visual 절대 오프셋**이다.  
Semantic이 여러 줄을 이어서 매칭하면 **단일 range가 아니라 배열**이다.

```text
HighlightRange {
  pageNum: number
  start: number      // visualText 절대 시작 (inclusive)
  end: number        // visualText 절대 끝 (exclusive)
  lineId?: number
}

// 예: soft-wrap으로 "내자리는" 매칭
// line101 "…내자" + line102 "리는…"
[
  { pageNum, start: absOf("내자"), end: …, lineId: 101 },
  { pageNum, start: absOf("리는"), end: …, lineId: 102 },
]
```

| 항목 | 정책 |
|------|------|
| occurrence / 기본 index | Visual; 다중 줄이면 **첫 구간 start** 또는 ranges 전체를 보관 (구현 시 API 한 가지로 고정) |
| UI 하이라이트 | `HighlightRange[]` → 박스·밑줄 N개 |
| 금지 | Semantic 전용 이어붙인 문자열의 오프셋을 UI에 직접 사용 |

기존 단일 `range`/`index` API는 이행기 동안 “ranges[0] 또는 병합 불가능 시 첫 줄만”으로 두되, P0-3·P2에서 배열을 정식화한다.

---

## 4. 기능별 정책

| 기능 | Visual | SoftWrapGraph |
|------|--------|---------------|
| 표기 통일 추천 | ✅ 줄 단위만 | ❌ |
| 맞춤법 / 주의 / 찾기 | ✅ | ✅ P2 |
| 하이라이트 | `HighlightRange[]` | 투영만 |
| 내보내기 | `visualText` | 메타 선택 |

### 4.1 표기 통일 — 테스트로 고정 (필수)

문서만으로는 나중에 깨진다. **회귀 테스트 이름으로 강제:**

```text
unify_should_not_cross_visual_line_boundary
```

예시 입력 (`visualText`):

```text
시간적
관점
```

기대: `시간적관점` 이형태 후보 **없음** (줄 경계를 넘는 붙임 n-gram 없음).  
동일 계열: `동해`/`태평양`, `반드시`/`행복감의` 등.

---

## 5. measure 신호

measure(앞줄 endX ≈ 블록 오른쪽 끝)는 soft-wrap의 **좋은 기하 신호**다.  
단·박스·인용마다 오른쪽 끝이 다르므로 **전역 붙임 정책으로 쓰지 않는다.**

```
measure 발견 → SoftWrapGraph 후보 생성 → 필요한 엔진만 사용
```

모호하면 후보 없음 (fail-closed).

---

## 6. 구현 단계

### P0 — Visual 오염 제거 (세분화)

가장 큰 효과는 **“붙이지 않는다”** 에서 나온다. 첫 구현을 나눈다.

#### P0-1 — Visual 줄 유지 + eager soft-wrap 제거 (즉시 효과) ✅

1. Visual 기본 경로에서 eager soft-wrap 빈문자 join **제거** (`buildPageText`는 줄 사이 항상 `\n`)
2. `visualText` canonical 반환; 이행기 `page.text` === `visualText` (deprecated alias)
3. 회귀: 목록·지도·본문 어절 줄바꿈이 한 토큰으로 붙지 않음 + `unify_should_not_cross_visual_line_boundary`
4. 허용: `내자`/`리는` Visual에서 두 줄 (P2 SoftWrapGraph 전)
5. 구 결합 판정은 `hangulSoftWrapSeparatorLegacy`로 보존 (Visual 미사용)

#### P0-2 — line metadata

1. `VisualLine` / `lineId` / `absStart`·`absEnd` (또는 동등 매핑)
2. `visualText` ↔ 줄 구간 조회 헬퍼

#### P0-3 — offset projection 기초

1. `HighlightRange` / `HighlightRange[]` 타입·헬퍼
2. 단일 index API와의 이행 규칙 문서화
3. (본격 SoftWrap 투영은 P2와 함께 완성해도 됨)

### P1 — SoftWrapGraph 후보 생성

measure·same margin 등 신호, fail-closed, 단위 테스트.

### P2 — 맞춤법/찾기만 SoftWrapGraph 사용

가상 이어쓰기 검사 → `HighlightRange[]` 투영.

### P3 — 표기 통일 Visual only 고정

`unify_should_not_cross_visual_line_boundary` 및 가드.  
P0-1만으로 동작이 맞으면 코드는 최소·실수 유입 방지.

---

## 7. 기존 코드와의 관계

| 기존 | 본 설계 |
|------|---------|
| eager `hangulSoftWrapSeparator` | P0-1 Visual 경로 퇴출 |
| `isLikelyHangulEojeolBoundary` | Visual 정책 제거 방향; Semantic 필터만 |
| `rejoinHangulSoftLineBreaks` | canonical 파이프라인 밖 |
| `page.text` | → `visualText`; deprecated alias |
| 지도 x-gap 줄 분리 | Visual **줄 나누기** 유지 |

구문서 “한글·행간이면 붙인다” 가정은 **폐기**.  
새 가정: **줄 유지; 연결은 SoftWrapGraph 후보.**

---

## 8. 성공 기준

1. `unify_should_not_cross_visual_line_boundary` 및 대표 가짜 붙임 회귀 통과
2. `visualText` 줄 경계 ≈ PDF 시각 줄 (의도적 soft-wrap 미복원 제외)
3. P2 후: `내자`/`리는` 맞춤법 경로 복원 + `HighlightRange[]` 하이라이트
4. measure 모호 시 과붙임 없음
5. 신규 코드가 `page.text`를 “완성 본문”으로 가정하지 않음 (`visualText` 사용)

---

## 9. 위험과 완화

| 위험 | 완화 |
|------|------|
| P0-1만으로 맞춤법 미복원 | 알려진 한계; P2 후속 |
| `page.text` 관행 | 이름 `visualText` + deprecated; `\n` 제거 사용 금지 |
| 단일 range 가정 | `HighlightRange[]` 명시 (P0-3) |
| measure 과다 후보 | fail-closed; 통일은 그래프 미사용 |
| P0 범위 과다 | P0-1 → P0-2 → P0-3 순차 |

---

## 10. 하지 않을 것

- Visual에 형태 예외를 쌓아 soft-wrap “때우기”
- soft-wrap 결과를 다시 공용 완성 문자열에 굽기
- 표기 통일이 SoftWrapGraph로 줄 경계 넘기
- `visualText.replace(/\n/g, '')`를 검사 원문으로 쓰기
- “일단 붙이고 아닌 것 제거”로 회귀

---

## 11. 문서·코드 대응 (구현 시)

| 층 | 예상 위치 |
|----|-----------|
| Visual | `pdfPageText.js` / `visualPageText.js` |
| SoftWrapGraph | `softWrapCandidates.js` (신설 후보) |
| HighlightRange | `pdfHighlightRange.js` 확장 또는 인접 모듈 |
| 표기 통일 | `unifyCandidateDiscover.js` + `unify_should_not_cross_visual_line_boundary` |
| 단 reading order | `pageColumnSplit.js` · `spreadColumnSplit.js` — `page-column-reading-order-2026-08-01.md` |
| 설계 | 본 문서 |

---

## 12. 오픈소스 참고 · PDF.js raw vs visualText 비교

### 12.1 구분 (중요)

인디야 병목은 **PDF 렌더링**이 아니라 **텍스트 추출 후 reading order·줄 조립**이다.

| 계층 | 하는 일 | 인디야 |
|------|---------|--------|
| 뷰어/렌더 | 그리기·줌·페이지 표시 | PDF.js 뷰 |
| 텍스트 레이어 | 좌표 있는 선택·검색용 텍스트 | `getTextContent` → Visual 조립 |
| 검사 | 맞춤법·표기 통일 | Visual (+ 이후 Semantic) |

“좋은 PDF 리더를 가져다 쓰면 해결”이 아니라, 리더가 이미 하는 **좌표 → reading order → (필요 시) 검색용 연결**을 Visual/Semantic에 맞게 이식하는 문제다.

### 12.2 참고할 오픈소스 (우선순위)

| 순위 | 프로젝트 | 쓰임 |
|------|----------|------|
| **1** | **Mozilla PDF.js** | 이미 사용 중. `getTextContent()` item(`str`·`transform`·`width`)·텍스트 레이어 철학이 Visual과 가장 가깝다. **스택에 새로 붙이지 말고 결과·구조를 비교·참고.** |
| 2 | MuPDF (`stext`: page→block→line→span→char) | VisualLine 계층 모델 참고. JS 연동 비용 큼 → 알고리즘·스키마만. |
| 3 | pdfplumber (Python) | word 좌표·테이블 연구용. 서비스 직접 연동보다 참고. |

PDF는 보통 “문장 순서 배열”이 아니라 **좌표+그리기 명령**에 가깝다. 리더는 내부적으로 x/y clustering·column·reading order heuristic을 돌린다. 인디야의 `pageColumnSplit` / `spreadColumnSplit`도 그 일부다.

표시용과 검색용을 나누는 뷰어 관행은 본 문서의 **Visual / Semantic**과 같은 축이다.  
(예: 화면은 `행복`/`감` 두 줄, 검색은 SoftWrapGraph로 `행복감` 후보.)

### 12.3 실무 순서 (합의)

1. **같은 샘플 PDF**로 PDF.js `getTextContent` raw vs 인디야 `visualText` 비교  
2. 차이가 **item 순서**인지 **우리 줄/단 조립**인지 분리  
3. Visual은 좌표·줄 유지 (P0-1 방향)  
4. SoftWrapGraph / 검색용 연결은 Semantic (P1·P2)  
5. MuPDF 계층은 데이터 모델 참고만  

### 12.4 샘플 PDF 비교 체크리스트

**목적:** “PDF.js는 왼단→오른단인데 인디야만 섞이는가?”를 한 권(또는 대표 페이지)으로 재현·기록한다.

**준비**

- [ ] 대표 샘플 1권 고정 (2단 본문·목록 세로 배치·지도 라벨·어절 중간 개행이 있는 페이지 포함)
- [ ] 추출 옵션 동일: `getTextContent({ disableCombineTextItems: true })` (현행 `pdfService.extractAllPagesText`)
- [ ] 비교 페이지 번호 목록 (예: 2단=p.N, 목록=p.4, 지도=p.22/40, soft-wrap 의심=p.?)

**A. Raw item (`getTextContent`)**

- [ ] item 순서: 대략 왼단 위→아래 후 오른단인가, y만 섞여 가로로 튀는가
- [ ] 각 item: `str`, `transform[4]`(x), `transform[5]`(y), `width`, (가능하면) font size
- [ ] 공백 전용 item·과장 `width`(다음 라벨까지) 여부
- [ ] 동일 (str,x,y) 이중 레이어(오버레이) 여부

**B. 인디야 Visual (`buildPageText` → `visualText`)**

- [ ] 줄 경계 `\n`이 시각 줄과 대응하는지 (P0-1: eager soft-wrap으로 붙지 않는지)
- [ ] `pageColumnSplit` / `spreadColumnSplit` 적용 여부·실패 시 단 섞임
- [ ] 같은 y 밴드·큰 x gap 라벨이 한 줄/한 토큰으로 붙지 않는지
- [ ] `text` === `visualText` (이행기 alias)

**C. 차이 분류 (원인 칸에 하나만)**

| 증상 예 | item 순서 문제 | 단/줄 조립 문제 | (구) soft-wrap 오염 | 기타 |
|---------|----------------|-----------------|---------------------|------|
| 왼·오른단 단어 가로 접합 | ☐ | ☐ | ☐ | ☐ |
| `시간적`+`관점` → 한 토큰 | ☐ | ☐ | ☐ | ☐ |
| `동해`+`태평양` → 한 토큰 | ☐ | ☐ | ☐ | ☐ |
| 검색 `행복감` vs 줄 `행복`/`감` | ☐ | ☐ | ☐ | ☐ |
| `명지` 찾기: 리더 1234567 vs 인디야 4523617 (§12.5) | ☐ | ☐ | ☐ | ☐ |
| `명지` 7번 리스트만·하이라이트 없음 (§12.5) | ☐ | ☐ | ☐ | ☐ 오프셋 |

**D. 기록**

- [ ] 페이지별: raw 스케치(또는 item 덤프 경로) / `visualText` 발췌 / 원인 분류
- [ ] 단 감지 fail-open인지 fail-closed인지 메모
- [ ] SoftWrapGraph(P1)로 넘길 후보 vs Visual에서 절대 붙이면 안 되는 케이스 구분

**하지 않음:** 이 비교를 핑계로 Visual에 형태 휴리스틱·완성 문자열 soft-wrap을 다시 넣지 않는다.

### 12.5 사례: `명지` / `명지 계곡` 찾기 순서 (캡처 합의)

**검색·표기 통일 대상:** `명지` · `명지 계곡` (캡처: 리더 펼침 / 인디야 약 81P).  
**증거:** 사용자 숫자 표기 + 캡처 영상·스크린샷 (로컬 `캡처파일/리더가.mp4`, `인디야.mp4`).

#### 리더 — 사용자가 보는 순서 (정답 reading order)

왼 페이지 위→아래(본문→캡션) 후, 오른 페이지.

| # | 위치 (대략) |
|---|-------------|
| 1 | 왼·제목 「…유명한 **명지** 계곡」 |
| 2 | 왼·첫 단락 |
| 3 | 왼·둘째 단락 「벌써 **명지** 계곡…」 |
| 4 | 왼·같은 단락 「여기가 **명지** 계곡…」 |
| 5 | 왼·같은 단락 아래 「『**명지** 계곡』이…」 |
| 6 | 왼·사진 위 캡션 |
| 7 | 오른·본문 「**명지** 계곡 외에도…」 |

순서: **1 → 2 → 3 → 4 → 5 → 6 → 7**

#### 인디야 — 실제 찾기/칩 순서 (사용자 기준)

같은 위치에 붙인 번호 기준, 인디야가 도는 순서는:

**4 → 5 → 2 → 3 → 6 → 1 → 7** (`4523617`)

즉 제목 쪽(4·5) → 본문 중부(2·3) → 하단(6) → 캡션(1) → 오른 페이지(7)처럼 **시각 위→아래가 아니다.**

부가:

- 사이드에 `81P 1/6` … `6/6` 및 붙임형 `명지계곡` 1건 등 리스트는 존재
- **7번:** 리스트에는 있으나 PDF 위 **분홍 하이라이트·빨간 밑줄이 안 보임** (파란 커서만 등). → reading order와 **별개로 하이라이트/오프셋 투영 버그** 후보

#### 원인 가설 (체크리스트 C에 기입)

| 증상 | 우선 의심 | soft-wrap? |
|------|------------|------------|
| 찾기 순서 `4523617` ≠ 리더 `1234567` | **reading order** (content stream / y·블록 정렬 / 단·캡션 영역) | 아님 |
| 7번 미하이라이트 | occurrence index ↔ `itemRefs` / 하이라이트 범위 | 아님 |
| `명지 계곡` vs `명지계곡` 이형태 | Visual 공백·줄 조립 (별도) | 부분 가능 |

**회귀 (2026-08-02):** 차트용 `line-run`이 어절 간격 item을 붙임으로 세고, `textLayout`만 좁은 gap을 붙임으로 읽으면 Visual에 없는 「명지계곡」이 다시 생김.
→ (1) 본문에 띄움 입증이 있으면 multi-item 붙임 line-run 거부 (2) Visual 줄에 연속 붙임이 없으면 layout 스캔 붙임 기각.

**회귀 (명지계곡×5만):** 줄끝 1음절「명」+ 다음「지계곡」soft-wrap이 붙임을 발명(다른 표기엔 이 줄바꿈 패턴 없음).
→ (3) 붙임 입증은 soft-wrap 병합 전 Visual 원본 줄 (4) soft-wrap 붙임 hit는 item에 연속 붙임 리터럴이 있을 때만.

→ §12.3 비교 시 **이 페이지를 필수 샘플**로 넣고, raw item 순서가 이미 `4523617`인지 / 조립·칩 정렬이 섞는지 분리한다.  
실행: **`scripts/bench-reading-order.mjs`** · 기록·C→B/A 결정: **`reading-order-find-benchmark-2026-08-02.md` §C**.

**C. 차이 분류 행 추가**

| 증상 예 | item 순서 문제 | 단/줄 조립 문제 | (구) soft-wrap 오염 | 기타 |
|---------|----------------|-----------------|---------------------|------|
| `명지` 찾기 순서 리더≠인디야 (`4523617`) | ☐ | ☐ | ☐ | ☐ 하이라이트 |
| 7번 리스트만 있고 하이라이트 없음 | ☐ | ☐ | ☐ | ☑ 오프셋/하이라이트 |

---

## 13. 합의 로그

- soft-wrap = **edge**, 완성 문자열 오염이 구조 문제
- B 골격 + A(measure)는 후보 신호만
- 가짜 붙임 방지 1순위
- 리뷰 반영: `visualText` 명칭·`HighlightRange[]`·P0 세분화·Semantic = 해석 그래프 집합
- 표기 통일 Visual only는 **테스트 이름으로 고정**
- P0-1 구현: eager soft-wrap 제거, `visualText`
- PDF.js/MuPDF는 **교체보다 비교·모델 참고**; raw vs `visualText` 체크리스트(§12)
- 사례 §12.5: 리더 `명지` 순서 1–7 vs 인디야 `4523617` + 7번 미하이라이트

**다음 단계:** §12.4를 `명지` 페이지로 실행 — `npm run bench:reading-order -- "<pdf>" --page=81 --phrase=명지` (C 벤치).
