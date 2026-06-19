/**
 * @param {number | undefined | null} bytes
 */
export function formatFileSize(bytes) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** 업로드 후 파일 카드 등 — 항상 MB 단위 */
export function formatFileSizeMb(bytes) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null;
  const mb = bytes / (1024 * 1024);
  if (mb < 0.01 && bytes > 0) return '<0.01MB';
  const digits = mb >= 10 ? 1 : 2;
  return `${mb.toFixed(digits)}MB`;
}
