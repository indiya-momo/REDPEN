/**
 * PDF 교정본 주석 — 화면에 보이는 검수 결과 → 주석 목록.
 */
import {
  highlightRangeForCaution,
  highlightRangeForSpelling,
  relocateMatchedTextRange,
} from '../pdfHighlightRange.js';
import { getHighlightOverlayReplace } from '../highlightOverlayReplace.js';
import { classifyAnnotStyle } from './annotClassify.js';

/**
 * @typedef {Object} AnnotFinding
 * @property {number} pageNum
 * @property {'spelling' | 'unify'} source
 * @property {import('./annotClassify.js').AnnotStyle} style
 * @property {number} start page.text 기준
 * @property {number} end
 * @property {string} found
 * @property {string} replacement
 * @property {string} label 주석 위 빨간 글씨 (교정 기호는 빈 문자열)
 * @property {string} contents /Contents
 * @property {string} subject /Subj
 */

/** @param {string | undefined} category */
function categoryName(category) {
  if (category === 'caution') return '검토';
  if (category === 'loanword') return '외래어 표기';
  return '맞춤법';
}

/**
 * @param {import('../pdfService.js').PageData} page
 * @param {object} group
 * @param {object} inst
 * @param {boolean} isCaution
 */
function rangeForInstance(page, group, inst, isCaution) {
  if (Array.isArray(inst.itemIndexes) && inst.itemIndexes.length) {
    const len = Math.max(String(inst.matchedText ?? '').length, 1);
    if (page.text.slice(inst.index, inst.index + len) === inst.matchedText) {
      return { start: inst.index, end: inst.index + len };
    }
    return relocateMatchedTextRange(page.text, inst.matchedText, inst.index ?? 0);
  }
  return isCaution
    ? highlightRangeForCaution(page, inst)
    : highlightRangeForSpelling(page, inst);
}

/**
 * @param {{
 *   spellingEntries?: Array<{ group: object, source: string }>,
 *   unifyGroups?: object[],
 *   pageTexts: import('../pdfService.js').PageData[],
 *   isInstanceVisible?: (source: string, group: object, inst: object) => boolean,
 * }} input
 * @returns {AnnotFinding[]}
 */
export function collectAnnotFindings({
  spellingEntries = [],
  unifyGroups = [],
  pageTexts,
  isInstanceVisible,
}) {
  /** @type {Map<number, import('../pdfService.js').PageData>} */
  const pageByNum = new Map((pageTexts ?? []).map((p) => [p.pageNum, p]));
  /** @type {AnnotFinding[]} */
  const out = [];
  const seen = new Set();

  /** @param {AnnotFinding} f */
  const push = (f) => {
    const key = `${f.pageNum}:${f.start}:${f.end}:${f.style}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(f);
  };

  for (const { group, source } of spellingEntries) {
    if (source !== 'spelling' || !group) continue;
    const isCaution = group.category === 'caution';
    for (const inst of group.instances ?? []) {
      if (isInstanceVisible && !isInstanceVisible('spelling', group, inst)) continue;
      const page = pageByNum.get(inst.pageNum);
      if (!page?.text) continue;
      const range = rangeForInstance(page, group, inst, isCaution);
      if (!range || range.end <= range.start) continue;
      const found = page.text.slice(range.start, range.end);
      const replacement = String(inst.suggestedText ?? '').trim();
      const style = classifyAnnotStyle({ source: 'spelling', group, inst, found, replacement });
      const tip = String(group.tip ?? '').trim();
      const oneLine = found.replace(/\s*\n\s*/g, ' ');
      let label = '';
      let contents = '';
      if (style === 'review') {
        let overlay = null;
        try {
          overlay = getHighlightOverlayReplace(inst, { group });
        } catch {
          overlay = null;
        }
        label = String(overlay || group.label || '검토').trim();
        contents = `[검토] ${group.label ?? ''}${tip ? `\n${tip}` : ''}\n찾은 말: ${oneLine}`;
      } else {
        label = style === 'strike' ? replacement : '';
        contents = `${oneLine} → ${replacement}${tip ? `\n${tip}` : ''}`;
      }
      push({
        pageNum: inst.pageNum,
        source: 'spelling',
        style,
        start: range.start,
        end: range.end,
        found,
        replacement,
        label,
        contents,
        subject: style === 'review' ? '검토' : categoryName(group.category),
      });
    }
  }

  for (const group of unifyGroups ?? []) {
    // 사용자가 통일형을 고른 묶음만, 통일형이 아닌 표기만
    // 통일형의 붙임 표시(^, ⁀)는 빼고 띄움 표시(∨)는 공백으로 — 띄어쓰기만 다르면 교정기호로
    const chosen = String(group?.replace ?? '').replace(/[\^\u2040]/g, '').replace(/\u2228/g, ' ').trim();
    if (!group?.overlayReplace || !chosen || group.find === chosen) continue;
    for (const inst of group.instances ?? []) {
      if (isInstanceVisible && !isInstanceVisible('consistency', group, inst)) continue;
      const page = pageByNum.get(inst.pageNum);
      if (!page?.text) continue;
      const range = rangeForInstance(page, group, inst, false);
      if (!range || range.end <= range.start) continue;
      const found = page.text.slice(range.start, range.end);
      const style = classifyAnnotStyle({ source: 'unify', group, inst, found, replacement: chosen });
      push({
        pageNum: inst.pageNum,
        source: 'unify',
        style,
        start: range.start,
        end: range.end,
        found,
        replacement: chosen,
        label: style === 'unify-box' ? String(group.overlayReplace) : '',
        contents: `[표기 통일] ${found.replace(/\s*\n\s*/g, ' ')} → ${chosen}`,
        subject: '표기 통일',
      });
    }
  }

  out.sort((a, b) => a.pageNum - b.pageNum || a.start - b.start);
  return out;
}
