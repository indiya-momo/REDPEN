import { BUILT_IN_RULES } from './builtInRules.js';
import { compileRuleRegex } from './regexFromFind.js';

/** @typedef {import('./pdfService.js').PageData} PageData */

export const SCAN_PDF_MESSAGE =
  '스캔 PDF는 문자를 읽을 수 없습니다. 인디자인으로 만든 텍스트 PDF를 준비해 주세요.';

export const LOW_QUALITY_MESSAGE =
  '';

export const PROBE_FAIL_MESSAGE =
  '이 PDF에서는 검수 규칙이 동작하지 않습니다. 인디자인 텍스트 PDF로 다시보내 주세요.';

const MIN_CHARS_FOR_PROBE = 800;
const MIN_NON_WS_FOR_HANGUL_CHECK = 400;
const MIN_PROBE_HITS = 1;

/**
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdf
 */
export async function getPdfProducerHints(pdf) {
  try {
    const meta = await pdf.getMetadata();
    const info = meta?.info ?? {};
    const producer = String(info.Producer ?? '').trim();
    const creator = String(info.Creator ?? '').trim();
    const combined = `${producer} ${creator}`.toLowerCase();
    return {
      looksInDesign: /indesign|adobe\s+indesign/i.test(combined),
      producer,
      creator,
    };
  } catch {
    return {
      looksInDesign: false,
      producer: '',
      creator: '',
    };
  }
}

/**
 * @param {PageData} page
 */
export function scorePageExtractionQuality(page) {
  const items = page.items ?? [];
  let charCount = 0;
  let singleCharItems = 0;

  for (const item of items) {
    if (!('str' in item) || !item.str) continue;
    const len = item.str.length;
    charCount += len;
    if (len === 1) singleCharItems += 1;
  }

  const itemCount = items.length;
  if (charCount < 30) {
    return { ok: true, skipped: true, charCount, itemCount };
  }

  const fragmentation = itemCount / charCount;
  const singleCharRatio = singleCharItems / Math.max(itemCount, 1);
  const ok = fragmentation <= 2.8 && singleCharRatio <= 0.55;

  return {
    ok,
    skipped: false,
    charCount,
    itemCount,
    fragmentation,
    singleCharRatio,
  };
}

/**
 * @param {PageData[]} pages
 */
export function assessExtractionQuality(pages) {
  const sampleIndexes = pickSamplePageIndexes(pages.length);
  const scores = sampleIndexes.map((i) => scorePageExtractionQuality(pages[i]));
  const active = scores.filter((s) => !s.skipped);
  if (!active.length) {
    return { ok: true, sampledPages: sampleIndexes.length, badPages: 0 };
  }

  const badPages = active.filter((s) => !s.ok).length;
  const badRatio = badPages / active.length;

  return {
    ok: badRatio < 0.5,
    sampledPages: sampleIndexes.length,
    badPages,
    badRatio,
    scores: active,
  };
}

/**
 * @param {number} numPages
 */
function pickSamplePageIndexes(numPages) {
  if (numPages <= 0) return [];
  const indexes = new Set([0]);
  if (numPages > 1) indexes.add(1);
  if (numPages > 2) indexes.add(2);
  if (numPages > 6) indexes.add(Math.floor(numPages / 2));
  if (numPages > 3) indexes.add(numPages - 1);
  return [...indexes].filter((i) => i >= 0 && i < numPages);
}

/**
 * @returns {import('./ruleTypes.js').Rule[]}
 */
function probeRules() {
  return BUILT_IN_RULES.filter(
    (r) =>
      r.enabled &&
      r.find.length >= 2 &&
      r.find.length <= 12 &&
      r.pattern !== 'regex',
  ).slice(0, 10);
}

/**
 * @param {PageData[]} pages
 */
export function runProbeMatches(pages) {
  const rules = probeRules();
  const sampleIndexes = pickSamplePageIndexes(pages.length);
  let corpus = '';
  for (const i of sampleIndexes) {
    corpus += `${pages[i]?.text ?? ''}\n`;
  }
  const charCount = corpus.replace(/\s/g, '').length;

  if (charCount < MIN_CHARS_FOR_PROBE) {
    return { ok: true, skipped: true, hits: 0, rules: rules.length, charCount };
  }

  let hits = 0;
  for (const rule of rules) {
    const re = compileRuleRegex(rule);
    if (!re) continue;
    re.lastIndex = 0;
    if (re.test(corpus)) hits += 1;
  }

  return {
    ok: hits >= MIN_PROBE_HITS,
    skipped: false,
    hits,
    rules: rules.length,
    charCount,
  };
}

/**
 * @param {string} text
 */
export function countHangul(text) {
  return (text.match(/[\uAC00-\uD7A3]/g) ?? []).length;
}

/**
 * @param {PageData[]} pages
 */
export function analyzeTextCorpus(pages) {
  let corpus = '';
  for (const page of pages) {
    corpus += page.text ?? '';
  }
  const nonWs = corpus.replace(/\s/g, '').length;
  const hangul = countHangul(corpus);
  const letters = (corpus.match(/\p{L}/gu) ?? []).length;
  const latin = (corpus.match(/[A-Za-z]/g) ?? []).length;
  const latinRatio = latin / Math.max(letters, 1);
  const mojibakeHints =
    (corpus.match(/[\u0600-\u06FF\u0590-\u05FF]/g) ?? []).length;

  return { nonWs, hangul, letters, latin, latinRatio, mojibakeHints };
}

/**
 * @param {PageData[]} pages
 */
export function assessHangulExtraction(pages) {
  const stats = analyzeTextCorpus(pages);
  if (stats.nonWs < MIN_NON_WS_FOR_HANGUL_CHECK) {
    return { ok: true, skipped: true, ...stats, reason: 'too_short' };
  }
  if (stats.hangul >= 1) {
    return { ok: true, skipped: false, ...stats, reason: 'hangul_ok' };
  }
  if (
    stats.hangul === 0 &&
    stats.latinRatio >= 0.85 &&
    stats.mojibakeHints < 15
  ) {
    return { ok: true, skipped: false, ...stats, reason: 'latin_primary' };
  }
  if (stats.hangul === 0) {
    return { ok: true, skipped: false, ...stats, reason: 'hangul_missing' };
  }
  return { ok: true, skipped: false, ...stats, reason: 'ok' };
}

/**
 * @param {{ looksInDesign: boolean, producer?: string, creator?: string }} producerHints
 */
export function looksResavedPdf(producerHints) {
  const combined =
    `${producerHints.producer ?? ''} ${producerHints.creator ?? ''}`.toLowerCase();
  if (producerHints.looksInDesign && !/quartz pdfcontext|pdfkit|ios version/i.test(combined)) {
    return false;
  }
  return /quartz pdfcontext|pdfkit|ios version|mac os x|preview|microsoft print|ghostscript|pdftools|pdf-xchange|skia\/pdf/i.test(
    combined,
  );
}

/**
 * @param {{
 *   producerHints: { looksInDesign: boolean, producer?: string, creator?: string },
 *   pages: PageData[],
 * }} input
 */
export function validatePublishablePdf({ producerHints, pages }) {
  if (!pages.some((p) => p.text.trim())) {
    return {
      ok: false,
      reason: 'scan',
      message: SCAN_PDF_MESSAGE,
    };
  }

  const hangulCheck = assessHangulExtraction(pages);

  return {
    ok: true,
    reason: producerHints.looksInDesign ? 'ok' : 'ok_no_indesign_meta',
    hangulCheck,
  };
}
