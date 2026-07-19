import { buildInstancePills } from '../components/ResultPageSummary.jsx';
import { getBuiltInTip } from './builtInRules.js';
import { cautionResultChipLabel } from './cautionRules.js';
import { AUXILIARY_VERB_BADGE_LABEL } from './bonBojoRules.js';
import {
  formatConsistencyExcelSummaryLine,
  formatSpellingExcelSummaryLine,
} from './checkResultSummaryFormat.js';
import { LITERAL_FIND_FEATURE_LABEL } from './consistencyRuleLimit.js';
import { formatAuxiliaryVerbResultLabel } from './patternDisplayLabels.js';

const AUXILIARY_EXPORT_CATEGORY = AUXILIARY_VERB_BADGE_LABEL;

const HEADER_BG = 'FF3E2723';
const HEADER_FG = 'FFFFFFFF';
const CAUTION_BG = 'FFD7CCC8';
const BUILTIN_BG = 'FFEFEBE9';
const THIN_BORDER_COLOR = 'FFBBBBBB';

const THIN = { style: 'thin', color: { argb: THIN_BORDER_COLOR } };
const CELL_BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN };

const EXCEL_GUIDE_FONT = { name: 'Arial', size: 9, color: { argb: 'FF555555' } };

/** 엑셀 1행 안내 — 잘림 시 행·열 자동 맞춤 (굵은 구간 = 단축키~열 너비) */
const EXCEL_CLIP_GUIDE_RICHTEXT = [
  {
    text: '※ 내용이 잘려 보이면 ',
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
 * @param {ReturnType<typeof buildInstancePills>} pills
 * @param {(systemPage: number) => string} formatPageLabel
 * @param {string} source
 * @param {object} group
 * @param {(source: string, group: object, inst: object) => boolean} [isInstanceVisible]
 * @returns {{ text: string, strike?: boolean }[]}
 */
function buildPageRuns(pills, formatPageLabel, source, group, isInstanceVisible) {
  /** @type {{ text: string, strike?: boolean }[]} */
  const runs = [];
  for (let i = 0; i < pills.length; i++) {
    const { inst, indexOnPage, totalOnPage } = pills[i];
    const pageLabel = formatPageLabel(inst.pageNum);
    const fragment = totalOnPage > 1 ? ` ${indexOnPage}/${totalOnPage}` : '';
    const label = `${pageLabel}${fragment}`;
    const hidden = isInstanceVisible ? !isInstanceVisible(source, group, inst) : false;

    if (i > 0) runs.push({ text: '  ' });
    runs.push({ text: label, strike: hidden });
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
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── 맞춤법 조판 ───────────────────────────────────────────────────

/**
 * @typedef {{
 *   category: string,
 *   groupLabel: string,
 *   dividerGroupKey: string,
 *   label: string,
 *   tip: string,
 *   countText: string,
 *   isCaution: boolean,
 *   pagesHidden: boolean,
 *   pageRuns: { text: string, strike?: boolean }[],
 * }} SpellingExportRow
 */

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
export function buildSpellingExportModel({
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
}) {
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

  for (const { group, source } of orderedEntries) {
    const isCaution = group.category === 'caution';
    const category = isCaution ? '편집자 검토 필요' : '맞춤법 규칙';
    const tipText =
      (group.tip || '').trim() ||
      (source === 'spelling' && !isCaution
        ? getBuiltInTip(group.find, group.replace, group.spellingRuleId) || ''
        : '');
    const visMode = groupVisibilityMode ? groupVisibilityMode(source, group) : 'visible';
    const totalCount = group.instances.length;
    const shownCount = visibleInstanceCount ? visibleInstanceCount(source, group) : totalCount;
    const countText =
      visMode === 'hidden'
        ? `0/${totalCount}`
        : visMode === 'partial'
          ? `${shownCount}/${totalCount}`
          : `${totalCount}`;
    const pagesHidden = visMode === 'hidden';
    const pills = pagesHidden ? [] : buildInstancePills(group.instances);
    const pageRuns = pagesHidden
      ? []
      : buildPageRuns(pills, formatPageLabel, source, group, isInstanceVisible);

    rows.push({
      category,
      groupLabel: group.dividerLabel || '-',
      dividerGroupKey: String(group.dividerGroup ?? ''),
      label: getEntryLabel(group, source),
      tip: tipText,
      countText,
      isCaution,
      pagesHidden,
      pageRuns,
    });
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
 * 조판 모델 → ExcelJS workbook buffer.
 * @param {SpellingExportModel} model
 * @returns {Promise<ArrayBuffer>}
 */
export async function writeSpellingWorkbook(model) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = '인디야';
  const ws = wb.addWorksheet(model.sheetName || '맞춤법 확인');

  ws.columns = [
    { width: 14 },
    { width: 18 },
    { width: 30 },
    { width: 40 },
    { width: 14 },
    { width: 58 },
  ];

  ws.mergeCells('A1:F1');
  const guideCell = ws.getCell('A1');
  guideCell.value = { richText: EXCEL_CLIP_GUIDE_RICHTEXT };
  guideCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
  guideCell.alignment = { horizontal: 'center', vertical: 'center', wrapText: false };
  guideCell.border = CELL_BORDER;
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:F2');
  const summaryCell = ws.getCell('A2');
  summaryCell.value = model.summaryLine;
  summaryCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF000000' } };
  summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
  summaryCell.alignment = { horizontal: 'left', vertical: 'center', indent: 1, wrapText: false };
  summaryCell.border = CELL_BORDER;
  ws.getRow(2).height = 30;

  ['구분', '묶음', '기준', '설명', '발견 수', '페이지'].forEach((h, i) => {
    const cell = ws.getRow(3).getCell(i + 1);
    cell.value = h;
    applyStyle(cell, { bg: HEADER_BG, fg: HEADER_FG, bold: true, hAlign: 'center' });
  });
  ws.getRow(3).height = 30;

  const categoryRanges = [];
  let currentRange = null;
  const groupRanges = [];
  let currentGroupRange = null;
  const rows = model.rows ?? [];

  for (let i = 0; i < rows.length; i++) {
    const excelRowNum = i + 4;
    const rowData = rows[i];
    const bg = rowData.isCaution ? CAUTION_BG : BUILTIN_BG;
    const groupKey = `${rowData.category}\0${rowData.dividerGroupKey ?? ''}`;

    if (!currentRange || currentRange.category !== rowData.category) {
      if (currentRange) categoryRanges.push(currentRange);
      currentRange = { start: excelRowNum, end: excelRowNum, category: rowData.category, bg };
    } else {
      currentRange.end = excelRowNum;
    }

    if (!currentGroupRange || currentGroupRange.key !== groupKey) {
      if (currentGroupRange) groupRanges.push(currentGroupRange);
      currentGroupRange = {
        start: excelRowNum,
        end: excelRowNum,
        key: groupKey,
        label: rowData.groupLabel,
        bg,
      };
    } else {
      currentGroupRange.end = excelRowNum;
    }

    const pagePlainText = rowData.pagesHidden ? '' : pageRunsToPlainText(rowData.pageRuns);
    const linesB = estimateLines(rowData.label, 30);
    const linesC = estimateLines(rowData.tip, 40);
    const linesE = estimatePillLines(pagePlainText, 58);
    const row = ws.getRow(excelRowNum);
    row.height = rowHeightPt(linesB, linesC, linesE);

    const catCell = row.getCell(1);
    catCell.value = rowData.category;
    applyStyle(catCell, { bg, hAlign: 'center', vAlign: 'center' });

    const groupCell = row.getCell(2);
    groupCell.value = rowData.groupLabel;
    applyStyle(groupCell, { bg, hAlign: 'center', vAlign: 'center' });

    const labelCell = row.getCell(3);
    labelCell.value = rowData.label;
    applyStyle(labelCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });

    const tipCell = row.getCell(4);
    tipCell.value = rowData.tip;
    applyStyle(tipCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });

    const countCell = row.getCell(5);
    countCell.value = rowData.countText;
    applyStyle(countCell, { bg, hAlign: 'center', vAlign: 'top' });

    const pagesCell = row.getCell(6);
    if (rowData.pagesHidden) {
      pagesCell.value = '-';
    } else {
      pagesCell.value = { richText: pageRunsToExcelRichText(rowData.pageRuns) };
    }
    applyStyle(pagesCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });
  }

  if (currentRange) categoryRanges.push(currentRange);
  if (currentGroupRange) groupRanges.push(currentGroupRange);

  for (const range of categoryRanges) {
    if (range.start < range.end) {
      ws.mergeCells(range.start, 1, range.end, 1);
    }
    const cell = ws.getCell(range.start, 1);
    cell.value = range.category;
    applyStyle(cell, { bg: range.bg, hAlign: 'center', vAlign: 'middle' });
  }

  for (const range of groupRanges) {
    if (range.start < range.end) {
      ws.mergeCells(range.start, 2, range.end, 2);
    }
    const cell = ws.getCell(range.start, 2);
    cell.value = range.label;
    applyStyle(cell, { bg: range.bg, hAlign: 'center', vAlign: 'middle' });
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
 */
function consistencyCategoryOf(group) {
  return group.patternKind === 'auxiliary-verb'
    ? AUXILIARY_EXPORT_CATEGORY
    : LITERAL_FIND_FEATURE_LABEL;
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
 *   countText: string,
 *   isAuxiliary: boolean,
 *   pagesHidden: boolean,
 *   pageRuns: { text: string, strike?: boolean }[],
 * }} ConsistencyExportRow
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
 * }} ConsistencyExportModel
 */

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
 *   filename?: string,
 * }} options
 * @returns {ConsistencyExportModel}
 */
