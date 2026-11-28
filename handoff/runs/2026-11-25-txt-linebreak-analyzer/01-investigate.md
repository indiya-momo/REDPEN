# 01 조사 — TXT 문단 줄바꿈 vs 통일 softwrap

담당: Grok (Cursor). 설계 확정·`src/` 수정 없음.  
run: `2026-11-25-txt-linebreak-analyzer`

## 1. TXT 변환 흐름 (현재)

1. UI: `src/components/PdfCenterStage.jsx` — 「TXT 변환」→ `preparePdfTxtReview` → `PdfTxtLinebreakReviewModal`
2. 추출·정리: `src/lib/pdfTxtExport.js` `preparePdfTxtReview`
   - `extractAllPagesText` → `cleanPageLinesForTxt` (`pdfTxtBodyClean.js`)
   - `analyzeParagraphFlow` (`pdfTxtParagraph.js`) → candidates + stats
   - 검수전 초안: `joinPagesWithMarkers` (조판 줄바꿈 **유지**)
3. 최종본: `buildFinalTxt` → `applyLinebreakDecisions` (`pdfTxtLinebreakReview.js`)
   - 기본 `autoParagraph` true: 문단 안 줄바꿈을 잇고, 애매한 곳만 모달
4. 주석 (`pdfTxtParagraph.js` 1–6행): **검수전·찾기 핫패스와 무관**

## 2. TXT가 “잇기”를 정하는 곳

핵심: `classifyParagraphPair` / `paragraphJoinGlue` / `particleAttachKind`  
파일: `src/lib/pdfTxtParagraph.js`

| 층 | 하는 일 | 근거 |
|----|---------|------|
| 레이아웃 | 짧은 줄·테두리·들여쓰기·행간·글자 크기 → keep | `lineFullness`, `SHORT_RATIO` 0.62, `BORDER_RATIO` 0.84, `INDENT_EM`, `GAP_RATIO`, `FONT_RATIO` (~16–27, 301–335, 383–427행) |
| 문장·목록 | 문장 끝·목록 시작 → keep | `SENTENCE_END_RE`, `LIST_START_RE` (~33–37, 372–373행) |
| 한글 glue | 음절-음절: 조사 붙임 / 어절 경계면 공백 / 완전 1음절 집합이면 공백 / 아니면 붙임(`''`) | `paragraphJoinGlue` 269–292행 |
| 공유 휴리스틱 | `isLikelyHangulEojeolBoundary` **import from** `pdfPageText.js` | 8–11행, 282행 |
| TXT 전용 목록 | `COMPLETE_ONE_SYLLABLE_EOJEOL`, `COMPLETE_SHORT_EOJEOL`, `PARTICLE_EOJEOL`, 모호 조사 | 43–119행대 |
| 모달 | `uncertain`만 후보, 상한 80, 순위 josa→midword→hyphen→border→… | `PARAGRAPH_EXCEPTION_LIMIT` 14행, `EXCEPTION_RANK` 455–462행 |
| 자동 결정 | keep / nospace(`''`) / space / dehyphen | `autoDecisionForVerdict` 448–452행 |

`midWord` 정의 (361행): `glue === '' && !particle` — 즉 **공백 없이 잇는 한글 이음**이면서 조사 붙임이 아닐 때. 이때도 기본 action은 종종 `join`(레이아웃이 막지 않으면), `uncertain`이면 모달.

## 3. 통일 softwrap 흐름 (이번 차수에서 잰 것)

1. Visual `buildPageText`: **eager soft-wrap 없음**, 줄바꿈 유지 (`pdfPageText.js` / 테스트 `pdfService.buildPageText.test.js`)
2. 표기 통일 스캔: `splitUnifyScanLinesWithAbs` → **`mergeUnifyHangulSoftWrapScanLines`** (`unifyCandidateDiscover.js` ~1553–1587행)
3. 판정: `isUnifyHangulMidWordSoftWrap` (`pdfPageText.js` ~170–187행)
   - 줄 끝 마지막 어절 **한글 1음절** + `isLikelyHangulEojeolBoundary` 아니면 붙임
4. 성공 기준: **충돌 클러스터 키**가 깨지거나 가려지지 않게 (목록 품질)
5. 측정 요약 (구현 근거로 쓰지 말고 참고만)
   - 키위 SPACE 626 → 충돌 키 **205 동일**
   - DUAL 가려진 키 1(`발송작업`); `제|작하였던` 키위 **JOIN** → 「분석기 띄움만」으로는 구제 안 됨
   - A 오경보가 띄움보다 해롭다 (6차 방어선). wasm A FP 2/169; 바른 A 0, Y 14/19

