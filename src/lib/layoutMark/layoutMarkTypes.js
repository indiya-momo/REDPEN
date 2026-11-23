/**
 * 조판 기호 1차: 줄바꿈 · 행갈이 · 들여쓰기 (내어는 다음).
 * @typedef {'paraSplit' | 'paraGap' | 'indent' | 'outdent'} LayoutMarkKind
 */

/** @type {readonly LayoutMarkKind[]} */
export const LAYOUT_MARK_KINDS_PHASE1 = Object.freeze([
  'paraSplit',
  'paraGap',
  'indent',
]);

export const LAYOUT_MARK_SOURCE = 'layout-mark';

/** 들여쓰기 Replace에 넣는 전각 1자 (디자이너가 단락 속성으로 다시 볼 수 있음) */
export const LAYOUT_INDENT_SPACE = '\u3000';

/** @type {Record<LayoutMarkKind, string>} */
export const LAYOUT_MARK_LABELS = Object.freeze({
  paraSplit: '줄바꿈',
  paraGap: '행갈이',
  indent: '들여쓰기',
  outdent: '내어쓰기',
});

/**
 * @typedef {{
 *   id: string,
 *   pageNum: number,
 *   index: number,
 *   kind: LayoutMarkKind,
 *   tip?: string,
 *   before?: string,
 *   after?: string,
 *   source: typeof LAYOUT_MARK_SOURCE,
 * }} LayoutMark
 */
