/**
 * 주석 PDF 스파이크 (로드맵 ①).
 * 사용: node scripts/pdf-annot-spike.mjs [pdf…]
 * 기본: tmp/annot-fixtures/*.pdf
 *
 * 산출: tmp/annot-spike-out/*.pdf + report.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFDict,
  PDFHexString,
  PDFNumber,
  PDFString,
} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const fixturesDir = path.join(root, 'tmp/annot-fixtures');
const outDir = path.join(root, 'tmp/annot-spike-out');
const TARGET = '할때';
const NOTE = '할때 → 할 때';
const AUTHOR = 'Indiya';

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
).href;

/**
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 */
function normalizeRect(x1, y1, x2, y2) {
  return {
    llx: Math.min(x1, x2),
    lly: Math.min(y1, y2),
    urx: Math.max(x1, x2),
    ury: Math.max(y1, y2),
  };
}

/**
 * Acrobat-style QuadPoints (TL, TR, BL, BR) in PDF space.
 * @param {{ llx: number, lly: number, urx: number, ury: number }} r
 */
function quadPointsAcrobat(r) {
  return [r.llx, r.ury, r.urx, r.ury, r.llx, r.lly, r.urx, r.lly];
}

/**
 * Spec-ish CCW from bottom-left (BL, BR, TR, TL).
 * @param {{ llx: number, lly: number, urx: number, ury: number }} r
 */
function quadPointsSpec(r) {
  return [r.llx, r.lly, r.urx, r.lly, r.urx, r.ury, r.llx, r.ury];
}

/**
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {string} needle
 */
async function findNeedlePdfRect(page, needle) {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent({ disableCombineTextItems: true });
  const items = content.items.filter((it) => 'str' in it && it.str);
  for (const item of items) {
    const idx = item.str.indexOf(needle);
    if (idx < 0) continue;
    const end = idx + needle.length;
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const scaleX = Math.hypot(tx[0], tx[1]) || 1;
    const fontHeight = Math.hypot(tx[2], tx[3]) || scaleX;
    const left = tx[4] + idx * scaleX;
    const right = tx[4] + end * scaleX;
    const top = tx[5] - fontHeight * 0.09;
    const bottom = top + fontHeight;
    const [px1, py1] = viewport.convertToPdfPoint(left, top);
    const [px2, py2] = viewport.convertToPdfPoint(right, bottom);
    const rect = normalizeRect(px1, py1, px2, py2);
    return {
      rect,
      viewport: { left, top, width: right - left, height: bottom - top },
      pageRotate: page.rotate,
      viewBox: page.view,
    };
  }
  return null;
}

/**
 * @param {import('pdf-lib').PDFPage} page
 * @param {import('pdf-lib').PDFContext} context
 * @param {{
 *   rect: { llx: number, lly: number, urx: number, ury: number },
 *   quad: number[],
 *   subtype: 'StrikeOut' | 'Highlight',
 *   withAp: boolean,
 *   contents: string,
 *   author: string,
 *   label: string,
 * }} opts
 */
