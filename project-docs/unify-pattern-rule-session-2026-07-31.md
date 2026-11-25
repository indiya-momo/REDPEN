# 표기 통일 추천 — 세션 patternRule (접미 계열 편측 확장)

**상태:** 초안·부분 구현 — **플로우 설계는 아래 문서로 대체**  
**대체:** [`unify-phase2-pattern-2026-07-31.md`](./unify-phase2-pattern-2026-07-31.md)  
**날짜:** 2026-07-31

## 요약

초기에는 개별 쌍 확정 직후 confirm → 인라인 미리보기를 넣었다.  
이후 합의로 **1차 완결 → 2차-A 패턴 선택 → 2차-B 쌍 목록** 순차로 바꿨다.  
유틸(`unifyPatternRule.js`)은 재사용하되 UI 트리거는 새 설계를 따른다.

## 코드 (유틸)

- `src/lib/unifyPatternRule.js`
- (구) `UnifyCandidateFindPanel` confirm·인라인 미리보기 — 새 플로우 구현 시 제거·이전
