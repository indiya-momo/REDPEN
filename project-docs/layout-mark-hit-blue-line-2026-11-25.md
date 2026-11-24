# 조판 줄바꿈 히트 — 파란 줄(「그 모습을」) 정리

**날짜:** 2026-11-25  
**범위:** 원고 작업대 · 줄바꿈(`layout-paraSplit`) 클릭 앵커  
**표본 PDF:** `261124_경주멍-본문_4교.pdf` · **4쪽**  
**문제 줄(사용자 파란 밑줄):**

> 에서 어찌 그리 차분하신지요. 그 모습을 보고 있으면 저도 서두르

이 문서는 「해결됐다」가 아니라, **아직 사용자 기준 성공이 확인되지 않은 상태**에서  
증상·재현·원인·시도·남은 판정을 한곳에 모은다.

**문서 용도:** 작업 메모(판권 통과·우선순위 왕복으로 빗나가지 않게). 해결 보고 아님.

---

## 1. 사용자가 말한 성공 기준 (축소 금지)

| # | 사용자 문장 | 성공이면 |
|---|-------------|---------|
| A | 「그」를 못 잡아서 「그리」로 넘어간다 | 「그 모습을」의 **그**를 찍으면 **그**에 도장 |
| B | 「그」찍으면 「모습의/모습을」이 찍힌다 | 위와 같음 — **모습을**로 가면 실패 |
| C | 파란 친 **그 줄 전체가** 문제다 | 그 줄의 어절(어찌·그리·그·모습을·서두르 …)을 찍으면 **찍은 어절**에만 붙음 |

에이전트가 표지·판권(「초판」)만 찍어 통과 처리한 것은 **이 기준을 충족하지 않는다.**

---

## 2. 재현 조건

1. 경주멍 4교를 연다 (세션 복원 가능).
2. 인쇄 쪽 **4**로 이동.
3. 도구 상자 **줄바꿈** ON.
4. 프롤로그 본문 줄  
   `에서 어찌 그리 차분하신지요. 그 모습을 보고 있으면 저도 서두르`  
   위에서 **그**(「그 모습을」의 그)를 클릭.

**기대:** 목록 `줄바꿈 · 그`, 하이라이트가 「그」 위에만.  
**실패 예:** `줄바꿈 · 모습을` / `줄바꿈 · 그리` / 하이라이트가 「모습을」·「그리」쪽.

같은 줄에서 「모습을」「어찌」「그리」를 각각 찍어도, 찍은 어절과 목록·하이라이트가 같아야 한다.

---

## 3. 이 줄의 PDF 구조 (측정)

4쪽 `pageTexts` 기준 (에이전트 브라우저 fiber 조회):

- `visualText === text` (이 페이지는 동일).
- 해당 문장은 **한 text item**에 들어 있음:

| itemIndex | start–end (page index) | str (앞부분) |
|-----------|------------------------|--------------|
| 14 | 458–494 | `에서 어찌 그리 차분하신지요. 그 모습을 보고 있으면 저도 서두르` |
| 15 | 534–558 | `던 마음을 가다듬고…` (soft-wrap 이어짐) |

주요 인덱스:

| 어절 | index (대략) |
|------|----------------|
| 어찌 | 461 |
| 그리 | 464 |
| 그 (그 모습) | 475 |
| 모습을 | 477 |
| 서두르 | 491 |

한 줄·한 item 안에 **「그리」의 그**와 **「그 모습을」의 그**가 둘 다 있다.  
글자 박스·phrase 매칭이 **첫 「그」**만 보면 뒤의 「그」가 깨진다.  
이 측정은 구체적이고, 문제 구조를 설명하는 데 설득력이 있다.

---

## 4. 원인 후보 (층이 다름 — 한 번에 판정하지 말 것)

### 4.1 히트: 화면 글자 vs PDF 글리프 (클릭 → index)

- 텍스트 레이어는 `scaleX`로 맞춘 **한 줄짜리 span**.
- span **폭 ÷ 글자 수** 균일 비율이면, 보이는 「어찌」클릭이 「그리」쪽으로 밀릴 수 있음.
- PDF 글리프 bbox는 「그」가 좁거나 왼쪽으로 밀려, **보이는 「그」클릭이 「모」**로 넘어갈 수 있음  
  (`pageGeometry.js` 주석: 「그」→「모」, 「고」→「인」).

### 4.2 앵커: index → 어절 W

- `extractStartEojeol` / `resolveAnchorEojeol`.
- 공백 trailing 스냅(「그 」→「그」) 수정이 **이 줄에서 효과가 있었는지는 화면 검증 없음** → 아래 §6.

### 4.3 하이라이트: W → 박스 (같은 줄에 「그」가 둘)

