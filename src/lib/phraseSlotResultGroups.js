/**
 * 공통 항목 찾기(@패턴) 결과를 채워진 표기별로 묶고 정렬한다.
 * 정렬: 건수 내림차순 → 같으면 첫 등장 페이지 오름차순 → 표기 문자열.
 */

/**
 * @typedef {{
 *   text: string,
 *   count: number,
 *   firstPage: number,
 *   instances: import('./ruleEngine.js').MatchInstance[],
 * }} PhraseSlotFillGroup
 */

/**
 * @param {import('./ruleEngine.js').MatchInstance[]} instances
 * @returns {PhraseSlotFillGroup[]}
 */
export function groupPhraseSlotInstancesByFill(instances) {
  /** @type {Map<string, import('./ruleEngine.js').MatchInstance[]>} */
  const byText = new Map();
  for (const inst of instances ?? []) {
    const text = String(inst?.matchedText ?? '');
    if (!text) continue;
    const list = byText.get(text);
    if (list) list.push(inst);
    else byText.set(text, [inst]);
  }

  /** @type {PhraseSlotFillGroup[]} */
  const groups = [];
  for (const [text, list] of byText) {
    let firstPage = Number.POSITIVE_INFINITY;
    for (const inst of list) {
      const page = Number(inst?.pageNum);
      if (Number.isFinite(page) && page < firstPage) firstPage = page;
    }
    if (!Number.isFinite(firstPage)) firstPage = 0;
    groups.push({
      text,
      count: list.length,
      firstPage,
      instances: list,
    });
  }

  groups.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.firstPage !== b.firstPage) return a.firstPage - b.firstPage;
    return a.text.localeCompare(b.text, 'ko');
  });

  return groups;
}
