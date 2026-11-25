import { buildInstancePills } from '../components/ResultPageSummary.jsx';
import { getBuiltInTip } from './builtInRules.js';
import { cautionResultChipLabel } from './cautionRules.js';
import { AUXILIARY_VERB_BADGE_LABEL } from './bonBojoRules.js';
import {
  formatConsistencyExcelSummaryLine,
  formatSpellingExcelSummaryLine,
} from './checkResultSummaryFormat.js';
import {
  LITERAL_FIND_FEATURE_LABEL,
  UNIFY_FEATURE_LABEL,
} from './consistencyRuleLimit.js';
import {
  getConsistencyUnifyPinnedTailWord,
  isConsistencyUnifyResultGroup,
  resolveConsistencyGroupTailWord,
} from './consistencyUnifyRegister.js';
import { formatAuxiliaryVerbResultLabel } from './patternDisplayLabels.js';
import { groupPhraseSlotInstancesByFill } from './phraseSlotResultGroups.js';
import { encodeSpacesVisible } from './spaceVisibleText.js';
import {
  EXCEL_ROUNDTRIP_EDIT_GUIDE,
  MACHINE_COL_HEADERS,
  buildMachineExportFields,
  buildPageFingerprintMap,
  setExcelTextCell,
} from './exportExcelRoundtrip.js';

const AUXILIARY_EXPORT_CATEGORY = AUXILIARY_VERB_BADGE_LABEL;
const UNIFY_CANDIDATE_EXPORT_CATEGORY = '표기 통일 추천';
const UNIFY_PINNED_EXPORT_TIP = '통일형 📌';
const UNIFY_NEED_EXPORT_TIP = '통일 필요 항목';

const HEADER_BG = 'FF3E2723';
const HEADER_FG = 'FFFFFFFF';
const CAUTION_BG = 'FFD7CCC8';
const BUILTIN_BG = 'FFEFEBE9';
const MACHINE_HEADER_BG = 'FF5D4037';
const THIN_BORDER_COLOR = 'FFBBBBBB';

const THIN = { style: 'thin', color: { argb: THIN_BORDER_COLOR } };
const CELL_BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN };

const EXCEL_GUIDE_FONT = { name: 'Arial', size: 9, color: { argb: 'FF555555' } };

/** 엑셀 1행 안내 — roundtrip + 잘림 시 행·열 자동 맞춤 */
const EXCEL_CLIP_GUIDE_RICHTEXT = [
  {
    text: `${EXCEL_ROUNDTRIP_EDIT_GUIDE} `,
    font: { ...EXCEL_GUIDE_FONT, bold: true },
  },
  {
    text: '내용이 잘려 보이면 ',
    font: { ...EXCEL_GUIDE_FONT, bold: false },
  },
  {
    text: 'Ctrl+A→홈 탭→ 서식 → 행 높이 자동 맞춤, 열 너비 자동 맞춤',
    font: { ...EXCEL_GUIDE_FONT, bold: true },
  },
  {
    text: ' 이용하세요',
    font: { ...EXCEL_GUIDE_FONT, bold: false },
  },
];

const SPELLING_HUMAN_HEADERS = [
  '구분',
  '묶음',
  '기준',
  '설명',
  '발견 문구',
  '수정안',
  '페이지',
];
const CONSISTENCY_HUMAN_HEADERS = [
  '구분',
  '기준',
  '설명',
  '발견 문구',
  '수정안',
  '페이지',
];

// ── 행 높이 계산 ──────────────────────────────────────────────────

/** 한글·CJK 여부 (Excel에서 약 2배 너비로 렌더링) */
function isWideChar(ch) {
  const cp = ch.codePointAt(0);
  return (
    (cp >= 0xAC00 && cp <= 0xD7AF) || // 한글 음절
    (cp >= 0x1100 && cp <= 0x11FF) || // 한글 자모
    (cp >= 0x3130 && cp <= 0x318F) || // 한글 호환 자모
    (cp >= 0xA960 && cp <= 0xA97C) || // 한글 자모 확장 A
    (cp >= 0xD7B0 && cp <= 0xD7C6) || // 한글 자모 확장 B
    (cp >= 0x4E00 && cp <= 0x9FFF) || // CJK 통합 한자
    (cp >= 0xFF00 && cp <= 0xFFEF) // 전각 문자
  );
}

/**
 * 일반 텍스트(한글 포함) 줄 수 추정 — 글자 단위 줄바꿈
 * @param {string} text
 * @param {number} colWidth
 */
function estimateLines(text, colWidth) {
  if (!text || text.length === 0) return 1;
  const usable = Math.max(4, Math.floor(colWidth * 0.78));
  let lines = 1;
  let pos = 0;
  for (const ch of String(text)) {
    if (ch === '\n') {
      lines++;
      pos = 0;
      continue;
    }
    const w = isWideChar(ch) ? 2 : 1;
    pos += w;
    if (pos > usable) {
      lines++;
      pos = w;
    }
  }
  return lines;
}

/**
 * 페이지 레이블 텍스트 줄 수 추정 — Excel과 동일하게 공백(space) 기준 단어 단위 줄바꿈.
 * @param {string} pillText
 * @param {number} colWidth
 */
function estimatePillLines(pillText, colWidth) {
  if (!pillText) return 1;
  const usable = Math.max(4, Math.floor(colWidth * 0.72));
  const words = pillText.split(' ').filter((w) => w.length > 0);
  let lines = 1;
  let lineW = 0;
  for (const word of words) {
    const w = word.length;
    if (lineW === 0) {
      lineW = w;
    } else if (lineW + 1 + w > usable) {
      lines++;
      lineW = w;
    } else {
      lineW += 1 + w;
    }
  }
  return lines;
}

