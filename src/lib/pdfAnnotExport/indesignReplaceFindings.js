/**
 * 인디자인용 Acrobat Replace 내보내기 — finding 선별·겹침·원문 자체 점검.
 * @see docs/superpowers/specs/2026-11-19-indesign-replace-export-design.md
 */

/**
 * @typedef {import('./collectAnnotFindings.js').AnnotFinding} AnnotFinding
 * @typedef {{
 *   included: AnnotFinding[],
 *   excluded: { noReplacement: number, textMismatch: number, overlap: number, reviewOnly: number },
 * }} IndesignReplacePrepareResult
 */

/**
 * slice와 found 비교 — 줄바꿈·연속 공백만 느슨히.
 * @param {string} a
 * @param {string} b
 */
export function normalizeFindingText(a, b) {
  const norm = (s) =>
    String(s ?? '')
      .replace(/\s*\n\s*/g, '\n')
      .replace(/[ \t]+/g, ' ');
  return norm(a) === norm(b);
}

/**
 * 구간 [start,end)가 page.text에서 기대 원문과 같은지.
 * QuadPoints·글리프 좌표를 읽지 않는다 — finding 인덱스↔문자열 매핑만 본다.
 * Tw 등 좌표 모델 오차는 이 점검으로 걸리지 않는다.
 * @param {import('../pdfService.js').PageData | undefined} page
 * @param {AnnotFinding} f
 */
export function findingTextMatchesPage(page, f) {
  if (!page?.text) return false;
  const sliced = page.text.slice(f.start, f.end);
  const expect = String(f.found ?? f.matchedText ?? '');
  if (!expect) return false;
  if (sliced === expect) return true;
  return normalizeFindingText(sliced, expect);
}

/**
 * @param {AnnotFinding} a
 * @param {AnnotFinding} b
 */
function rangesOverlap(a, b) {
  if (a.pageNum !== b.pageNum) return false;
  return a.start < b.end && b.start < a.end;
}

/**
 * 겹치면 더 긴 구간 우선, 동길이면 앞선(수집 순·start) 유지.
 * @param {AnnotFinding[]} items
 * @returns {{ kept: AnnotFinding[], dropped: number }}
 */
export function resolveOverlappingFindings(items) {
  const sorted = [...items].sort((a, b) => {
    if (a.pageNum !== b.pageNum) return a.pageNum - b.pageNum;
    const la = a.end - a.start;
    const lb = b.end - b.start;
    if (la !== lb) return lb - la;
    return a.start - b.start;
  });
  /** @type {AnnotFinding[]} */
  const kept = [];
  /** @type {AnnotFinding[]} */
  const droppedItems = [];
  for (const f of sorted) {
    if (kept.some((k) => rangesOverlap(k, f))) {
      droppedItems.push(f);
      continue;
    }
    kept.push(f);
  }
  kept.sort((a, b) =>
    a.pageNum !== b.pageNum ? a.pageNum - b.pageNum : a.start - b.start,
  );
  return { kept, dropped: droppedItems.length, droppedItems };
}

/**
 * @param {AnnotFinding[]} findings
 * @param {import('../pdfService.js').PageData[]} pageTexts
 * @returns {IndesignReplacePrepareResult}
 */
export function prepareIndesignReplaceFindings(findings, pageTexts) {
  const pageByNum = new Map((pageTexts ?? []).map((p) => [p.pageNum, p]));
  /** @type {AnnotFinding[]} */
  const withRep = [];
  let noReplacement = 0;
  let textMismatch = 0;
  let reviewOnly = 0;

  for (const f of findings ?? []) {
    if (f.style === 'review') {
      reviewOnly += 1;
      continue;
    }
    const rep = String(f.replacement ?? '').trim();
    if (!rep) {
      noReplacement += 1;
      continue;
    }
    const page = pageByNum.get(f.pageNum);
    if (!findingTextMatchesPage(page, f)) {
      textMismatch += 1;
      continue;
    }
    withRep.push(f);
  }

  const { kept, dropped, droppedItems } = resolveOverlappingFindings(withRep);
  const includedManual = kept.filter((f) => f.fromManual).length;
  const overlapManual = (droppedItems ?? []).filter((f) => f.fromManual).length;
  return {
    included: kept,
    includedManual,
    overlapManual,
    overlapEngine: dropped - overlapManual,
    excluded: {
      noReplacement,
      textMismatch,
      overlap: dropped,
      reviewOnly,
    },
  };
}

/** @param {IndesignReplacePrepareResult['excluded']} excluded */
export function countExcluded(excluded) {
  return (
    (excluded?.noReplacement ?? 0) +
    (excluded?.textMismatch ?? 0) +
    (excluded?.overlap ?? 0) +
    (excluded?.reviewOnly ?? 0)
  );
}

/**
 * 인디자인용 내려받기 안내 (기술 용어·Accept 약속 없음).
 * @param {{
 *   included: number,
 *   excluded: IndesignReplacePrepareResult['excluded'],
 * }} counts
 */
export function formatIndesignReplaceNotice({
  included,
  includedManual = 0,
  excluded,
  overlapManual = 0,
  overlapEngine,
  layoutExcludedOverlap = 0,
}) {
  const excl = countExcluded(excluded);
  const overlapEngineN =
    overlapEngine ?? Math.max(0, (excluded?.overlap ?? 0) - overlapManual);
  const overlapBit =
    excluded.overlap > 0
      ? `겹침 ${excluded.overlap}(수동 ${overlapManual}, 엔진 ${overlapEngineN})`
      : `겹침 ${excluded.overlap}`;
  const parts = [
    `포함 ${included}건(수동 ${includedManual})`,
    excl
      ? `제외 ${excl}건(고침 없음 ${excluded.noReplacement}, 검토만 ${excluded.reviewOnly}, 원문 불일치 ${excluded.textMismatch}, ${overlapBit})`
      : '제외 0건',
  ];
  if (layoutExcludedOverlap > 0) {
    parts.push(
      `조판 기호 ${layoutExcludedOverlap}건 제외(문자 고침과 겹침)`,
    );
  }
  return (
    `${parts.join(' · ')}\n\n` +
    'PDF를 다운로드한 뒤에는 가급적 주석을 수정하지 마세요.\n' +
    '위치가 변경되어 인디자인 적용 시 어긋날 수 있습니다.\n' +
    'PDF 주석 가져오기를 통한 자동 반영은 인디자인·원본 PDF에 따라 정확도가 달라질 수 있습니다.'
  );
}
