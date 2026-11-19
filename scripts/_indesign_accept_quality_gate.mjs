/**
 * 인디야 Replace Accept 품질 게이트 — 출처·폴백 목록·합성·QuadPoints 가로 진단.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument, PDFName, PDFArray, PDFDict } from 'pdf-lib';
import { buildPageText, dedupeOverlayTextItems } from '../src/lib/pdfPageText.js';
import {
  ensurePageGlyphOffsets,
  getItemGlyphOffsets,
} from '../src/lib/pdfGlyphAdvances.js';
import { fallbackCharEm } from '../src/lib/pdfTextItemMetrics.js';
import {
  segmentsForTextRange,
  quadPointsAcrobatOrder,
} from '../src/lib/pdfAnnotExport/annotGeometry.js';
import { writeAnnotatedPdf } from '../src/lib/pdfAnnotExport/writeAnnotatedPdf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../project-docs/indesign-replace-golden-2026-11-19');
const desktop = 'C:\\Users\\gikan\\OneDrive\\바탕 화면';
const srcPdf = path.join(desktop, '261117_경주멍-본문 2교지_131.pdf');
const goldenPath = path.join(outDir, 'replace-pairs.json');
const desktopOut = path.join(desktop, '261117_경주멍-본문_인디야Replace스모크.pdf');

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.resolve(__dirname, '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
).href;

const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
const pdfBytes = fs.readFileSync(srcPdf);

const metaDoc = await PDFDocument.load(pdfBytes, {
  ignoreEncryption: true,
  updateMetadata: false,
});
function infoStr(key) {
  try {
    const v = metaDoc.context.lookup(metaDoc.context.trailer.get(PDFName.of('Info')));
    if (!(v instanceof PDFDict)) return null;
    const n = v.lookup(PDFName.of(key));
    if (!n) return null;
    return typeof n.decodeText === 'function' ? n.decodeText() : String(n);
  } catch {
    return null;
  }
}
const producer = infoStr('Producer') ?? metaDoc.getProducer?.() ?? null;
const creator = infoStr('Creator') ?? metaDoc.getCreator?.() ?? null;

const pdf = await pdfjsLib.getDocument({
  data: new Uint8Array(pdfBytes),
  cMapUrl:
    pathToFileURL(path.resolve(__dirname, '../public/pdfjs/cmaps')).href + '/',
  cMapPacked: true,
}).promise;

const pageTexts = [];
const fallbacks = [];
let itemsTotal = 0;
let glyphHit = 0;
let glyphMiss = 0;
let leadingSpace = 0;
let twSeen = 0;

for (let n = 1; n <= pdf.numPages; n += 1) {
  const page = await pdf.getPage(n);
  const content = await page.getTextContent({ disableCombineTextItems: true });
  const items = dedupeOverlayTextItems(content.items.filter((it) => 'str' in it));
  await ensurePageGlyphOffsets(page, items, pdfjsLib.OPS, { force: true });

  const opList = await page.getOperatorList();
  for (let i = 0; i < opList.fnArray.length; i += 1) {
    if (opList.fnArray[i] === pdfjsLib.OPS.setWordSpacing) {
      const w = opList.argsArray[i]?.[0];
      if (typeof w === 'number' && Math.abs(w) > 1e-6) twSeen += 1;
    }
  }

  const built = buildPageText(items);
  pageTexts.push({
    pageNum: n,
    text: built.text,
    items,
    itemRefs: built.itemRefs,
  });

  for (let ii = 0; ii < items.length; ii += 1) {
    const it = items[ii];
    if (!it?.str) continue;
    itemsTotal += 1;
    const lead = /^\s/u.test(it.str);
    if (lead) leadingSpace += 1;
    const off = getItemGlyphOffsets(it);
    if (off) glyphHit += 1;
    else {
      glyphMiss += 1;
      if (fallbacks.length < 200) {
        fallbacks.push({
          page: n,
          itemIndex: ii,
          reason: lead ? 'leading_space' : 'match_fail_or_other',
          str: String(it.str).slice(0, 40),
          width: it.width ?? null,
        });
      }
    }
  }
}

const findings = [];
const needles = [
  { pageNum: 1, found: '경주멍', replacement: '경주멍멍' },
  { pageNum: 2, found: '경주멍', replacement: '경 주멍' },
];
for (const n of needles) {
  const pd = pageTexts.find((p) => p.pageNum === n.pageNum);
  const start = pd?.text?.indexOf(n.found) ?? -1;
  if (start < 0) {
    console.error('needle missing', n, 'snippet', pd?.text?.slice(0, 80));
    process.exit(1);
  }
  findings.push({
    pageNum: n.pageNum,
    start,
    end: start + n.found.length,
    found: n.found,
    replacement: n.replacement,
    style: 'strike',
    label: '',
    contents: '',
    subject: '맞춤법',
  });
}

const cleanDoc = await PDFDocument.load(pdfBytes, {
  ignoreEncryption: true,
  updateMetadata: false,
});
for (const page of cleanDoc.getPages()) {
  if (page.node.get(PDFName.of('Annots'))) page.node.delete(PDFName.of('Annots'));
}
const cleanBytes = await cleanDoc.save({ useObjectStreams: false });

const { bytes, counts } = await writeAnnotatedPdf({
  pdfBytes: cleanBytes,
  findings,
  pageTexts,
  charEm: fallbackCharEm,
  mode: 'indesignReplace',
});
fs.writeFileSync(desktopOut, bytes);

const outDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
const qpDiag = [];
for (let pi = 0; pi < outDoc.getPages().length; pi += 1) {
  const page = outDoc.getPages()[pi];
  const annotsRef = page.node.get(PDFName.of('Annots'));
  if (!annotsRef) continue;
  const annots = page.node.context.lookup(annotsRef);
  if (!(annots instanceof PDFArray)) continue;
  for (let i = 0; i < annots.size(); i += 1) {
    const annot = page.node.context.lookup(annots.get(i));
    if (!(annot instanceof PDFDict)) continue;
    if (annot.get(PDFName.of('Subtype'))?.toString() !== '/StrikeOut') continue;
    if (annot.get(PDFName.of('IT'))?.toString() !== '/StrikeOutTextEdit') continue;
    const qp = annot.lookup(PDFName.of('QuadPoints'), PDFArray);
    const nums = [];
    for (let k = 0; k < qp.size(); k += 1) nums.push(qp.get(k).asNumber());
    const xs = [];
    for (let k = 0; k < nums.length; k += 2) xs.push(nums[k]);
    qpDiag.push({
      page: pi + 1,
      indiyaX0: Math.min(...xs),
      indiyaX1: Math.max(...xs),
      quadCount: nums.length / 8,
    });
  }
}

for (let i = 0; i < Math.min(qpDiag.length, golden.length); i += 1) {
  const gxs = golden[i].strike.quadPoints.map((p) => p[0]);
  qpDiag[i].acrobatX0 = Math.min(...gxs);
  qpDiag[i].acrobatX1 = Math.max(...gxs);
  qpDiag[i].dx0 = qpDiag[i].indiyaX0 - qpDiag[i].acrobatX0;
  qpDiag[i].dx1 = qpDiag[i].indiyaX1 - qpDiag[i].acrobatX1;
  qpDiag[i].goldenContents = golden[i].caret.contents;
  qpDiag[i].indiyaReplacement = findings[i]?.replacement;
}

const segX = findings.map((f) => {
  const pd = pageTexts.find((p) => p.pageNum === f.pageNum);
  const segs = segmentsForTextRange(pd, f.start, f.end, fallbackCharEm);
  const qp = quadPointsAcrobatOrder(segs);
  const xs = [];
  for (let k = 0; k < qp.length; k += 2) xs.push(qp[k]);
  const ref = pd.itemRefs.find((r) => r.start <= f.start && f.start < r.end);
  return {
    page: f.pageNum,
    found: f.found,
    segX0: Math.min(...xs),
    segX1: Math.max(...xs),
    usedGlyph: !!(ref && getItemGlyphOffsets(pd.items[ref.itemIndex])),
  };
});

const sourceKind = /ezPDF/i.test(String(producer ?? ''))
  ? 'ezPDF_resave'
  : 'unknown';

const report = {
  at: new Date().toISOString(),
  srcPdf,
  desktopOut,
  source: {
    producer,
    creator,
    kind: sourceKind,
    note:
      '스펙 §5.2: ezPDF 경로는 보장 밖·결과만 기록. ID 내보내기 원본이 있으면 그걸 우선.',
  },
  tw: {
    setWordSpacingNonZeroOps: twSeen,
    note:
      twSeen === 0
        ? 'Tw(setWordSpacing≠0) 미검출 → Tw 보정 영향 없음이 정상일 수 있음.'
        : 'Tw 연산 있음 → isSpace일 때만 Tw 가산 경로가 의미 있음.',
  },
  glyphCoverage: {
    itemsTotal,
    glyphHit,
    glyphMiss,
    leadingSpaceItems: leadingSpace,
    fallbackListed: fallbacks.length,
  },
  fallbacks,
  findings,
  writeCounts: counts,
  quadPointsXDiagnostic: qpDiag,
  segmentXFromSharedPath: segX,
  acceptVerdict: {
    status: 'pending_manual',
    criteria:
      'InDesign Import→Accept 후 본문이 경주멍멍 / 경 주멍과 일치하면 합격. QuadPoints 수치 일치는 비합격 조건.',
  },
};

fs.writeFileSync(path.join(outDir, 'accept-quality-gate.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(
  path.join(outDir, 'fallback-inventory.json'),
  JSON.stringify(
    { srcPdf, sourceKind, glyphCoverage: report.glyphCoverage, fallbacks },
    null,
    2,
  ),
);
console.log(JSON.stringify({
  source: report.source,
  tw: report.tw,
  glyphCoverage: report.glyphCoverage,
  findings,
  writeCounts: counts,
  quadPointsXDiagnostic: qpDiag,
  segmentXFromSharedPath: segX,
  desktopOut,
}, null, 2));