const LINE_H_PT = 15;
const ROW_PAD_PT = 8;
const MIN_ROW_H = 24;
const MAX_ROW_H = 800;

/** 줄 수 배열 중 최대값으로 행 높이(pt) 결정 */
function rowHeightPt(...linesArr) {
  const maxLines = Math.max(1, ...linesArr);
  return Math.min(MAX_ROW_H, Math.max(MIN_ROW_H, maxLines * LINE_H_PT + ROW_PAD_PT));
}

// ── 셀 스타일·레이블 ──────────────────────────────────────────────

function applyStyle(cell, { bg, fg = 'FF000000', bold = false, size = 10, hAlign = 'left', vAlign = 'center', wrap = false }) {
  cell.font = { name: 'Arial', size, bold, color: { argb: fg } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  cell.alignment = { horizontal: hAlign, vertical: vAlign, wrapText: wrap };
  cell.border = CELL_BORDER;
}

function getEntryLabel(group, source) {
  if (source === 'spelling') {
    if (group.category === 'caution') return cautionResultChipLabel(group);
    if (group.label) return group.label;
    const first = group.instances[0];
    return first ? `${first.matchedText} → ${first.suggestedText}` : '';
  }
  return group.label;
}

/**
 * @param {{ text: string, strike?: boolean }[]} pageRuns
 * @returns {string}
 */
function pageRunsToPlainText(pageRuns) {
  return pageRuns.map((r) => r.text).join('');
}

/**
 * @param {{ text: string, strike?: boolean }[]} pageRuns
 */
function pageRunsToExcelRichText(pageRuns) {
  return pageRuns.map((run) => {
    if (run.strike == null) {
      return { text: run.text };
    }
    return {
      text: run.text,
      font: {
        name: 'Arial',
        size: 10,
        strike: Boolean(run.strike),
        color: { argb: run.strike ? 'FF999999' : 'FF000000' },
      },
    };
  });
}

/**
 * 기준란에 적힌 표면형(한 번, 한번 / 같이 …) — 페이지 열에 문구를 붙일지 판단용.
 * @param {object} group
 * @returns {Set<string>}
 */
function spellingCriteriaSurfaceForms(group) {
  /** @type {Set<string>} */
  const forms = new Set();
  const add = (raw) => {
    const n = String(raw ?? '')
      .replace(/\s+/g, '')
      .trim();
    if (n.length >= 1) forms.add(n);
  };
  const pushParts = (raw) => {
    const base = String(raw ?? '')
      .replace(/→.*$/u, '')
      .replace(/（[^）]*）|\([^)]*\)/gu, ' ');
    for (const part of base.split(/[,|·/]/u)) {
      const cleaned = part.replace(/[\\^$*+?()[\]{}|]/g, '').trim();
      if (cleaned) add(cleaned);
    }
  };
  pushParts(group?.find);
  pushParts(group?.replace);
  pushParts(group?.label);
  return forms;
}

/**
 * @param {string} matchedText
 * @param {Set<string>} forms
 */
function matchedTextNeedsPageAnnotation(matchedText, forms) {
  const mt = String(matchedText ?? '').trim();
  if (!mt) return false;
  const n = mt.replace(/\s+/g, '');
  if (!n) return false;
  if (forms.has(n)) return false;
  return true;
}

/**
 * @param {ReturnType<typeof buildInstancePills>} pills
 * @param {(systemPage: number) => string} formatPageLabel
 * @param {string} source
 * @param {object} group
 * @param {(source: string, group: object, inst: object) => boolean} [isInstanceVisible]
 * @param {{ annotateDistinctMatchedText?: boolean }} [options]
 * @returns {{ text: string, strike?: boolean }[]}
 */
function buildPageRuns(
  pills,
  formatPageLabel,
  source,
  group,
  isInstanceVisible,
  options = {},
) {
  const annotate = Boolean(options.annotateDistinctMatchedText);
  const forms = annotate ? spellingCriteriaSurfaceForms(group) : null;

  /** @type {{ label: string, strike: boolean, annotated: boolean }[]} */
  const items = [];
  for (const { inst, indexOnPage, totalOnPage } of pills) {
    const pageLabel = formatPageLabel(inst.pageNum);
    const fragment = totalOnPage > 1 ? ` ${indexOnPage}/${totalOnPage}` : '';
    const pagePart = `${pageLabel}${fragment}`;
    const mt = String(inst.matchedText ?? '').trim();
    const annotated =
      annotate && forms != null && matchedTextNeedsPageAnnotation(mt, forms);
    const label = annotated ? `${mt} ${pagePart}` : pagePart;
    const hidden = isInstanceVisible ? !isInstanceVisible(source, group, inst) : false;
    items.push({ label, strike: hidden, annotated });
  }

  const sep = items.some((it) => it.annotated) ? ', ' : '  ';
  /** @type {{ text: string, strike?: boolean }[]} */
  const runs = [];
  for (let i = 0; i < items.length; i++) {
    if (i > 0) runs.push({ text: sep });
    runs.push({ text: items[i].label, strike: items[i].strike });
  }
  return runs;
}

// ── 묶음(divider) 정렬 ────────────────────────────────────────────

/**
 * 맞춤법 내보내기 전용 정렬(방식 1).
 * @param {{group: import('../lib/ruleEngine.js').GroupedResult, source: string}[]} entries
 */