export function buildConsistencyExportModel({
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
  filename = '표기통일_검사결과.xlsx',
}) {
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

  for (const { group, source } of entries ?? []) {
    const category = consistencyCategoryOf(group);
    const isAuxiliary = category === AUXILIARY_EXPORT_CATEGORY;
    const tipText = (group.tip || '').trim();
    const visMode = groupVisibilityMode ? groupVisibilityMode(source, group) : 'visible';
    const totalCount = group.instances.length;
    const shownCount = visibleInstanceCount ? visibleInstanceCount(source, group) : totalCount;
    const countText =
      visMode === 'hidden'
        ? `0/${totalCount}`
        : visMode === 'partial'
          ? `${shownCount}/${totalCount}`
          : `${totalCount}`;
    const pagesHidden = visMode === 'hidden';
    const pills = pagesHidden ? [] : buildInstancePills(group.instances);
    const pageRuns = pagesHidden
      ? []
      : buildPageRuns(pills, formatPageLabel, source, group, isInstanceVisible);

    rows.push({
      category,
      label: consistencyEntryLabel(group),
      tip: tipText,
      countText,
      isAuxiliary,
      pagesHidden,
      pageRuns,
    });
  }

  return {
    kind: 'consistency',
    sheetName: '표기 통일 확인',
    filename,
    summaryLine: formatConsistencyExcelSummaryLine(summary),
    summary,
    rows,
  };
}

