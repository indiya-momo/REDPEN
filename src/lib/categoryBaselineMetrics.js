/**
 * 범주 회귀 기준선 점수.
 * 띄어쓰기 범주와 이후 모듈(예: '-지 말다')이 같은 식으로 TP/FN/FP를 집계한다.
 *
 * 채점 (verified이고 skip이 아닌 행만):
 * - FIX: 긍정. 짚혔고 제안이 기대출력과 같으면 TP, 아니면 FN (미검출·제안 불일치 모두).
 * - KEEP: 부정. 하나라도 짚히면 FP, 아니면 TN.
 * verified:false(stdict 확인·Kiwi 태깅)와 skip(보류)은 건수만 따로 세고 합격/불합격·정밀도/재현율에 넣지 않는다.
 * confirm·안내는 기대가 FIX/KEEP이 아니므로 건수만 센다.
 */

/** @param {unknown} needsCheck */
export function isExpectationUnverified(needsCheck) {
  const text = String(needsCheck ?? '');
  return text.includes('stdict 확인') || text.includes('Kiwi 태깅');
}

/**
 * 시트 셀의 복수 기대출력. `도와 드려 보다 / 도와드려 보다`
 * @param {unknown} raw
 * @returns {string[]}
 */
export function splitExpectedOutputs(raw) {
  return String(raw ?? '')
    .split(/\s*\/\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * 한 매치를 입력에 적용한 전체 문자열. 위치가 어긋나면 null.
 * @param {string} input
 * @param {{ matchedText?: string, suggestedText?: string, index?: number }} instance
 * @returns {string | null}
 */
export function rewriteWithInstance(input, instance) {
  const matched = String(instance?.matchedText ?? '');
  const suggested = String(instance?.suggestedText ?? '');
  const index = instance?.index;
  if (!matched || !Number.isInteger(index) || index < 0) return null;
  if (input.slice(index, index + matched.length) !== matched) return null;
  return input.slice(0, index) + suggested + input.slice(index + matched.length);
}

/**
 * FIX 행: 제안 문자열이 기대출력이거나, 그 제안을 입력에 적용한 결과가 기대출력이다.
 * @param {string} input
 * @param {{ matchedText?: string, suggestedText?: string, index?: number }[]} instances
 * @param {string[]} expectedOutputs
 */
export function suggestionMatchesExpected(input, instances, expectedOutputs) {
  const expected = new Set((expectedOutputs ?? []).map((s) => String(s)).filter(Boolean));
  if (expected.size === 0) return false;
  for (const instance of instances ?? []) {
    const suggested = String(instance?.suggestedText ?? '');
    if (expected.has(suggested)) return true;
    const rewritten = rewriteWithInstance(input, instance);
    if (rewritten != null && expected.has(rewritten)) return true;
  }
  return false;
}

/**
 * @typedef {Object} CategoryBaselineRow
 * @property {string} id
 * @property {string} category
 * @property {'FIX'|'KEEP'|'confirm'|'안내'|'보류'|string} expect
 * @property {boolean} verified
 * @property {boolean} [skip]
 * @property {boolean} flagged
 * @property {boolean} suggestionMatched
 * @property {string} [input]
 * @property {string[]} [expectedOutputs]
 * @property {{ matchedText?: string, suggestedText?: string, label?: string }[]} [hits]
 */

function emptyBucket() {
  return {
    tp: 0,
    fn: 0,
    fp: 0,
    tn: 0,
    unverified: 0,
    unverifiedFlagged: 0,
    skipped: 0,
    confirm: 0,
    guide: 0,
    other: 0,
  };
}

/** @param {number} numerator @param {number} denominator */
export function rate(numerator, denominator) {
  if (!denominator) return null;
  return numerator / denominator;
}

/**
 * @param {CategoryBaselineRow[]} rows
 */
export function scoreCategoryBaseline(rows) {
  /** @type {Map<string, ReturnType<typeof emptyBucket>>} */
  const byCategory = new Map();
  /** @type {CategoryBaselineRow[]} */
  const falsePositives = [];
  /** @type {CategoryBaselineRow[]} */
  const unverifiedFlagged = [];

  const bucketFor = (category) => {
    const key = category || '(없음)';
    let bucket = byCategory.get(key);
    if (!bucket) {
      bucket = emptyBucket();
      byCategory.set(key, bucket);
    }
    return bucket;
  };

  for (const row of rows) {
    const bucket = bucketFor(row.category);
    if (row.skip || row.expect === '보류') {
      bucket.skipped += 1;
      continue;
    }
    if (!row.verified) {
      bucket.unverified += 1;
      if (row.flagged) {
        bucket.unverifiedFlagged += 1;
        unverifiedFlagged.push(row);
      }
      continue;
    }
    if (row.expect === 'FIX') {
      if (row.suggestionMatched) bucket.tp += 1;
      else bucket.fn += 1;
      continue;
    }
    if (row.expect === 'KEEP') {
      if (row.flagged) {
        bucket.fp += 1;
        falsePositives.push(row);
      } else {
        bucket.tn += 1;
      }
      continue;
    }
    if (row.expect === 'confirm') {
      bucket.confirm += 1;
      continue;
    }
    if (row.expect === '안내') {
      bucket.guide += 1;
      continue;
    }
    bucket.other += 1;
  }

  const categories = [...byCategory.entries()].map(([category, counts]) => ({
    category,
    ...counts,
    precision: rate(counts.tp, counts.tp + counts.fp),
    recall: rate(counts.tp, counts.tp + counts.fn),
  }));

  const totals = categories.reduce((sum, row) => {
    for (const key of Object.keys(emptyBucket())) {
      sum[key] += row[key];
    }
    return sum;
  }, emptyBucket());

  return {
    categories,
    totals: {
      ...totals,
      precision: rate(totals.tp, totals.tp + totals.fp),
      recall: rate(totals.tp, totals.tp + totals.fn),
    },
    falsePositives,
    unverifiedFlagged,
  };
}

/** @param {number | null} value */
function formatRate(value) {
  if (value == null) return '—';
  return value.toFixed(3);
}

/**
 * @param {ReturnType<typeof scoreCategoryBaseline>} report
 */
export function formatCategoryBaselineTable(report) {
  const header = [
    '범주',
    'TP',
    'FN',
    'FP',
    'precision',
    'recall',
    'unverified',
    'skipped',
    'confirm',
    'guide',
  ];
  const lines = [header.join('\t')];
  const push = (label, row) => {
    lines.push(
      [
        label,
        row.tp,
        row.fn,
        row.fp,
        formatRate(row.precision),
        formatRate(row.recall),
        row.unverified,
        row.skipped,
        row.confirm,
        row.guide,
      ].join('\t'),
    );
  };
  for (const row of report.categories) push(row.category, row);
  push('합계', report.totals);
  return lines.join('\n');
}

/**
 * 오탐·미검증 검출을 로그용 한 줄로.
 * @param {CategoryBaselineRow[]} rows
 */
export function formatBaselineHitLines(rows) {
  if (!rows.length) return '(없음)';
  return rows
    .map((row) => {
      const hits = (row.hits ?? [])
        .map((hit) => {
          const label = hit.label ? ` [${hit.label}]` : '';
          return `"${hit.matchedText ?? ''}"→"${hit.suggestedText ?? ''}"${label}`;
        })
        .join(', ');
      return `${row.id}\t${row.category}\t${row.input ?? ''}\t${hits}`;
    })
    .join('\n');
}
