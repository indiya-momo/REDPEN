# 인디자인 PDF 주석 Accept · 설계 (문서만)

**작성:** 2026-11-18  
**개정:** 2026-11-19 — 합의 정본은  
[`docs/superpowers/specs/2026-11-19-indesign-replace-export-design.md`](../docs/superpowers/specs/2026-11-19-indesign-replace-export-design.md)  
(형식 재현 ≠ Accept 약속 분리, 내려받기 분기, 자체 점검, 검증 게이트).  
**상태:** 초안 유지 · **구현은 정본·검증 게이트 후**  
**1차 성공 기준(검증 후):** 인디자인이 PDF 주석을 가져와 **Accept** 하면 레이아웃 글자가 바뀐다.  
**관련:** [proof-export-roadmap-2026-11-17.md](./proof-export-roadmap-2026-11-17.md) §4(TSV+스크립트), [pdf-annot-spike-2026-11-17.md](./pdf-annot-spike-2026-11-17.md)

---

## 1. 배경 · 왜 필요한가

편집자가 Acrobat에서 쓰는 흔한 습관:

1. 바꿀 구간만 선택한다. 예: `밥` (앞뒤 공백·안내 문구 포함하지 않음).
2. **Replace Text** 주석으로 바꿀 말만 넣는다. 예: `저녁 밥`.
3. 인디자인 **파일 → PDF 주석 가져오기** 후 **Accept** → 본문 `밥`이 `저녁 밥`으로 대치된다.

잘못된 예: 선택·Contents에 `밥 > 저녁 밥`처럼 지시문을 넣으면, 대치 결과에 화살표·공백 규칙이 그대로 섞인다.  
올바른 모델은 **찾을 구간(선택) ↔ 바꿀 말(Contents)** 이고, 「밥 → 저녁 밥」은 UI 라벨일 뿐이다.

인디야가 이미 확정 쌍·좌표를 알고 있으므로, **같은 Replace/Insert/StrikeOut 형태**로 내보내면 인디자인 자동 반영 경로를 열 수 있다.  
지금의 ∨/⌒ Ink·FreeText 라벨은 사람이 읽기용이지 Accept 대상이 아니다.

---

## 2. 목표 / 비목표

### 목표 (1차)

- 인디자인 CC2019+에서 **Import PDF Comments → Accept** 로 글자 치환·삽입·삭제가 된다.
- 대상은 인디야가 **확정(또는 Accept 가능으로 표시한) 검수 쌍**만. 문맥 의존·except는 제외 또는 수동 전용.

### 비목표 (이번 설계 범위 밖)

- 브라우저에서 인디자인을 직접 조종·플러그인 연동.
- PDF 본문 글자 스트림을 인디야가 고쳐 쓰는 것.
- 기존 화면용 교정본(∨/⌒ Ink + FreeText)을 Accept용으로 **한 파일에 섞어** 대체하는 것(분리 권장).
- 로드맵 §4 TSV+스크립트 **폐기**. Accept 경로는 **병행 후보**이지 대체 확정이 아니다.
- 암호화·주석 금지 PDF 우회.

---

## 3. Adobe / 인디자인 쪽 사실 정리

### 3.1 Accept 되는 주석 종류

인디자인이 PDF 주석으로 **자동 적용(Accept)** 하는 것은 대략:

| 종류 | 역할 |
|------|------|
| Strikethrough (삭제) | 선택 구간 삭제 |
| Insert Text | 커서 위치에 삽입 |
| Replace Text | 선택 구간 삭제 + 새 문자열 |

형광펜·스티키·밑줄·**Ink(손그림)** 등은 가져와도 Accept로 본문이 안 바뀐다.

### 3.2 ReplaceText의 PDF 구조 (핵심)

Acrobat Replace는 주석 **하나**가 아니라 보통:

1. **Caret** — `/Subtype /Caret`, `/IT /Replace`, `/Contents` = **바꿀 말만**
2. **StrikeOut** — `/Subtype /StrikeOut`, `/IT /StrikeOutTextEdit`, QuadPoints = **지울 구간**
3. 둘을 **그룹**(`/Group` 또는 NM/IRT 관례 — 스파이크에서 Acrobat 샘플로 확정)

Insert는 Caret(`/IT /Insert` 등) + Contents.  
순수 삭제는 StrikeOut(텍스트 편집용 IT)만.

### 3.3 인디자인 전제 (실패하면 Unmapped)

