import JSZip from 'jszip';
import {
  exportModelFromSnapshot,
  remainingRetentionDays,
} from './checkResultSnapshot.js';
import {
  writeConsistencyWorkbook,
  writeSpellingWorkbook,
} from './exportResults.js';
import {
  buildProofreadExportFilename,
  formatProofreadYymmdd,
  proofreadExportLabelForKind,
} from './proofreadExportFilename.js';

/**
 * @param {Date} [date]
 * @returns {string}
 */
export function buildCheckResultsHistoryTxtName(date = new Date()) {
  return `${formatProofreadYymmdd(date)}_검수이력.txt`;
}

/**
 * @param {unknown} kind
 * @returns {string}
 */
function kindLabel(kind) {
  return kind === 'consistency' ? '표기 통일' : '맞춤법';
}

/**
 * @param {unknown} ms
 * @returns {string}
 */
function formatWhen(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return '-';
  try {
    return new Date(n).toLocaleString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

/**
 * 화면 목록과 같은 요약 — zip 안 txt 전용.
 * @param {Array<Record<string, unknown>>} items
 * @returns {string}
 */
export function buildCheckResultsHistoryTxt(items) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return '';

  const blocks = list.map((item) => {
    const when = formatWhen(item.createdAt);
    const days = remainingRetentionDays(Number(item.expiresAt));
    return `${kindLabel(item.kind)}\n${when} ${days}일 남음`;
  });
  return `${blocks.join('\n\n')}\n`;
}

/**
 * @param {BlobPart | Blob} data
 * @param {string} filename
 * @param {string} mime
 */
function downloadBlob(data, filename, mime) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 작업대 다운로드와 같은 형식. 저장된 구형 filename 은 무시하고 재생성.
 * @param {{
 *   kind?: unknown,
 *   createdAt?: unknown,
 *   pdfFileName?: unknown,
 *   filename?: unknown,
 * } & Record<string, unknown>} item
 * @param {Set<string>} used
 */
function uniqueXlsxName(item, used) {
  const kind = item.kind === 'consistency' ? 'consistency' : 'spelling';
  const when = Number(item.createdAt);
  const date = Number.isFinite(when) ? new Date(when) : new Date();
  const pdfName =
    typeof item.pdfFileName === 'string' && item.pdfFileName.trim()
      ? item.pdfFileName
      : '프로젝트명';
  const base = buildProofreadExportFilename(
    pdfName,
    proofreadExportLabelForKind(kind),
    date,
  ).replace(/\.xlsx$/i, '');
  let name = `${base}.xlsx`;
  let n = 2;
  while (used.has(name)) {
    name = `${base}_${n}.xlsx`;
    n += 1;
  }
  used.add(name);
  return name;
}

/**
 * 저장된 스냅숏들을 엑셀로 만든 뒤 zip으로 다운로드.
 * @param {{
 *   items: Array<Record<string, unknown> & { id?: string }>,
 *   zipFilename?: string,
 * }} args
 * @returns {Promise<{ ok: true, fileCount: number } | { ok: false, reason: string }>}
 */
export async function downloadCheckResultsAsZip({ items, zipFilename }) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    return { ok: false, reason: 'empty' };
  }

  const zip = new JSZip();
  const used = new Set();
  let fileCount = 0;

  for (const item of list) {
    const model = exportModelFromSnapshot({
      kind: item.kind === 'consistency' ? 'consistency' : 'spelling',
      sheetName: typeof item.sheetName === 'string' ? item.sheetName : undefined,
      filename: typeof item.filename === 'string' ? item.filename : undefined,
      summaryLine:
        typeof item.summaryLine === 'string' ? item.summaryLine : '',
      summary:
        item.summary && typeof item.summary === 'object' ? item.summary : {},
      rows: Array.isArray(item.rows) ? item.rows : [],
    });
    if (!model) continue;

    const buffer =
      model.kind === 'spelling'
        ? await writeSpellingWorkbook(model)
        : await writeConsistencyWorkbook(model);

    zip.file(uniqueXlsxName(item, used), buffer);
    fileCount += 1;
  }

  if (fileCount === 0) {
    return { ok: false, reason: 'no-files' };
  }

  const historyTxt = buildCheckResultsHistoryTxt(list);
  if (historyTxt) {
    zip.file(buildCheckResultsHistoryTxtName(), historyTxt);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const name =
    (typeof zipFilename === 'string' && zipFilename.trim()
      ? zipFilename.trim().replace(/\.zip$/i, '')
      : '검수결과') + '.zip';
  downloadBlob(blob, name, 'application/zip');
  return { ok: true, fileCount };
}