function orderEntriesByDividerGroup(entries) {
  const caution = [];
  const builtin = [];
  for (const e of entries) {
    if (e.group?.category === 'caution') caution.push(e);
    else builtin.push(e);
  }
  const buckets = new Map();
  for (const e of builtin) {
    const key = e.group?.dividerGroup || '\0';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(e);
  }
  const groupedBuiltin = [];
  for (const arr of buckets.values()) groupedBuiltin.push(...arr);
  return [...caution, ...groupedBuiltin];
}

/**
 * @param {BlobPart} buffer
 * @param {string} filename
 */
export function downloadXlsxBuffer(buffer, filename) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 클릭 직후 즉시 revoke하면 큰 xlsx에서 브라우저가 다운로드를 취소하는 경우가 있음
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ── 맞춤법 조판 ───────────────────────────────────────────────────

/**
 * @typedef {{
 *   category: string,
 *   groupLabel: string,
 *   dividerGroupKey: string,
 *   label: string,
 *   tip: string,
 *   matchedText: string,
 *   suggestedText: string,
 *   pageText: string,
 *   pageStrike: boolean,
 *   isCaution: boolean,
 *   pagesHidden: boolean,
 *   rowId?: string,
 *   pageNum?: number | '',
 *   start?: number | '',
 *   end?: number | '',
 *   pdfName?: string,
 *   pdfPages?: number | '',
 *   pageFp?: string,
 * }} SpellingExportRow
 */

/**
 * @param {object} options
 * @returns {{
 *   pdfName: string,
 *   pdfPages: number | '',
 *   pageFpByNum: Map<number, string>,
 * }}
 */
function exportPdfMetaFromOptions(options = {}) {
  const pdfName = String(options.pdfFileName ?? options.pdfName ?? '').trim();
  const pagesRaw = options.pdfPages ?? options.numPages;
  const pdfPages =
    pagesRaw === '' || pagesRaw == null || !Number.isFinite(Number(pagesRaw))
      ? ''
      : Number(pagesRaw);
  const pageFpByNum =
    options.pageFpByNum instanceof Map
      ? options.pageFpByNum
      : buildPageFingerprintMap(options.pageTexts);
  return { pdfName, pdfPages, pageFpByNum };
}

/**
 * @param {SpellingExportRow | object} row
 * @param {ReturnType<typeof buildMachineExportFields>} machine
 */
function withMachineFields(row, machine) {
  return {
    ...row,
    rowId: machine.rowId,
    pageNum: machine.pageNum,
    start: machine.start,
    end: machine.end,
    pdfName: machine.pdfName,
    pdfPages: machine.pdfPages,
    pageFp: machine.pageFp,
  };
}

/**
 * @param {import('../lib/ruleEngine.js').MatchInstance} inst
 * @param {number} indexOnPage
 * @param {number} totalOnPage
 * @param {(systemPage: number) => string} formatPageLabel
 */
function formatInstancePageText(inst, indexOnPage, totalOnPage, formatPageLabel) {
  let pageLabel = formatPageLabel
    ? String(formatPageLabel(inst.pageNum) ?? '').trim()
    : `${inst.pageNum}P`;
  if (!pageLabel) pageLabel = `${inst.pageNum}P`;
  else if (!/P$/i.test(pageLabel)) pageLabel = `${pageLabel}P`;
  const fragment = totalOnPage > 1 ? ` ${indexOnPage}/${totalOnPage}` : '';
  return `${pageLabel}${fragment}`;
}

/**
 * @typedef {{
 *   kind: 'spelling',
 *   sheetName: string,
 *   filename: string,
 *   summaryLine: string,
 *   summary: {
 *     cautionCriteriaCount: number,
 *     cautionFindingsCount: number,
 *     builtinCriteriaCount: number,
 *     builtinFindingsCount: number,
 *     totalFindings: number,
 *     cautionSelected: boolean,
 *     builtinSelected: boolean,
 *   },
 *   rows: SpellingExportRow[],
 * }} SpellingExportModel
 */

/**
 * 화면/세션 → 순수 JSON 조판 (ExcelJS 없음).
 * @param {{
 *   entries: {group: import('../lib/ruleEngine.js').GroupedResult, source: string}[],
 *   formatPageLabel: (systemPage: number) => string,
 *   isInstanceVisible: (source: string, group: object, inst: object) => boolean,
 *   groupVisibilityMode: (source: string, group: object) => 'visible' | 'partial' | 'hidden',
 *   visibleInstanceCount: (source: string, group: object) => number,
 *   cautionCriteriaCount: number,
 *   cautionFindingsCount: number,
 *   builtinCriteriaCount: number,
 *   builtinFindingsCount: number,
 *   totalFindings: number,
 *   cautionSelected?: boolean,
 *   builtinSelected?: boolean,
 *   filename?: string,
 * }} options
 * @returns {SpellingExportModel}
 */
