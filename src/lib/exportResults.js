import { buildInstancePills } from '../components/ResultPageSummary.jsx';
import { getBuiltInTip } from './builtInRules.js';
import { cautionResultChipLabel } from './cautionRules.js';
import { formatAuxiliaryVerbResultLabel } from './patternDisplayLabels.js';

const HEADER_BG = 'FF3E2723';
const HEADER_FG = 'FFFFFFFF';
const CAUTION_BG = 'FFD7CCC8';
const BUILTIN_BG = 'FFEFEBE9';
const THIN_BORDER_COLOR = 'FFBBBBBB';

const THIN = { style: 'thin', color: { argb: THIN_BORDER_COLOR } };
const CELL_BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN };

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
    (cp >= 0xFF00 && cp <= 0xFFEF)    // 전각 문자
  );
}

/**
 * 텍스트가 colWidth 너비의 셀에서 몇 줄을 차지하는지 추정.
 * - 한글/CJK = 2 unit, ASCII = 1 unit
 * - 줄바꿈(\n) 강제 처리
 * - Excel 열 너비 1 unit ≈ Arial 10pt 숫자 1자 폭
 * @param {string} text
 * @param {number} colWidth  ws.columns 에 설정한 width 값
 * @returns {number}
 */
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
    if (ch === '\n') { lines++; pos = 0; continue; }
    const w = isWideChar(ch) ? 2 : 1;
    pos += w;
    if (pos > usable) { lines++; pos = w; }
  }
  return lines;
}

/**
 * 페이지 레이블 텍스트 줄 수 추정 — Excel과 동일하게 공백(space) 기준 단어 단위 줄바꿈.
 * "78-79P 122-123P" 또는 "174-175P 1/2" 같은 레이블은 중간에 잘리지 않고 통째로 다음 줄로 이동.
 * @param {string} pillText  pillsToPlainText() 결과
 * @param {number} colWidth
 */
function estimatePillLines(pillText, colWidth) {
  if (!pillText) return 1;
  // 실측 기준으로 colWidth의 72%를 유효 너비로 사용
  const usable = Math.max(4, Math.floor(colWidth * 0.72));
  // 연속 공백 포함 split → 빈 문자열 제거
  const words = pillText.split(' ').filter((w) => w.length > 0);
  let lines = 1;
  let lineW = 0;
  for (const word of words) {
    const w = word.length; // 페이지 레이블은 전부 ASCII
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

const LINE_H_PT = 15;   // Arial 10pt 한 줄 높이 (pt) — 실측 여유분 포함
const ROW_PAD_PT = 8;   // 상하 패딩 합산
const MIN_ROW_H = 24;
const MAX_ROW_H = 800;  // 발견 수 많은 항목 대응

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
    const first = group.instances[0];
    return first ? `${first.matchedText} → ${first.suggestedText}` : group.label;
  }
  return group.label;
}

// ── 페이지 열(E) ──────────────────────────────────────────────────

/**
 * pills → 행 높이 추정용 plain text
 * (buildPagesRichText 와 동일한 레이블·구분자 사용)
 */
