import { buildInstancePills } from '../components/ResultPageSummary.jsx';
import { getBuiltInTip } from './builtInRules.js';
import { cautionResultChipLabel } from './cautionRules.js';

const HEADER_BG = 'FF3E2723';
const HEADER_FG = 'FFFFFFFF';
const CAUTION_BG = 'FFD7CCC8';
const BUILTIN_BG = 'FFEFEBE9';
const THIN_BORDER_COLOR = 'FFBBBBBB';

const THIN = { style: 'thin', color: { argb: THIN_BORDER_COLOR } };
const CELL_BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN };

function applyStyle(cell, { bg, fg = 'FF000000', bold = false, size = 10, hAlign = 'left', vAlign = 'center', wrap = false }) {
  cell.font = { name: 'Arial', size, bold, color: { argb: fg } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  cell.alignment = { horizontal: hAlign, vertical: vAlign, wrapText: wrap };
  cell.border = CELL_BORDER;
}

function getEntryLabel(group, source) {
  if (source === 'spelling') {
    if (group.category === 'caution') return cautionResultChipLabel(group);
    const first = group.instances[0];
    return first ? `${first.matchedText} → ${first.suggestedText}` : group.label;
  }
  return group.label;
}

function buildPagesRichText(pills, source, group, formatPageLabel, isInstanceVisible) {
  const runs = [];
  for (let i = 0; i < pills.length; i++) {
    const { inst, indexOnPage, totalOnPage } = pills[i];
    const pageLabel = formatPageLabel(inst.pageNum);
    const fragment = totalOnPage > 1 ? ` ${indexOnPage}/${totalOnPage}` : '';
    const label = `${pageLabel}${fragment}`;
    const hidden = isInstanceVisible ? !isInstanceVisible(source, group, inst) : false;

    if (i > 0) runs.push({ text: '  ' });
    runs.push({
      text: label,
      font: {
        name: 'Arial',
        size: 10,
        strike: hidden,
        color: { argb: hidden ? 'FF999999' : 'FF000000' },
      },
    });
  }
  return runs;
}

/**
 * @param {{
 *   entries: {group: import('../lib/ruleEngine.js').GroupedResult, source: string}[],
 *   formatPageLabel: (systemPage: number) => string,
 *   isInstanceVisible: (source: string, group: object, inst: object) => boolean,
 *   groupVisibilityMode: (source: string, group: object) => 'visible' | 'partial' | 'hidden',
 *   visibleInstanceCount: (source: string, group: object) => number,
 *   cautionCount: number,
 *   builtinCount: number,
 *   totalFindings: number,
 *   filename?: string,
 * }} options
 */
export async function exportSpellingResults({
  entries,
  formatPageLabel,
  isInstanceVisible,
  groupVisibilityMode,
  visibleInstanceCount,
  cautionCount,
  builtinCount,
  totalFindings,
  filename = '맞춤법_검사결과.xlsx',
}) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = '인디야';
  const ws = wb.addWorksheet('맞춤법 확인');

  ws.columns = [
    { width: 14 }, // A: 구분
    { width: 30 }, // B: 기준
    { width: 40 }, // C: 설명
    { width: 12 }, // D: 발견 수
    { width: 55 }, // E: 페이지
  ];

  // ── 요약 행 (row 1) ───────────────────────────────────────────
  ws.mergeCells('A1:E1');
  const summaryCell = ws.getCell('A1');
  summaryCell.value = `편집자 검토 필요 기준 ${cautionCount}개 · 맞춤법 기준 ${builtinCount}개 · 전체 발견 ${totalFindings}건`;
  summaryCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF000000' } };
  summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
  summaryCell.alignment = { horizontal: 'left', vertical: 'center', indent: 1 };
  summaryCell.border = CELL_BORDER;
  ws.getRow(1).height = 24;

  // ── 헤더 (row 2) ──────────────────────────────────────────────
  ['구분', '기준', '설명', '발견 수', '페이지'].forEach((h, i) => {
    const cell = ws.getRow(2).getCell(i + 1);
    cell.value = h;
    applyStyle(cell, { bg: HEADER_BG, fg: HEADER_FG, bold: true, hAlign: 'center' });
  });
  ws.getRow(2).height = 20;

  // ── 데이터 행 (row 3~) ────────────────────────────────────────
  const categoryRanges = []; // { start, end, category, bg }
  let currentRange = null;

  for (let i = 0; i < entries.length; i++) {
    const excelRowNum = i + 3;
    const { group, source } = entries[i];
    const isCaution = group.category === 'caution';
    const category = isCaution ? '편집자 검토' : '맞춤법';
    const bg = isCaution ? CAUTION_BG : BUILTIN_BG;

    // 구분 병합 범위 추적
    if (!currentRange || currentRange.category !== category) {
      if (currentRange) categoryRanges.push(currentRange);
      currentRange = { start: excelRowNum, end: excelRowNum, category, bg };
    } else {
      currentRange.end = excelRowNum;
    }

    const tipText =
      (group.tip || '').trim() ||
      (source === 'spelling' && !isCaution
        ? getBuiltInTip(group.find, group.replace) || ''
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

    const row = ws.getRow(excelRowNum);
    row.height = 40;

    // A: 구분 (병합 후 덮어씌워질 값이지만 스타일 적용)
    const catCell = row.getCell(1);
    catCell.value = category;
    applyStyle(catCell, { bg, hAlign: 'center', vAlign: 'center' });

    // B: 기준
    const labelCell = row.getCell(2);
    labelCell.value = getEntryLabel(group, source);
    applyStyle(labelCell, { bg, hAlign: 'justify', vAlign: 'center', wrap: true });

    // C: 설명
    const tipCell = row.getCell(3);
    tipCell.value = tipText;
    applyStyle(tipCell, { bg, hAlign: 'left', vAlign: 'center', wrap: true });

    // D: 발견 수
    const countCell = row.getCell(4);
    countCell.value = countText;
    applyStyle(countCell, { bg, hAlign: 'center', vAlign: 'center' });

    // E: 페이지
    const pagesCell = row.getCell(5);
    if (visMode === 'hidden') {
      pagesCell.value = '-';
    } else {
      const pills = buildInstancePills(group.instances);
      pagesCell.value = { richText: buildPagesRichText(pills, source, group, formatPageLabel, isInstanceVisible) };
    }
    applyStyle(pagesCell, { bg, hAlign: 'left', vAlign: 'center', wrap: true });
  }

  if (currentRange) categoryRanges.push(currentRange);

  // 구분 열 병합
  for (const range of categoryRanges) {
    if (range.start < range.end) {
      ws.mergeCells(range.start, 1, range.end, 1);
    }
    const cell = ws.getCell(range.start, 1);
    cell.value = range.category;
    applyStyle(cell, { bg: range.bg, hAlign: 'center', vAlign: 'center' });
  }

  // 다운로드
  const buffer = await wb.xlsx.writeBuffer();
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