export function buildSpellingExportModel(options) {
  const {
    entries,
    formatPageLabel,
    isInstanceVisible,
    groupVisibilityMode,
    visibleInstanceCount,
    cautionCriteriaCount,
    cautionFindingsCount,
    builtinCriteriaCount,
    builtinFindingsCount,
    totalFindings,
    cautionSelected = true,
    builtinSelected = true,
    filename = '맞춤법_검사결과.xlsx',
  } = options;
  const { pdfName, pdfPages, pageFpByNum } = exportPdfMetaFromOptions(options);
  const summary = {
    cautionCriteriaCount,
    cautionFindingsCount,
    builtinCriteriaCount,
    builtinFindingsCount,
    totalFindings,
    cautionSelected,
    builtinSelected,
  };
  const orderedEntries = orderEntriesByDividerGroup(entries ?? []);
  /** @type {SpellingExportRow[]} */
  const rows = [];
  // visibleInstanceCount는 요약 줄용으로 호출부에서 이미 집계됨 — 건별 행에서는 pills만 씀
  void visibleInstanceCount;

  for (const { group, source } of orderedEntries) {
    if (group.category === 'manuscript-search') {
      const hasReplace = (group.instances ?? []).some((inst) =>
        String(inst.suggestedText ?? inst.replace ?? group.replace ?? '').trim(),
      );
      if (!hasReplace) continue;
    }
    const isCaution = group.category === 'caution';
    const isManual = group.category === 'manual';
    const isSpacing = String(group.category ?? '').startsWith('spacing:');
    const category = isCaution
      ? '편집자 검토 필요'
      : isManual
        ? '수정 추가'
        : isSpacing
          ? '띄어쓰기'
          : '맞춤법 규칙';
    const tipText =
      (group.tip || '').trim() ||
      (source === 'spelling' && !isCaution && !isSpacing && !isManual
        ? getBuiltInTip(group.find, group.replace, group.spellingRuleId) || ''
        : '');
    const visMode = groupVisibilityMode ? groupVisibilityMode(source, group) : 'visible';
    if (visMode === 'hidden') continue;
    const criteriaLabel = getEntryLabel(group, source);
    const pills = buildInstancePills(group.instances ?? []);
    const fallbackSuggested = String(group.replace ?? '').trim();
    const sourceKey = `${category}|${criteriaLabel}|${group.cautionId ?? group.find ?? ''}`;

    for (const { inst, indexOnPage, totalOnPage } of pills) {
      if (isInstanceVisible && !isInstanceVisible(source, group, inst)) continue;
      const matchedText = String(inst.matchedText ?? '').trim();
      const suggestedText = isCaution
        ? ''
        : String(inst.suggestedText ?? fallbackSuggested).trim();
      const machine = buildMachineExportFields({
        inst,
        sourceKey,
        pdfName,
        pdfPages,
        pageFpByNum,
      });
      rows.push(
        withMachineFields(
          {
            category,
            groupLabel: group.dividerLabel || '-',
            dividerGroupKey: String(group.dividerGroup ?? ''),
            label: criteriaLabel,
            tip: tipText,
            matchedText,
            suggestedText,
            pageText: formatInstancePageText(
              inst,
              indexOnPage,
              totalOnPage,
              formatPageLabel,
            ),
            pageStrike: false,
            isCaution,
            pagesHidden: false,
          },
          machine,
        ),
      );
    }
  }

  return {
    kind: 'spelling',
    sheetName: '맞춤법 확인',
    filename,
    summaryLine: formatSpellingExcelSummaryLine(summary),
    summary,
    rows,
  };
}

/**
 * 허브에 저장된 옛 집계형 행도 건별 스키마로 맞춰 다시 내려받게 한다.
 * @param {object} row
 * @returns {SpellingExportRow}
 */
function emptyMachineFields() {
  return {
    rowId: '',
    pageNum: /** @type {number | ''} */ (''),
    start: /** @type {number | ''} */ (''),
    end: /** @type {number | ''} */ (''),
    pdfName: '',
    pdfPages: /** @type {number | ''} */ (''),
    pageFp: '',
  };
}

function normalizeSpellingExportRow(row) {
  if (row && typeof row.matchedText === 'string' && 'pageText' in row) {
    return /** @type {SpellingExportRow} */ ({
      ...emptyMachineFields(),
      ...row,
      rowId: String(row.rowId ?? ''),
      pageNum: row.pageNum ?? '',
      start: row.start ?? '',
      end: row.end ?? '',
      pdfName: String(row.pdfName ?? ''),
      pdfPages: row.pdfPages ?? '',
      pageFp: String(row.pageFp ?? ''),
    });
  }
  const pageRuns = Array.isArray(row?.pageRuns) ? row.pageRuns : [];
  return {
    category: String(row?.category ?? ''),
    groupLabel: String(row?.groupLabel ?? '-'),
    dividerGroupKey: String(row?.dividerGroupKey ?? ''),
    label: String(row?.label ?? ''),
    tip: String(row?.tip ?? ''),
    matchedText: String(row?.label ?? ''),
    suggestedText: '',
    pageText: pageRunsToPlainText(pageRuns),
    pageStrike: false,
    isCaution: Boolean(row?.isCaution),
    pagesHidden: Boolean(row?.pagesHidden),
    ...emptyMachineFields(),
  };
}

/**
 * @param {import('exceljs').Worksheet} ws
 * @param {number} colCount
 * @param {string} summaryLine
 */
function writeExportGuideRows(ws, colCount, summaryLine) {
  const lastCol = colCount;
  ws.mergeCells(1, 1, 1, lastCol);
  const guideCell = ws.getCell('A1');
  guideCell.value = { richText: EXCEL_CLIP_GUIDE_RICHTEXT };
  guideCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
  guideCell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
  guideCell.border = CELL_BORDER;
  ws.getRow(1).height = 36;

  ws.mergeCells(2, 1, 2, lastCol);
  const summaryCell = ws.getCell('A2');
  summaryCell.value = summaryLine;
  summaryCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF000000' } };
  summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
  summaryCell.alignment = { horizontal: 'left', vertical: 'center', indent: 1, wrapText: false };
  summaryCell.border = CELL_BORDER;
  ws.getRow(2).height = 30;
}

/**
 * @param {import('exceljs').Row} headerRow
 * @param {string[]} humanHeaders
 */
function writeExportHeaderRow(headerRow, humanHeaders) {
  humanHeaders.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    applyStyle(cell, { bg: HEADER_BG, fg: HEADER_FG, bold: true, hAlign: 'center' });
  });
  MACHINE_COL_HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(humanHeaders.length + i + 1);
    cell.value = h;
    applyStyle(cell, {
      bg: MACHINE_HEADER_BG,
      fg: HEADER_FG,
      bold: true,
      hAlign: 'center',
      size: 8,
    });
  });
  headerRow.height = 34;
}

