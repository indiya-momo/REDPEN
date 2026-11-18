# 본조 붙임 오탐 · 원고 실측 (2026-11-18)

**상태:** 5절 반영 완료(커밋 `8e58d8a`). 추가 금칙·짧은어절 규칙은 **넣지 않음**.  
**후속:** 접힘 사용은 PostHog `aux_solid_fold`로 집계. 완전 제거는 배포 후 펼침 빈도를 본 뒤.  
**관련:** `어두운` → `두←운|워|웠|움` + VA 단독 DROP은 이미 반영.

---

## 1. 측정 방법

- stem 시트 붙임 regex(현행 `AUX_TAIL_FORBIDDEN_AFTER` 포함) → 표면 수집  
- Kiwi `isConfirmedAuxiliaryMorph` → KEEP / DROP  
- 시뮬: 「한글 2음절 이하 + VX 없음 → 버림」  
- 스크립트: `scripts/_probe_aux_keep_book_part2.mjs`

---

## 2. 원고별 요약

| PDF | 쪽 | raw 붙임 | KEEP 고유(합) | DROP 표면 | 2음절+VX없음 시뮬 |
|-----|----|----------|---------------|-----------|-------------------|
| book_part2.pdf | 34 | 73 | 62 (66) | 6 | **0** |
| 261117_경주멍-본문 2교지_검토중_.pdf | 116 | 275 | 204 (242) | 22 | **0** |

### 관심 가정 오탐 (경주멍)

| 표면 | 결과 |
|------|------|
| 어두운·고마운·어지러운·아나·어가·여보 | 원고에 없음 |
| 아주 | DROP×5 |
| 해가 | DROP×2 |
| 아내가·아들딸에게 | DROP |

### 두다 KEEP (경주멍) — 보조로 타당

| 표면 | stem | 형태소 |
|------|------|--------|
| 숨겨둔 | 겨 둔 | 숨기/VV + 두/VX |
| 달아둔 | 아 둔 | 닫 + 두/VX |

---

## 3. 판단 (합의 반영)

1. **금칙 이어짐 추가** (`두←컴`, `지←러운`, `마←운…`)  
   - 언어적으로 안전하나, 위 원고에서는 **화면 KEEP을 바꾸지 않음**.  
   - `AUX_TAIL_FORBIDDEN_AFTER`는 **regex 매칭 로직** → 베타 freeze 대상.  
   - **지금은 넣지 않음.** 오탐이 화면에 남은 원고이 나오면 그때 빈도 보고 검토.

2. **「짧은 붙임 + VX 없음」 규칙**  
   - 두 원고 모두 시뮬 **0건**.  
   - **보류.** 다른 원고에서 KEEP 중 짧은+VX없음 목록이 쌓이면 재검토.

3. **정확 금지어** (`아내` 등)  
   - 형태소 DROP으로 이미 처리. **보류.**

4. **장기: 보조별 허용 어미 allowlist**  
   - 매칭 구조 변경 → **베타 이후**.

---

## 4. VX 없음 × 표준국어대사전 (경주멍)

스크립트: `scripts/_probe_aux_solid_novx.mjs` (로컬 `127.0.0.1:5173/api/stdict`)

| 구분 | 고유 | 합 |
|------|------|-----|
| VX 없음 KEEP | 137 | 163 |
| lemma 있음 + **등재 YES** (합성어 표시 대상) | **122** | **147** |
| lemma 있음 + 등재 NO | 10 | 11 |
| lemma 없음 | 5 | 5 |

등재 YES 예: `들여다보다`, `바라보다`, `좋아하다`, `이어지다`, `잃어버리다`, `들어오다` …  
→ 제품 `enrichAuxiliaryDictSolid`가 **붙임+등재**면 `auxDictSolid`만 달고 **목록에 남김**.

등재 NO·lemma 오류 예: `튀어나다`(←튀어나오다), `피어오다`(←피어오르다), `손잡이라지다`, `함께였으려나다`.

