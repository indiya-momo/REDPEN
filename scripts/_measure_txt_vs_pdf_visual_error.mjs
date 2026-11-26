/**
 * TXT 오차 = PDF 시각 읽기 순서와 대조.
 * npx vite-node scripts/_measure_txt_vs_pdf_visual_error.mjs [pdf...]
 *
 * 정답: 페이지에서 눈으로 읽는 순서
 * 오차: TXT/후보가 이은 줄쌍이 그 순서의 이웃이 아닐 때
 *
 * 인자 없으면 이전 배치와 같은 3권.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractAllPagesText, loadPdfFromBuffer } from '../src/lib/pdfService.js';
import { cleanPageLinesForTxt } from '../src/lib/pdfTxtBodyClean.js';
import { analyzeParagraphFlow } from '../src/lib/pdfTxtParagraph.js';
import {
  applyUncertainSuggestionsToCandidates,
  suggestUncertainLinebreakDecisions,
} from '../src/lib/pdfTxtUncertainAnalyzer.js';
import { loadKiwiNode } from '../src/lib/kiwiMorph/loadNode.js';
import { analyzeLine, clearKiwiAnalyzeCache } from '../src/lib/kiwiMorph/analyze.js';
import { clearKiwiInstance } from '../src/lib/kiwiMorph/runtime.js';
import { isHangulSyllableChar } from '../src/lib/pdfPageText.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const desk = 'C:/Users/gikan/OneDrive/바탕 화면';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

const DEFAULT_PDFS = [
  'C:/Users/gikan/OneDrive/바탕 화면/인디야/인디야샘플PDF/세이노의가르침_230405.pdf',
  'C:/Users/gikan/OneDrive/바탕 화면/인디야/인디야샘플PDF/260107_스트리트 이코노미-본문(4교).pdf',
  'C:/Users/gikan/OneDrive/바탕 화면/261125 본문(4교)_박물관 피드백.pdf',
];

const pdfPaths = process.argv.slice(2).length
  ? process.argv.slice(2)
  : DEFAULT_PDFS;

/** @param {string} name */
function safeStem(name) {
  return String(name)
    .replace(/\.pdf$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '_')
    .replace(/\s+/gu, '_')
    .slice(0, 80);
}

/**
 * @param {{ x?: number, col?: number }[]} layouts
 */