/**
 * @param {import('exceljs').Row} row
 * @param {number} startCol
 * @param {object} rowData
 * @param {string} bg
 */
function writeMachineExportCells(row, startCol, rowData, bg) {
  const values = [
    rowData.rowId ?? '',
    rowData.pageNum ?? '',
    rowData.start ?? '',
    rowData.end ?? '',
    rowData.pdfName ?? '',
    rowData.pdfPages ?? '',
    rowData.pageFp ?? '',
  ];
  values.forEach((value, i) => {
    const cell = row.getCell(startCol + i);
    if (typeof value === 'number') {
      cell.value = value;
    } else {
      setExcelTextCell(cell, value);
    }
    applyStyle(cell, { bg, hAlign: 'left', vAlign: 'top', wrap: true, size: 9 });
  });
}

/**
 * @param {object} row
 * @returns {ConsistencyExportRow}
 */
function normalizeConsistencyExportRow(row) {
  if (row && typeof row.matchedText === 'string' && 'pageText' in row) {
    return /** @type {ConsistencyExportRow} */ ({
      ...emptyMachineFields(),
      ...row,
      suggestedText: String(row.suggestedText ?? ''),
      rowId: String(row.rowId ?? ''),
      pageNum: row.pageNum ?? '',
      start: row.start ?? '',
      end: row.end ?? '',
      pdfName: String(row.pdfName ?? ''),
      pdfPages: row.pdfPages ?? '',
      pageFp: String(row.pageFp ?? ''),
    });
  }
  const pageRuns = Array.isArray(row?.pageRuns) ? row.pageRuns : [];
  return {
    category: String(row?.category ?? ''),
    label: String(row?.label ?? ''),
    tip: String(row?.tip ?? ''),
    matchedText: String(row?.label ?? ''),
    suggestedText: '',
    pageText: pageRunsToPlainText(pageRuns),
    pageStrike: false,
    isAuxiliary: Boolean(row?.isAuxiliary),
    pagesHidden: Boolean(row?.pagesHidden),
    ...emptyMachineFields(),
  };
}

/**
 * 조판 모델 → ExcelJS workbook buffer.
 * @param {SpellingExportModel} model
 * @returns {Promise<ArrayBuffer>}
 */
export async function writeSpellingWorkbook(model) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = '인디야';
  const ws = wb.addWorksheet(model.sheetName || '맞춤법 확인');
  const colCount = SPELLING_HUMAN_HEADERS.length + MACHINE_COL_HEADERS.length;

  ws.columns = [
    { width: 14 },
    { width: 14 },
    { width: 24 },
    { width: 28 },
    { width: 18 },
    { width: 16 },
    { width: 12 },
    { width: 22 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 18 },
    { width: 10 },
    { width: 12 },
  ];

  writeExportGuideRows(ws, colCount, model.summaryLine || '');
  writeExportHeaderRow(ws.getRow(3), SPELLING_HUMAN_HEADERS);

  const rows = (model.rows ?? []).map(normalizeSpellingExportRow);

  for (let i = 0; i < rows.length; i++) {
    const excelRowNum = i + 4;
    const rowData = rows[i];
    const bg = rowData.isCaution ? CAUTION_BG : BUILTIN_BG;
    const linesMatch = estimateLines(rowData.matchedText, 18);
    const linesSuggest = estimateLines(rowData.suggestedText, 16);
    const linesPage = estimateLines(rowData.pageText, 12);
    const row = ws.getRow(excelRowNum);
    row.height = rowHeightPt(linesMatch, linesSuggest, linesPage, 2);

    const catCell = row.getCell(1);
    catCell.value = rowData.category;
    applyStyle(catCell, { bg, hAlign: 'center', vAlign: 'top' });

    const groupCell = row.getCell(2);
    groupCell.value = rowData.groupLabel;
    applyStyle(groupCell, { bg, hAlign: 'center', vAlign: 'top' });

    const labelCell = row.getCell(3);
    labelCell.value = rowData.label;
    applyStyle(labelCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });

    const tipCell = row.getCell(4);
    tipCell.value = rowData.tip;
    applyStyle(tipCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });

    const matchCell = row.getCell(5);
    setExcelTextCell(matchCell, rowData.matchedText);
    applyStyle(matchCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });

    const suggestCell = row.getCell(6);
    setExcelTextCell(suggestCell, rowData.suggestedText);
    applyStyle(suggestCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });

    const pagesCell = row.getCell(7);
    pagesCell.value = rowData.pageText || '';
    applyStyle(pagesCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });

    writeMachineExportCells(row, SPELLING_HUMAN_HEADERS.length + 1, rowData, bg);
  }

  return wb.xlsx.writeBuffer();
}

/**
 * @param {Parameters<typeof buildSpellingExportModel>[0]} options
 */
export async function exportSpellingResults(options) {
  const model = buildSpellingExportModel(options);
  const buffer = await writeSpellingWorkbook(model);
  downloadXlsxBuffer(buffer, model.filename);
  return model;
}

/**
 * 저장된 조판 모델만으로 엑셀 다운로드 (허브 재다운로드용).
 * @param {SpellingExportModel} model
 * @param {string} [filename]
 */
export async function downloadSpellingExportModel(model, filename) {
  const buffer = await writeSpellingWorkbook(model);
  downloadXlsxBuffer(buffer, filename || model.filename || '맞춤법_검사결과.xlsx');
}

// ── 일관성 조판 ───────────────────────────────────────────────────

