import { SPACE_VISIBLE_CHAR } from './spaceVisibleText.js';

const W = SPACE_VISIBLE_CHAR;

/** 한글 꼬리만 짧을 때 — 힌트와 같은 형태 예시 (등록값이 아님) */
const KR_SAMPLE_PREFIX = '우리';

/** @param {string} s */
function hasHangul(s) {
  return /[\uAC00-\uD7A3]/.test(s);
}

/**
 * 붙임 — 띄운 위치(˅)가 있으면 그대로, 한 글자 꼬리만 있으면 우리˅나라 형태 예시
 * @param {string} tail
 */
export function formatCompoundTailLabel(tail) {
  const parts = tail.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const head = parts.slice(0, -1).join('');
    return `${head}${W}${last} → ${head}${last}`;
  }
  const t = parts[0] ?? tail.trim();
  if (hasHangul(t)) {
    return `${KR_SAMPLE_PREFIX}${W}${t} → ${KR_SAMPLE_PREFIX}${t}`;
  }
  return t;
}

/**
 * 띄움 — 띄울 위치가 있으면 그대로, 한 글자 꼬리만 있으면 우리집 → 우리˅집 형태 예시
 * @param {string} tail
 */
export function formatCompoundSpacingLabel(tail) {
  const parts = tail.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const glued = parts.join('');
    const spaced = parts.join(W);
    return `${glued} → ${spaced}`;
  }
  const t = parts[0] ?? tail.trim();
  if (hasHangul(t)) {
    return `${KR_SAMPLE_PREFIX}${t} → ${KR_SAMPLE_PREFIX}${W}${t}`;
  }
  return t;
}
