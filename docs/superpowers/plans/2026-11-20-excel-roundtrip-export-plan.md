# 엑셀 roundtrip 1차 — 내려받기 형식

**스펙:** [`../specs/2026-11-20-excel-roundtrip-annot-design.md`](../specs/2026-11-20-excel-roundtrip-annot-design.md)  
**범위:** 내보내기만. 올리기 UI·파서 없음.

## 단계

1. `exportExcelRoundtrip.js` — 행ID · pageFp · 구간 · 문자열 셀 헬퍼
2. `buildSpellingExportModel` / `buildConsistencyExportModel` — 기계용 필드, 숨긴 발견 제외, 표기통일 수정안(📌만)
3. `writeSpellingWorkbook` / `addConsistencyWorksheet` — 데이터 행 병합 제거, 열 확장, 안내 문구
4. `MainScreen` — `pdfFileName` · `pdf.numPages` · `pageTexts` 전달
5. `exportResults.test.js` — 열·병합 없음·숨김 제외·📌 수정안

## 검증

- 맞춤법·표기통일 모델에 `pageNum`/`start`/`end`/`rowId` 있음
- 워크북 데이터 행에 mergeCells 없음
- 숨긴 인스턴스 행 0
- `=`로 시작하는 발견 문구도 문자열 셀