- PDF가 **해당 인디자인 문서에서 보낸(Export)** PDF여야 한다 (CC2019+ 권장).
- PDF 보낸 뒤 **인디자인 원고를 거의 바꾸지 않은** 상태여야 위치가 맞는다.
- 인디야에 올린 PDF가 인디자인이 아닌 경로(스캔·다른 조판·재저장)면 Accept 매핑이 깨질 수 있다 → 제품 안내에 **「인디자인에서보낸 PDF만」**을 명시.

참고(조사 시점): Adobe 「Import PDF comments」, CreativePro 등 — Replace = Caret+StrikeOut 그룹.

---

## 4. 인디야 현재 상태 (갭)

`writeAnnotatedPdf.js` 기준:

| 검수 스타일 | 현재 주석 | 인디자인 Accept |
|-------------|-----------|-----------------|
| 띄움/붙임 기호 | **Ink** ∨/⌒ | ❌ |
| 취소·대치형 strike | **StrikeOut** + **FreeText** 라벨 | ❌ (편집용 Replace 쌍·IT 아님) |
| 표기통일 상자 등 | Highlight/박스 + FreeText | ❌ |

좌표·글리프(Tw) 정렬은 화면↔교정본에서 이미 이슈가 있었고 Accept 품질에도 동일하게 영향을 준다. Accept용 주석도 **화면과 같은 글리프 기준 좌표**를 써야 한다.

로드맵 §4는 원래 **TSV + 스크립트**이며 「PDF 글자 수정·브라우저→인디자인 직접 연동은 하지 않는다」고 적어 두었다.  
본 문서는 그 **직접 연동 금지**를 유지한 채, **Acrobat 호환 주석 PDF를 사람이 인디자인에 가져오는** 우회로를 설계한다.

---

## 5. 접근 후보와 결정

| | 내용 | 장점 | 단점 |
|--|------|------|------|
| **A** | 제품 교정본을 Acrobat Replace/Insert/StrikeOut으로 교체 | Accept 직결 | 화면용 ∨/⌒ 가독성 약화, 기존 사용자 습관 변화 |
| **B** | §4 TSV+스크립트만 강화 | 주석 스펙 리스크 없음 | 「주석 Accept」 목표와 어긋남 |
| **C** | **인디자인용 교정본**을 별도 출구로 (Accept 주석만) · 화면용 Ink PDF 유지 | 목표 충족 + 기존 UX 보존 | 출구·안내 문구 증가 |

**채택: C를 제품 방향, A를 내부 포맷으로.**  
1차는 **샘플 PDF로 Accept까지 되는 스파이크** → 통과 후에만 UI 버튼.

---

## 6. 설계 (합의안)

### 6.1 출구

- **화면/편집자용 교정본** (현행): Ink ∨/⌒, StrikeOut+라벨, 상자 — 변경 최소.
- **인디자인용 교정본** (신규, 나중): Accept 가능 주석만. 작성자 `Indiya` 유지.

같은 검수 세션에서 둘 다 받을 수 있게 하되, **한 버튼에 섞지 않는다** (로드맵 §5와 동일 정신).

### 6.2 검수 종류 → 주석 매핑 (초안)

| 인디야 의미 | PDF 주석 | Contents / 선택 규칙 |
|-------------|----------|----------------------|
| 문자열 대치 (확정 쌍) | Replace (Caret+StrikeOut 그룹) | 선택=찾을 말 구간만. Contents=**바꿀 말만**. 라벨 `A → B`는 Contents에 넣지 않음. |
| 삭제만 | StrikeOut (텍스트 편집 IT) | 선택=삭제 구간. |
| 띄움(공백 삽입) | Insert Text | 삽입 위치 Caret. Contents=` ` (공백 한 칸) 또는 제품이 정한 공백 규칙. |
| 붙임(공백 삭제) | StrikeOut 또는 Replace(공백→빈문자) | 지울 공백 구간만 선택. ∨/⌒ Ink는 인디자인용에 **넣지 않음**. |
| 검토·미확정·문맥 의존 | 넣지 않음 또는 스티키(Accept 제외) | Accept 오염 방지. |

표기통일·본+보 등 **여러 후보 중 하나 선택**인 항목: Accept용에는 **사용자가 고른 목표형만**. 미선택 시 제외.

### 6.3 데이터 소스

- `collectAnnotFindings`와 동일 계열의 **확정·가시** 결과만.
- `matchedText` / overlay 치환 문자열 = Contents.
- QuadPoints·Rect = 기존 `annotGeometry` + **export 시 글리프 force 재측정** 경로(화면 정합).

### 6.4 실패·안내

제품/도움말에 고정 문구:

1. 인디자인에서 **보내기한 PDF**를 인디야에 올릴 것.
2. 보낸 뒤 인디자인에서 문장을 고치면 주석이 Unmapped될 수 있음.
3. Accept 전 인디자인 주석 패널에서 매핑·미리보기 확인.
4. Ink만 있는 일반 교정본은 Accept되지 않음 → **인디자인용**을 받을 것.

### 6.5 §4 TSV와의 관계

| 경로 | 언제 유리한가 |
|------|----------------|
| PDF 주석 Accept | 인디자인 원본·동일 PDF 전제, 위치 기반, 편집자→디자이너가 Acrobat 습관일 때 |
| TSV+스크립트 | PDF 출처가 애매하거나, 전역 문자열 치환·배치 적용이 필요할 때 |

둘 다 로드맵에 남긴다. Accept가 스파이크에서 실패하면 §4가 주력.

---

## 7. 단계 계획 (구현은 승인 후)

### Phase 0 — 문서 (본 문서) ✅

합의·갭·매핑·전제만 고정. 코드 없음.

### Phase 1 — 수동 기준 샘플 (반나절~1일)

1. 인디자인에서 짧은 문장 PDF 보내기. 예: `강아지가 밥을 먹는다.`
2. Acrobat에서 `밥` → Replace `저녁 밥` 한 건만.
3. 인디자인 Import → Accept → 본문 확인.
4. 같은 PDF를 pdf-lib/도구로 열어 **Caret/StrikeOut/IT/Group/Contents** 덤프 → **골든 스펙** 표로 본 문서 부록에 붙임.

합격: Accept 1건 성공 + 덤프 필드 목록 확정.

### Phase 2 — 쓰기 스파이크 (제품 UI 없음)

- 골든 스펙대로 pdf-lib로 Replace 1건 합성.
- 인디자인 Accept 재현.
- Insert(공백)·StrikeOut(삭제) 각 1건.
- Rotate / CropBox 샘플은 Phase 2 후반 또는 Phase 3.

합격: 합성 PDF가 인디자인 Accept 통과 (최소 1문서·1페이지).

### Phase 3 — 인디야 연결 (제품)

- `writeAnnotatedPdf`와 **분리된** writer 또는 모드 `acceptCompatible: true`.
- 확정 대치만 → Replace. 띄/붙 → Insert/StrikeOut.
- 「인디자인용 교정본 받기」출구 + 안내 문구.
- 자동 테스트: 주석 dict에 `/IT /Replace`·그룹·Contents=바꿀 말만 (인디자인 자동화는 CI 밖 → 수동 체크리스트).

### Phase 4 — 품질·범위

- 줄바꿈 걸친 대치, 다단, 표 안 텍스트.
- Unmapped 비율 측정 가이드.
- ∨/⌒ 화면본과 Accept본 **동시 받기** UX 다듬기.
- (선택) Accept 실패 시 §4 TSV 안내 링크.

---

## 8. 위험

| 위험 | 완화 |
|------|------|
| Acrobat이 쓰는 그룹/IRT 관례와 합성 dict가 미묘하게 다름 | Phase 1 골든 덤프를 유일한 스펙으로 |
| PDF 출처가 인디자인이 아님 | UI·도움말 전제 고지, Unmapped 시 §4 유도 |
| Contents에 `A → B`를 넣어 버림 | 매핑 표·테스트로 Contents=목표형만 |
| Ink와 Replace를 한 PDF에 섞음 | 출구 분리 (C) |
| 좌표 어긋남 → 잘못된 글자 Accept | export 글리프 force 경로 필수, Phase 2에서 육안+Accept |

---

## 9. 열린 결정 (구현 직전에만 물으면 됨)

- 인디자인용에 **미확정**을 스티키로 남길지, 아예 제외할지.
- 띄움 Contents를 U+0020 한 칸으로 할지, 인디자인이 기대하는 다른 공백인지 (Phase 1에서 확인).
- 작성자/주제 문자열을 Acrobat UI에 어떻게 보이게 할지.

---

## 10. 다음 행동

1. 이 문서 리뷰·수정.
2. 구현 착수 지시가 오면 **Phase 1 수동 샘플 + 골든 덤프**만. 제품 버튼·writer 분기는 Phase 1 합격 후.
3. 커밋은 요청 시에만.

---

## 부록 A — 골든 스펙 (비움 · Phase 1 후 채움)

Acrobat이 만든 Replace 1건 덤프 자리:

- Caret: Subtype, IT, Contents(hex), Rect, …

- StrikeOut: Subtype, IT, QuadPoints, …

- Group / IRT / NM …

- 인디자인 Accept 결과: 성공 / Unmapped / 부분
