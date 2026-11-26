/**
 * 시각 오차 골든 JSON 스키마 검증 (순수 함수).
 * 정답은 사람 라벨만. 파이프라인 출력을 베낀 골든은 스키마로 막지 못한다(V6 절차).
 */

/**
 * @typedef {{ source: string, flags?: string }} RegexSpec
 * @typedef {{
 *   schemaVersion: 1,
 *   book: { id: string, pdfFileName: string, pdfSha256?: string, pageCount?: number },
 *   labeledBy: 'human',
 *   labeledAt: string,
 *   labelSource: string,
 *   labelEvidence: string[],
 *   labelBasis?: 'pdf-visual' | 'manuscript',
 *   checks: {
 *     forbiddenMash?: { id: string, pattern: RegexSpec, note?: string }[],
 *     requiredCells?: { id: string, text: string, note?: string }[],
 *     visualAdjacency?: {
 *       id: string,
 *       pages?: [number, number],
 *       note?: string,
 *       leftNeedle: string,
 *       expectNextPrefix: string,
 *       forbidNextPrefix?: string,
 *       expectContiguous: RegexSpec,
 *       forbidContiguous?: RegexSpec,
 *     }[],
 *     columnLayout?: { page: number, expect: 'single' | 'two', note?: string }[],
 *   },
 * }} VisualGolden
 */

/**
 * @param {unknown} spec
 * @returns {{ ok: true, re: RegExp } | { ok: false, error: string }}
 */
export function compileRegexSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return { ok: false, error: 'RegexSpec must be object { source, flags? }' };
  }
  const source = /** @type {{ source?: unknown, flags?: unknown }} */ (spec).source;
  const flags = /** @type {{ source?: unknown, flags?: unknown }} */ (spec).flags;
  if (typeof source !== 'string' || !source) {
    return { ok: false, error: 'RegexSpec.source must be non-empty string' };
  }
  if (flags != null && typeof flags !== 'string') {
    return { ok: false, error: 'RegexSpec.flags must be string when set' };
  }
  // 'u' always on
  let finalFlags = String(flags ?? '');
  if (!finalFlags.includes('u')) finalFlags += 'u';
  try {
    return { ok: true, re: new RegExp(source, finalFlags) };
  } catch (err) {
    return {
      ok: false,
      error: `RegexSpec compile failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * @param {unknown} value
 * @returns {{ ok: true, golden: VisualGolden } | { ok: false, errors: string[] }}
 */
export function validateVisualGolden(value) {
  /** @type {string[]} */
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, errors: ['golden must be an object'] };
  }
  const g = /** @type {Record<string, unknown>} */ (value);
  if (g.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!g.book || typeof g.book !== 'object') errors.push('book required');
  else {
    const book = /** @type {Record<string, unknown>} */ (g.book);
    if (typeof book.id !== 'string' || !book.id) errors.push('book.id required');
    if (typeof book.pdfFileName !== 'string' || !book.pdfFileName) {
      errors.push('book.pdfFileName required');
    }
  }
  if (g.labeledBy !== 'human') errors.push("labeledBy must be 'human'");
  if (typeof g.labeledAt !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(g.labeledAt)) {
    errors.push('labeledAt must be YYYY-MM-DD…');
  }
  if (typeof g.labelSource !== 'string' || !g.labelSource.trim()) {
    errors.push('labelSource required');
  }
  if (!Array.isArray(g.labelEvidence) || g.labelEvidence.length < 1) {
    errors.push('labelEvidence requires ≥1 entry');
  } else if (g.labelEvidence.some((x) => typeof x !== 'string' || !x.trim())) {
    errors.push('labelEvidence entries must be non-empty strings');
  }
  if (
    g.labelBasis != null &&
    g.labelBasis !== 'pdf-visual' &&
    g.labelBasis !== 'manuscript'
  ) {
    errors.push("labelBasis must be 'pdf-visual' | 'manuscript' when set");
  }
  if (!g.checks || typeof g.checks !== 'object' || Array.isArray(g.checks)) {
    errors.push('checks required');
  } else {
    const checks = /** @type {Record<string, unknown>} */ (g.checks);
    if (checks.forbiddenMash != null) {
      if (!Array.isArray(checks.forbiddenMash)) {
        errors.push('checks.forbiddenMash must be array');
      } else {
        checks.forbiddenMash.forEach((row, i) => {
          if (!row || typeof row !== 'object') {
            errors.push(`forbiddenMash[${i}] invalid`);
            return;
          }
          const r = /** @type {Record<string, unknown>} */ (row);
          if (typeof r.id !== 'string' || !r.id) {
            errors.push(`forbiddenMash[${i}].id required`);
          }
          const compiled = compileRegexSpec(r.pattern);
          if (!compiled.ok) {
            errors.push(`forbiddenMash[${i}].pattern: ${compiled.error}`);
          }
        });
      }
    }
    if (checks.requiredCells != null) {
      if (!Array.isArray(checks.requiredCells)) {
        errors.push('checks.requiredCells must be array');
      } else {
        checks.requiredCells.forEach((row, i) => {
          const r = /** @type {Record<string, unknown>} */ (row || {});
          if (typeof r.id !== 'string' || typeof r.text !== 'string' || !r.text) {
            errors.push(`requiredCells[${i}] needs id+text`);
          }
        });
      }
    }
    if (checks.visualAdjacency != null) {
      if (!Array.isArray(checks.visualAdjacency)) {
        errors.push('checks.visualAdjacency must be array');
      } else {
        checks.visualAdjacency.forEach((row, i) => {
          const r = /** @type {Record<string, unknown>} */ (row || {});
          if (typeof r.id !== 'string' || !r.id) {
            errors.push(`visualAdjacency[${i}].id required`);
          }
          if (typeof r.leftNeedle !== 'string' || !r.leftNeedle) {
            errors.push(`visualAdjacency[${i}].leftNeedle required`);
          }
          if (typeof r.expectNextPrefix !== 'string' || !r.expectNextPrefix) {
            errors.push(`visualAdjacency[${i}].expectNextPrefix required`);
          }
          const expect = compileRegexSpec(r.expectContiguous);
          if (!expect.ok) {
            errors.push(`visualAdjacency[${i}].expectContiguous: ${expect.error}`);
          }
          if (r.forbidContiguous != null) {
            const forbid = compileRegexSpec(r.forbidContiguous);
            if (!forbid.ok) {
              errors.push(
                `visualAdjacency[${i}].forbidContiguous: ${forbid.error}`,
              );
            }
          }
        });
      }
    }
    if (checks.columnLayout != null) {
      if (!Array.isArray(checks.columnLayout)) {
        errors.push('checks.columnLayout must be array');
      } else {
        checks.columnLayout.forEach((row, i) => {
          const r = /** @type {Record<string, unknown>} */ (row || {});
          if (!Number.isFinite(r.page) || (r.expect !== 'single' && r.expect !== 'two')) {
            errors.push(`columnLayout[${i}] needs page + expect single|two`);
          }
        });
      }
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, golden: /** @type {VisualGolden} */ (value) };
}
