# Acrobat Replace 골든 (Phase 1 필드 덤프)

**샘플:** 261117_경주멍-본문 2교지_131.pdf  
**출처(사용자 확인):** 인디자인 내보내기 → Acrobat Replace 주석 → ezPDF Maker 재저장.  
**Accept 수동:** 이 저장소에서는 인디자인 Accept를 자동 실행하지 않음. 필드 스펙만 고정. Accept 품질 판정은 ID 골든 원본 + Tw/공유 글리프 경로 수정 반영 후.

## 필수 필드

- Caret: Subtype=Caret, IT=Replace, Contents=고침만, Subj≈삽입된 텍스트
- StrikeOut: Subtype=StrikeOut, IT=StrikeOutTextEdit, IRT→Caret, RT=Group, QuadPoints, Contents 비움

덤프: [replace-pairs.json](./replace-pairs.json) (`경주몽`, `경주 멍`)

## Phase 2 — pdf-lib 합성 대조

단위 테스트(`pdfAnnotExport.test.js`)가 합성 PDF에서 위 필드를 검사한다.  
인디자인 Import→Accept는 수동 스모크(제품 CI 밖).

## Phase 4 — 겹침·줄바꿈·품질

| 항목 | 상태 |
|------|------|
| 겹침 | 더 긴 구간 우선 (`prepareIndesignReplaceFindings`). 밀린 건수는 UI 안내에 `겹침 N`으로 **분리 표시** |
| 줄바꿈 | `segmentsForTextRange` 다중 Seg → 복수 QuadPoints; 자체 점검은 found 정규화 |
| 자체 점검 | `page.text.slice(start,end)` ↔ `found`만. **QuadPoints에서 글자를 다시 읽지 않음.** 좌표·Tw 정확도는 보증하지 않음 |
| Tw / 공유 글리프 | **미반영.** Accept 품질 판정은 이 경로 수정 이후로 미룸. 그 전은 형식 스파이크만. |
| ezPDF 경로 | 보장 밖 · 결과만 기록 |
