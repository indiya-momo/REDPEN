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
- **미구현:** 본조 결과에서 통일 패널로 점프(Phase 1-3), 본조 전용 듀얼 카운트(Phase 2).