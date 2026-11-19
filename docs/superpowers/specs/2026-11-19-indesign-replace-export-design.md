# 인디자인용 PDF · Acrobat Replace 내보내기 설계

**작성:** 2026-11-19  
**상태:** 합의 · **구현됨** (형식·Tw 반영 · Accept 본문 스모크 **통과** 2026-11-19)
**상위:** [project-docs/indesign-pdf-comment-accept-design-2026-11-18.md](../../../project-docs/indesign-pdf-comment-accept-design-2026-11-18.md)  
**관련:** [proof-export-roadmap-2026-11-17.md](../../../project-docs/proof-export-roadmap-2026-11-17.md), 샘플 `261117_경주멍-본문 2교지_131.pdf`  
**골든:** [project-docs/indesign-replace-golden-2026-11-19/](../../../project-docs/indesign-replace-golden-2026-11-19/)  
**묶음 분할:** [보류·불필요](./2026-11-19-indesign-replace-batch-export-design.md) (하나씩 Accept 가능)

---

## 0. 한 줄 원칙

**「Acrobat Replace 형식 재현 가능」과 「인디자인 Accept로 본문이 바뀐다」를 분리한다.**  
후자는 검증 전에는 제품 약속이 아니다.

---

## 1. 목표 · 성공 기준 · 비범위

### 사용자 목표

인디야 **화면**은 지금처럼 원문→고침을 보여 주고, **내려받기**에서 「인디자인 자동 반영용」을 고르면 Adobe Acrobat **Replace** 구조(`Caret` + `StrikeOut` 그룹)로 PDF를 만든다.

### 성공 기준 (단계별)

| 단계 | 기준 |
|------|------|
| A. 형식 | 인디야가 쓴 주석이 샘플과 같은 필드(`IT /Replace`, `StrikeOutTextEdit`, `IRT`, Contents=고침만, QuadPoints) |
| B. 제품 안전 | 내보내기 직전 자체 점검 실패·고침 없음·겹침 제외 건수가 UI에 보임 |
| C. Accept (검증 후) | ID 내보내기 원본 + 인디야 Replace에 대해 Import→Accept→**기대 문자열과 본문 대조** 통과 |

### 비범위

- 화면 Adobe 캐럿·취소선 UI
- 지금 교정본을 Replace만으로 교체
- 순수 Insert(샘플 확보 전)
- 인디자인 플러그인·비-ID/ezPDF 경로 Accept **보장**
- `ruleEngine` 변경

---

## 2. 고정 결정 (§1)

| 항목 | 결정 |
|------|------|
| 접근 | 내려받기 **분기만** (화면·검수 로직 최소) |
| 모드 | `proof`(지금 교정본) \| `indesignReplace`(인디자인용) |
| 화면 | 현행 하이라이트·→고침 유지 |
| 포함 | `replacement`가 있는 finding (맞춤법·통일·**띄어/붙여 고침** 포함) |
| 띄어쓰기 | **단어 구간 전체 Replace** (`경주멍`→`경주 멍` 샘플과 동일) |
| 제외 | 고침 없음·검토만·자체 점검 실패·겹침에서 탈락 |
| PDF 구조 | Caret `/IT /Replace` + StrikeOut `/IT /StrikeOutTextEdit` `/IRT` `/RT /Group` |
| Contents | **고침만** (라벨 `A → B` 금지) |
| Ink·FreeText 라벨 | `proof` 모드만 |

### 샘플 출처 (기록)

사용자 확인: **인디자인에서 내보낸 PDF** → Acrobat에서 Replace 주석 → **ezPDF Maker로 다시 저장**.  
파일 Producer=`ezPDF Maker`는 재저장 흔적. Accept 전제 검증의 **1차 골든 원본**은 재저장 전 ID 내보내기본을 별도로 쓴다.

### 골든 필드 (Acrobat 샘플 덤프 요지)

**Caret:** `/Subtype /Caret`, `/IT /Replace`, `/Contents`=고침(UTF-16), `/Subj`≈삽입된 텍스트, Popup, AP, (샘플에 `/RC` XHTML 있음 → 1차 생략 가능).  

**StrikeOut:** `/Subtype /StrikeOut`, `/IT /StrikeOutTextEdit`, `/IRT`→Caret, `/RT /Group`, `/QuadPoints`, Contents 비움, Popup, AP.

---

## 3. 위험

| 위험 | 완화 |
|------|------|
| Accept는 **본문 오치환**으로 이어짐 (표시 오류가 아님) | 내보내기 직전 자체 점검 + 스모크에서 Accept 결과↔기대 대조. 어긋나면 품질 미달 기록, 강행 금지 |
| 「어긋나면 미수락」은 **Accept 시점** 일 → 제품이 미리 알 수 없음 | 제품 안전장치는 **내보내기 직전** `page.text` 구간↔원문 일치 점검 |
| ID 내보내기 전제 vs ezPDF·한글 PDF | UI 고지. ezPDF·비-ID는 보장 밖·결과만 기록 |
| Tw·공백 폭 오차 → QuadPoints 어긋남 | 공유 글리프 경로 수정 **반영 후** Accept 품질 판정. ID 골든 원본에서 Tw 전후 **별도** 측정 |
| Tw 수정은 공유 경로에 반영됨(eef79a9). Accept 본문 판정·ezPDF 한계는 §5 | §5 검증 4 |
| 순수 Insert 미검증 | 샘플 확보 전 미사용 |
| Contents에 지시문 | 테스트로 고침만 강제 |

---

## 4. 쓰기 · 매핑 · 안내 (§2)

