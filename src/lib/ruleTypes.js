/** @typedef {'literal' | 'regex'} RulePattern */

/**
 * @typedef {'compound-find' | 'compound-tail' | 'compound-spacing' | 'phrase-slot-find' | 'auxiliary-verb' | 'custom-regex'} RuleKind
 */

/**
 * @typedef {Object} Rule
 * @property {string} find
 * @property {string} replace
 * @property {boolean} enabled
 * @property {boolean} [builtIn]
 * @property {RulePattern} [pattern] — 기본 literal
 * @property {string} [label] — 목록 표시용
 * @property {RuleKind} [patternKind]
 * @property {string} [tailWord] — 일관성 등록 문자열 (˅ = 공백 위치)
 * @property {string[]} [excludePrefixes] — 이 앞말($1)이면 검사 제외
 * @property {string[]} [excludePhrases] — 이 구문 전체가 매칭되면 제외
 * @property {'spelling' | 'consistency' | 'caution' | 'custom'} [category]
 * @property {string} [cautionId]
 * @property {string[]} [cautionStems]
 * @property {string} [tip] — 시트 tip (맞춤법 결과 안내)
 * @property {string} [memo] — 시트 memo (관리용)
 * @property {boolean} [countsInQuota] — false면 1000개 한도·맞춤법 확인 (N/M) 집계에서 제외
 * @property {boolean} [visible] — false면 규칙 목록 UI에만 숨김(검사는 enabled로 제어)
 * @property {string} [dividerGroup] — 맞춤법 목록 구분선 묶음 키(같은 값끼리는 구분선 없음)
 * @property {string} [overlayReplace] — 시트 overlay_replace: PDF 하이라이트 위 표시 문구
 * @property {boolean} [consistencyUnifyEntry] — 통일형 만들기에서 등록한 일관성 항목
 * @property {boolean} [consistencyUnifyPinned] — 통일형 만들기에서 📌로 지정한 통일형
 * @property {boolean} [consistencyLiteralEntry] — 일관성 찾기에서 등록한 항목
 * @property {boolean} [requireLeadingBoundary] — true면 앞에 글자/숫자가 붙은 매칭은 제외
 * @property {string} [bonBojoItemId] — bon-bojo 시트 item_id; 목록·체크는 항목 단위
 */

export const MAX_RULES = 1000;
