# Acrobat Replace 골든 · Accept 품질 게이트

**샘플:** 261117_경주멍-본문 2교지_131.pdf  
**출처(메타):** Producer/Creator=`ezPDF Maker` → **ezPDF 재저장본** (스펙 §5.2: 보장 밖·결과만 기록). ID 내보내기 원본이 있으면 그걸 우선.  
**Contents 스모크:** Acrobat Replace Contents만 `경주멍멍`/`경 주멍`으로 바꾼 파일 — 사용자 확인 **Accept 통과** (2026-11-19).

## 필수 필드 (Acrobat 덤프)

- Caret: Subtype=Caret, IT=Replace, Contents=고침만, Subj≈삽입된 텍스트
- StrikeOut: Subtype=StrikeOut, IT=StrikeOutTextEdit, IRT→Caret, RT=Group, QuadPoints

덤프: [replace-pairs.json](./replace-pairs.json)

## Tw / 공유 글리프

- **코드 반영됨** (`eef79a9`, `pdfGlyphAdvances.js`). 화면·주석·내보내기 모두 `getItemGlyphOffsets` 우선. `glyph.isSpace`일 때만 Tw 가산.
- 이 샘플: `setWordSpacing≠0` 연산 **2회** 검출. item 2/2 글리프 매칭 성공, 선행 공백·폴백 **0**.
- 자체 점검(`page.text.slice`)은 좌표·Tw를 보증하지 않음 (제품 안내와 동일).

## Phase 4 · 품질

| 항목 | 상태 |
|------|------|
| 겹침 | 긴 구간 우선 · UI `겹침 N` 분리 |
| 줄바꿈 | 다중 Seg → QuadPoints |
| 자체 점검 | 문자열만 · 좌표 비보증 |
| Tw | **반영됨** · Accept 품질은 아래 게이트 |
| ezPDF | 보장 밖 · 결과만 기록 |

## Accept 품질 게이트 (2026-11-19)

측정 산출: [accept-quality-gate.json](./accept-quality-gate.json), [fallback-inventory.json](./fallback-inventory.json)

### 판정 기준

- **합격 = 인디자인 Import→Accept 후 본문 ↔ 고침 일치**
- QuadPoints 수치 일치는 **진단용** (가로 x0·x1 위주; 세로·exact match 비합격 조건 아님)

### 인디야 합성본

- 파일: 바탕화면 `261117_경주멍-본문_인디야Replace스모크.pdf` (기존 주석 제거 후 Caret+StrikeOut 2쌍)
- 고침: p1 `경주멍`→`경주멍멍`, p2 `경주멍`→`경 주멍`
- QuadPoints 가로 vs Acrobat 골든: dx0/dx1 ≈ 0 (±0.01pt) — 진단상 가로 정합 양호
- **Accept 본문 대조:** `passed_manual` — 사용자 확인 통과(경주멍·유물멍)

### 폴백 목록

- leading_space / match_fail: **0건** (이 2페이지 샘플). 상세는 fallback-inventory.json.
