/**
 * 사람 골든 ↔ 산출물 대조 (순수 함수). 산출물을 재정렬하지 않는다.
 */
import { compileRegexSpec, validateVisualGolden } from './goldenSchema.js';

/**
 * @typedef {{
 *   mode?: string,
 *   decisionsMode?: string,
 *   extractLines?: { pageNum: number, lineIndex: number, text: string }[],
 *   finalTxt: string,
 *   columnDecisions?: { pageNum: number, kind: string, reason?: string, deferred?: boolean, margin?: string }[],
 *   candidates?: { id: string, reason?: string, defaultDecision?: string }[],
 * }} GoldenArtifacts
 * @typedef {{
 *   bookId: string,
 *   mode?: string,
 *   decisionsMode?: string,
 *   items: { checkId: string, kind: string, status: 'PASS'|'FAIL'|'SKIP', why: string }[],
 *   totals: { pass: number, fail: number, skip: number, errorRate: number | null },
 *   pageLayoutCandidates?: { total: number, truncatedByLimit?: number },
 * }} GoldenReport
 */

/**
 * @param {{ pageNum: number, lines: string[] }[] | { pageNum: number, lineIndex: number, text: string }[]} cleanedOrFlat
 * @returns {{ pageNum: number, lineIndex: number, text: string }[]}
 */
export function flattenExtractLines(cleanedOrFlat) {
  const rows = cleanedOrFlat ?? [];
  if (!rows.length) return [];
  if ('text' in rows[0] && 'lineIndex' in rows[0]) {
    return /** @type {{ pageNum: number, lineIndex: number, text: string }[]} */ (
      rows
    );
  }
  /** @type {{ pageNum: number, lineIndex: number, text: string }[]} */
  const flat = [];
  for (const page of /** @type {{ pageNum: number, lines: string[] }[]} */ (rows)) {
    const lines = page.lines ?? [];
    for (let i = 0; i < lines.length; i += 1) {
      flat.push({ pageNum: page.pageNum, lineIndex: i, text: lines[i] });
    }
  }
  return flat;
}

/**
 * @param {{ pageNum: number, lineIndex: number, text: string }[]} flat
 * @param {string} leftNeedle
 */
function findNeedleHits(flat, leftNeedle) {
  /** @type {number[]} */
  const hits = [];
  for (let i = 0; i < flat.length; i += 1) {
    if (String(flat[i].text).includes(leftNeedle)) hits.push(i);
  }
  return hits;
}

/**
 * @param {unknown} goldenInput
 * @param {GoldenArtifacts} artifacts
 * @returns {GoldenReport}
 */