- `phraseLocalRangesInItems`가 compact에서 **needle의 첫 출현**만 쓰면,  
  match가 「그」(475)여도 박스가 **「그리」의 그**(464)에 붙을 수 있음.
- `clipMatchToItemLocals`에 `matchStart`로 가까운 출현을 고르도록 패치함  
  (`src/lib/pdfService.js`, 테스트 `pdfService.itemHighlight.test.js`).

4.1과 4.3은 **다른 층**이다. 클릭이 어느 index로 해소되느냐 vs 그 index에서 박스를 어디에 그리느냐.

### 4.4 MainScreen → PdfViewer `textHitMode`

- PdfViewer 기본값은 `textHitMode = 'range'`.
- `textHitMode={manuscript.textHitMode}`가 빠지면 줄바꿈 모드에서도 **클릭(접힌 선택)이 무시**됨.
- 커밋 시도 중 빠졌다가 다시 연결함 (`MainScreen.jsx`).

---

## 5. 이번에 손댄 코드 (미커밋 포함 가능)

| 변경 | 의도 |
|------|------|
| `MainScreen.jsx` · `textHitMode` 재연결 | 줄바꿈 클릭이 layout-point로 들어가게 |
| `addLayoutMark.js` · `visualText ?? text` | 앵커 문자열이 화면 텍스트와 같게 |
| `pdfService.js` · `needleIndexNear` / `preferPageIndex` | 같은 줄 두 「그」중 **matchStart에 가까운 쪽** |
| `textLayerHitFromClient.js` · DOM Range 글자 rect | 균일 비율 대신 **글자 박스** |
| `PdfViewer.jsx` · 히트 우선순위 왕복 | glyph ↔ DOM을 바꿔 가며 맞춤 시도 |
| `PdfViewer.jsx` + `addLayoutMark.js` · **DEV 3단·conflict 로그** | **동작 불변**, 관측만 (§11) |
| `textLayerHitFromClient.js` · DOM 공백 rect 포함 | 공백 index → trailing 「그」 (유지) |
| `pageGeometry.js` · gap>1→앞글자 **철회**, 중점 복구 | 틈 전부가 앞 어절 → 「뭘 찍어도 왼쪽」 |
| `PdfViewer` + CSS · layout-point에서 선택 금지 | 노란 ::selection이 왼쪽부터 늘어나던 UX |

**우선순위 동결 유지:** DOM → glyph 폴백만. 이번 수정은 **보로노이·공백 박스**이며 source 우선순위는 바꾸지 않음.

---

## 6. 가설 정리 (검토 반영)

### 6.1 공백·어절 틈 → 「모습을」 (확인됨)

- DOM `indexFromSpanCharRects`가 **공백을 박스에서 제외**하면 「그」·「모」보로노이 **중점이 공백 한가운데**.
- 공백(또는 「그」오른쪽 틈) 클릭 → DOM index **477 「모」** → 앵커 **모습을**. glyph는 같은 점에서 **475 「그」** (conflict).
- 수정 후: 공백 포함 + 틈(gap>1)은 앞 글자 → 공백 클릭 index **476 ␠** → trailing **그**, 하이라이트 ovMo=0.

### 6.2 검증 함정

- 판권 「초판」만 찍어 통과 처리 → 파란 줄 기준 위반.
- synthetic `PointerEvent`(DOM Range 중심)는 사용자가 마우스로 보이는 글자를 찍는 것과 **같지 않을 수 있음**. conflict 빈도도 synthetic으로 모으면 사용자 경로를 대표하지 못함.
- 골든 fixture도 좌표를 어디서 얻느냐에 같은 한계. **실제 마우스** 또는 사용자가 찍은 좌표가 기준.

---

## 7. 에이전트 쪽 측정 메모 (신뢰 한계 · synthetic)

DOM Range 중심 synthetic `pointerup` 시점(참고용, 성공 근거 아님):

- 히트: `그`(475), `모`(477), `그리`(464), `어찌`(461) 등이 맞은 글자로 찍힌 적 있음 (`source: dom`).
- 목록·하이라이트 overlap이 어절과 맞은 적도 있음.

그러나 사용자는 「그 → 모습을」「줄 전체 문제」를 유지 → **사용자 성공 기준 미달.**  
맞춤법 노란 하이라이트·soft-wrap(`서두르`|`던`)은 별 이슈일 수 있으나 파란 줄과 겹치면 「줄 전체 깨짐」처럼 보일 수 있음.

---

## 8. 남은 판정 (전부 미확인 · 「해결」금지)