function pillsToPlainText(pills, formatPageLabel) {
  return pills
    .map(({ inst, indexOnPage, totalOnPage }, i) => {
      const pageLabel = formatPageLabel(inst.pageNum);
      const fragment = totalOnPage > 1 ? ` ${indexOnPage}/${totalOnPage}` : '';
      return (i > 0 ? '  ' : '') + `${pageLabel}${fragment}`;
    })
    .join('');
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

// ── 메인 export ───────────────────────────────────────────────────

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
    { width: 18 }, // A: 구분
    { width: 30 }, // B: 기준
    { width: 40 }, // C: 설명
    { width: 14 }, // D: 발견 수
    { width: 58 }, // E: 페이지
  ];

  // ── 안내 행 (row 1) ───────────────────────────────────────────
  ws.mergeCells('A1:E1');
  const guideCell = ws.getCell('A1');
  guideCell.value = {
    richText: [
      { text: '※ 내용이 잘려 보이면 ', font: { name: 'Arial', size: 9, bold: false, color: { argb: 'FF555555' } } },
      { text: 'Ctrl+A→홈 탭→ 서식 → 행 높이 자동 맞춤', font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF555555' } } },
      { text: ' 을 이용하세요', font: { name: 'Arial', size: 9, bold: false, color: { argb: 'FF555555' } } },
    ],
  };
  guideCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
  guideCell.alignment = { horizontal: 'center', vertical: 'center', wrapText: false };
  guideCell.border = CELL_BORDER;
  ws.getRow(1).height = 30;

  // ── 요약 행 (row 2) ───────────────────────────────────────────
  ws.mergeCells('A2:E2');
  const summaryCell = ws.getCell('A2');
  summaryCell.value = `편집자 검토 필요 ${cautionCount}개 · 맞춤법 규칙 ${builtinCount}개 · 전체 발견 ${totalFindings}건`;
  summaryCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF000000' } };
  summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
  summaryCell.alignment = { horizontal: 'left', vertical: 'center', indent: 1, wrapText: false };
  summaryCell.border = CELL_BORDER;
  ws.getRow(2).height = 30;

  // ── 헤더 (row 3) ──────────────────────────────────────────────
  ['구분', '기준', '설명', '발견 수', '페이지'].forEach((h, i) => {
    const cell = ws.getRow(3).getCell(i + 1);
    cell.value = h;
    applyStyle(cell, { bg: HEADER_BG, fg: HEADER_FG, bold: true, hAlign: 'center' });
  });
  ws.getRow(3).height = 30;

  // ── 데이터 행 (row 4~) ────────────────────────────────────────
  const categoryRanges = [];
  let currentRange = null;

  for (let i = 0; i < entries.length; i++) {
    const excelRowNum = i + 4;
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

    // pills는 한 번만 생성해서 높이 추정·셀 값에 공유
    const pills = visMode === 'hidden' ? [] : buildInstancePills(group.instances);
    const pagePlainText = visMode === 'hidden' ? '' : pillsToPlainText(pills, formatPageLabel);
    const labelText = getEntryLabel(group, source);

    // ── 행 높이: 열 B·C·E 중 가장 많은 줄 수 기준 ──────────────
    const linesB = estimateLines(labelText, 30);
    const linesC = estimateLines(tipText, 40);
    const linesE = estimatePillLines(pagePlainText, 58);
    const row = ws.getRow(excelRowNum);
    const h = rowHeightPt(linesB, linesC, linesE);
    row.height = h;
    // A: 구분
    const catCell = row.getCell(1);
    catCell.value = category;
    applyStyle(catCell, { bg, hAlign: 'center', vAlign: 'center' });

    // B: 기준
    const labelCell = row.getCell(2);
    labelCell.value = labelText;
    applyStyle(labelCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });

    // C: 설명
    const tipCell = row.getCell(3);
    tipCell.value = tipText;
    applyStyle(tipCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });

    // D: 발견 수
    const countCell = row.getCell(4);
    countCell.value = countText;
    applyStyle(countCell, { bg, hAlign: 'center', vAlign: 'top' });

    // E: 페이지
    const pagesCell = row.getCell(5);
    if (visMode === 'hidden') {
      pagesCell.value = '-';
    } else {
      pagesCell.value = { richText: buildPagesRichText(pills, source, group, formatPageLabel, isInstanceVisible) };
    }
    applyStyle(pagesCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });
  }

  if (currentRange) categoryRanges.push(currentRange);

  // 구분 열 병합
  for (const range of categoryRanges) {
    if (range.start < range.end) {
      ws.mergeCells(range.start, 1, range.end, 1);
    }
    const cell = ws.getCell(range.start, 1);
    cell.value = range.category;
    applyStyle(cell, { bg: range.bg, hAlign: 'center', vAlign: 'middle' });
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

// ── 일관성 탭 export ──────────────────────────────────────────────

/**
 * 일관성 탭 구분 결정
 * @param {import('./ruleEngine.js').GroupedResult} group
 */
function consistencyCategoryOf(group) {
  return group.patternKind === 'auxiliary-verb' ? '본용언+보조용언' : '일관성 찾기';
}

/**
 * 일관성 탭 기준 레이블
 * @param {import('./ruleEngine.js').GroupedResult} group
 */
function consistencyEntryLabel(group) {
  if (group.patternKind === 'auxiliary-verb') {
    return group.tailWord
      ? formatAuxiliaryVerbResultLabel(group.tailWord, group.groupDisplayLabel)
      : (group.groupDisplayLabel?.trim() || group.label || '');
  }
  return group.label || group.find || '';
}

/**
 * @param {{
 *   entries: {group: import('./ruleEngine.js').GroupedResult, source: string}[],
 *   formatPageLabel: (systemPage: number) => string,
 *   isInstanceVisible: (source: string, group: object, inst: object) => boolean,
 *   groupVisibilityMode: (source: string, group: object) => 'visible' | 'partial' | 'hidden',
 *   visibleInstanceCount: (source: string, group: object) => number,
 *   literalCount: number,
 *   auxiliaryCount: number,
 *   totalFindings: number,
 *   filename?: string,
 * }} options
 */
export async function exportConsistencyResults({
  entries,
  formatPageLabel,
  isInstanceVisible,
  groupVisibilityMode,
  visibleInstanceCount,
  literalCount,
  auxiliaryCount,
  totalFindings,
  filename = '일관성_검사결과.xlsx',
}) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = '인디야';
  const ws = wb.addWorksheet('일관성 확인');

  ws.columns = [
    { width: 18 }, // A: 구분
    { width: 30 }, // B: 기준
    { width: 40 }, // C: 설명
    { width: 14 }, // D: 발견 수
    { width: 58 }, // E: 페이지
  ];

  // ── 안내 행 (row 1)
  ws.mergeCells('A1:E1');
  const guideCell = ws.getCell('A1');
  guideCell.value = {
    richText: [
      { text: '※ 내용이 잘려 보이면 ', font: { name: 'Arial', size: 9, bold: false, color: { argb: 'FF555555' } } },
      { text: 'Ctrl+A→홈 탭→ 서식 → 행 높이 자동 맞춤', font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF555555' } } },
      { text: ' 을 이용하세요', font: { name: 'Arial', size: 9, bold: false, color: { argb: 'FF555555' } } },
    ],
  };
  guideCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
  guideCell.alignment = { horizontal: 'center', vertical: 'center', wrapText: false };
  guideCell.border = CELL_BORDER;
  ws.getRow(1).height = 30;

  // ── 요약 행 (row 2)
  ws.mergeCells('A2:E2');
  const summaryCell = ws.getCell('A2');
  summaryCell.value = `일관성 찾기 ${literalCount}개 · 본용언+보조용언 ${auxiliaryCount}개 · 전체 발견 ${totalFindings}건`;
  summaryCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF000000' } };
  summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
  summaryCell.alignment = { horizontal: 'left', vertical: 'center', indent: 1, wrapText: false };
  summaryCell.border = CELL_BORDER;
  ws.getRow(2).height = 30;

  // ── 헤더 (row 3)
  ['구분', '기준', '설명', '발견 수', '페이지'].forEach((h, i) => {
    const cell = ws.getRow(3).getCell(i + 1);
    cell.value = h;
    applyStyle(cell, { bg: HEADER_BG, fg: HEADER_FG, bold: true, hAlign: 'center' });
  });
  ws.getRow(3).height = 30;

  // ── 데이터 행 (row 4~)
  const categoryRanges = [];
  let currentRange = null;

  for (let i = 0; i < entries.length; i++) {
    const excelRowNum = i + 4;
    const { group, source } = entries[i];
    const category = consistencyCategoryOf(group);
    const bg = category === '본용언+보조용언' ? CAUTION_BG : BUILTIN_BG;

    if (!currentRange || currentRange.category !== category) {
      if (currentRange) categoryRanges.push(currentRange);
      currentRange = { start: excelRowNum, end: excelRowNum, category, bg };
    } else {
      currentRange.end = excelRowNum;
    }

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

    const pills = visMode === 'hidden' ? [] : buildInstancePills(group.instances);
    const pagePlainText = visMode === 'hidden' ? '' : pillsToPlainText(pills, formatPageLabel);
    const labelText = consistencyEntryLabel(group);

    const linesB = estimateLines(labelText, 30);
    const linesC = estimateLines(tipText, 40);
    const linesE = estimatePillLines(pagePlainText, 58);
    const row = ws.getRow(excelRowNum);
    const h = rowHeightPt(linesB, linesC, linesE);
    row.height = h;
    const catCell = row.getCell(1);
    catCell.value = category;
    applyStyle(catCell, { bg, hAlign: 'center', vAlign: 'center' });

    const labelCell = row.getCell(2);
    labelCell.value = labelText;
    applyStyle(labelCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });

    const tipCell = row.getCell(3);
    tipCell.value = tipText;
    applyStyle(tipCell, { bg, hAlign: 'left', vAlign: 'top', wrap: true });

    const countCell = row.getCell(4);
    countCell.value = countText;
    applyStyle(countCell, { bg, hAlign: 'center', vAlign: 'top' });

    const pagesCell = row.getCell(5);
    if (visMode === 'hidden') {
      pagesCell.value = '-';
    } else {
      pagesCell.value = { richText: buildPagesRichText(pills, source, group, formatPageLabel, isInstanceVisible) };
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
