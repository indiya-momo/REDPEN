/**
 * 표본 PDF 경로 해석. 없으면 missing (측정 SKIP용).
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * @param {{
 *   pdfFileName: string,
 *   sampleDirs?: string[],
 *   envDir?: string | null,
 * }} book
 * @returns {{ status: 'found', path: string } | { status: 'missing', tried: string[] }}
 */
export function resolveSample(book) {
  const tried = [];
  const envDir =
    book.envDir ??
    process.env.REDPEN_SAMPLE_DIR ??
    process.env.INDIYA_SAMPLE_PDF_DIR ??
    null;
  /** @type {string[]} */
  const dirs = [];
  if (envDir) dirs.push(resolve(envDir));
  for (const d of book.sampleDirs ?? []) dirs.push(resolve(d));

  for (const dir of dirs) {
    const path = join(dir, book.pdfFileName);
    tried.push(path);
    if (existsSync(path)) return { status: 'found', path };
  }
  return { status: 'missing', tried };
}
