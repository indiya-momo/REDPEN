# 조사 — PDF↔TXT 재사용·스킬·API·MCP·OSS·업계 관행

**날짜:** 2026-11-26  
**범위:** 인디야 TXT 추출·읽기 순서·표 칸·오차 측정  
**근거:** 저장소 코드·package.json·스킬 목록·MCP 카탈로그·공개 문서/벤치

---

## 1. 기존 프로젝트에 재사용할 코드가 있는가?

**있다. 이미 핵심 경로가 인디야 안에 있다.**

| 모듈 | 역할 | 근거 |
|------|------|------|
| `src/lib/pdfService.js` + `pdfPageText.js` | pdf.js 추출, `visualText` / items | package `pdfjs-dist@5.2.133` |
| `src/lib/pageColumnSplit.js` | 페이지 내 2단 감지·왼→오 읽기 | `project-docs/page-column-reading-order-2026-08-01.md` (합의·구현됨) |
| `src/lib/spreadColumnSplit.js` | 펼침면 분리 (2단과 모듈 분리) | 동일 문서 |
| `src/lib/pdfTxtBodyClean.js` | TXT용 줄·머리말 제거·**같은 y 표 칸 x-gap 분리** | 커밋 `5900dae` |
| `src/lib/pdfTxtParagraph.js` | soft-wrap 이음 / keep (outdent·table·문장끝) | 동상 |
| `src/lib/pdfTxtUncertainAnalyzer.js` | uncertain만 Kiwi A/Y/K | 동상 · 플래그 OFF 기본 |
| `src/lib/pdfTxtLinebreakReview.js` · `pdfTxtExport.js` | 모달 후보·최종 TXT | 동상 |
| `src/lib/matchReadingOrder.js` | **찾기/하이라이트**용 시각 순 (칩 정렬) | TXT용과 목적이 다름 — 재사용 시 혼동 주의 |
| `src/lib/kiwiMorph/*` | 형태소 분석 (줄바꿈 갈림·측정) | `kiwi-nlp` |
| `scripts/_measure_*` · `_compare_street_*` | 측정·대조 (순환 함정 문서화됨) | Temp/바탕화면 리포트 |

**설계 메모(재사용 시 필수 읽기):**  
`project-docs/page-column-reading-order-2026-08-01.md`, softwrap 차수 `project-docs/softwrap-차수/`, handoff `2026-11-25-txt-linebreak-analyzer/`, `2026-11-26` BRIEF.

**함의:** 새 엔진을 처음부터 도입하기보다, **가짜 2단 오탐·페이지 넘김**을 `pageColumnSplit` / `pdfTxtBodyClean` 쪽에 수술하는 것이 현재 제품과 맞다.

---

## 2. 이미 만들어진 스킬이 있는가?

**PDF 전용 스킬은 없다.** 프로세스·게이트 스킬은 있다.

| 스킬 | PDF↔TXT에 쓸 때 |
|------|-----------------|
| `status-not-pressure` | 「오래·구조」→ 증상만 패치 금지 |
| `minimal-path` | 찾기 1차 핫패스에 무거운 PDF 재스캔 금지; TXT는 별 경로 |
| `user-goal-no-narrow` | 오차=PDF 대조 목표 유지 |
| `brainstorming` / `grill-me` | 측정·단 분리 설계 전 승인 |
| `handoff` | 세션 인수인계 |
| `architecture-audit` · `refactoring-plan` · `surgical-refactoring` | 구조 감사→계획→한 단계 리팩터 |
| `codebase-design` | 모듈 경계 (bodyClean vs paragraph vs analyzer) |

**없음:** “PDF reading order fix” 전용 Agent Skill, OCR 파이프라인 스킬.

---

## 3. 활용할 수 있는 API가 있는가?

### 이미 쓰는 것 (로컬·제품 경로)