/**
 * @param {import('./ruleEngine.js').GroupedResult} group
 * @param {import('./ruleTypes.js').Rule[]} [customRules]
 */
function consistencyCategoryOf(group, customRules = []) {
  if (group.patternKind === 'auxiliary-verb') {
    return AUXILIARY_EXPORT_CATEGORY;
  }
  if (group.patternKind === 'phrase-slot-find') {
    return '공통 항목 찾기';
  }
  if (isConsistencyUnifyResultGroup(customRules, group)) {
    return UNIFY_FEATURE_LABEL;
  }
  return LITERAL_FIND_FEATURE_LABEL;
}

/**
 * @param {import('./ruleEngine.js').GroupedResult} group
 * @param {import('./ruleTypes.js').Rule[]} [customRules]
 */
function consistencyExportTip(group, customRules = []) {
  if (isConsistencyUnifyResultGroup(customRules, group)) {
    const pinned = getConsistencyUnifyPinnedTailWord(customRules);
    const tail = resolveConsistencyGroupTailWord(group);
    if (pinned && tail === pinned) {
      return UNIFY_PINNED_EXPORT_TIP;
    }
    return UNIFY_NEED_EXPORT_TIP;
  }
  return (group.tip || '').trim();
}

/**
 * 본용언+보조용언 설명란 — 발견 문구(쪽).
 * 예: 쉬어 가라고(1P), 되어 간다는(19P)
 * @param {import('./ruleEngine.js').GroupedResult} group
 * @param {string} source
 * @param {(systemPage: number) => string} formatPageLabel
 * @param {(source: string, group: object, inst: object) => boolean} [isInstanceVisible]
 * @returns {string}
 */
export function formatAuxiliaryExportExamples(
  group,
  source,
  formatPageLabel,
  isInstanceVisible,
) {
  /** @type {string[]} */
  const parts = [];
  for (const inst of group?.instances ?? []) {
    if (
      isInstanceVisible &&
      !isInstanceVisible(source, group, inst)
    ) {
      continue;
    }
    const text = String(inst.matchedText ?? '').trim();
    if (!text) continue;
    let page = formatPageLabel
      ? String(formatPageLabel(inst.pageNum) ?? '').trim()
      : `${inst.pageNum}P`;
    if (!page) page = `${inst.pageNum}P`;
    else if (!/P$/i.test(page)) page = `${page}P`;
    parts.push(`${text}(${page})`);
  }
  return parts.join(', ');
}

/**
 * @param {import('./ruleEngine.js').GroupedResult} group
 */
function consistencyEntryLabel(group) {
  if (group.patternKind === 'auxiliary-verb') {
    return group.tailWord
      ? formatAuxiliaryVerbResultLabel(group.tailWord, group.groupDisplayLabel)
      : group.groupDisplayLabel?.trim() || group.label || '';
  }
  return group.label || group.find || '';
}

/**
 * @typedef {{
 *   category: string,
 *   label: string,
 *   tip: string,
 *   matchedText: string,
 *   suggestedText: string,
 *   pageText: string,
 *   pageStrike: boolean,
 *   isAuxiliary: boolean,
 *   pagesHidden: boolean,
 *   rowId?: string,
 *   pageNum?: number | '',
 *   start?: number | '',
 *   end?: number | '',
 *   pdfName?: string,
 *   pdfPages?: number | '',
 *   pageFp?: string,
 * }} ConsistencyExportRow
 */

/**
 * 표기 통일 수정안 — 📌통일형만 채움. 나머지는 빈 칸.
 * @param {string} tipText
 * @param {object} group
 * @param {object} inst
 * @param {import('./ruleTypes.js').Rule[]} customRules
 */
function consistencySuggestedForExport(tipText, group, inst, customRules) {
  if (tipText !== UNIFY_PINNED_EXPORT_TIP) return '';
  const pinned = getConsistencyUnifyPinnedTailWord(customRules);
  return String(inst.suggestedText ?? pinned ?? group.replace ?? '').trim();
}

/**
 * @typedef {{
 *   sheetName: string,
 *   summaryLine: string,
 *   rows: ConsistencyExportRow[],
 * }} ConsistencyExportSheet
 */

/**
 * @typedef {{
 *   kind: 'consistency',
 *   sheetName: string,
 *   filename: string,
 *   summaryLine: string,
 *   summary: {
 *     literalCriteriaCount: number,
 *     literalFindingsCount: number,
 *     unifyCriteriaCount: number,
 *     unifyFindingsCount: number,
 *     commonStringCriteriaCount: number,
 *     commonStringFindingsCount: number,
 *     auxiliaryCriteriaCount: number,
 *     auxiliaryFindingsCount: number,
 *     totalFindings: number,
 *     literalSelected: boolean,
 *     unifySelected: boolean,
 *     commonStringSelected: boolean,
 *     auxiliarySelected: boolean,
 *   },
 *   rows: ConsistencyExportRow[],
 *   recommend: ConsistencyExportSheet | null,
 * }} ConsistencyExportModel
 */

/**
 * @param {number} itemCount
 * @param {number} findingsCount
 */
export function formatUnifyCandidateExcelSummaryLine(itemCount, findingsCount) {
  return `표기 통일 추천 ${itemCount}항목 전체 발견 ${findingsCount}`;
}

