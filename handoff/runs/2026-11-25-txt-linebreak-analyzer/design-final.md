# design-final — TXT × softwrap 교훈 (승인용)

run: `2026-11-25-txt-linebreak-analyzer`  
반영: `02-design.md` + `03-critique.md`

## 채택

**1차 = 안 B, 축소판:** TXT 런타임·모달 동작은 **바꾸지 않는다.**  
softwrap 교훈을 **`classifyParagraphPair` / `paragraphJoinGlue` 회귀 테스트(약 n=20)** 로만 남긴다.

- Y≥5, A≥10, josa/midword 유형 ≥5 (대략).
- softwrap 육안 200 전량 이관 금지. 문자열만으로 재현 가능한 쌍만.
- UX 카피 변경 없음.
- `mergeUnifyHangulSoftWrapScanLines`·Kiwi/Bareun·음절 목록 확장·검수전 의미 변경·ruleEngine/pdfPageText 본문 변경 없음.

## 2차 (별도 승인)

안 C: uncertain만 분석기. B 머지 후, 표본·A-FP 게이트·갈림 시 현행·플래그 OFF·전송/라이선스 닫은 뒤.

## 하지 않음

안 A만으로 run 종료(문서만) — 기각.  
안 D — 기각.  
통일 softwrap ②~④를 이 승인으로 재개 — 금지.

## issues 요약

| 제기 | 반영 | 이유 |
|------|------|------|
| merge→TXT | 미반영 | 경로·성공 기준 상이 |
| 런타임 분석기 1차 | 미반영 | 이득 미측정, 비용 |
| 육안 200 전량 픽스처 | 미반영 | 03 반론. n≈20 |
| UX 문구 1차 | 미반영 | 03 반론 |
| 회귀 n≈20 | 반영 | 03 |

## 승인 시 구현자가 할 일

1. 픽스처·테스트 파일 추가 (기존 softwrap `it.fails` 불변).
2. `npm test` 해당 파일 통과.
3. 실험 log에 한 블록.
4. C/구현 플래그는 열지 않음.

## 구현 기록 (2026-11-25)

- 추가: `src/lib/fixtures/txt-softwrap-glue-regression.json`
- 추가: `src/lib/pdfTxtParagraph.softwrapRegression.test.js`
- TXT·모달·분석기 런타임 **미변경**
- `npx vitest run src/lib/pdfTxtParagraph.softwrapRegression.test.js` → 4 passed | 1 expected fail