| API | 용도 | 한계 |
|-----|------|------|
| **pdf.js** `getTextContent()` | glyph + transform | 문단/표 없음; 그리기 순서 ≠ 읽기 순서 ([pdf.js#14493](https://github.com/mozilla/pdf.js/issues/14493)) |
| **pdf.js** `getStructTree()` (가능) | Tagged PDF 구조 | textContent와 별개; 태그 없는 출판 PDF는 빈약 |
| **kiwi-nlp** / `kiwiMorph.analyzeLine` | A/Y/K·측정 | **PDF 정답이 아님** (합의된 함정) |
| **pdf-lib** | 주석 PDF 등 | 텍스트 읽기 순서 복원용이 아님 |

### 외부 상용 (미연동, 옵션)

| API | 강점 | 주의 |
|-----|------|------|
| **Adobe PDF Extract / PDF Services** | Elements 배열 = reading order, 표→JSON/CSV/XLSX, Sensei | 클라우드·유료·원고 외부 전송 — 출판 민감도 검토 필요 |
| 문서: [Extract how-to](https://developer.adobe.com/document-services/docs/overview/pdf-services-api/howtos/extract-pdf), [Extract overview](https://developer.adobe.com/document-services/docs/overview/pdf-extract-api/) | | |

**권고:** 1차 수정은 **로컬 pdf.js 기하** 유지. Adobe는 골든/벤치·난이도 높은 책 **대조용**으로만 검토.

---

## 4. 적합한 MCP 서버가 있는가?

**PDF 구조 추출 전용 MCP는 현재 세션에 없다.**

| MCP | PDF↔TXT 관련성 |
|-----|----------------|
| `cursor-ide-browser` | 5173에서 모달·TXT UI **육안 검증**에 적합 |
| `cursor-computer-use` | 바탕화면 TXT/PDF 열람 가능하나 추출 엔진 아님 |
| Figma | 조판 추출과 무관 (needsAuth) |
| Gmail / Sheets | 무관 |
| `cursor-origin` / GitHub subscriptions | 배포·CI용, 읽기 순서 아님 |

**결론:** MCP로 문제를 “풀어 주는” 서버는 없고, **브라우저 MCP는 검증 보조**만.

---

## 5. 오픈소스 라이브러리가 있는가?

| 라이브러리 | 강점 | 인디야 적합도 |
|------------|------|----------------|
| **이미 사용: pdf.js** | 브라우저 동일 스택 | 메인 경로 — 유지 |
| **이미 사용: kiwi-nlp** | 한글 형태소 | soft-wrap 갈림만 |
| **PyMuPDF** | `find_tables()`, 다단 partial | Node/브라우저 번들 부담; AGPL 이슈 가능 |
| **pdfplumber** | 표·좌표 | Python |
| **papero** | XY-cut 다단·표, CPU, pdf.js 포팅도 언급 | 벤치/실험 후보 ([GitHub](https://github.com/beatrizalmeidaf/papero-pdf-text-extractor)) |
| **OpenDataLoader-PDF** | XY-Cut++ reading order, 표 벤치 상위, Apache-2.0 | 로컬 deterministic 모드 후보 ([GitHub](https://github.com/opendataloader-project/opendataloader-pdf/)) |
| **Docling / Marker** | ML 레이아웃 | 무거움·GPU |
| **olmOCR** (AllenAI) | VLM 읽기 순서·표 | GPU·스캔/난이도용 ([arxiv](https://arxiv.org/html/2502.18443)) |

**권고:** 제품 핫패스에 새 OSS를 바로 넣지 말고, **depressione 표본으로 papero/OpenDataLoader vs 현재 추출 골든 대조** 후 결정.

---

## 6. 다른 개발자들은 이 문제를 어떻게 해결하는가?

공통 패턴 (pdf.js 실무·Adobe·OSS 문서 종합):

1. **위치 정렬:** y↓ 후 x→ (그리기 순서 무시) — nibbo 등 실무 글과 동일  
2. **다단:** x 히스토그램/거터로 단 분리 → **단마다** 정렬 (페이지 통째 y-x 금지) — 인디야 `pageColumnSplit`과 같은 계열  
3. **표:** (a) 칸 bbox로 셀 유지·리플로우 금지, 또는 (b) 전용 표 재구성 / Extract API  
4. **Tagged PDF / struct tree:** 있으면 읽기 순서 보조, 없으면 기하만  
5. **스캔·실패:** OCR 또는 VLM (olmOCR 등)  
6. **품질 측정:** 읽기 순서·표 셀 이웃을 **레이아웃 골든**으로 평가 (olmOCR-Bench 등) — **자기 추출 재정렬 비교는 순환**

인디야 특수: 한글 soft-wrap(음절 중간 줄바꿈) + 출판 2단·표 — 영문 RAG 파이프와 목표가 다름. **교정 TXT**이므로 “대충 읽히면 됨”이 아니라 **칸·문장 경계 keep**이 핵심.

---

## 종합 (워커 큐에 대한 함의)

| 큐 | 재사용 우선순위 | 외부 도입 |
|----|-----------------|-----------|
| ① depressione 읽기 순서 | `pageColumnSplit` 오탐·`pdfTxtBodyClean` 줄 순서 수술 | 표본만 OSS 대조 가능 |
| ② 비순환 오차 측정 | 스트리트 mash 패턴·사람/골든 표본; Adobe Extract는 선택 골든 | 벤치 방법론(olmOCR-Bench류) 참고 |

**하지 말 것:** Kiwi A/Y를 PDF 오차로 다시 쓰기 · 추출≡재정렬 오차율 · notices/momo와 트랙 섞기.
