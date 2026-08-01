# 찾기/칩 reading order 벤치 · 개선 방향 (2026-08-02)

## 상태

- **합의:** **C → B 기본 · A는 B 한계 시** (2026-08-02)
- **진행 중:** **C 벤치** — `scripts/bench-reading-order.mjs`
- **보류:** 휴리스틱 칩 정렬만으로 체감 개선 실패 → 구조(문자열↔bbox 동봉)로 전환
- **관련:** `visual-semantic-text-layers-2026-08-02.md` §12.5  
  `page-column-reading-order-2026-08-01.md`

## 한 줄 요약

Sumatra/MuPDF Find가 맞는 이유는 “정렬이 더 똑똑해서”가 아니라 **추출 시 문자열과 좌표가 한 세트**이기 때문이다.  
인디야는 `getTextContent` → 줄 조립 → index → itemRefs 역투영이라 단계마다 어긋날 수 있다.  
**C로 raw vs visual vs 기하를 가른 뒤**, B(PDF.js 위 문자+bbox Find)를 기본 가설로 두고, raw 기하조차 리더와 다르면 A(MuPDF·라이선스 별도)를 검토한다.

---

## C. 벤치 체크리스트 (실행)

### 목적

| 관측 | 해석 |
|------|------|
| 원시 item 기하 순 ≈ 리더, visual/칩만 뒤섞임 | **조립·index 투영** → **B** |
| 원시 스트림 순은 뒤섞이나 **기하 순 ≈ 리더** | PDF.js 좌표 OK → **B** |
| 원시 **기하**조차 리더와 다름 | 추출 엔진 한계 가능 → **A** 근거 |
| visual hit 중 `hasRef=false` | **7번형** 하이라이트 투영 후보 |

### 명령

```bash
node scripts/bench-reading-order.mjs "C:\\path\\to\\sample.pdf" --page=81 --phrase=명지
node scripts/bench-reading-order.mjs "C:\\path\\to\\sample.pdf" --page=81 --phrase=명지 --out=tmp/ro-bench.json
```

또는 `npm run bench:reading-order -- "C:\\path\\to\\sample.pdf" --page=81 --phrase=명지`

### 기록 칸 (실행 후 채움)

| 항목 | 값 |
|------|-----|
| PDF / page / phrase | `과학교과서_up.pdf` / **81** / `명지` |
| rawHits / visualHits | **10** / **8** (`tmp/ro-bench-명지-p81.json`) |
| orders.rawStream | `12345678910` |
| orders.rawGeometric | `10312765489` |
| orders.visualIndex | `12345678` (= 현재 칩이 따를 순) |
| orders.visualGeometric | `36278451` (페이지 전역 −y,x) |
| visualHitsWithoutItemRef | **0** (이 샘플에서 7번형「ref 없음」은 재현 안 됨) |
| verdict (스크립트) | `raw_stream` |
| 리더·Sumatra oracle 순 | `1234567` (왼 단 위→아래 후 오른 단, 7곳) |
| rawGeometric vs oracle | **다름** — (1) hit 수 10≠7·중복·조각 (2) 전역 (−y,x) ≠ **단(column) 우선** 읽기 |
| visual vs oracle | index 순 ≠ 기하; 스니펫 잡음(`goRt`/`dyD`)·지도 글리프 오접합(허위 「명지산」)은 추출/조립 아티팩트 |
| **다음 단계** | **B 유지** (PDF.js 좌표·문자 존재) — Find를 **문자+bbox**로, 정렬은 **단 인지** 또는 Sumatra식 추출 순. **A는 보류** (좌표 자체가 틀렸다는 증거 없음; AGPL 전제) |

벤치 수정: Node에서 CMap은 `file://` 금지 → `node_modules/pdfjs-dist/cmaps/` 경로 + trailing `/`.

### 짝짓기 (pairing, 2026-08-02)

원본: `tmp/ro-bench-명지-p81.json` → 태깅: `tmp/ro-bench-명지-p81.pairing.json`

| 갈래 | 판정 |
|------|------|
| **개수** | 읽히는 `명지`/`명지계곡` **7곳** = 리더 7. |
| **「명지산」** | **페이지에 없음 (사용자 확인).** PDF.js가 지도 글리프 `명`·`지`·`산`(x≈711)을 이어 읽은 **추출 오탐**. 정상 지명 아님. |
| **중복·조각** | 제목 이중 드로잉 + raw glue → raw 10. |
| **잡음** | `goRtlA dyDdj` = item 119 원문. |
| **투영** | itemRefs **94/104** 불일치. `hasRef=true`≠ bbox 신뢰. |

**B 범위:** 문자+item bbox Find(+지도 글리프 오탐 억제·dedup) → 하이라이트 동일 경로 → 그다음 S2.

### B 슬라이스1 (2026-08-02) — `pdfItemPhraseFind.js`

