# 해 보이는 — 보다 오분류 / 보이다 띄어쓰기 필수

**일자:** 2026-11-18  
**상태:** A·B 반영.  
**사례:** book_part2 p32 `자비롭기만 해보이는` → 편집 기준 `해 보이는`(붙여 쓰기 불가).

---

## 문제

- 시트 `해 보`는 UI 칸 **(아/어) + 보다 · 붙여쓰기 가능**(`verb-boda1`, `GLUE_OPTIONAL`)에 있었다.
- 패턴이 `보` + `STEM_TAIL_END`라서 **보이다** 활용(`보이는`)까지 먹었다.
- 그래서 `해보이는`이 «붙여도 된다» 줄로 올라와 편집 기준과 어긋났다.

---

## 반영

### A — 보다 오분류 차단

`AUX_TAIL_FORBIDDEN_AFTER.보`에 **`이|일|여|였`** 추가.

| 표면 | A 이후 |
|------|--------|
| `해 봐` / `해 본` / `해 보` | 보다 유지 |
| `해 보이는` / `해보일` / `해보여` | 보다 줄에서 **제외** |

### B — 보이다 띄어쓰기 필수

| | |
|--|--|
| item | `verb-boida` |
| 라벨 | `(아/어) + 보이다` |
| stems | `해/어/아` + `보이·보인·보일·보여·보였` |
| UI | `SPACE_REQUIRED` (`bonBojoUiGroupForItemId`) |
| 동작 | 1차 띄움 + 붙임 보강 → `해보이는` → `해 보이는`, ∨ |

**시트 sync 주의:** `npm run sync-bon-bojo`는 구글 시트만 쓰므로 `verb-boida`를 지운다. 시트에 행을 추가하거나, sync 후 로컬 항목을 다시 넣어야 한다.

**체크박스:** `SPACE_REQUIRED`는 `verb-boida`+`verb-long-compound-split`을 `every`로 본다. 새 item이 생기면 형제만 켜진 저장은 재시드 때 같이 켜고, 시트 새로고침은 최신 `customRules` 기준으로 덮는다.

**형태소 2차:** `pruneAuxiliaryFalseMorph`는 fail-closed(미분석·비용언 버림). enrich 전 로컬 미준비면 Kiwi prefetch → 남는 표면은 바른(`/api/bareun/analyze`, `BAREUN_API_KEY`)으로 채움. 1차 regex 비용 변화 없음.

---

## 관련 코드

- stems: `src/data/bon-bojo-rules.json` → `verb-boida`
- UI 칸: `bonBojoUiGroupForItemId('verb-boida')` → `SPACE_REQUIRED`
- `보` 금칙: `src/lib/auxiliaryVerbPattern.js` → `AUX_TAIL_FORBIDDEN_AFTER`
- 붙임 보강: `src/lib/auxiliaryGluedFromSpaced.js`
- ∨: `src/lib/highlightOverlayReplace.js` (띄어쓰기 필수 칸만)
