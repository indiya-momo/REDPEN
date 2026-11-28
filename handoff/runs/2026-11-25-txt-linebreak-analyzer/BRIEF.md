# BRIEF — TXT 줄바꿈 × 줄끝 이음 측정 이관

- **run_id:** 2026-11-25-txt-linebreak-analyzer
- **날짜:** 2026-11-25
- **트랙:** TXT 변환 / 문단 줄바꿈

## 사용자 목표

이때까지 한 끝 단락(줄끝) 잇기 작업이 TXT 변환에도 유용하니, **통일 스캔 이음을 TXT에 합치지 말고**, TXT 자동 판정에 이번 분석기·오경보 기준을 **얼마나 얹을지** 따로 연다.

## 성공 기준

1. 조사에 TXT 경로·통일 softwrap 경로·공유 함수·차이(성공 기준)가 파일·줄 근거로 남는다.
2. 설계는 **승인 전**이며, `src/` 미수정.
3. 사람이 “구현해” 하기 전에: 얹을 범위(안 얹음 / 모달 순위만 / 자동 판정에 분석기)와 **측정 게이트**가 설계·issues에 명시된다.

## 축소 여부

없음

## 잠금 (이 run · 설계·검토)

- [x] `src/` 전체 (설계·검토 라운드)
- [x] `mergeUnifyHangulSoftWrapScanLines`를 TXT 파이프에 연결하지 않음
- [x] 독립 어절 목록에 `건`·Y 상위 음절 추가 금지
- [x] 요청 없이 커밋·푸시 금지
- [x] 통일 softwrap ②~④ 구현을 이 트랙으로 몰래 재개하지 않음

## 근거·원본

- softwrap 차수 1~9 (육안 200, 키위 4817, 바른 200, 8차 가려진 키)
- 특히 A 오경보 방어선 (6차), wasm A FP M186·M195, 바른 Y 14/19
- TXT: `src/lib/pdfTxtParagraph.js`, `pdfTxtLinebreakReview.js`, `pdfTxtExport.js`

## Claude가 맡는가?

예 — 여러 모듈·성공 기준이 다른 두 경로를 잇는 **설계 의사결정**. 조사는 Grok.

## 사람이 승인 전에 볼 산출물

- [ ] `01-investigate.md`
- [ ] (다음) Claude `02-design.md`
- [ ] `issues.md`
- [ ] `design-final.md` (승인용)
