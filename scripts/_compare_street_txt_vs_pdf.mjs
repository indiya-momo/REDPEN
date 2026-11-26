/**
 * 스트리트 TXT ↔ PDF 시각 줄(칸) 대조
 * npx vite-node scripts/_compare_street_txt_vs_pdf.mjs
 *
 * 정답: PDF에서 뽑은 시각 칸·줄 (cleanPageLinesForTxt)
 * 오차:
 *  1) TXT에 mash 패턴이 남아 있음 (PDF 칸이 한 줄로 섞인 채)
 *  2) 최종 TXT가 이은 줄쌍이 PDF 시각 이웃이 아님
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractAllPagesText, loadPdfFromBuffer } from '../src/lib/pdfService.js';
import { cleanPageLinesForTxt } from '../src/lib/pdfTxtBodyClean.js';
import { analyzeParagraphFlow } from '../src/lib/pdfTxtParagraph.js';
import { applyLinebreakDecisions } from '../src/lib/pdfTxtLinebreakReview.js';
import {
  applyUncertainSuggestionsToCandidates,
  suggestUncertainLinebreakDecisions,
} from '../src/lib/pdfTxtUncertainAnalyzer.js';
import { loadKiwiNode } from '../src/lib/kiwiMorph/loadNode.js';
import { analyzeLine, clearKiwiAnalyzeCache } from '../src/lib/kiwiMorph/analyze.js';
import { clearKiwiInstance } from '../src/lib/kiwiMorph/runtime.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const desk = 'C:/Users/gikan/OneDrive/바탕 화면';
const pdfPath = join(
  desk,
  '인디야/인디야샘플PDF/260107_스트리트 이코노미-본문(4교).pdf',
);
const prevTxtPath = join(desk, '260107_스트리트 이코노미-본문(4교).txt');
const afterTxtPath = join(desk, '260107_스트리트_이코노미-본문(4교)-x칸분리후.txt');

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

const MASH_RES = [
  /안정적인원 자 재/u,
  /원 자 재 가 격 상 승기업/u,
  /유기적유기적/u,
  /달국에/u,
  /임금가격/u,
  /는지총이익/u,
];

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

function buildVisualSeq(cleaned) {
  /** @type {{ key: string, text: string }[]} */
  const seq = [];
  for (const page of cleaned ?? []) {
    const lines = page.lines ?? [];
    const layouts = page.lineLayout ?? [];
    for (const i of visualOrderIndices(lines, layouts)) {
      seq.push({ key: `${page.pageNum}:${i}`, text: lines[i] });
    }
  }
  return seq;
}

function areNeighbors(seq, leftKey, rightKey) {
  for (let i = 0; i < seq.length - 1; i += 1) {
    if (seq[i].key === leftKey && seq[i + 1].key === rightKey) return true;
  }
  return false;
}

function mashScore(text) {
  const lines = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .split('\n');
  const nonEmpty = lines.filter((l) => l.trim());
  let errorLines = 0;
  /** @type {string[]} */
  const samples = [];
  for (const line of nonEmpty) {
    if (MASH_RES.some((re) => re.test(line))) {
      errorLines += 1;
      if (samples.length < 8) samples.push(line.slice(0, 100));
    }
  }
  return {
    nonEmptyLines: nonEmpty.length,
    errorLines,
    errorRate: nonEmpty.length ? errorLines / nonEmpty.length : 0,
    samples,
  };
}