/**
 * @param {ConsistencyExportModel} model
 * @returns {Promise<ArrayBuffer>}
 */
export async function writeConsistencyWorkbook(model) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = '인디야';
  const ws = wb.addWorksheet(model.sheetName || '표기 통일 확인');

  ws.columns = [
    { width: 18 },
    { width: 30 },
    { width: 40 },
    { width: 14 },
    { width: 58 },
  ];

  ws.mergeCells('A1:E1');
  const guideCell = ws.getCell('A1');
  guideCell.value = { richText: EXCEL_CLIP_GUIDE_RICHTEXT };
  guideCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
  guideCell.alignment = { horizontal: 'center', vertical: 'center', wrapText: false };
  guideCell.border = CELL_BORDER;
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:E2');
  const summaryCell = ws.getCell('A2');
  summaryCell.value = model.summaryLine;
  summaryCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF000000' } };
  summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
  summaryCell.alignment = { horizontal: 'left', vertical: 'center', indent: 1, wrapText: false };
  summaryCell.border = CELL_BORDER;
  ws.getRow(2).height = 30;

  ['구분', '기준', '설명', '발견 수', '페이지'].forEach((h, i) => {
    const cell = ws.getRow(3).getCell(i + 1);
    cell.value = h;
    applyStyle(cell, { bg: HEADER_BG, fg: HEADER_FG, bold: true, hAlign: 'center' });
  });
  ws.getRow(3).height = 30;

  const categoryRanges = [];
  let currentRange = null;
  const rows = model.rows ?? [];

  for (let i = 0; i < rows.length; i++) {
    const excelRowNum = i + 4;
    const rowData = rows[i];
    const bg = rowData.isAuxiliary ? CAUTION_BG : BUILTIN_BG;

    if (!currentRange || currentRange.category !== rowData.category) {
      if (currentRange) categoryRanges.push(currentRange);
      currentRange = { start: excelRowNum, end: excelRowNum, category: rowData.category, bg };
    } else {
      currentRange.end = excelRowNum;
    }

    const pagePlainText = rowData.pagesHidden ? '' : pageRunsToPlainText(rowData.pageRuns);
    const linesB = estimateLines(rowData.label, 30);
    const linesC = estimateLines(rowData.tip, 40);
    const linesE = estimatePillLines(pagePlainText, 58);
    const row = ws.getRow(excelRowNum);
    row.height = rowHeightPt(linesB, linesC, linesE);

    const catCell = row.getCell(1);
    catCell.value = rowData.category;
    applyStyle(catCell, { bg, hAlign: 'center', vAlign: 'center' });

    const labelCell = row.getCell(2);
    labelCell.value = rowData.label;
    applyStyle(labelCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });

    const tipCell = row.getCell(3);
    tipCell.value = rowData.tip;
    applyStyle(tipCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });

    const countCell = row.getCell(4);
    countCell.value = rowData.countText;
    applyStyle(countCell, { bg, hAlign: 'center', vAlign: 'top' });

    const pagesCell = row.getCell(5);
    if (rowData.pagesHidden) {
      pagesCell.value = '-';
    } else {
      pagesCell.value = { richText: pageRunsToExcelRichText(rowData.pageRuns) };
    }
    applyStyle(pagesCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });
  }

  if (currentRange) categoryRanges.push(currentRange);

  for (const range of categoryRanges) {
    if (range.start < range.end) {
      ws.mergeCells(range.start, 1, range.end, 1);
    }
    const cell = ws.getCell(range.start, 1);
    cell.value = range.category;
    applyStyle(cell, { bg: range.bg, hAlign: 'center', vAlign: 'middle' });
  }

  return wb.xlsx.writeBuffer();
}

/**
 * @param {Parameters<typeof buildConsistencyExportModel>[0]} options
 */
export async function exportConsistencyResults(options) {
  const model = buildConsistencyExportModel(options);
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
