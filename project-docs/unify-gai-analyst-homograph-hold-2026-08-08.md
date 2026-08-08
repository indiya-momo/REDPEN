# 표기통일 — `가`/`이`·분석가 오탐 (보류 2026-08-08)

## 합의 (미구현)

1. **`가`/`이`는 통일 후보에서 떼지 않는다** (휴리스틱·Kiwi 둘 다).  
   `경제분석` vs `경제분석가`는 **다른 말**로 둔다.
2. `을/를/은/는/도/만/의/과/와…`처럼 덜 헷갈리는 조사만 제거.
3. 코드 패치는 **일단 하지 않음** — 이 문서만 남김.

## 증상

- 1차 목록에 `경제 분석` N회.
- 실제로는 `경제 분석가`(분석가)와 `경제 분석`이 섞임.
- 하이라이트가 `경제 분석가`까지 칠해짐.

## 원인 (코드 확인 요약)

| 층 | 동작 | 결과 |
|----|------|------|
| **휴리스틱 strip** | 이미 `가`/`이`는 안 뗌 | 단독으로는 분석가→분석 안 됨 |
| **Kiwi strip** | morph 경계로 `…+가(JKS)`면 여전히 뗄 수 있음 | 플래그 ON 시 분석가 붕괴 가능 |
| **잡음 조사 휴리스틱** | `isSpacedLeftJosaNoiseEojeol('분석가')` → stem`분석`+`가` → **DROP** | 띄움 `경제 분석가`가 후보에서 탈락. 붙임 `경제분석가`만 남거나 충돌 클러스터 미성립 |
| **rematerialize** | `collectUnifyPhraseStarts`가 `indexOf` 부분일치 | `경제 분석` ⊂ `경제 분석가`, `경제분석` ⊂ `경제분석가` → 횟수·칩 부풀림 |

재현 스케치 (raw index):

```text
text: 경제 분석가와 경제분석가. 경제 분석과 경제분석.
→ 충돌 클러스터 key=경제분석 counts { 경제 분석:2, 경제분석:2 }
→ key=경제분석가 는 붙임만·또는 없음 (띄움은 잡음 DROP)
```

## 나중에 손댈 때 (최소 후보)

핫패스 비용·회귀 큼 → **승인 후 한 축만**.

1. **Kiwi `skipGaI`** — `stripTrailingJosaFromTokens` / unify 호출부에 `가`·`이`만 있는 끝 조사는 null (heuristic과 동일 정책).
2. **잡음** — 띄움 어절에서 `가`/`이`를 조사로 벗겨 DROP하지 않기 (`SPACED_LEFT_*`에서 제외). `내가`·`주식시장이` 회귀 테스트 필수.
3. **경계** — `collectUnifyPhraseStarts` / rematerialize: 매치 뒤 한글 꼬리가 비어 있거나 **가·이 제외** 끝조사일 때만 인정 (`경제 분석과` OK, `경제 분석가` 거부).

탈락(당장 비추): 1차 전수 Kiwi 경계 게이트, 분석가 예외 JSON 나열만으로 때우기.

## 관련 파일

- `src/lib/unifyCandidateNormalize.js` — `stripTrailingJosaHeuristic`
- `src/lib/kiwiMorph/stripTrailingJosa.js`
- `src/lib/unifyNoiseListLeftHeuristic.js` — `isSpacedLeftJosaNoiseEojeol`
- `src/lib/unifyCandidateDiscover.js` — `prepareUnifyOccurrenceCandidate`, `collectUnifyPhraseStarts`, `rematerializeConflictOccurrencesFromPageText`

## 상태

**보류.** 구현·커밋 없음 (2026-08-08).
