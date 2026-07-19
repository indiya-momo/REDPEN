/**
 * 작업대 검수결과 다운로드·허브 ZIP 공통 파일명.
 * 엑셀: 260719_고구려조선본없음_맞춤법검수.xlsx
 * ZIP:  260719_고구려조선본없음_검수결과.zip
 */

/**
 * @param {Date} [date]
 * @returns {string} YYMMDD
 */
export function formatProofreadYymmdd(date = new Date()) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/**
 * @param {string | null | undefined} pdfFileNameOrProject
 * @returns {string}
 */
export function sanitizeProofreadProjectPart(pdfFileNameOrProject) {
  const raw = String(pdfFileNameOrProject ?? '').trim();
  const withoutExt = raw ? raw.replace(/\.[^.]+$/, '') : '프로젝트명';
  const cleaned = withoutExt.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned || '프로젝트명';
}

/**
 * @param {'spelling' | 'consistency' | string} kind
 * @returns {string}
 */
export function proofreadExportLabelForKind(kind) {
  return kind === 'consistency' ? '표기통일검수' : '맞춤법검수';
}

/**
 * 연월일_프로젝트이름_맞춤법검수(또는 표기통일검수).xlsx
 * @param {string | null | undefined} pdfFileName
 * @param {string} [label]
 * @param {Date} [date]
 * @returns {string}
 */
export function buildProofreadExportFilename(
  pdfFileName,
  label = '맞춤법검수',
  date = new Date(),
) {
  const datePart = formatProofreadYymmdd(date);
  const projectPart = sanitizeProofreadProjectPart(pdfFileName);
  const safeLabel = String(label ?? '맞춤법검수').replace(/[\\/:*?"<>|]/g, '_');
  return `${datePart}_${projectPart}_${safeLabel}.xlsx`;
}

/**
 * 허브 「검수 이력 다운받기」 ZIP 이름 (확장자 제외).
 * @param {string | null | undefined} projectName
 * @param {Date} [date]
 * @returns {string}
 */
export function buildCheckResultsZipBasename(projectName, date = new Date()) {
  const datePart = formatProofreadYymmdd(date);
  const projectPart = sanitizeProofreadProjectPart(projectName || '검수결과');
  return `${datePart}_${projectPart}_검수결과`;
}
