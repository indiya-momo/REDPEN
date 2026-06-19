const MB = 1024 * 1024;

/** 운영 권장 — 초과 시 경고만 */
export const PDF_SIZE_WARN_BYTES = 50 * MB;

/** 운영 상한 — 초과 시 업로드·검수 차단 */
export const PDF_SIZE_MAX_BYTES = 100 * MB;

export const PDF_SIZE_MAX_MESSAGE =
  'PDF 용량이 100MB를 초과합니다. 파일을 나눈 뒤 100MB 이하로 다시 올려 주세요.';

/**
 * @param {number | null | undefined} sizeBytes
 * @returns {boolean}
 */
export function isPdfSizeOverMax(sizeBytes) {
  return Number.isFinite(sizeBytes) && sizeBytes > PDF_SIZE_MAX_BYTES;
}

/**
 * @param {number | null | undefined} sizeBytes
 * @returns {boolean}
 */
export function isPdfSizeOverWarn(sizeBytes) {
  return (
    Number.isFinite(sizeBytes) &&
    sizeBytes > PDF_SIZE_WARN_BYTES &&
    !isPdfSizeOverMax(sizeBytes)
  );
}
