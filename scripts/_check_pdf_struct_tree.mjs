/**
 * A1 (DECISION): 표본 PDF 구조 트리(태그) 유무 확인만.
 * 제품 경로(TXT 파이프라인)는 바꾸지 않는다. 보고서용.
 *
 *   npx vite-node scripts/_check_pdf_struct_tree.mjs [pdf...]
 *
 * 경로 생략 시 바탕화면 샘플(있으면) depressione·스트리트를 본다.
 */
import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const desk = 'C:/Users/gikan/OneDrive/바탕 화면';
const sampleDir = join(desk, '인디야/인디야샘플PDF');

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

const defaults = [
  join(sampleDir, 'depressione_PDF_v1.pdf'),
  join(sampleDir, 'street_PDF_v1.pdf'),
].filter((p) => existsSync(p));

const paths = process.argv.slice(2).length
  ? process.argv.slice(2).map((p) => resolve(p))
  : defaults;

/**
 * @param {string} pdfPath
 */
async function probe(pdfPath) {
  if (!existsSync(pdfPath)) {
    return { file: basename(pdfPath), path: pdfPath, status: 'missing' };
  }
  const data = new Uint8Array(readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pageCount = pdf.numPages;
  let taggedPages = 0;
  let firstRole = null;
  const maxProbe = Math.min(pageCount, 8);
  for (let i = 1; i <= maxProbe; i += 1) {
    const page = await pdf.getPage(i);
    let tree = null;
    try {
      tree = await page.getStructTree();
    } catch {
      tree = null;
    }
    if (tree) {
      taggedPages += 1;
      if (!firstRole) {
        firstRole =
          tree.role ||
          tree.children?.[0]?.role ||
          (typeof tree === 'object' ? Object.keys(tree).slice(0, 3).join(',') : 'present');
      }
    }
  }
  return {
    file: basename(pdfPath),
    path: pdfPath,
    status: 'ok',
    pageCount,
    probedPages: maxProbe,
    taggedPages,
    hasStructTree: taggedPages > 0,
    firstRole,
    note:
      taggedPages > 0
        ? '태그가 있음 — 다음 라운드에서 구조 트리 우선 경로를 따로 설계할 근거'
        : '태그 없음 또는 비어 있음 — A1 제품 경로 미도입 유지',
  };
}

const results = [];
for (const p of paths) {
  results.push(await probe(p));
}

const report = {
  schema: 'pdf-struct-tree-probe-v1',
  productPathChanged: false,
  root,
  results,
};

console.log(JSON.stringify(report, null, 2));
if (!paths.length) {
  console.error('표본 PDF 없음. 경로를 인자로 넘기거나 샘플 폴더를 확인하세요.');
  process.exitCode = 2;
}
