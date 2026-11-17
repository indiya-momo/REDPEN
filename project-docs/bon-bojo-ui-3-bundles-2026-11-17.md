# 본조 UI — 마스터 체크 3줄

**상태:** 구현 (2026-11-17)

## 요약

- 일관성 탭·프로젝트 허브에서 본용언+보조용언 기준은 **체크 3줄**만 보인다.
- 엔진·시트·결과 그룹(`displayLabel`별)은 **기존 16 itemId** 그대로다.

## 3줄 ↔ itemId

| UI 라벨 | 묶음 키 | itemId |
|---------|---------|--------|
| 아/어 + 가다 외 (붙여쓰기 가능) | `glue-optional` | 가·나·보·오·… 13종 |
| 아/어 + 지다&하다 (붙여쓰기 필수) | `glue-required` | `verb-jida`, `verb-hada` |
| 본용언이 3음절 이상 복합어/파생어(띄어쓰기 필수) | `space-required` | `verb-long-compound-split` |

## 코드

- 묶음 정의: `listBonBojoBundleDefinitions()` (`bonBojoRules.js`)
- on/off: `toggleAuxiliaryVerbBundle`, `setAllAuxiliaryVerbBundles` (`auxiliaryVerbRegister.js`)
- UI: `AuxiliaryVerbBundleChecklist.jsx`

## 저장 프로젝트

규칙 배열은 여전히 itemId별 `enabled` 플래그. 묶음 중 일부만 켜진 경우 해당 줄은 **indeterminate**.

## Phase 1 — 붙임/띄움 함께 보기 (2026-11-17)

- **본조:** 띄움 맞춤법·2차 붙임 제안·3음절 띄움 (결과는 보조별 줄 유지).
- **표기 통일:** 문서 안 붙임↔띄움 이형태. bon-bojo stem이 걸리면 `auxReview` + 배지  
  `(아/어) + 보다 · 붙임/띄움 짝` (툴팁에 spaced/glued stem).
- **카피:** 본조 상자·표기 통일 추천 intro에 상호 안내 문구.
- **1-3:** 본조 결과 카드 「표기 통일에서 보기」 → 추천 패널 스크롤. `auxReview.itemId`가 같으면 클러스터 포커스, 없으면 찾기 안내. 자동 찾기는 하지 않음.

## Phase 2 — 본조 결과 띄움/붙임 건수 (2026-11-17)

- 결과 카드 헤더: 그룹별 `띄움 N건 · 붙임 M건` (`matchedText` 기준, 잡힌 표면만).
- 툴팁: 반대 형태만 있으면 표기 통일 추천 안내.
- **2-1:** `auxiliaryVerbDocStemScan.js` — 활성 itemId의 stem 쌍으로 `pageTexts` 전수 집계. 결과 카드에 `원고 … · 검사 …`.
- **원고만 행:** 검사 0건·원고 stem 있음 → UI에 빈 결과 카드(`buildAuxiliaryDocOnlyResultGroups`). 엔진 결과에는 넣지 않음.
- **미구현:** unify 시드 일괄 등록(2-3).