export function evaluateGolden(goldenInput, artifacts) {
  const validated = validateVisualGolden(goldenInput);
  if (!validated.ok) {
    return {
      bookId: 'invalid',
      mode: artifacts.mode,
      decisionsMode: artifacts.decisionsMode,
      items: [
        {
          checkId: 'schema',
          kind: 'schema',
          status: 'FAIL',
          why: validated.errors.join('; '),
        },
      ],
      totals: { pass: 0, fail: 1, skip: 0, errorRate: 1 },
    };
  }
  const golden = validated.golden;
  const finalTxt = String(artifacts.finalTxt ?? '');
  const flat =
    artifacts.extractLines ??
    flattenExtractLines(/** @type {never[]} */ ([]));

  /** @type {GoldenReport['items']} */
  const items = [];

  for (const row of golden.checks.forbiddenMash ?? []) {
    const compiled = compileRegexSpec(row.pattern);
    if (!compiled.ok) {
      items.push({
        checkId: row.id,
        kind: 'forbiddenMash',
        status: 'FAIL',
        why: compiled.error,
      });
      continue;
    }
    const hit = compiled.re.test(finalTxt);
    items.push({
      checkId: row.id,
      kind: 'forbiddenMash',
      status: hit ? 'FAIL' : 'PASS',
      why: hit ? 'pattern matched in finalTxt' : 'ok',
    });
  }

  for (const row of golden.checks.requiredCells ?? []) {
    const ok = finalTxt.includes(row.text);
    items.push({
      checkId: row.id,
      kind: 'requiredCells',
      status: ok ? 'PASS' : 'FAIL',
      why: ok ? 'ok' : 'text missing in finalTxt',
    });
  }

  for (const row of golden.checks.visualAdjacency ?? []) {
    const hits = findNeedleHits(flat, row.leftNeedle);
    if (hits.length === 0) {
      items.push({
        checkId: row.id,
        kind: 'visualAdjacency',
        status: 'FAIL',
        why: 'needle-missing',
      });
      continue;
    }
    if (hits.length >= 2) {
      items.push({
        checkId: row.id,
        kind: 'visualAdjacency',
        status: 'FAIL',
        why: 'needle-ambiguous',
      });
      continue;
    }
    const idx = hits[0];
    const next = flat[idx + 1] ?? null;
    const nextText = next?.text ?? '';
    const nextOk =
      Boolean(nextText) &&
      nextText.trimStart().startsWith(row.expectNextPrefix);
    const nextForbidden =
      Boolean(row.forbidNextPrefix) &&
      Boolean(nextText) &&
      nextText.trimStart().startsWith(/** @type {string} */ (row.forbidNextPrefix));

    const expectCompiled = compileRegexSpec(row.expectContiguous);
    const forbidCompiled = row.forbidContiguous
      ? compileRegexSpec(row.forbidContiguous)
      : { ok: true, re: null };
    if (!expectCompiled.ok || !forbidCompiled.ok) {
      items.push({
        checkId: row.id,
        kind: 'visualAdjacency',
        status: 'FAIL',
        why: !expectCompiled.ok
          ? expectCompiled.error
          : /** @type {{ error: string }} */ (forbidCompiled).error,
      });
      continue;
    }
    const expectInFinal = expectCompiled.re.test(finalTxt);
    const forbidInFinal = forbidCompiled.re
      ? forbidCompiled.re.test(finalTxt)
      : false;
    const extractOrderOk = nextOk && !nextForbidden;
    const contiguousOk = expectInFinal && !forbidInFinal;
    const ok = extractOrderOk && contiguousOk;
    items.push({
      checkId: row.id,
      kind: 'visualAdjacency',
      status: ok ? 'PASS' : 'FAIL',
      why: ok
        ? 'ok'
        : `extractOrderOk=${extractOrderOk} contiguousOk=${contiguousOk}`,
    });
  }

  for (const row of golden.checks.columnLayout ?? []) {
    const decisions = artifacts.columnDecisions ?? [];
    const hit = decisions.find((d) => d.pageNum === row.page);
    if (!hit) {
      items.push({
        checkId: `column-p${row.page}`,
        kind: 'columnLayout',
        status: 'FAIL',
        why: 'page decision missing',
      });
      continue;
    }
    const ok = hit.kind === row.expect;
    items.push({
      checkId: `column-p${row.page}`,
      kind: 'columnLayout',
      status: ok ? 'PASS' : 'FAIL',
      why: ok ? 'ok' : `got ${hit.kind}`,
    });
  }

  const pass = items.filter((i) => i.status === 'PASS').length;
  const fail = items.filter((i) => i.status === 'FAIL').length;
  const skip = items.filter((i) => i.status === 'SKIP').length;
  const judged = pass + fail;
  const pageLayout = (artifacts.candidates ?? []).filter(
    (c) => c.reason === 'page-layout',
  );

  return {
    bookId: golden.book.id,
    mode: artifacts.mode,
    decisionsMode: artifacts.decisionsMode,
    items,
    totals: {
      pass,
      fail,
      skip,
      errorRate: judged ? Number((fail / judged).toFixed(4)) : null,
    },
    pageLayoutCandidates: {
      total: pageLayout.length,
    },
  };
}
