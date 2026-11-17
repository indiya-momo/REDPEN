/**
 * TXT 줄바꿈 확인 — 애매한 줄 이음만 모아 사람이 붙임/줄유지를 고른다.
 */
import {
  isHangulSyllableChar,
  isLikelyHangulEojeolBoundary,
  isUnifyHangulMidWordSoftWrap,
} from './pdfPageText.js';

const SENTENCE_END_RE = /[.!?…。」』》]$/u;
const MAX_CANDIDATES = 80;
/** 1음절이어도 줄 끝 어절로 완결된 말로 보는 것 — 모달 후보에서 제외 */
const COMPLETE_ONE_SYLLABLE_EOJEOL = new Set([
  '때',
  '것',
  '수',
  '중',
  '후',
  '전',
  '등',
  '및',
  '또',
  '더',
  '곧',
  '단',
  '속',
  '안',
  '밖',
  '위',
  '아래',
]);

/**
 * @typedef {{
 *   id: string,
 *   pageNum: number,
 *   lineIndex: number,
 *   left: string,
 *   right: string,
 *   defaultDecision: 'join' | 'keep',
 * }} LinebreakCandidate
 */

/**
 * 모달에 올릴 후보만. 기본은 줄 유지 — 사용자가 고른 붙이기만 적용.
 * @param {string} left
 * @param {string} right
 * @returns {'join' | 'keep' | null} null = 후보 아님
 */
export function classifyLinebreakPair(left, right) {
  const L = String(left ?? '').replace(/\s+$/u, '');
  const R = String(right ?? '').replace(/^\s+/u, '');
  if (!L || !R) return null;
  if (SENTENCE_END_RE.test(L)) return null;

  const last = L[L.length - 1];
  const first = R[0];
  if (!isHangulSyllableChar(last) || !isHangulSyllableChar(first)) return null;

  // 단어 중간 soft-wrap(명|지)만 후보. 기본 keep — 때|손 같은 완결 어절은 제외.
  if (!isUnifyHangulMidWordSoftWrap(L, R)) return null;
  if (isLikelyHangulEojeolBoundary(L, R)) return null;
  const lastEojeol = L.split(/\s+/u).filter(Boolean).pop() ?? '';
  if (COMPLETE_ONE_SYLLABLE_EOJEOL.has(lastEojeol)) return null;
  return 'keep';
}

/**
 * @param {{ pageNum: number, lines: string[] }[]} pages
 * @returns {LinebreakCandidate[]}
 */
export function findLinebreakCandidates(pages) {
  /** @type {LinebreakCandidate[]} */
  const out = [];
  for (const page of pages ?? []) {
    const lines = page.lines ?? [];
    for (let i = 0; i < lines.length - 1; i += 1) {
      const def = classifyLinebreakPair(lines[i], lines[i + 1]);
      if (!def) continue;
      out.push({
        id: `${page.pageNum}:${i}`,
        pageNum: page.pageNum,
        lineIndex: i,
        left: lines[i],
        right: lines[i + 1],
        defaultDecision: def,
      });
      if (out.length >= MAX_CANDIDATES) return out;
    }
  }
  return out;
}

/**
 * @param {{ pageNum: number, lines: string[] }[]} pages
 * @param {Record<string, 'join' | 'keep'>} decisions
 * @returns {string}
 */
export function applyLinebreakDecisions(pages, decisions = {}) {
  /** @type {string[]} */
  const blocks = [];
  for (const page of pages ?? []) {
    const lines = page.lines ?? [];
    if (!lines.length) continue;
    let buf = lines[0];
    for (let i = 0; i < lines.length - 1; i += 1) {
      const id = `${page.pageNum}:${i}`;
      const decision = decisions[id] ?? 'keep';
      if (decision === 'join') {
        buf += lines[i + 1];
      } else {
        buf += `\n${lines[i + 1]}`;
      }
    }
    blocks.push(buf.replace(/\s+$/u, ''));
  }
  return blocks.filter(Boolean).join('\n\n');
}

/**
 * 검수전(쪽 표식 포함) 본문.
 * @param {{ pageNum: number, lines: string[] }[]} pages
 * @returns {string}
 */
export function joinPagesWithMarkers(pages) {
  /** @type {string[]} */
  const blocks = [];
  for (const page of pages ?? []) {
    const body = (page.lines ?? []).join('\n').replace(/\s+$/u, '');
    if (!body) continue;
    if (blocks.length === 0) blocks.push(body);
    else blocks.push(`--- p.${page.pageNum} ---\n${body}`);
  }
  return blocks.join('\n\n');
}