function addMarkupAnnot(page, context, opts) {
  const { rect, quad, subtype, withAp, contents, author, label } = opts;
  const rectArr = context.obj([rect.llx, rect.lly, rect.urx, rect.ury]);
  const quadArr = context.obj(quad);

  /** @type {Record<string, unknown>} */
  const dict = {
    Type: 'Annot',
    Subtype: subtype,
    Rect: rectArr,
    QuadPoints: quadArr,
    Contents: PDFHexString.fromText(contents),
    T: PDFHexString.fromText(author),
    NM: PDFString.of(`indiya-spike:${label}`),
    C:
      subtype === 'Highlight'
        ? context.obj([1, 0.92, 0.23])
        : context.obj([0.86, 0.08, 0.24]),
    CA: PDFNumber.of(1),
    F: PDFNumber.of(4),
    Border: context.obj([0, 0, 0]),
  };

  if (withAp) {
    const w = Math.max(rect.urx - rect.llx, 0.5);
    const h = Math.max(rect.ury - rect.lly, 0.5);
    const midY = h / 2;
    const stroke =
      subtype === 'Highlight'
        ? `0.86 0.08 0.24 RG 0.86 0.08 0.24 rg 0.35 w 0 0 ${w.toFixed(3)} ${h.toFixed(3)} re f`
        : `0.86 0.08 0.24 RG 1.2 w 0 ${midY.toFixed(3)} m ${w.toFixed(3)} ${midY.toFixed(3)} l S`;
    const formStream = context.stream(stroke, {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: context.obj([0, 0, w, h]),
      Matrix: context.obj([1, 0, 0, 1, 0, 0]),
      Resources: context.obj({}),
    });
    const formRef = context.register(formStream);
    const apDict = context.obj({ N: formRef });
    dict.AP = apDict;
  }

  const annotDict = context.obj(dict);
  const annotRef = context.register(annotDict);

  const annotsKey = PDFName.of('Annots');
  let annots = page.node.lookup(annotsKey);
  if (!annots) {
    annots = context.obj([]);
    page.node.set(annotsKey, annots);
  }
  if (!(annots instanceof PDFArray)) {
    throw new Error('Page Annots is not an array');
  }
  annots.push(annotRef);
  return annotRef;
}

/**
 * @param {string} pdfPath
 */
