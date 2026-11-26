/**
 * TXT 파이프라인 실행 (측정·골든용). pdfTxtExport 흐름 재사용.
 */
import {
  analyzeParagraphFlow,
  classifyParagraphPair,
  crossPageLayoutTrust,
} from '../../src/lib/pdfTxtParagraph.js';
import { applyLinebreakDecisions } from '../../src/lib/pdfTxtLinebreakReview.js';
import {
  applyUncertainSuggestionsToCandidates,
  suggestUncertainLinebreakDecisions,
} from '../../src/lib/pdfTxtUncertainAnalyzer.js';

/**
 * @param {{ pageNum: number, lines: string[], lineLayout?: object[], column?: object, bodyHeadIndex?: number, bodyTailIndex?: number }[]} cleaned
 * @param {{
 *   mode?: 'analyzer-off' | 'analyzer-on',
 *   decisionsMode?: 'untouched' | 'accept-defaults',
 *   analyze?: (line: string) => unknown,
 * }} [options]
 */
export function runTxtPipeline(cleaned, options = {}) {
  const mode = options.mode ?? 'analyzer-off';
  const decisionsMode = options.decisionsMode ?? 'untouched';
  const flow = analyzeParagraphFlow(cleaned);

  let candidates = flow.candidates;
  if (mode === 'analyzer-on' && typeof options.analyze === 'function') {
    const analyzed = suggestUncertainLinebreakDecisions(candidates, {
      forceEnabled: true,
      analyze: options.analyze,
    });
    candidates = applyUncertainSuggestionsToCandidates(candidates, analyzed);
  }

  /** @type {Record<string, string>} */
  const decisions = {};
  if (decisionsMode === 'accept-defaults') {
    for (const c of candidates) {
      decisions[c.id] =
        c.defaultDecision === 'join' ? 'space' : c.defaultDecision;
    }
  }

  const finalTxt = applyLinebreakDecisions(cleaned, decisions, {
    autoParagraph: true,
  });

  /** @type {{ pageNum: number, lineIndex: number, text: string }[]} */
  const extractLines = [];
  for (const page of cleaned ?? []) {
    const lines = page.lines ?? [];
    for (let i = 0; i < lines.length; i += 1) {
      extractLines.push({ pageNum: page.pageNum, lineIndex: i, text: lines[i] });
    }
  }

  const columnDecisions = (cleaned ?? []).map((page) => ({
    pageNum: page.pageNum,
    kind: page.column?.kind ?? 'single',
    reason: page.column?.reason,
    deferred: page.column?.deferred,
    margin: page.column?.margin,
  }));

  // O5/F4: 쪽 넘김 page-layout 비율 (후보 상한과 무관하게 전 쪽 경계 집계)
  const filled = (cleaned ?? []).filter((p) => (p.lines ?? []).length > 0);
  let pageLayoutKeeps = 0;
  // 바닥글("글자 + 쪽번호")이 다음 쪽 본문에 이어붙은 경계 수 — 골든 회귀 센서
  let footerJoins = 0;
  for (let i = 0; i < filled.length - 1; i += 1) {
    const trust = crossPageLayoutTrust(filled[i], filled[i + 1]);
    const leftLines = filled[i].lines ?? [];
    const rightLines = filled[i + 1].lines ?? [];
    const leftLayouts = filled[i].lineLayout ?? [];
    const rightLayouts = filled[i + 1].lineLayout ?? [];
    const verdict = classifyParagraphPair(
      leftLines[leftLines.length - 1],
      rightLines[0],
      leftLayouts[leftLines.length - 1],
      rightLayouts[0],
      null,
      trust,
    );
    if (verdict.reason === 'page-layout') pageLayoutKeeps += 1;
    if (
      verdict.action === 'join' &&
      /\s\d{1,3}$/u.test(String(leftLines[leftLines.length - 1] ?? '').trim())
    ) {
      footerJoins += 1;
    }
  }
  const pageCount = filled.length;
  const pageLayoutPerPage = pageCount ? pageLayoutKeeps / pageCount : 0;

  return {
    mode,
    decisionsMode,
    candidates,
    stats: flow.stats,
    finalTxt,
    extractLines,
    columnDecisions,
    pageLayoutStats: {
      pageCount,
      pageLayoutKeeps,
      footerJoins,
      pageLayoutPerPage: Number(pageLayoutPerPage.toFixed(4)),
      over10pct: pageLayoutPerPage > 0.1,
    },
  };
}
