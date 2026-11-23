# 조판 기호 (바꾸기 Replace · 개행·공백 Contents) 설계

**작성:** 2026-11-23  
**상태:** 합의 · Contents 값 확정 · 구현 가능  
**상위:** 원고 작업대 (`2026-11-20-manuscript-toolbox-design.md`), 인디자인 Replace (`2026-11-19-indesign-replace-export-design.md`)  
**계획:** [`../plans/2026-11-23-layout-mark-symbols-plan.md`](../plans/2026-11-23-layout-mark-symbols-plan.md)

---

## 0. 한 줄 원칙

조판 지시(줄바꿈·행갈이·들여쓰기)는 **인디자인용 PDF의 바꾸기(Replace) 주석**으로 내보낸다.  
Contents는 사람이 Acrobat에서 `--`/`-`로 자리 잡은 모양을 **공백·개행으로 치환**한 것과 같다. Accept 시 본문에 개행·앞 공백이 반영된다.  
**내어쓰기**는 1차 **다음**(주석 UI에 공백 미표시).  
들여는 **글자 공백**이지 인디자인 단락 “첫 줄 들여” 속성이 아니다(조판 정리 시 속성으로 바꿀 수 있음 — §6).

---

## 1. 합의된 전제

| 항목 | 결정 |
|------|------|
| **1차** | 화면 기호 + 인디자인용 Replace: **줄바꿈 · 행갈이 · 들여쓰기** |
| **다음** | **내어쓰기** |
| 내보내기 | 인디자인용 PDF만. 교정본 옵션 자리만, 기본 off |
| 파이프 | Caret+StrikeOut Replace 재사용. Contents = **고침만** |
| 앵커 | **클릭한 줄의 시작 어절 `W`** (문단 자동 스냅 없음) |
| 작업대 | 엔진·띄어쓰기 폴더와 무관 |

### 1.1 용어

| kind | 라벨 | 뜻 | 1차 |
|------|------|-----|-----|
| `paraSplit` | 줄바꿈 | 문단 중간에서 둘로 나눔 | ✅ |
| `paraGap` | 행갈이 | 문단 사이 빈 행 한 줄 | ✅ |
| `indent` | 들여쓰기 | 줄 앞 공백 추가 | ✅ |
| `outdent` | 내어쓰기 | 앞 공백 줄이기 | 다음 |

### 1.2 스모크 (사용자)

| 시도 | 결과 |
|------|------|
| `(줄바꿈)` 문구만 | 반영 안 됨 |
| 개행 + 시작 어절 | 줄 나뉨 → `paraSplit` = `"\n"+W` |
| 행 하나 더 띄움 | 행갈이 됨 → `"\n\n"+W` **확정**(사용자) |
| 앞 공백 추가 | 들여 됨 → 전각 1자 `　` (**확정**; 조판자가 단락 속성으로 다시 볼 수 있음) |
| 공백 줄이기(내어) | 주석에 공백 안 보여 어려움 |
| found=`요즘`, Contents=`--요즘\n-` | Accept 후 `--요즘` / `- 말로는…` → 공백·개행 치환의 뼈대 |

줄바꿈만으로는 들여 **자동 미적용** → 들여는 별도 기호(같은 `W`에 겹치면 §5.1에서 **한 건으로 합성**).

---

## 2. Replace Contents 규칙

자리 잡기:

```text
found:        요즘
Contents:     --요즘
              -
```

| kind | found | replacement | 확정 |
|------|-------|-------------|------|
| `paraSplit` | `W` | `"\n" + W` | ✅ |
| `paraGap` | `W` | `"\n\n" + W` (빈 줄 하나 + 시작 어절) | ✅ |
| `indent` | `W` | `"　" + W` (전각 1자; 디자이너가 단락 들여로 정리할 수 있음) | ✅ |
| `outdent` | — | 1차 미구현 | 다음 |

- Contents에 `(줄바꿈)` 등 지시 문구 **금지**.
- 화면 기호는 PDF Contents와 별개.

