/**
 * TXT 파이프라인 실행 (측정·골든용). pdfTxtExport 흐름 재사용.
 */
import { analyzeParagraphFlow } from '../../src/lib/pdfTxtParagraph.js';
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

  return {
    mode,
    decisionsMode,
    candidates,
    stats: flow.stats,
    finalTxt,
    extractLines,
    columnDecisions,
  };
}