| 항목 | 결과 |
|------|------|
| 모듈 | `src/lib/pdfItemPhraseFind.js` (+ vitest) |
| p81 `명지` 개수 | **7** (= 리더). 허위 명+지+산 글리프 **제거** (본문 입증 `isCorroboratedGlyphHit`) |
| 이중 드로잉 | xy dedup |
| 단 정렬 | hit x 폭≥120이면 중앙 gutter 폴백 → **왼→오**. p81: 캡션·본문·안내판 → 제목·오른본문. (리더가 제목 먼저면 잔여 차이 가능) |
| UI 연결 | 아직 없음 (표기통일 Find 교체는 다음 슬라이스) |

다음: unify 발견/하이라이트를 이 hit의 **item bbox**로 연결 (itemRefs 경로 우회).

### B 슬라이스2 — UI 연결 (2026-08-02)

| 경로 | 변경 |
|------|------|
| `assignUniqueUnifyHighlightIndices` | `page.items` 있으면 `findPhraseHitsInPdfItems`로 재배치 (+ `itemIndexes`/`x`/`y`/`column`) |
| `instancesFromOccs` → 칩 | 좌표·itemIndexes 전달 |
| `useHighlights` + `PdfViewer` | `highlightRectsForItemIndexes` (itemRefs 우회) |
| `matchReadingOrder` | B좌표·고정 column·같은 줄 itemIndex |

| p81 `명지` 통합 검증: **7건**, 순 캡션→벌써→여기가→안내판→제목→오른본문2, 전부 `itemIndexes` 보유.

**성능 (2026-08-02):** 인덱스 전체 variant에 item Find를 돌리면 페이지 응답 없음. → 인덱스에서는 텍스트 슬롯만, **미리보기/인스턴스 생성 시** `enrichOccurrencesWithItemHits`만 호출.






### freeze

- **허용:** 본 벤치 · 표기통일 Find/하이라이트 투영 · `pdfPageText` 조립(큰 재작성은 별도 승인)
- **금지:** `ruleEngine` / spelling·caution **매칭** 키 변경

### A / B (벤치 후)

| 안 | 언제 |
|----|------|
| **B** (기본 가설) | raw 기하≈oracle 또는 visual만 깨짐 — 문자+bbox 동봉 Find, PDF.js 단일 |
| **A** (대안) | raw 기하≠oracle — MuPDF 등, **AGPL/상업 라이선스·번들** 별도 승인 |

XY-cut급 전면 레이아웃 엔진은 베타 밖.

---

## 1. 문제와 재정의

### 1.1 표면

| | 리더 (정답 궤적) | 인디야 |
|--|-----------------|--------|
| 예: `명지` / `명지 계곡` | 보는 순 **1→2→3→4→5→6→7** | **4→5→2→3→6→1→7** (`4523617`) |
| 부가 | — | **7번** 리스트에는 있으나 분홍 하이라이트·빨간 밑줄 없음 |

### 1.2 재정의

| 이전처럼 좁히기 쉬운 말 | 이번 합의 |
|-------------------------|-----------|
| 「명지계곡」 붙여쓰기 오탐만 | 다단·블록 레이아웃에서 **아이템 조립·정렬**이 어긋난 결과의 **한 증상**일 수 있음 |
| soft-wrap만 고치면 찾기 순서도 고쳐짐 | **순서 뒤섞임 ≠ soft-wrap** (P0-1 Visual 줄 유지와 별축) |
| 정렬만 고치면 7번도 고쳐짐 | **hit 존재 vs 하이라이트 투영**은 다른 버그 클래스 |
| 칩 기하 정렬 패치로 체감 | **실패** — 구조(문자열↔bbox) 문제로 재진단 |

붙여쓰기 오탐과 순서 뒤섞임은 **같은 뿌리(다단·영역 조립)에서 나온 다른 결과**일 수 있으나, 수정은 **한 패치로 둘 다 된다고 가정하지 않는다.**

### 1.3 파이프라인 차이 (왜 리더·Sumatra와 다른가)

```
PDF = 그리기 명령 + 좌표 (문장 순서 비보장)
        │
        ├─ [Sumatra] MuPDF stext → (문자열 + 글리프 좌표 동봉) → Find
        │
        ├─ [리더] 좌표 클러스터 → reading order → Find Next
        │
        └─ [인디야] getTextContent → 줄 조립 → index → itemRefs 역투영
```

PDF.js `getTextContent()`는 Acrobat류 reading-order 재구성 없이 **원시 아이템**을 준다.  
닫힌 리더 코드는 가져오지 않고, **행동(궤적)만 벤치**한다. Sumatra 코드(GPLv3)는 복제하지 않는다.

---

## 2. 사례 고정: `명지` (캡처)

**증거:** 사용자 숫자 표기 + 로컬 캡처 (`리더가.mp4`, `인디야.mp4` 등).

### 2.1 리더 — 보는 순서 (oracle)

왼 페이지 위→아래(본문→캡션) 후 오른 페이지: **1 → 2 → 3 → 4 → 5 → 6 → 7**  
(제목 → 본문 단락들 → 캡션 → 오른 본문)

### 2.2 인디야 — 칩/찾기 순서

같은 위치 번호 기준: **4 → 5 → 2 → 3 → 6 → 1 → 7** (`4523617`)

- 7번: 리스트만 있고 PDF 위 하이라이트·빨간줄 없음 → **투영 이슈로 분리**