function candidateKeys(c, cleaned) {
  const id = String(c.id ?? '');
  if (id.endsWith(':page')) {
    const page = cleaned.find((p) => p.pageNum === c.pageNum);
    const next = cleaned.find((p) => p.pageNum > c.pageNum);
    if (!page?.lines?.length || !next?.lines?.length) return null;
    return {
      leftKey: `${c.pageNum}:${page.lines.length - 1}`,
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

await loadKiwiNode({ rootDir: root, register: true });

const buf = readFileSync(pdfPath);
const pdf = await loadPdfFromBuffer(
  new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
);
const pages = await extractAllPagesText(pdf);
await pdf.destroy?.();
const cleaned = cleanPageLinesForTxt(pages);
const visualSeq = buildVisualSeq(cleaned);

// PDF 표면(칸·줄) mash — 있으면 추출 단계 오차
const pdfSurfaceText = cleaned.map((p) => (p.lines ?? []).join('\n')).join('\n');
const pdfMash = mashScore(pdfSurfaceText);

const flow = analyzeParagraphFlow(cleaned);
const analyzed = suggestUncertainLinebreakDecisions(flow.candidates, {
  forceEnabled: true,
  analyze: analyzeLine,
});
const candidates = applyUncertainSuggestionsToCandidates(
  flow.candidates,
  analyzed,
);
/** @type {Record<string, string>} */
const decisions = {};
for (const c of candidates) {
  decisions[c.id] =
    c.defaultDecision === 'join' ? 'space' : c.defaultDecision;
}
const finalTxt = applyLinebreakDecisions(cleaned, decisions, {
  autoParagraph: true,
});

let joinN = 0;
let joinNotNeighbor = 0;
/** @type {object[]} */
const joinSamples = [];
for (const c of candidates) {
  const joins =
    c.defaultDecision === 'space' ||
    c.defaultDecision === 'nospace' ||
    c.defaultDecision === 'join' ||
    c.defaultDecision === 'dehyphen';
  if (!joins) continue;
  const keys = candidateKeys(c, cleaned);
  if (!keys) continue;
  joinN += 1;
  if (!areNeighbors(visualSeq, keys.leftKey, keys.rightKey)) {
    joinNotNeighbor += 1;
    if (joinSamples.length < 12) {
      joinSamples.push({
        id: c.id,
        decided: c.defaultDecision,
        left: String(c.left).slice(-36),
        right: String(c.right).slice(0, 36),
      });
    }
  }
}

const prevTxt = readFileSync(prevTxtPath, 'utf8');
const afterTxt = readFileSync(afterTxtPath, 'utf8');
const prevMash = mashScore(prevTxt);
const afterMash = mashScore(afterTxt);
const finalMash = mashScore(finalTxt);

// PDF 칸 텍스트가 이전/이후 TXT에 살아 있는지 — 표본 칸
const cellNeedles = [
  '원 자 재 가 격 상 승',
  '근로자들이 실질 임금',
  '비용 감소와 안정적인',
  '기업은 투입 비용의 상',
];
const cellCheck = cellNeedles.map((n) => ({
  cell: n,
  inPdf: pdfSurfaceText.includes(n),
  inPrev: prevTxt.includes(n),
  inAfter: afterTxt.includes(n),
  mashedInPrev: prevTxt.includes(n.replace(/\s/g, '')) || /안정적인원 자 재/.test(prevTxt),
}));

clearKiwiAnalyzeCache();
clearKiwiInstance();

const out = {
  measuredAt: new Date().toISOString(),
  pdf: basename(pdfPath),
  note:
    '정답=PDF 시각 칸·줄. mash오차=한 줄에 칸이 섞인 패턴. 이음오차=모달이 이은 쌍이 PDF 시각 이웃이 아님.',
  pdfSurface: {
    lines: cleaned.reduce((n, p) => n + (p.lines?.length || 0), 0),
    mash: pdfMash,
  },
  txtMashVsPdf: {
    prev: prevMash,
    afterFile: afterMash,
    afterPipelineFinal: finalMash,
  },
  modalJoinVsPdfVisualNeighbor: {
    joinedCandidates: joinN,
    notVisualNeighbor: joinNotNeighbor,
    errorRate: joinN ? joinNotNeighbor / joinN : 0,
    samples: joinSamples,
  },
  cellPresence: cellCheck,
};

const md = [];
md.push('# 스트리트 TXT ↔ PDF 대조');
md.push('');
md.push(`- 측정: ${out.measuredAt}`);
md.push(`- PDF: ${out.pdf}`);
md.push('- 정답: PDF 시각 칸·줄 (`cleanPageLinesForTxt`)');
md.push('');
md.push('## 1) mash 오차 (PDF 칸이 한 줄로 섞임)');
md.push('');
md.push('| 대상 | 비어있지 않은 줄 | 오차 줄 | 오차율 |');
md.push('|---|---:|---:|---:|');
md.push(
  `| PDF 표면(추출) | ${pdfMash.nonEmptyLines} | ${pdfMash.errorLines} | ${(pdfMash.errorRate * 100).toFixed(3)}% |`,
);
md.push(
  `| 이전 TXT | ${prevMash.nonEmptyLines} | ${prevMash.errorLines} | ${(prevMash.errorRate * 100).toFixed(3)}% |`,
);
md.push(
  `| 이후 TXT 파일 | ${afterMash.nonEmptyLines} | ${afterMash.errorLines} | ${(afterMash.errorRate * 100).toFixed(3)}% |`,
);
md.push('');
md.push('## 2) 이음 오차 (모달이 이음 · PDF 시각 이웃 아님)');
md.push('');
md.push(
  `| 이은 후보 | 비이웃 | 오차율 |`,
);
md.push('|---:|---:|---:|');
md.push(
  `| ${joinN} | ${joinNotNeighbor} | ${((out.modalJoinVsPdfVisualNeighbor.errorRate || 0) * 100).toFixed(1)}% |`,
);
md.push('');
md.push('### 이음 오차 표본');
md.push('');
for (const s of joinSamples) {
  md.push(`- ${s.id} · ${s.decided}`);
  md.push(`  - …${s.left} ↵ ${s.right}…`);
}
md.push('');
md.push('## 3) PDF 칸 문자열이 TXT에 살아 있는지');
md.push('');
md.push('| 칸(PDF) | PDF | 이전 TXT | 이후 TXT |');
md.push('|---|---|---|---|');
for (const c of cellCheck) {
  md.push(
    `| ${c.cell} | ${c.inPdf ? 'Y' : 'N'} | ${c.inPrev ? 'Y' : 'N'} | ${c.inAfter ? 'Y' : 'N'} |`,
  );
}
md.push('');

const mdPath = join(desk, 'street-txt-vs-pdf.md');
writeFileSync(mdPath, md.join('\n'), 'utf8');
writeFileSync(join(desk, 'street-txt-vs-pdf.json'), JSON.stringify(out, null, 2), 'utf8');

console.log(JSON.stringify({ mdPath, ...out }, null, 2));
console.log(md.join('\n'));
