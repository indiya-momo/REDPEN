# BRIEF — PDF 정답 기준 TXT 줄바꿈 · 표/단 오차

## 식별

- **run_id:** 2026-11-26-txt-pdf-layout-error
- **날짜:** 2026-11-26
- **트랙:** softwrap / PDF↔TXT / 표·단 레이아웃

## 사용자 목표

오차는 PDF와 확인하는 것(시각 읽기 순서·칸). Kiwi A/Y vs 추천 결정은 오차가 아님.  
표·칸·다른 덩어리 오접은 띄움·붙임 금지, 유지(keep).

## 성공 기준

- TXT가 PDF에서 눈으로 읽는 칸·문장 순서와 맞음  
- 표 mash·잘못 이음이 모달/최종 TXT에 다시 안 남음  
- 오차율 측정이 추출 재정렬 순환이 아님  

## 축소 여부

없음

## 잠금

- [ ] notices / momo / firestore를 이 run에 섞지 않음  
- [ ] ruleEngine·spelling/caution 매칭 (beta freeze)  
- [ ] welcome-mo (「모바일」 없으면)  
- 요청 없이 커밋·푸시 금지  

## 근거·원본

- **전체 핸드오프 (다음 채팅용):**  
  (작성자 PC의 임시 폴더 파일. 저장소에 포함하지 않음)
- 커밋: `5900dae`
- 이전 run: `handoff/runs/2026-11-25-txt-linebreak-analyzer/`
- 바탕화면: `street-txt-vs-pdf.md`, `pdf-visual-order-tautology-check.md`

## Claude가 맡는가?

예 (PDF 읽기 순서·레이아웃 구조)

## 사람이 승인 전에 볼 산출물

- [x] depressione 읽기 순서 수정 표본 (불치병→의 희생자…)  
  - `pageColumnSplit` 교차거터 가드(미커밋) · 프로브 PASS · 골든 2/2  
- [x] 순환 없는 PDF 오차 정의·표본 수치  
  - `scripts/_measure_pdf_visual_error_nontautology.mjs`  
  - 바탕화면: `pdf-visual-error-nontautology.md`  