---

## 3. 데이터

```text
LayoutMark {
  id, pageNum, index,
  kind: 'paraSplit' | 'paraGap' | 'indent' | 'outdent',
  tip?, before?, after?,  // after ≈ W
  source: 'layout-mark'
}
```

`index` = `page.text` (visualText와 동일, 줄 `\n` 보존). 수동 finding과 분리.

---

## 4. UI

줄바꿈·행갈이·들여 찍기/삭제. 클릭 → 인덱스 + `W`.  
`setGroups`/`publish`/`remap` 금지.

---

## 5. 내보내기 · 겹침

### 5.1 같은 어절 `W`에 조판 기호가 둘 이상

겹침 제외로 **한쪽을 버리지 않는다.**  
같은 `(pageNum, found 구간)`의 layout kind를 **한 Replace로 합성**한다.

합성 순서(앞→뒤):

1. 개행 prefix: `paraGap`이면 `\n\n`, 아니면 `paraSplit`이면 `\n`, 없으면 `""`
2. 들여: `indent`이면 `"　"`, 없으면 `""`
3. `+ W`

예: 줄바꿈+들여 → `"\n" + "　" + W`  
행갈이+들여 → `"\n\n" + "　" + W`  
(같은 앵커에 `paraSplit`과 `paraGap`이 동시에 있으면 **행갈이(`\n\n`) 우선** — 빈 행이 더 강한 개행.)

화면에는 기호를 각각 보여도 되고, 내보내기만 합성한다.

### 5.2 기존 문자 Replace(맞춤법·수동 고침 등)와 구간 겹침

Accept가 본문을 바꾸므로 **조용히 빼지 않는다.**

1. **우선:** 문자 고침(맞춤법·통일·수동 replace)이 같은 `W` 구간을 쓰면 **문자 고침을 유지**하고, 그 구간의 **조판 Replace는 내보내지 않음**.
2. 제외된 조판 건수는 내보내기 결과/안내에 **`조판 기호 N건 제외(문자 고침과 겹침)`** 로 표시(기존 indesign 제외 건수 UI가 있으면 합산·구분).
3. 1차에서 문자 고침 Contents에 개행·들여를 **자동 합치지는 않음**(오염·순서 위험). 필요하면 다음 단계에서 “합치기” 옵션.

### 5.3 파이프

1. 문자 finding 수집 → 기존 겹침 제외  
2. LayoutMark → 같은 앵커 합성(§5.1) → Replace payload  
3. 문자 Replace 구간과 겹치면 §5.2로 제외·집계  
4. Caret+StrikeOut 기록  

---

## 6. 들여 = 글자 공백 (문단 속성 아님)

원고 단계 표시·Accept용. 조판자가 이후 단락 첫 줄 들여 속성으로 정리할 수 있음 — 제품·조판 합의 권장.

---

## 7. 비목표

내어 1차, FreeText-only, Insert 지시 문구, proof 수록, 펜, spacing 폴더, ruleEngine,  
문자 고침+조판 **자동 합성**(§5.2.3 다음).

---

## 8. 검증

| 항목 | 기준 |
|------|------|
| Accept | 줄바꿈·행갈이·들여 본문 기대값 |
| 합성 | 같은 `W`에 줄바꿈+들여 → 한 건 `"\n"+INDENT+W` |
| 제외 고지 | 문자 Replace 겹침 시 N건 안내 |
| 경계 | 페이지 첫·끝 어절; 줄 끝·하이픈 가능 어절에서 found↔본문 일치 |
| 회귀 | 기존 문자 Replace 골든 |

출처: Adobe 「Import PDF comments」 Accept = Strikethrough / Replace / Insert Text  
https://helpx.adobe.com/lt/indesign/using/import-pdf-comments.html (2026-11-23 조회)

---

## 9. 구현 순서

1. 계획 문서 단계대로 구현  
2. 앱 PDF Accept 스모크 B  
3. (다음) 내어쓰기