async function processOne(pdfPath) {
  const bytes = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjsLib.getDocument({
    data: bytes.slice(),
    disableWorker: true,
    cMapUrl: `${pathToFileURL(path.join(root, 'public/pdfjs/cmaps')).href}/`,
    cMapPacked: true,
    useSystemFonts: false,
  });
  const pdfJsDoc = await loadingTask.promise;
  const page = await pdfJsDoc.getPage(1);
  const hit = await findNeedlePdfRect(page, TARGET);
  await pdfJsDoc.destroy();

  if (!hit) {
    return {
      file: path.basename(pdfPath),
      ok: false,
      error: `needle "${TARGET}" not found on page 1`,
    };
  }

  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: false });
  const pdfPage = pdfDoc.getPage(0);
  const context = pdfDoc.context;
  const r = hit.rect;

  const variants = [
    {
      label: 'strike-acrobat-ap',
      subtype: /** @type {const} */ ('StrikeOut'),
      quad: quadPointsAcrobat(r),
      withAp: true,
    },
    {
      label: 'strike-spec-ap',
      subtype: /** @type {const} */ ('StrikeOut'),
      quad: quadPointsSpec(r),
      withAp: true,
    },
    {
      label: 'strike-acrobat-noap',
      subtype: /** @type {const} */ ('StrikeOut'),
      quad: quadPointsAcrobat(r),
      withAp: false,
    },
    {
      label: 'highlight-acrobat-ap',
      subtype: /** @type {const} */ ('Highlight'),
      quad: quadPointsAcrobat(r),
      withAp: true,
    },
  ];

  // Offset vertically so variants don't fully overlap for visual compare
  for (let i = 0; i < variants.length; i += 1) {
    const dy = i * 0; // same target phrase — overlapping by design for spike
    const rect = {
      llx: r.llx,
      lly: r.lly + dy,
      urx: r.urx,
      ury: r.ury + dy,
    };
    const v = variants[i];
    addMarkupAnnot(pdfPage, context, {
      rect,
      quad: v.quad.map((n, qi) => (qi % 2 === 1 ? n + dy : n)),
      subtype: v.subtype,
      withAp: v.withAp,
      contents: `${NOTE} [${v.label}]`,
      author: AUTHOR,
      label: v.label,
    });
  }

  const outBytes = await pdfDoc.save({ useObjectStreams: false });
  const base = path.basename(pdfPath, '.pdf');
  const outPath = path.join(outDir, `${base}.annotated.pdf`);
  fs.writeFileSync(outPath, outBytes);

  // Re-read annotations with pdf.js and compare Rect to intended
  const verifyDoc = await pdfjsLib.getDocument({
    data: outBytes.slice(),
    disableWorker: true,
    cMapUrl: `${pathToFileURL(path.join(root, 'public/pdfjs/cmaps')).href}/`,
    cMapPacked: true,
  }).promise;
  const vPage = await verifyDoc.getPage(1);
  const annots = (await vPage.getAnnotations()) ?? [];
  const indi = annots.filter((a) => String(a.id || a.annotationName || '').includes('indiya') || String(a.contents || '').includes('할때'));
  // pdf.js may expose contents / rect
  const comparisons = annots.map((a) => {
    const rect = a.rect || a.rectangles?.[0];
    let delta = null;
    if (Array.isArray(rect) && rect.length >= 4) {
      const got = normalizeRect(rect[0], rect[1], rect[2], rect[3]);
      delta = {
        llx: Number((got.llx - r.llx).toFixed(3)),
        lly: Number((got.lly - r.lly).toFixed(3)),
        urx: Number((got.urx - r.urx).toFixed(3)),
        ury: Number((got.ury - r.ury).toFixed(3)),
      };
    }
    return {
      subtype: a.subtype,
      contents: a.contentsObj?.str ?? a.contents ?? '',
      title: a.titleObj?.str ?? a.title ?? '',
      hasAppearance: Boolean(a.hasAppearance),
      rect,
      deltaVsTarget: delta,
    };
  });
  const hangulOk = comparisons.some((c) => String(c.contents).includes('할때'));
  await verifyDoc.destroy();

  const maxAbs = comparisons.reduce((m, c) => {
    if (!c.deltaVsTarget) return m;
    const d = c.deltaVsTarget;
    return Math.max(m, Math.abs(d.llx), Math.abs(d.lly), Math.abs(d.urx), Math.abs(d.ury));
  }, 0);

  return {
    file: path.basename(pdfPath),
    ok: true,
    outPath: path.relative(root, outPath).replace(/\\/g, '/'),
    pageRotate: hit.pageRotate,
    viewBox: hit.viewBox,
    targetRect: r,
    viewportBox: hit.viewport,
    annotationCount: annots.length,
    comparisons,
    maxAbsDelta: maxAbs,
    coordPass: maxAbs <= 1.5,
    hangulContentsOk: hangulOk,
  };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const args = process.argv.slice(2);
  const inputs =
    args.length > 0
      ? args
      : fs
          .readdirSync(fixturesDir)
          .filter((n) => n.endsWith('.pdf'))
          .map((n) => path.join(fixturesDir, n));

  /** @type {unknown[]} */
  const results = [];
  for (const pdfPath of inputs) {
    try {
      // eslint-disable-next-line no-await-in-loop
      results.push(await processOne(pdfPath));
    } catch (err) {
      results.push({
        file: path.basename(pdfPath),
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const report = {
    needle: TARGET,
    note: NOTE,
    author: AUTHOR,
    results,
    summary: {
      files: results.length,
      ok: results.filter((r) => r && /** @type {{ok?: boolean}} */ (r).ok).length,
      coordPass: results.filter(
        (r) => r && /** @type {{coordPass?: boolean}} */ (r).coordPass,
      ).length,
    },
  };
  const reportPath = path.join(outDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report.summary, null, 2));
  console.log('report →', path.relative(root, reportPath));
  for (const r of results) {
    const row = /** @type {{ file: string, ok: boolean, coordPass?: boolean, error?: string, maxAbsDelta?: number, outPath?: string }} */ (
      r
    );
    if (!row.ok) {
      console.log(`FAIL ${row.file}: ${row.error}`);
    } else {
      console.log(
        `${row.coordPass ? 'PASS' : 'WARN'} ${row.file} maxΔ=${row.maxAbsDelta} → ${row.outPath}`,
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
