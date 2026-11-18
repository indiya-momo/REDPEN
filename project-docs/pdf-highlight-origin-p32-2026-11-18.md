# 화면 하이라이트 원점 — book_part2 p32

**일자:** 2026-11-18  
**대상:** `뛰지말라는` 밑줄·∨가 글리프와 어긋남. 밑줄과 ∨는 같은 박스를 씀.

---

## 결론 (재개 후)

| 가설 | 결과 |
|------|------|
| 1. `inst.index` / `itemRefs` 1글자 어긋남 | **기각** — 제품 경로(`dedupeOverlayTextItems` → `buildPageText`)에서 refs↔items 불일치 0. ∨ 마크 local=22 = `말` 시작. |
| 2. `item.width` ≠ 캔버스 렌더 폭 (Tw) | **채택** — 연산자 목록 글리프 원점 대비 비율 분할이 ∨에서 **약 −0.9글자(−7.5pt)**. |

원인: `getTextContent`의 `item.width`는 유니코드 공백마다 Tw를 더하지만, 캔버스 `showText`는 `glyph.isSpace`(1바이트 32)일 때만 Tw를 더한다. Identity-H 공백 줄에서 비율 분할이 뒤로 갈수록 오른쪽으로 밀림.

**보정:** `eef79a9` — `pdfGlyphAdvances.js`로 캔버스와 같은 글리프 원점을 캐시하고, 화면(`viewportBoxForTextItem`)·주석(`segmentForItemSpan`) 모두 `getItemGlyphOffsets` 우선.

프로브:

- `scripts/_probe_glyph_vs_width_p32.mjs`
- `scripts/_probe_malda_align_prod.mjs` (JSON hook: `node --import ./scripts/_json-import-hook.mjs …`)
- `scripts/_probe_screen_annot_same_x_p32.mjs` — 화면 mid ↔ 주석 mid ↔ 글리프 경계

---

## 리뷰 로그 (단계 2 직전, 참고)

페이지 32, 한 TextItem.

| 항목 | 값 |
|---|---|
| 문자열 | `약사여래불 사이를 뛰어다니며 엄마의 뛰지말라는 채근을 듣던` |
| `item.width` | 263.443 |
| `str.length` | 32 |
| `뛰지말라는` local | 20 |
| ∨ local (`말`) | 22 |
| glyph∨ − prop∨ | ≈ −7.47pt ≈ −0.91글자 |

균등/measureText 비율만으로는 Δ≈1.5pt라 1글자 밀림을 설명 못 함 → Tw 가설로 전환한 것이 맞다.

---

## 남은 확인 (코드 패치 아님)

1. 브라우저에서 book_part2 p32 `뛰지말라는` ∨·밑줄이 글리프에 붙는지 (하드 리로드).
2. 같은 페이지 **교정 PDF 내보내기** 주석 ∨가 화면과 같은 자리인지.
3. 글리프 매칭 실패 item(폴백)이 있으면 그 페이지만 따로 목록화.

프로브 오진 주의: `buildPageText`만 돌리고 `items`를 dedupe 전 배열로 조회하면 itemIndex가 어긋나 보인다. 제품은 `pageData.items`가 이미 dedupe본이다.