function columnsAreDistinct(layouts) {
  const left = [];
  const right = [];
  for (const L of layouts ?? []) {
    if (L?.col === 1) right.push(Number(L.x) || 0);
    else left.push(Number(L.x) || 0);
  }
  if (!left.length || !right.length) return false;
  const mid = (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  return Math.abs(mid(right) - mid(left)) >= 40;
}

/**
 * @param {string[]} lines
 * @param {{ x?: number, y?: number, col?: number }[]} layouts
 * @returns {number[]}
 */
function visualOrderIndices(lines, layouts) {
  const n = lines?.length ?? 0;
  const idx = Array.from({ length: n }, (_, i) => i);
  const lays = layouts ?? [];
  const distinct = columnsAreDistinct(lays);
  idx.sort((a, b) => {
    const La = lays[a] || {};
    const Lb = lays[b] || {};
    if (distinct) {
      const ca = Number(La.col) || 0;
      const cb = Number(Lb.col) || 0;
      if (ca !== cb) return ca - cb;
    }
    const ya = Number(La.y);
    const yb = Number(Lb.y);
    if (Number.isFinite(ya) && Number.isFinite(yb) && ya !== yb) return yb - ya;
    return (Number(La.x) || 0) - (Number(Lb.x) || 0);
  });
  return idx;
}

/**
 * @param {{ pageNum: number, lines: string[], lineLayout?: object[] }[]} cleaned
 */
function buildVisualSequence(cleaned) {
  /** @type {{ key: string, pageNum: number, origIndex: number, text: string }[]} */
  const seq = [];
  for (const page of cleaned ?? []) {
    const lines = page.lines ?? [];
    const layouts = page.lineLayout ?? [];
    for (const origIndex of visualOrderIndices(lines, layouts)) {
      seq.push({
        key: `${page.pageNum}:${origIndex}`,
        pageNum: page.pageNum,
        origIndex,
        text: lines[origIndex],
      });
    }
  }
  return seq;
}

/**
 * @param {{ key: string }[]} seq
 * @param {string} leftKey
 * @param {string} rightKey
 */
function areVisualNeighbors(seq, leftKey, rightKey) {
  for (let i = 0; i < seq.length - 1; i += 1) {
    if (seq[i].key === leftKey && seq[i + 1].key === rightKey) return true;
  }
  return false;
}

/**
 * @param {import('../src/lib/pdfTxtLinebreakReview.js').LinebreakCandidate} c
 * @param {{ pageNum: number, lines: string[] }[]} cleaned
 */
function candidateKeys(c, cleaned) {
  const id = String(c.id ?? '');
  if (id.endsWith(':page')) {
    const pageNum = c.pageNum;
    const page = cleaned.find((p) => p.pageNum === pageNum);
    const next = cleaned.find((p) => p.pageNum > pageNum);
    if (!page?.lines?.length || !next?.lines?.length) return null;
    return {
      leftKey: `${pageNum}:${page.lines.length - 1}`,
      rightKey: `${next.pageNum}:0`,
    };
  }
  const m = /^(\d+):(\d+)$/.exec(id);
  if (!m) return null;
  return {
    leftKey: `${Number(m[1])}:${Number(m[2])}`,
    rightKey: `${Number(m[1])}:${Number(m[2]) + 1}`,
  };
}

function morphEye(left, right) {
  const L = String(left ?? '').replace(/\s+$/u, '');
  const R = String(right ?? '').replace(/^\s+/u, '');
  if (!L || !R) return 'skip';
  if (!isHangulSyllableChar(L.at(-1)) || !isHangulSyllableChar(R[0])) return 'skip';
  const leftTail = L.slice(Math.max(0, L.length - 14));
  const rightHead = R.slice(0, 14);
  const window = leftTail + rightHead;
  const at = leftTail.length;
  let analyzed;
  try {
    analyzed = analyzeLine(window);
  } catch {
    return 'skip';
  }
  const tokens = analyzed?.tokens ?? [];
  for (const t of tokens) {
    const start = Number(t.position) || 0;
    const end = start + (Number(t.length) || 0);
    if (start < at && end > at && (Number(t.length) || 0) >= 2) return 'A';
  }
  return tokens.length ? 'Y' : 'skip';
}

function rate(wrong, n) {
  return n ? Number((wrong / n).toFixed(4)) : null;
}

/**
 * @param {string} pdfPath
 */
async function measureOne(pdfPath) {
  const buf = readFileSync(pdfPath);
  const pdf = await loadPdfFromBuffer(
    new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
  );
  const pages = await extractAllPagesText(pdf);
  await pdf.destroy?.();
  const cleaned = cleanPageLinesForTxt(pages);
  const visualSeq = buildVisualSequence(cleaned);

  const flow = analyzeParagraphFlow(cleaned);
  const analyzer = suggestUncertainLinebreakDecisions(flow.candidates, {
    forceEnabled: true,
    analyze: analyzeLine,
  });
  const candidates = applyUncertainSuggestionsToCandidates(
    flow.candidates,
    analyzer,
  );

  let candN = 0;
  let orderWrong = 0;
  let gluedWrong = 0;
  let keptNonNeighbor = 0;
  /** @type {object[]} */
  const orderSamples = [];
  /** @type {Record<string, { n: number, wrong: number, samples: object[] }>} */
  const byReason = {};

  for (const c of candidates) {
    const keys = candidateKeys(c, cleaned);
    if (!keys) continue;
    candN += 1;
    const neighbor = areVisualNeighbors(visualSeq, keys.leftKey, keys.rightKey);
    const decided = c.defaultDecision;
    const joins =
      decided === 'space' ||
      decided === 'nospace' ||
      decided === 'join' ||
      decided === 'dehyphen';
    let wrong = false;
    let kind = 'ok';
    if (!neighbor) {
      orderWrong += 1;
      wrong = true;
      if (joins) {
        gluedWrong += 1;
        kind = '비이웃을_이음';
      } else {
        keptNonNeighbor += 1;
        kind = '비이웃_후보(유지)';
      }
    }
    const reason = c.reason || 'other';
    if (!byReason[reason]) byReason[reason] = { n: 0, wrong: 0, samples: [] };
    byReason[reason].n += 1;
    if (wrong) byReason[reason].wrong += 1;
    if (wrong && orderSamples.length < 24) {
      const sample = {
        id: c.id,
        kind,
        decided,
        reason,
        eye: morphEye(c.left, c.right),
        left: String(c.left).slice(-36),
        right: String(c.right).slice(0, 36),
        leftKey: keys.leftKey,
        rightKey: keys.rightKey,
      };
      orderSamples.push(sample);
      if (byReason[reason].samples.length < 4) {
        byReason[reason].samples.push(sample);
      }
    }
  }

  let extractPairN = 0;
  let extractPairOrderWrong = 0;
  for (const page of cleaned) {
    const lines = page.lines ?? [];
    for (let i = 0; i < lines.length - 1; i += 1) {
      extractPairN += 1;
      if (
        !areVisualNeighbors(
          visualSeq,
          `${page.pageNum}:${i}`,
          `${page.pageNum}:${i + 1}`,
        )
      ) {
        extractPairOrderWrong += 1;
      }
    }
  }
  for (let p = 0; p < cleaned.length - 1; p += 1) {
    const a = cleaned[p];
    const b = cleaned[p + 1];
    if (!a?.lines?.length || !b?.lines?.length) continue;
    extractPairN += 1;
    if (
      !areVisualNeighbors(
        visualSeq,
        `${a.pageNum}:${a.lines.length - 1}`,
        `${b.pageNum}:0`,
      )
    ) {
      extractPairOrderWrong += 1;
    }
  }

  const stem = safeStem(basename(pdfPath));
  const out = {
    measuredAt: new Date().toISOString(),
    pdf: basename(pdfPath),
    pdfPath,
    note:
      '오차=PDF 시각 읽기 순서와 불일치. 후보 줄쌍이 시각 이웃이 아니면 오차. Kiwi A/Y는 참고만.',
    visualOrder: {
      rule:
        '단 x가 갈라지면 왼단→오른단(각 단 -y), 아니면 페이지 전체 -y·x (위→아래)',
    },
    modalCandidates: {
      n: candN,
      orderWrong,
      gluedWrong,
      keptNonNeighbor,
      errorRate: rate(orderWrong, candN),
      glueErrorRate: rate(gluedWrong, candN),
      byReason: Object.fromEntries(
        Object.entries(byReason).map(([k, v]) => [
          k,
          {
            n: v.n,
            wrong: v.wrong,
            errorRate: rate(v.wrong, v.n),
            samples: v.samples,
          },
        ]),
      ),
    },
    extractAdjacency: {
      pairs: extractPairN,
      notVisualNeighbor: extractPairOrderWrong,
      errorRate: rate(extractPairOrderWrong, extractPairN),
    },
    samples: orderSamples,
  };

  const md = [];
  md.push(`# ${stem} PDF 시각 읽기 순서 오차`);
  md.push('');
  md.push(`- 측정: ${out.measuredAt}`);
  md.push(`- PDF: ${out.pdf}`);
  md.push(`- 정답: ${out.visualOrder.rule}`);
  md.push('- 오차: TXT/모달 후보가 이은 줄쌍이 시각 이웃이 아님');
  md.push('');
  md.push('## 모달 후보 (uncertain)');
  md.push('');
  md.push('| 구분 | n | 오차 | 오차율 |');
  md.push('|---|---:|---:|---:|');
  md.push(
    `| 전체(비이웃) | ${candN} | ${orderWrong} | ${((out.modalCandidates.errorRate || 0) * 100).toFixed(1)}% |`,
  );
  md.push(
    `| 그중 이음(space/nospace 등) | ${candN} | ${gluedWrong} | ${((out.modalCandidates.glueErrorRate || 0) * 100).toFixed(1)}% |`,
  );
  md.push(
    `| 그중 유지(keep) | ${candN} | ${keptNonNeighbor} | ${((rate(keptNonNeighbor, candN) || 0) * 100).toFixed(1)}% |`,
  );
  md.push('');
  md.push('## reason별');
  md.push('');
  md.push('| reason | n | 오차 | 오차율 |');
  md.push('|---|---:|---:|---:|');
  for (const [k, v] of Object.entries(out.modalCandidates.byReason).sort(
    (a, b) => b[1].n - a[1].n,
  )) {
    md.push(
      `| ${k} | ${v.n} | ${v.wrong} | ${v.errorRate == null ? '-' : `${(v.errorRate * 100).toFixed(1)}%`} |`,
    );
  }
  md.push('');
  md.push('## 추출 줄 인접(모달 밖 포함)');
  md.push('');
  md.push(
    `줄쌍 ${extractPairN}, 시각 비이웃 ${extractPairOrderWrong} (오차율 ${((out.extractAdjacency.errorRate || 0) * 100).toFixed(1)}%)`,
  );
  md.push('');
  md.push('## 오차 표본');
  md.push('');
  for (const s of orderSamples) {
    md.push(
      `- [${s.kind}] ${s.id} · ${s.reason} · decided=${s.decided} · eye=${s.eye}`,
    );
    md.push(`  - …${s.left} ↵ ${s.right}…`);
    md.push(`  - keys ${s.leftKey} → ${s.rightKey} (시각 이웃 아님)`);
  }
  md.push('');

  const mdPath = join(desk, `${stem}-pdf-visual-order-error.md`);
  const jsonPath = join(desk, `${stem}-pdf-visual-order-error.json`);
  writeFileSync(mdPath, md.join('\n'), 'utf8');
  writeFileSync(jsonPath, JSON.stringify(out, null, 2), 'utf8');
  mkdirSync(join(root, 'tmp'), { recursive: true });
  writeFileSync(
    join(root, 'tmp', `${stem}-pdf-visual-order-error.json`),
    JSON.stringify(out, null, 2),
    'utf8',
  );

  return {
    stem,
    pdf: out.pdf,
    mdPath,
    jsonPath,
    modal: out.modalCandidates,
    extract: out.extractAdjacency,
  };
}

await loadKiwiNode({ rootDir: root, register: true });

/** @type {Awaited<ReturnType<typeof measureOne>>[]} */
const summaries = [];
for (const pdfPath of pdfPaths) {
  if (!existsSync(pdfPath)) {
    console.error(`missing: ${pdfPath}`);
    continue;
  }
  console.error(`measuring: ${basename(pdfPath)}`);
  clearKiwiAnalyzeCache();
  summaries.push(await measureOne(pdfPath));
}

clearKiwiAnalyzeCache();
clearKiwiInstance();

const summaryMd = [];
summaryMd.push('# PDF 시각 읽기 순서 오차 — 3권 요약');
summaryMd.push('');
summaryMd.push(`- 측정: ${new Date().toISOString()}`);
summaryMd.push('- 정답: PDF 시각 읽기 순서 / 오차: 비이웃 줄쌍');
summaryMd.push('');
summaryMd.push('| 책 | 모달 n | 비이웃 | 오차율 | 잘못 이음 | 추출 비이웃율 |');
summaryMd.push('|---|---:|---:|---:|---:|---:|');
for (const s of summaries) {
  summaryMd.push(
    `| ${s.pdf} | ${s.modal.n} | ${s.modal.orderWrong} | ${((s.modal.errorRate || 0) * 100).toFixed(1)}% | ${s.modal.gluedWrong} | ${((s.extract.errorRate || 0) * 100).toFixed(1)}% |`,
  );
}
summaryMd.push('');
summaryMd.push('## 파일');
summaryMd.push('');
for (const s of summaries) {
  summaryMd.push(`- ${s.mdPath}`);
}
summaryMd.push('');

const summaryPath = join(desk, 'pdf-visual-order-error-3books-summary.md');
writeFileSync(summaryPath, summaryMd.join('\n'), 'utf8');

console.log(
  JSON.stringify(
    {
      summaryPath,
      books: summaries.map((s) => ({
        pdf: s.pdf,
        mdPath: s.mdPath,
        modalErrorRate: s.modal.errorRate,
        orderWrong: s.modal.orderWrong,
        n: s.modal.n,
        extractErrorRate: s.extract.errorRate,
      })),
    },
    null,
    2,
  ),
);
