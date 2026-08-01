# Kiwi P2 구현 메모 (경계 게이트)

- 일시: 2026-08-02
- 플래그: `VITE_SPELLING_KIWI_BOUNDARY` (기본 OFF)
- 화이트리스트(승인): `NNG` `NNP` `NNB` `NR` `NP` `SL` `SH` `SN` `XSN` `XPN`

## 동작

- `matchFilters.shouldSkipMatch` 끝단에 Kiwi 게이트
- 표기통일: `enrichOccurrencesWithItemHits` 직전 `filterUnifyOccurrencesByKiwiBoundary` (칩·하이라이트만, 발견 스캔 비적용)
- 표기통일 발견: `경제다!라`(한글 사이 기호) · `경제다라`(Kiwi `VCP+EF|EC` 이다 종결) 제외
- 토큰 **중간** 부분일치 + 화이트리스트 태그 → **skip**
- 토큰 **정확 스팬**(뒤 조사 있어도 어간만 매치) → **keep**
- 미로드·1:1 실패·플래그 OFF → 현행(스킵 안 함)
- `ruleEngine` 본문 변경 없음

## 파일

- `src/lib/kiwiMorph/boundaryGate.js`
- `src/lib/kiwiMorph/boundaryGate.test.js`
- `src/lib/unifyCandidateDiscover.js` — `filterUnifyOccurrencesByKiwiBoundary`