## 4. 이미 공유하는 것 / 공유하지 않는 것

**공유**

- `isLikelyHangulEojeolBoundary` / `isHangulSyllableChar` (`pdfPageText.js`)
- “줄 끝 한글이 단어 중간이면 붙인다”는 **표면 휴리스틱** 발상
- 독립·완전 1음절 어절을 함부로 붙이지 않으려는 목록 (집합 내용은 **다름**)

**공유하지 않음**

- `mergeUnifyHangulSoftWrapScanLines` — TXT에서 **호출하지 않음**
- Kiwi / Bareun — TXT 문단 경로에 **없음**
- 성공 기준: 통일=충돌 키 · TXT=읽히는 문단 + 모달 부담
- TXT는 **레이아웃(폭·들여쓰기·행간)** 이 1차 문단 경계. 통일 softwrap은 스캔 줄 문자열 위주
- TXT glue는 `''` | `' '` | `dehyphen`. 통일은 줄 문자열 연결(키 표면)

## 5. TXT에 “분석기·오경보 기준을 얹는다”가 의미할 수 있는 선택지 (조사만, 미채택)

| 안 | 내용 | 비용·위험 |
|----|------|-----------|
| A | **안 얹음.** 현행 휴리스틱+모달 유지. softwrap 교훈은 BRIEF/문서만 | 구현 0. TXT 품질 변화 0 |
| B | **모달 순위·기본값만.** midword/josa uncertain에 softwrap 육안·A-FP 라벨을 회귀 표본으로 고정. 자동 glue 불변 | 테스트·표본. 런타임 분석기 0 |
| C | **uncertain 후보만** 분석기(키위→바른 폴더)로 glue/keep 보조. 갈리면 현행(또는 keep) | 네트워크·라이선스·비동기. Pages에 바른 없음. A-FP 게이트 필수 |
| D | 전 문단 쌍에 분석기 | 핫패스·비용 큼. 1차 금지에 가깝다 |

통일 쪽 8차·키위 결과상 **「분석기가 띄우면 목록이 좋아진다」는 TXT에도 자동 이득으로 이식되지 않음.** TXT는 이미 문단 단위로 잇고, 문제는 **잘못 잇기(조사·짧은 줄·제목)** 와 **모달 80 상한**이다.

## 6. 제약·부작용

- TXT는 동기 `analyzeParagraphFlow` 후 모달. 분석기 삽입 시 **배치·폴백** 설계 필요 (handoff RULES ②: 설계 라운드에선 코드 금지).
- 원고가 바른 클라우드로 나가면 softwrap과 동일하게 **전송·라이선스** 항목.
- `COMPLETE_ONE_SYLLABLE_EOJEOL`에 softwrap Y 음절을 넣는 것은 **잠금과 충돌** 가능 (건·Y 상위 목록 추가 금지와 같은 위험).
- 검수전(`joinPagesWithMarkers`)은 조판 줄 유지 — 분석기를 넣어도 **검수전 의미**를 바꾸면 안 됨.

## 7. 권장 다음 단계 (구현 아님)

1. Claude: 위 A–D 중 목표에 맞는 안 + 측정 게이트(표본 n, A-FP, 모달 건수) 설계.
2. Grok: 설계 반론 (범위·기존 모달 UX·플래그).
3. 사람 승인 후에만 코드.
4. 구현 전 **표본 측정**이 필요하면: 잠긴 PDF 일부에서 TXT uncertain 후보만 뽑아 softwrap 육안 규칙과 대조 (별도 BRIEF 가능).

## 8. 파일 인덱스

| 경로 | 역할 |
|------|------|
| `src/lib/pdfTxtExport.js` | PDF→TXT 오케스트레이션 |
| `src/lib/pdfTxtParagraph.js` | 문단 판정·glue·모달 후보 |
| `src/lib/pdfTxtLinebreakReview.js` | 결정 적용·검수전 마커 |
| `src/lib/pdfTxtBodyClean.js` | 줄 청소 |
| `src/components/PdfTxtLinebreakReviewModal.jsx` | UI |
| `src/lib/pdfPageText.js` | `isLikelyHangulEojeolBoundary` 공유 |
| `src/lib/unifyCandidateDiscover.js` | 통일 softwrap merge (TXT 미사용) |
| `handoff/RULES.md` | 핑퐁·승인 규칙 |
| softwrap 8·9차 | 가려진 키·JOIN 확인 |
