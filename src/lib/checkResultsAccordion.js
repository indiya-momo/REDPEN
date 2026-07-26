/**
 * 맞춤법 검수 결과를 1단 카테고리(편집자 검토 / 맞춤법 규칙 / 외래어)로 나눈다.
 * @param {Array<{ group: { category?: string }, source: string }>} entries
 * @returns {{
 *   caution: typeof entries,
 *   builtin: typeof entries,
 *   loanword: typeof entries,
 * }}
 */
export function partitionSpellingResultEntries(entries) {
  /** @type {typeof entries} */
  const caution = [];
  /** @type {typeof entries} */
  const builtin = [];
  /** @type {typeof entries} */
  const loanword = [];

  for (const entry of entries ?? []) {
    if (entry?.source !== 'spelling') continue;
    const cat = entry.group?.category;
    if (cat === 'caution') caution.push(entry);
    else if (cat === 'loanword') loanword.push(entry);
    else builtin.push(entry);
  }

  return { caution, builtin, loanword };
}

/**
 * 기본으로 펼칠 카테고리 — 편집자 검토 우선, 없으면 첫 비어 있지 않은 칸.
 * @param {{ caution: unknown[], builtin: unknown[], loanword: unknown[] }} parts
 * @returns {'caution' | 'builtin' | 'loanword' | null}
 */
export function defaultOpenSpellingCategory(parts) {
  if (parts.caution.length) return 'caution';
  if (parts.builtin.length) return 'builtin';
  if (parts.loanword.length) return 'loanword';
  return null;
}
