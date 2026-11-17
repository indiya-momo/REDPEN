# 주석 PDF 스파이크 결과 (로드맵 ①)

**일자:** 2026-11-17  
**명령:** `npm run pdf:annot-spike` → `scripts/pdf-annot-spike.mjs`  
**의존:** `pdf-lib`  
**산출:** `tmp/annot-spike-out/*.annotated.pdf`, `report.json`

---

## 시험 대상

| 파일 | 의도 |
|------|------|
| `tmp/annot-fixtures/normal.pdf` | 기본 |
| `tmp/annot-fixtures/rotate90.pdf` | `/Rotate` 90 |
| `tmp/annot-fixtures/cropbox.pdf` | CropBox ≠ MediaBox |
| (참고) onboarding-sample | 쪽1에 `할때` 없음 → 스킵 |

각 파일에 `할때` 위치 StrikeOut(Acrobat Quad / Spec Quad / AP 없음) + Highlight(AP) 주석을 덧붙임.  
메모: `할때 → 할 때 […]`, 작성자: `Indiya` (UTF-16BE via `PDFHexString.fromText`).

---

## 자동 결과 (pdf.js 재독)

- **좌표:** 세 fixture 모두 `maxAbsDelta = 0` (목표 Rect와 일치). `coordPass` 통과.
- **한글 메모:** `contentsObj.str`에 `할때 → 할 때` 포함 확인.
- **작성자:** `titleObj.str === "Indiya"`.
- **AP:** StrikeOut은 `hasAppearance: true`. Highlight는 pdf.js가 built-in AP를 ignore 경고 — 뷰어 표시는 수동 확인 필요.

---

## 수동으로 남은 것 (합격 기준의 절반)

로드맵 합격: *세 뷰어에서 주석이 말 위에 걸치고, 아크로밧 목록에 한글 메모*.

자동으로 좌표·문자열은 확인됨. **아크로뱃 / 맥 미리보기 / 크롬**에서 아래 파일을 열어 표시만 확인하면 ① 시험 닫힘.

- `tmp/annot-spike-out/normal.annotated.pdf`
- `tmp/annot-spike-out/rotate90.annotated.pdf`
- `tmp/annot-spike-out/cropbox.annotated.pdf`

비교 포인트: Acrobat Quad vs Spec Quad 취소선 위치, AP 있는/없는 StrikeOut, Highlight 가시성.

---

## 제품 단계로 넘길 때

1. 스파이크의 주석 dict 작성 → `src/lib/` 모듈로 이동.
2. 화면 하이라이트와 동일하게 **결과 데이터 + 글자 조각 → PDF 좌표** (DOM 박스 금지).
3. 기본: StrikeOut + AP + Acrobat QuadPoints (수동 확인 후 확정).
4. 숨긴 항목 제외, 기존 주석 덧붙이기, 작성자 `Indiya`.
5. 그다음 UI: 주석 PDF 내려받기. TXT 1차·인디자인 표는 그 뒤.
