/**
 * PDF 교정본 주석 — 발견 분류 (띄어쓰기만 / 검토 항목).
 */

/** @param {string} s */
const compact = (s) => String(s ?? '').replace(/\s+/g, '');

/**
 * 찾은 말과 고칠 말이 띄어쓰기(공백·줄바꿈)만 다른가.
 * @param {string} found
 * @param {string} replacement
 */
export function isSpacingOnlyChange(found, replacement) {
  const a = String(found ?? '');
  const b = String(replacement ?? '');
  if (!a || !b) return false;
  if (a.replace(/\s+/g, ' ') === b.replace(/\s+/g, ' ')) return false;
  return compact(a) === compact(b) && compact(a).length > 0;
}

/**
 * 띄어쓰기 교정 위치. index는 found 안 글자 인덱스.
 * - insert: found[before]와 found[after] 사이에 띄움표
 * - join: found[before]와 found[after] 사이 공백(들)에 붙임표
 * @param {string} found
 * @param {string} replacement
 * @returns {Array<{ type: 'insert' | 'join', before: number, after: number }>}
 */
export function spacingEditOps(found, replacement) {
  const a = String(found ?? '');
  const b = String(replacement ?? '');
  /** @type {Array<{ type: 'insert' | 'join', before: number, after: number }>} */
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const fc = a[i];
    const sc = b[j];
    if (fc !== undefined && fc === sc) {
      i += 1;
      j += 1;
      continue;
    }
    if (fc !== undefined && /\s/.test(fc)) {
      let k = i;
      while (k < a.length && /\s/.test(a[k])) k += 1;
      if (sc !== undefined && /\s/.test(sc)) {
        // 공백 수만 다름 — 고칠 것 없음
        j += 1;
        i = k;
        continue;
      }
      if (i > 0 && k < a.length) ops.push({ type: 'join', before: i - 1, after: k });
      i = k;
      continue;
    }
    if (sc !== undefined && /\s/.test(sc)) {
      if (i > 0 && i < a.length) ops.push({ type: 'insert', before: i - 1, after: i });
      j += 1;
      continue;
    }
    i += 1;
    j += 1;
  }
  return ops;
}

/**
 * 편집자 검토 항목인가 — caution 전부, 맞춤법 중 고칠 말이 없거나 같거나 후보가 여럿.
 * @param {{ category?: string } | null | undefined} group
 * @param {{ matchedText?: string, suggestedText?: string } | null | undefined} inst
 */
export function isEditorReviewFinding(group, inst) {
  if (group?.category === 'caution') return true;
  const sug = String(inst?.suggestedText ?? '').trim();
  const found = String(inst?.matchedText ?? '').trim();
  if (!sug) return true;
  if (sug === found) return true;
  return /[/,]/.test(sug);
}

/**
 * @typedef {'spacing-mark' | 'strike' | 'unify-box' | 'review'} AnnotStyle
 */

/**
 * @param {{ source: 'spelling' | 'unify', group: object, inst: object, found: string, replacement: string }} f
 * @returns {AnnotStyle}
 */
export function classifyAnnotStyle(f) {
  if (f.source === 'spelling' && isEditorReviewFinding(f.group, f.inst)) return 'review';
  if (isSpacingOnlyChange(f.found, f.replacement)) return 'spacing-mark';
  return f.source === 'unify' ? 'unify-box' : 'strike';
}