- [ ] 사용자가 4쪽 파란 줄에서 **그**를 찍어 `줄바꿈 · 그`만 나오는지
- [ ] 같은 줄 **모습을** → `줄바꿈 · 모습을` (그/그리로 안 감)
- [ ] 같은 줄 **그리** → `줄바꿈 · 그리` (뒤의 그/모습으로 안 감)
- [ ] 새로고침 후에도 `textHitMode`가 유지된 빌드로 동일 동작
- [ ] 실제 마우스 클릭으로 `[layout-hit-conflict]` 빈도 관측 후 DOM 고정 여부 결정
- [ ] (결정 후) 우선순위를 하나로 고정하고 회귀(어찌·하고·그) 테스트에 넣기

위가 전부 체크되기 전에는 **「파란 줄 해결」로 보고하지 말 것.**

---

## 9. DEV 관측 로그 (2번 구현 · 우선순위 불변)

**범위:** `import.meta.env.DEV`만. 배포 빌드에서는 안 남음 (이번은 DEV 한정으로 충분하다고 정함).  
**동작:** 히트 채택 순서 **변경 없음** (현재: DOM 성공 시 DOM, 실패 시 glyph). conflict는 **병행 계산·로그만**.

| 태그 | 단계 | 위치 |
|------|------|------|
| `[layout-hit-1-index]` | 클릭 → index | `PdfViewer.jsx` · `resolveLayoutPointHit` |
| `[layout-hit-conflict]` | DOM index ≠ glyph index일 때만 | 동일 (채택 `chosen`만 기록) |
| `[layout-hit-2-anchor]` | index → 어절 W | `addLayoutMark.js` · `appendLayoutMark` |
| `[layout-hit-3-box-range]` | W → 하이라이트 **의도** 구간 | 동일 (`start`/`end`/`w`) |

`isTrusted: true`이면 실제 사용자(또는 브라우저) 마우스에 가깝다. synthetic은 보통 `false`.

### 수집 방법 (사용자·에이전트)

1. `npm run dev` → `http://127.0.0.1:5173` · DevTools Console.
2. 4쪽 파란 줄에서 **마우스로** 그 / 모습을 / 그리 / 어찌를 각각 클릭.
3. 증상과 함께 네 태그 줄을 복사해 §10에 붙인다.
4. conflict가 자주면 4.1(히트), 1·2는 맞는데 3만 어긋나면 4.3(박스) 쪽으로 좁힌다.

---

## 10. 관측된 사실

> isTrusted true는 사용자 클릭 시. 아래 첫 행은 **수정 전** synthetic conflict(재현 핵심).

| 시각 | 찍은 어절(의도) | 목록에 찍힌 것 | 1-index | conflict? | 2-anchor W | 3-box-range | 비고 |
|------|-----------------|----------------|---------|-----------|------------|-------------|------|
| 수정 전 | 「그」옆 공백 | (모습을 경로) | DOM 477 모 / glyph 475 그 | yes · chosen DOM | — | — | isTrusted false · 증상 재현 |
| 수정 후 | 공백 | 그 | 476 ␠ | glyph는 그(무해) | 그 475–476 | 그 | 하이라이트 ovGeu>0 ovMo=0 |
| 수정 후 | 그 / 그리 / 모습을 / 어찌 | 각각 동일 | — | — | 일치 | 일치 | 파란 줄 synthetic |

---

## 11. 다음에 손댈 때 (우선순위 동결 유지)

1. **사용자**가 파란 줄에서 「그」를 직접 찍어 `줄바꿈 · 그`인지 확인 (에이전트 synthetic ≠ 최종 합격).
2. isTrusted true conflict가 남아 있으면 §10에 추가 — source 우선순위는 그때까지 동결.
3. soft-wrap·맞춤법 하이라이트는 별 스냅샷.

---

## 12. 관련 파일

- `src/components/PdfViewer.jsx` (좌표·이벤트만 → `resolveLayoutPointHit`)
- `src/components/MainScreen.jsx` (`textHitMode`)
- `src/hooks/useManuscriptWorkbench.js` (`onTextSelected` / `appendLayoutMark`)
- `src/lib/layoutMark/addLayoutMark.js`
- `src/lib/layoutMark/layoutMarkReplace.js` (`extractStartEojeol`)
- `src/lib/manuscriptWorkbench/resolveLayoutPointHit.js` (DOM→glyph 정책)
- `src/lib/manuscriptWorkbench/textLayerHitFromClient.js`
- `src/lib/manuscriptWorkbench/pageGeometry.js` (`pickCandidateItemBoxes` 단일)
- `src/lib/pdfService.js` (`phraseLocalRangesInItems` / `clipMatchToItemLocals`)

---

## 13. 한 줄 요약

**「그」→「모습을」은 DOM이 공백을 빼고 어절 틈 중점을 「모」에 준 것이 주원인. 틈→앞글자·공백 박스 포함으로 synthetic 파란 줄(그/공백/모습을/그리/어찌)은 맞음. 사용자 마우스 합격 확인이 남았다. source 우선순위(DOM→glyph)는 그대로.**
