/**
 * TXT 최종본 문단 정리.
 * 기본은 문단 안 줄바꿈을 잇고, 애매한 곳만 모달에 올린다.
 * 검수전 쪽 표식 본문(`joinPagesWithMarkers`)은 조판 줄바꿈을 유지한다.
 */
import {
  analyzeParagraphFlow,
  appendParagraphPiece,
  autoDecisionForVerdict,
  classifyParagraphPair,
  buildParagraphContext,
} from './pdfTxtParagraph.js';

/**
 * @param {string} id
 * @param {import('./pdfTxtParagraph.js').ParagraphVerdict} verdict
 * @param {Record<string, LinebreakDecision>} decisions
 * @param {boolean} autoParagraph
 * @returns {LinebreakDecision}
 */
function resolveDecision(id, verdict, decisions, autoParagraph) {
  if (!autoParagraph) return 'keep';
  const chosen = decisions[id];
  if (
    chosen === 'keep' ||
    chosen === 'nospace' ||
    chosen === 'space' ||
    chosen === 'dehyphen' ||
    chosen === 'join'
  ) {
    return chosen;
  }
  return autoDecisionForVerdict(verdict);
}

/**
 * @typedef {'keep' | 'nospace' | 'space' | 'dehyphen' | 'join'} LinebreakDecision
 * @typedef {{
 *   id: string,
 *   pageNum: number,
 *   lineIndex: number,
 *   left: string,
 *   right: string,
 *   defaultDecision: LinebreakDecision,
 *   glue?: '' | ' ' | 'dehyphen',
 *   reason?: string,
 *   rank?: number,
 * }} LinebreakCandidate
 */

/**
 * @param {string} left
 * @param {string} right
 * @returns {'join' | 'keep' | null}
 */
export function classifyLinebreakPair(left, right) {
  const L = String(left ?? '').replace(/\s+$/u, '');
  const R = String(right ?? '').replace(/^\s+/u, '');
  if (!L || !R) return null;
  return classifyParagraphPair(L, R).action;
}

/**
 * @param {{ pageNum: number, lines: string[], lineLayout?: object[] }[]} pages
 * @returns {LinebreakCandidate[]}
 */
export function findLinebreakCandidates(pages) {
  return analyzeParagraphFlow(pages).candidates;
}

/**
 * @param {{ pageNum: number, lines: string[], lineLayout?: object[] }[]} pages
 * @param {Record<string, LinebreakDecision>} [decisions]
 * @param {{ autoParagraph?: boolean }} [options]
 *   autoParagraph false면 조판 줄바꿈을 그대로 둔다 (검수전과 달리 쪽 표식은 없음).
 * @returns {string}
 */
export function applyLinebreakDecisions(pages, decisions = {}, options = {}) {
  const autoParagraph = options.autoParagraph !== false;
  /** @type {{ pageNum: number, buf: string, lastLine: string, lastLayout: object | undefined, firstLine: string, firstLayout: object | undefined, context: ReturnType<typeof buildParagraphContext> }[]} */
  const blocks = [];
  for (const page of pages ?? []) {
    const lines = page.lines ?? [];
    const layouts = page.lineLayout ?? [];
    if (!lines.length) continue;
    const context = buildParagraphContext(lines, layouts);
    let buf = lines[0];
    for (let i = 0; i < lines.length - 1; i += 1) {
      const verdict = classifyParagraphPair(
        lines[i],
        lines[i + 1],
        layouts[i],
        layouts[i + 1],
        context,
      );
      const decision = resolveDecision(
        `${page.pageNum}:${i}`,
        verdict,
        decisions,
        autoParagraph,
      );
      buf = appendParagraphPiece(buf, lines[i + 1], decision, verdict.glue);
    }
    blocks.push({
      pageNum: page.pageNum,
      buf: buf.replace(/[ \t\u00A0]+$/u, ''),
      lastLine: lines[lines.length - 1],
      lastLayout: layouts[lines.length - 1],
      firstLine: lines[0],
      firstLayout: layouts[0],
      context,
    });
  }
  if (!blocks.length) return '';
  let out = blocks[0].buf;
  for (let i = 0; i < blocks.length - 1; i += 1) {
    const left = blocks[i];
    const right = blocks[i + 1];
    if (!autoParagraph) {
      out += `\n\n${right.buf}`;
      continue;
    }
    const verdict = classifyParagraphPair(
      left.lastLine,
      right.firstLine,
      left.lastLayout,
      right.firstLayout,
      left.context,
      { crossPage: true },
    );
    const decision = resolveDecision(
      `${left.pageNum}:page`,
      verdict,
      decisions,
      true,
    );
    if (decision === 'keep') out += `\n${right.buf}`;
    else out = appendParagraphPiece(out, right.buf, decision, verdict.glue);
  }
  return out;
}

/**
 * 검수전(쪽 표식 포함) 본문. 조판 줄바꿈을 유지한다.
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