---

## 3. 베타 freeze와의 관계

### freeze (승인 없이 금지)

- `ruleEngine`, regex, **spelling/caution 매칭** 로직
- `MainScreen` dead props·props 시그니처
- rule-set CRUD UI 복구 · `index.css` 대규모 분해
- `docs/` 배포물 수동 수정

### 본 작업 (freeze 밖 · 다만 범위 최소화)

| 경로 | freeze? |
|------|---------|
| `unifyCandidateDiscover.js` · preview groups · 칩/occurrence **정렬** | 아님 |
| 하이라이트 index↔itemRefs/**bbox 투영** | 아님 |
| `usePdfDocument.js` / `pdfPageText.js` Visual 조립 | 아님 (단, 큰 재작성은 별도 승인) |

**원칙:** hit **집합·매칭 키는 고정**하고, 1차 개선은 **정렬·투영만**.  
클러스터 생성·띄어쓰기 판정 로직을 넓게 바꾸지 않는다.

---

## 4. 진단 방법론

### 4.1 값싼 사전 점검 (S1 셋업 전, ~5분)

조립/`visualText` **이전**에 `getTextContent()` raw item의 `(str, x, y)` 순서를 로그만 친다.

| raw 순서 | 해석 |
|----------|------|
| 이미 `4523617`에 가깝다 | 콘텐츠 스트림/저작 순서 문제 → **정렬·스트림 쪽** |
| raw는 위→아래인데 칩만 뒤섞임 | **조립 또는 칩 정렬** |

S1과 정보가 겹치지만, 하네스 없이 방향을 반으로 줄인다.

### 4.2 hit 집합 고정 · 정렬 키만 변경

| 실험 | 정렬 키 | 리더와 같아지면 |
|------|---------|-----------------|
| **S0** | 현재 (`visualText` index 순) | 베이스라인 = `4523617` |
| **S1** | `(page, -y, x)` bbox/줄 기준 | **표시 정렬만** 잘못 → 칩 Next geometric sort로 충분할 수 있음 |
| **S2** | `(page, column, -y, x)` | 단 reading order 필요 |
| **S3** | Visual 줄 조립을 고친 뒤 index | 추출/조립 자체 문제 |
| **H** | 7번 index → highlight 범위 | 빈/잘못된 매핑 → 투영 버그 (정렬과 분리) |

큰 재작성 없이 **어디를 고칠지**부터 확인한다. (베타: 필요 이상으로 손대지 않기)

### 4.3 복잡한 레이아웃 · 과설계 방지

지도+본문+사이드·캡션 박스는 단순 2단보다 어렵다.  
S1/단순 x 구간 S2로 **잔여**가 남을 수 있고, 완전 해결은 XY-cut류까지 갈 수 있다.

**베타:** XY-cut·전면 레이아웃 엔진은 **하지 않는다.**  
순서: raw 로그 → S1 → 체감·잔여 오차 확인 → 유의미할 때만 단/블록 **좁은** 확장.  
잔여가 “제목·본문 OK, 캡션·사이드만 NG”면 전면 엔진보다 **영역 예외** 패치를 우선 검토.

### 4.4 지표 (벤치)

- 리더 궤적 대비 순열 유사도 (예: Kendall τ)
- 첫 hit가 리더 1번(제목)인지
- 리스트 N건 중 하이라이트 성공 N건 (7번 회귀)

**하지 않음:** 리더 바이너리 역공학 · Visual에 soft-wrap식 완성 문자열 재오염 · 순서+하이라이트를 한 패치로 뭉개기

---

## 5. 개선 계획 (단계) — C 이후

| 단계 | 내용 |
|------|------|
| **C** (현재) | `bench-reading-order.mjs` + 리더/Sumatra 수동 oracle |
| **B** (기본) | 문자+bbox 동봉 Find · 표기통일 하이라이트 (PDF.js 단일) |
| **A** (대안) | C에서 raw 기하≠oracle일 때만 MuPDF — 라이선스·번들 별도 승인 |
| 이후 | SoftWrapGraph 등 — 순서와 별축 |

구 P0′ 칩 기하 정렬만으로 체감 개선은 **실패**로 기록. B는 Find **데이터 모델** 전환이다.

---

## 6. 성공 기준

1. C 기록 칸이 채워지고 B/A 중 하나가 데이터로 선택됨  
2. (B 이후) `명지` 칩 순 ≈ 리더, 리스트 N = 하이라이트 N  
3. P0-1 줄 경계 통일 회귀 유지  
4. spelling `ruleEngine` 미침범  

---

## 7. 합의 로그

- Sumatra = 문자열↔좌표 동봉 (정렬 AI 아님); GPLv3 코드 미복제  
- C → B 기본 · A는 B 한계·라이선스 검토 후  
- freeze: 통일 Find/투영·조립 허용; spelling 매칭 금지  
- 휴리스틱 칩 정렬 패치 체감 실패 → C로 재출발  

**다음 단계:** §C 기록 칸 채움 (2026-08-02, `과학교과서_up.pdf` p81). **B 방향 유지**, A 보류. 구현 착수는 승인 후.