lemma 없음 예: `해보이는`(본+보이다, 타당), `퍼지며`, `아들인`(NNG+VCP — VA 제외 후에도 VCP로 KEEP).

---

## 5. 반영 (2026-11-18)

### (1) VCP-only DROP — 완료

`isConfirmedAuxiliaryMorph`: VV/VX/XSV만 인정 (VA·**VCP** 단독 제외).  
`이어보이다` 등은 VV라 KEEP. 경주멍 lemma없음·등재NO 중 VCP 오탐: `아들인`, `손잡이라지만`, `함께였으려나`.

**freeze 판단:** `auxiliaryMorphFilter.js`는 **매칭 후 필터**다.  
베타 freeze(`ruleEngine` · regex · spelling/caution **매칭** 로직) 밖으로 해석해 반영했다.  
(이미 들어간 VA-only DROP과 동일 층. `AUX_TAIL_FORBIDDEN_AFTER` 금칙 추가는 regex라 보류.)

### (2) 접힌 「합성어」칸 — 완료

- UI만 (`CheckResultsPanel` + CSS). **ruleEngine/regex freeze 파일 아님.**
- **접는 대상:** `auxDictSolid` (이미 붙여 쓴·사전 등재)만.
- **안 접음:** 띄움→붙임 제안(spaced solid) — 편집자 판단 대상.
- 펼침 시 PostHog `aux_solid_fold` (`open`, `count_bucket`만 · 원고 텍스트 없음).  
  (`console.info`는 베타 사용자 콘솔을 볼 수 없어 집계에 쓰지 않음.)
- 완전 제거는 배포 후 펼침 빈도를 본 뒤.

### 테스트 덮개 (보고 보완)

| 동작 | 고정 위치 |
|------|-----------|
| VCP-only DROP (`아들인`) | `auxiliaryMorphFilter.test.js` 토큰 fixture |
| VV KEEP (`이어보이다`) | 같은 파일 — VV+보이 fixture |
| `해보이는` KEEP | Kiwi `analyzeLine` + `pruneAuxiliaryFalseMorph` |
| 접힘 대상 = `auxDictSolid`만 | `auxiliaryDictSolid.test.js` 헬퍼 |
| 접힘 `<details>` 렌더 | **컴포넌트/화면 테스트 없음** (코드 경로만 확인) |

### 15건 사람 판독 (등재NO 10 + lemma없음 5)

| 표면 | 판정 |
|------|------|
| 튀어나와·튀어나온 | 실단어(튀어나오다). lemma 오분석 → 합성어 미표시 |
| 되어가는·내어주겠죠 | 보조/합성 후보로 타당 |
| 불러들이고·받아들이고·피어오른·피어오를 | 실단어. lemma 끝음절 오분석 |
| 손잡이라지만·함께였으려나·아들인 | **오탐** → VCP DROP으로 제거 |
| 해보이는 | 보조 타당 (lemma 없음 OK) |
| 해보셔요·퍼지며·퍼졌습니다 | 합성·단일동사 쪽 |

---

## 6. 남은 소음 · 다음 정리 후보 (별건)

새 규칙이 VV를 모두 KEEP하므로 **단일 동사 vs 보조**를 구분하지 못한다.  
목록에 계속 남는 예: `튀어나온`·`받아들이고`류, `퍼지며`류.

**lemma 오분석 (코드 확인):** `gluedCompoundLemma`가 표면 안에서 보조 onset을 찾은 뒤  
`앞부분 + 보조기본형`으로 표제어를 만든다. onset이 짧게 잡히면  
`튀어나온`→`튀어나다`, `피어오른`→`피어오다`처럼 **꼬리만 맞는 잘못된 lemma**가 난다.  
이번 슬라이스에서는 손대지 않음. 15건 중 약 10건이 이 계열 → **다음 정리 후보로 기록만.**

---

## 7. 재현

```text
node --import ./scripts/_json-import-hook.mjs scripts/_probe_aux_keep_book_part2.mjs "PDF경로"
node --import ./scripts/_json-import-hook.mjs scripts/_probe_aux_solid_novx.mjs "PDF경로"
```
