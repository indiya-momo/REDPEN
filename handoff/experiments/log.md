# 핑퐁 실험 기록 (처음 5작업)

| 작업 | Claude 사용 | 설계↔반론 횟수 | 구현 중 설계 변경 | 구현 후 설계 오류 | 소요 |
|------|-------------|----------------|-------------------|-------------------|------|
| 1 TXT×softwrap B | 0 (이 대화에서 설계) | 1 (02↔03) | 0 | 없음(테스트만) | 2026-11-25 |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

## 1 — TXT 줄바꿈 × softwrap 교훈 (B)

- run: `2026-11-25-txt-linebreak-analyzer`
- 채택: 런타임 불변 + 회귀 `pdfTxtParagraph.softwrapRegression.test.js` + fixture
- 잠금: A 10 nospace, Y space 3, josa/목록, wasm 문자열 문서화; Y 과도붙임 7은 `it.fails`
- 미착수: C 분석기, merge→TXT
- vitest: 4 passed | 1 expected fail

작업마다 아래에 한 블록을 추가한다.
