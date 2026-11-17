# 본조 UI — 마스터 체크 3줄

**상태:** 구현 (2026-11-17)

## 요약

- 일관성 탭·프로젝트 허브에서 본용언+보조용언 기준은 **체크 3줄**만 보인다.
- 엔진·시트·결과 그룹(`displayLabel`별)은 **기존 16 itemId** 그대로다.
- **표기 통일과 분리:** 본조 결과·원고/검사 띄움·붙임 집계는 본조 결과 패널에만 둔다. 표기 통일 추천에 배지·점프·시드를 넣지 않는다.

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

## 본조 결과 (본조 전용)

- 결과 카드: 그룹별 `원고 … · 검사 …` 띄움/붙임 건수.
- **2-1:** `auxiliaryVerbDocStemScan.js` — 활성 itemId stem 쌍으로 `pageTexts` 전수 집계.
- **원고만 행:** 검사 0건·원고 stem 있음 → UI에 빈 결과 카드(`buildAuxiliaryDocOnlyResultGroups`). 엔진 결과에는 넣지 않음.
