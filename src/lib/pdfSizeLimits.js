const MB = 1024 * 1024;

/** 운영 권장 — 초과 시 경고만 */
export const PDF_SIZE_WARN_BYTES = 50 * MB;

/** 브라우저 PDF 검수 열기·업로드 상한 */
export const PDF_SIZE_MAX_BYTES = 100 * MB;

/** TXT 변환(앱 버튼·터미널 스크립트) 상한 */
export const PDF_SIZE_MAX_BYTES_TERMINAL = 150 * MB;

export const PDF_SIZE_MAX_MESSAGE =
  'PDF 용량이 100MB를 초과합니다. 파일을 나눈 뒤 100MB 이하로 다시 올려 주세요.';

export const PDF_SIZE_MAX_MESSAGE_TERMINAL =
  'PDF 용량이 150MB를 초과합니다. 파일을 나눈 뒤 150MB 이하로 다시 시도해 주세요.';

/**
 * @param {number | null | undefined} sizeBytes
 * @param {number} [maxBytes=PDF_SIZE_MAX_BYTES] 브라우저 기본 100MB
 * @returns {boolean}
 */
export function isPdfSizeOverMax(sizeBytes, maxBytes = PDF_SIZE_MAX_BYTES) {
  return Number.isFinite(sizeBytes) && sizeBytes > maxBytes;
}

/**
 * 터미널·Node 전용 (150MB).
 * @param {number | null | undefined} sizeBytes
 * @returns {boolean}
 */
export function isPdfSizeOverMaxTerminal(sizeBytes) {
  return isPdfSizeOverMax(sizeBytes, PDF_SIZE_MAX_BYTES_TERMINAL);
}

/**
 * @param {number | null | undefined} sizeBytes
 * @param {number} [maxBytes=PDF_SIZE_MAX_BYTES] warn 상한(초과 차단선)
 * @returns {boolean}
 */
export function isPdfSizeOverWarn(sizeBytes, maxBytes = PDF_SIZE_MAX_BYTES) {
  return (
    Number.isFinite(sizeBytes) &&
    sizeBytes > PDF_SIZE_WARN_BYTES &&
    !isPdfSizeOverMax(sizeBytes, maxBytes)
  );
}
