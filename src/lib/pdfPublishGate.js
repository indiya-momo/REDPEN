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
 * @param {{
 *   producerHints: { looksInDesign: boolean },
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

  return {
    ok: true,
    reason: producerHints.looksInDesign ? 'ok' : 'ok_no_indesign_meta',
  };
}