/**
 * @param {{
 *   entries: {group: import('./ruleEngine.js').GroupedResult, source: string}[],
 *   formatPageLabel: (systemPage: number) => string,
 *   isInstanceVisible: (source: string, group: object, inst: object) => boolean,
 *   groupVisibilityMode: (source: string, group: object) => 'visible' | 'partial' | 'hidden',
 *   visibleInstanceCount: (source: string, group: object) => number,
 *   literalCriteriaCount: number,
 *   literalFindingsCount: number,
 *   unifyCriteriaCount?: number,
 *   unifyFindingsCount?: number,
 *   commonStringCriteriaCount: number,
 *   commonStringFindingsCount: number,
 *   auxiliaryCriteriaCount: number,
 *   auxiliaryFindingsCount: number,
 *   totalFindings: number,
 *   literalSelected?: boolean,
 *   unifySelected?: boolean,
 *   commonStringSelected?: boolean,
 *   auxiliarySelected?: boolean,
 *   customRules?: import('./ruleTypes.js').Rule[],
 *   recommendEntries?: {group: import('./ruleEngine.js').GroupedResult, source: string}[],
 *   filename?: string,
 * }} options
 * @returns {ConsistencyExportModel}
 */
export function buildConsistencyExportModel(options) {
  const {
    entries,
    formatPageLabel,
    isInstanceVisible,
    groupVisibilityMode,
    visibleInstanceCount,
    literalCriteriaCount,
    literalFindingsCount,
    unifyCriteriaCount = 0,
    unifyFindingsCount = 0,
    commonStringCriteriaCount,
    commonStringFindingsCount,
    auxiliaryCriteriaCount,
    auxiliaryFindingsCount,
    totalFindings,
    literalSelected = true,
    unifySelected = true,
    commonStringSelected = true,
    auxiliarySelected = true,
    customRules = [],
    recommendEntries = [],
    filename = '표기통일_검사결과.xlsx',
  } = options;
  const { pdfName, pdfPages, pageFpByNum } = exportPdfMetaFromOptions(options);
  const summary = {
    literalCriteriaCount,
    literalFindingsCount,
    unifyCriteriaCount,
    unifyFindingsCount,
    commonStringCriteriaCount,
    commonStringFindingsCount,
    auxiliaryCriteriaCount,
    auxiliaryFindingsCount,
    totalFindings,
    literalSelected,
    unifySelected,
    commonStringSelected,
    auxiliarySelected,
  };
  /** @type {ConsistencyExportRow[]} */
  const rows = [];
  void visibleInstanceCount;

  for (const { group, source } of entries ?? []) {
    const category = consistencyCategoryOf(group, customRules);
    const isAuxiliary = category === AUXILIARY_EXPORT_CATEGORY;
    const visMode = groupVisibilityMode ? groupVisibilityMode(source, group) : 'visible';
    if (visMode === 'hidden') continue;
    const tipText = consistencyExportTip(group, customRules);

    // 공통 항목 — 채워진 표기별로 기준을 나누고, 발견은 건별 행
    if (group.patternKind === 'phrase-slot-find') {
      const fills = groupPhraseSlotInstancesByFill(group.instances);
      for (const fill of fills) {
        const pills = buildInstancePills(fill.instances);
        const fillLabel = encodeSpacesVisible(fill.text);
        const sourceKey = `${category}|${fillLabel}`;
        for (const { inst, indexOnPage, totalOnPage } of pills) {
          if (isInstanceVisible && !isInstanceVisible(source, group, inst)) {
            continue;
          }
          const machine = buildMachineExportFields({
            inst,
            sourceKey,
            pdfName,
            pdfPages,
            pageFpByNum,
          });
          rows.push(
            withMachineFields(
              {
                category,
                label: fillLabel,
                tip: tipText,
                matchedText: String(inst.matchedText ?? fill.text ?? '').trim(),
                suggestedText: consistencySuggestedForExport(
                  tipText,
                  group,
                  inst,
                  customRules,
                ),
                pageText: formatInstancePageText(
                  inst,
                  indexOnPage,
                  totalOnPage,
                  formatPageLabel,
                ),
                pageStrike: false,
                isAuxiliary: false,
                pagesHidden: false,
              },
              machine,
            ),
          );
        }
      }
      continue;
    }

    const pills = buildInstancePills(group.instances ?? []);
    const criteriaLabel = consistencyEntryLabel(group);
    const sourceKey = `${category}|${criteriaLabel}`;
    for (const { inst, indexOnPage, totalOnPage } of pills) {
      if (isInstanceVisible && !isInstanceVisible(source, group, inst)) continue;
      const machine = buildMachineExportFields({
        inst,
        sourceKey,
        pdfName,
        pdfPages,
        pageFpByNum,
      });
      rows.push(
        withMachineFields(
          {
            category,
            label: criteriaLabel,
            tip: tipText,
            matchedText: String(inst.matchedText ?? '').trim(),
            suggestedText: consistencySuggestedForExport(
              tipText,
              group,
              inst,
              customRules,
            ),
            pageText: formatInstancePageText(
              inst,
              indexOnPage,
              totalOnPage,
              formatPageLabel,
            ),
            pageStrike: false,
            isAuxiliary,
            pagesHidden: false,
          },
          machine,
        ),
      );
    }
  }

  /** @type {ConsistencyExportRow[]} */
  const recommendRows = [];
  let recommendCriteria = 0;
  let recommendFindings = 0;
  for (const { group, source } of recommendEntries ?? []) {
    if (!group?.instances?.length) continue;
    recommendCriteria += 1;
    const criteriaLabel =
      consistencyEntryLabel(group) || group.label || group.find || '';
    const tip = String(group.tip ?? '').trim();
    const pills = buildInstancePills(group.instances);
    const sourceKey = `${UNIFY_CANDIDATE_EXPORT_CATEGORY}|${criteriaLabel}`;
    for (const { inst, indexOnPage, totalOnPage } of pills) {
      recommendFindings += 1;
      const machine = buildMachineExportFields({
        inst,
        sourceKey,
        pdfName,
        pdfPages,
        pageFpByNum,
      });
      recommendRows.push(
        withMachineFields(
          {
            category: UNIFY_CANDIDATE_EXPORT_CATEGORY,
            label: criteriaLabel,
            tip,
            matchedText: String(inst.matchedText ?? '').trim(),
            suggestedText: '',
            pageText: formatInstancePageText(
              inst,
              indexOnPage,
              totalOnPage,
              formatPageLabel,
            ),
            pageStrike: false,
            isAuxiliary: false,
            pagesHidden: false,
          },
          machine,
        ),
      );
    }
  }

  /** @type {ConsistencyExportSheet | null} */
  const recommend =
    recommendRows.length > 0
      ? {
          sheetName: UNIFY_CANDIDATE_EXPORT_CATEGORY,
          summaryLine: formatUnifyCandidateExcelSummaryLine(
            recommendCriteria,
            recommendFindings,
          ),
          rows: recommendRows,
        }
      : null;

  return {
    kind: 'consistency',
    sheetName: '표기 통일 확인',
    filename,
    summaryLine: formatConsistencyExcelSummaryLine(summary),
    summary,
    rows,
    recommend,
  };
}