### 모듈

- [`src/lib/pdfAnnotExport/writeAnnotatedPdf.js`](../../../src/lib/pdfAnnotExport/writeAnnotatedPdf.js) — `mode: 'indesignReplace'`
- [`src/lib/pdfAnnotExport/exportProofreadPdf.js`](../../../src/lib/pdfAnnotExport/exportProofreadPdf.js)
- [`src/lib/pdfAnnotExport/indesignReplaceFindings.js`](../../../src/lib/pdfAnnotExport/indesignReplaceFindings.js)
- [`src/lib/pdfAnnotExport/collectAnnotFindings.js`](../../../src/lib/pdfAnnotExport/collectAnnotFindings.js)
- 내려받기 UI (`MainScreen` 확인 대화상자)

### 파이프라인 (`indesignReplace`)

1. `collectAnnotFindings` (현행과 동일 소스).
2. `replacement` 비어 있지 않은 것만 후보. `style === 'review'` 제외.
3. **내보내기 직전 자체 점검:** `page.text.slice(start, end)`(finding의 `found`/`matchedText`와 동일 규칙)가 기대 원문과 일치할 때만 포함.
   - QuadPoints에서 글자를 다시 읽지 않음. **좌표·Tw 정확도는 보증하지 않음** (UI·README에 명시).
4. **겹침:** 같은 페이지 구간 겹침 → **더 긴 구간 우선**, 동길이면 먼저 수집된 것 유지, 나머지 제외. UI에 `겹침 N` **분리 표시**.
5. 통과 건만 Caret+StrikeOut 쌍 기록. `/RC`는 1차 생략. Popup은 1차 생략(열린 항목).
6. UI에 포함 N · 제외 N(고침 없음 / 검토만 / 원문 불일치 / 겹침) 표시.

### 줄바꿈

`segmentsForTextRange` → 다중 Seg → 복수 QuadPoints.  
자체 점검 정규화는 `found`와 동일 규칙. 실패 건 제외.

### 좌표 경로

`segmentsForTextRange` → `getItemGlyphOffsets` ?? `charOffsetsInItem` (**화면 하이라이트와 공유**).  
Tw/isSpace 보정은 이 공유 경로에 반영됨. Accept 품질은 본문 대조로 판정.

### 안내 문구 (약속 없이)

- 포함 N건 · 제외 N건(사유 요약).
- 「검토용 PDF를 만든 뒤에는 **인디자인 문서를 수정하지 마세요.** 수정하면 주석 위치가 맞지 않을 수 있습니다.»
- 「자동 반영은 인디자인·원본 PDF 조건에 따라 달라질 수 있습니다.»

### 데이터 흐름

```text
collectAnnotFindings
  → hasReplacement / not review
  → slice_matches_found (자체 점검)
  → overlap_rule
  → Caret + StrikeOut
  → counts + notice
```

---

## 5. 검증 게이트 (순서)

1. **가져오기 스모크:** ID 내보내기 PDF에 Acrobat Replace 1건 vs **같은 원본을 인디야가 pdf-lib로 저장·Replace 합성** — 각각 Import·Accept·**본문↔기대 대조**.  
2. **ezPDF 경로:** 이번 샘플류는 보장 밖, 결과만 기록.  
3. **Insert:** 필요 시에만 Acrobat Insert 샘플 덤프 후 스펙 추가.  
4. **QuadPoints / Tw:** 공유 글리프 경로(**Tw/isSpace 보정 eef79a9 반영됨**). Accept 품질 판정은 **본문 대조**가 기준이고 QuadPoints 가로는 진단. 측정: project-docs/indesign-replace-golden-2026-11-19/accept-quality-gate.json.

---

## 6. 단계

| Phase | 내용 | 합격 |
|-------|------|------|
| 0 | 본 문서 합의 | ✅ |
| 1 | ID 원본 + Acrobat Replace 골든 덤프·Accept 수동 | ✅ 필드 표 (`replace-pairs.json`) · Accept는 수동 |
| 2 | pdf-lib Replace 1건 합성 → Accept 재현 | ✅ 형식 단위 테스트 · 인디야 합성 Accept는 수동 게이트 |
| 3 | `indesignReplace` 모드 + 자체 점검 + UI 건수·안내 | ✅ |
| 4 | 겹침·줄바꿈·품질 | ✅ 코드·문서 · Tw **코드 반영됨** · Accept 본문 판정은 골든 README |

Tw/isSpace 보정은 공유 경로에 반영됨. Accept 합격은 인디자인 본문 대조로 판정한다.

---

## 7. 테스트

- 단위: Contents=고침만, `IT`/`IRT`, 자체 점검 제외, 겹침 규칙, 줄바꿈 QuadPoints.
- 골든: 샘플 Acrobat 쌍과 필드 동등(좌표 허용 오차는 별도).
- 수동: §5 전부.

---

## 8. 열린 항목

- `/RC` XHTML 필요 여부 (스모크 후).
- Popup 필수 여부.
- `proof`와 `indesignReplace` 동시 다운로드 UX 문구 다듬기.
- Tw/공유 글리프 경로 수정 후 Accept 품질 판정.

---

## 9. Self-review

- Placeholder/TBD: 열린 항목만 §8에 명시. Accept 성공은 검증 전 약속 없음.  
- §1 위험과 §4 자체 점검·안내 일치.  
- 범위: 내려받기 분기 + Replace 쓰기. 화면 Adobe UI·Insert 전면 없음.  
- 「미수락」= 스모크 판정 / 「제외」= 내보내기 직전 제품 동작으로 구분함.