/**
 * @param {import('exceljs').Workbook} wb
 * @param {{
 *   sheetName: string,
 *   summaryLine: string,
 *   rows: ConsistencyExportRow[],
 * }} sheet
 */
function addConsistencyWorksheet(wb, sheet) {
  const ws = wb.addWorksheet(sheet.sheetName || '표기 통일 확인');
  const colCount = CONSISTENCY_HUMAN_HEADERS.length + MACHINE_COL_HEADERS.length;

  ws.columns = [
    { width: 16 },
    { width: 24 },
    { width: 28 },
    { width: 18 },
    { width: 16 },
    { width: 12 },
    { width: 22 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 18 },
    { width: 10 },
    { width: 12 },
  ];

  writeExportGuideRows(ws, colCount, sheet.summaryLine || '');
  writeExportHeaderRow(ws.getRow(3), CONSISTENCY_HUMAN_HEADERS);

  const rows = (sheet.rows ?? []).map(normalizeConsistencyExportRow);

  for (let i = 0; i < rows.length; i++) {
    const excelRowNum = i + 4;
    const rowData = rows[i];
    const bg = rowData.isAuxiliary ? CAUTION_BG : BUILTIN_BG;
    const linesMatch = estimateLines(rowData.matchedText, 18);
    const linesSuggest = estimateLines(rowData.suggestedText, 16);
    const linesPage = estimateLines(rowData.pageText, 12);
    const row = ws.getRow(excelRowNum);
    row.height = rowHeightPt(linesMatch, linesSuggest, linesPage, 2);

    const catCell = row.getCell(1);
    catCell.value = rowData.category;
    applyStyle(catCell, { bg, hAlign: 'center', vAlign: 'top' });

    const labelCell = row.getCell(2);
    labelCell.value = rowData.label;
    applyStyle(labelCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });

    const tipCell = row.getCell(3);
    tipCell.value = rowData.tip;
    applyStyle(tipCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });

    const matchCell = row.getCell(4);
    setExcelTextCell(matchCell, rowData.matchedText);
    applyStyle(matchCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });

    const suggestCell = row.getCell(5);
    setExcelTextCell(suggestCell, rowData.suggestedText);
    applyStyle(suggestCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });

    const pagesCell = row.getCell(6);
    pagesCell.value = rowData.pageText || '';
    applyStyle(pagesCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });

    writeMachineExportCells(row, CONSISTENCY_HUMAN_HEADERS.length + 1, rowData, bg);
  }
}

/**
 * @param {ConsistencyExportModel} model
 * @returns {Promise<ArrayBuffer>}
 */
export async function writeConsistencyWorkbook(model) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = '인디야';

  const recommend = model.recommend;
  if (recommend?.rows?.length) {
    addConsistencyWorksheet(wb, {
      sheetName: recommend.sheetName || UNIFY_CANDIDATE_EXPORT_CATEGORY,
      summaryLine: recommend.summaryLine || '',
      rows: recommend.rows,
    });
  }

  if ((model.rows ?? []).length > 0) {
    addConsistencyWorksheet(wb, {
      sheetName: model.sheetName || '표기 통일 확인',
      summaryLine: model.summaryLine || '',
      rows: model.rows,
    });
  }

  // 둘 다 비면 빈 등록 시트라도 만들어 기존 호출처·스냅숏 재다운로드가 깨지지 않게 함
  if (wb.worksheets.length === 0) {
    addConsistencyWorksheet(wb, {
      sheetName: model.sheetName || '표기 통일 확인',
      summaryLine: model.summaryLine || '',
      rows: [],
    });
  }

  return wb.xlsx.writeBuffer();
}

/**
 * @param {Parameters<typeof buildConsistencyExportModel>[0]} options
 */
export async function exportConsistencyResults(options) {
  const model = buildConsistencyExportModel(options);
  const hasRecommend = Boolean(model.recommend?.rows?.length);
  const hasRegistered = (model.rows ?? []).length > 0;
  if (!hasRecommend && !hasRegistered) {
    return model;
  }
  const buffer = await writeConsistencyWorkbook(model);
  downloadXlsxBuffer(buffer, model.filename);
  return model;
}

/**
 * @param {ConsistencyExportModel} model
 * @param {string} [filename]
 */
export async function downloadConsistencyExportModel(model, filename) {
  const buffer = await writeConsistencyWorkbook(model);
  downloadXlsxBuffer(buffer, filename || model.filename || '표기통일_검사결과.xlsx');
}
