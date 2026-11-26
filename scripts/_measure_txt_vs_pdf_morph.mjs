/**
 * 검수전·추천형 TXT ↔ PDF, 조사 / 형태소 유형별 오차.
 * npx vite-node scripts/_measure_txt_vs_pdf_morph.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractAllPagesText, loadPdfFromBuffer } from '../src/lib/pdfService.js';
import { cleanPageLinesForTxt } from '../src/lib/pdfTxtBodyClean.js';
import {
  analyzeParagraphFlow,
  classifyParagraphPair,
  buildParagraphContext,
  paragraphJoinGlue,
} from '../src/lib/pdfTxtParagraph.js';
import {
  applyLinebreakDecisions,
  joinPagesWithMarkers,
} from '../src/lib/pdfTxtLinebreakReview.js';
import {
  applyUncertainSuggestionsToCandidates,
  suggestUncertainLinebreakDecisions,
} from '../src/lib/pdfTxtUncertainAnalyzer.js';
import { isHangulSyllableChar } from '../src/lib/pdfPageText.js';
import { loadKiwiNode } from '../src/lib/kiwiMorph/loadNode.js';
import { analyzeLine, clearKiwiAnalyzeCache } from '../src/lib/kiwiMorph/analyze.js';
import { clearKiwiInstance } from '../src/lib/kiwiMorph/runtime.js';
import { isJosaTag } from '../src/lib/kiwiMorph/tokens.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const desk = 'C:/Users/gikan/OneDrive/바탕 화면';
const pdfPath =
  'C:/Users/gikan/OneDrive/바탕 화면/인디야/인디야샘플PDF/depressione_PDF_v1.pdf';
const draftPath = join(desk, 'depressione_PDF_v1_검수전.txt');
const recPath = join(desk, 'depressione_PDF_v1_추천형.txt');

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

/** @param {string} tag */
function tagFamily(tag) {
  const t = String(tag ?? '');
  if (!t) return '기타';
  if (t.startsWith('J')) return '조사';
  if (t === 'NNG' || t === 'NNP' || t === 'NNB' || t === 'NR' || t === 'NP') {
    return '명사';
  }
  if (t.startsWith('V') || t === 'VX') return '용언';
  if (t === 'MAG' || t === 'MAJ') return '부사';
  if (t === 'MM') return '관형사';
  if (t.startsWith('X')) return '접사';
  if (t.startsWith('E')) return '어미';
  if (t === 'SL' || t === 'SH' || t === 'SN') return '기타기호';
  return t;
}

/**
 * @param {string} left
 * @param {string} right
 */
function morphAtJoin(left, right) {
  const L = String(left ?? '').replace(/\s+$/u, '');
  const R = String(right ?? '').replace(/^\s+/u, '');
  if (!L || !R) return { label: 'skip', eye: 'skip', detail: '' };
  const last = L[L.length - 1];
  const first = R[0];
  if (!isHangulSyllableChar(last) || !isHangulSyllableChar(first)) {
    return { label: '비한글경계', eye: 'skip', detail: '' };
  }

  const leftTail = L.slice(Math.max(0, L.length - 14));
  const rightHead = R.slice(0, 14);
  const window = leftTail + rightHead;
  const at = leftTail.length;
  const analyzed = analyzeLine(window);
  const tokens = analyzed?.tokens ?? [];
  if (!tokens.length) return { label: '분석실패', eye: 'skip', detail: '' };

  /** @type {import('../src/lib/kiwiMorph/tokens.js').KiwiToken | null} */
  let span = null;
  for (const t of tokens) {
    const start = Number(t.position) || 0;
    const len = Number(t.length) || 0;
    const end = start + len;
    if (start < at && end > at && len >= 2) {
      span = t;
      break;
    }
  }

  if (span) {
    const fam = tagFamily(span.tag);
    return {
      label: `형태소중간(${fam})`,
      eye: 'A',
      detail: `${span.str}/${span.tag}`,
      leftFam: fam,
      rightFam: fam,
    };
  }

  let leftTok = null;
  let rightTok = null;
  for (const t of tokens) {
    const start = Number(t.position) || 0;
    const end = start + (Number(t.length) || 0);
    if (end === at) leftTok = t;
    if (start === at) rightTok = t;
  }
  if (!leftTok) {
    for (const t of tokens) {
      const start = Number(t.position) || 0;
      const end = start + (Number(t.length) || 0);
      if (end <= at) leftTok = t;
    }
  }
  if (!rightTok) {
    for (const t of tokens) {
      const start = Number(t.position) || 0;
      if (start >= at) {
        rightTok = t;
        break;
      }
    }
  }

  const lf = tagFamily(leftTok?.tag);
  const rf = tagFamily(rightTok?.tag);
  let label = `${lf}+${rf}`;
  if (isJosaTag(rightTok?.tag)) label = `어절+조사(${rf})`;
  if (lf === '명사' && rf === '명사') label = '명사+명사';
  if (lf === '명사' && rf === '용언') label = '명사+용언';
  if (lf === '용언' && rf === '어미') label = '용언+어미';
  if (lf === '명사' && rf === '접사') label = '명사+접사';
  if (lf === '부사' && rf === '용언') label = '부사+용언';

  return {
    label,
    eye: 'Y',
    detail: `${leftTok?.str ?? '?'}/${leftTok?.tag ?? '?'} + ${rightTok?.str ?? '?'}/${rightTok?.tag ?? '?'}`,
    leftFam: lf,
    rightFam: rf,
  };
}

function stripMarkers(text) {
  return String(text ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n\n--- p\.\d+ ---\n/g, '\n\n')
    .replace(/^--- p\.\d+ ---\n/gm, '');
}

function fileStats(path) {
  const raw = readFileSync(path, 'utf8');
  const text = stripMarkers(raw);
  const lines = text.split('\n').filter((l) => l.length > 0);
  return {
    path: basename(path),
    bytes: Buffer.byteLength(raw, 'utf8'),
    chars: text.length,
    newlines: (text.match(/\n/g) || []).length,
    nonEmptyLines: lines.length,
    hangul: [...text].filter((ch) => isHangulSyllableChar(ch)).length,
  };
}

await loadKiwiNode({ rootDir: root, register: true });

const buf = readFileSync(pdfPath);
const pdf = await loadPdfFromBuffer(
  buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
);
const pages = await extractAllPagesText(pdf);
await pdf.destroy?.();
const cleaned = cleanPageLinesForTxt(pages);
const flow = analyzeParagraphFlow(cleaned);
const analyzer = suggestUncertainLinebreakDecisions(flow.candidates, {
  forceEnabled: true,
  analyze: analyzeLine,
});
const candidates = applyUncertainSuggestionsToCandidates(
  flow.candidates,
  analyzer,
);

/** @type {Record<string, 'keep'|'nospace'|'space'|'dehyphen'>} */
const decisions = {};
for (const c of candidates) {
  decisions[c.id] =
    c.defaultDecision === 'join' ? 'space' : c.defaultDecision;
}

const draftFromPdf = joinPagesWithMarkers(cleaned);
const recFromPdf = applyLinebreakDecisions(cleaned, decisions, {
  autoParagraph: true,
});

const draftFile = fileStats(draftPath);
const recFile = fileStats(recPath);
const draftPdfStats = {
  newlines: (draftFromPdf.match(/\n/g) || []).length,
  chars: draftFromPdf.length,
  lines: cleaned.reduce((n, p) => n + (p.lines?.length || 0), 0),
};
const recPdfStats = {
  newlines: (recFromPdf.match(/\n/g) || []).length,
  chars: recFromPdf.length,
};

/** @type {Record<string, { n: number, wrong: number, samples: object[] }>} */
const byMorph = {};
/** @type {Record<string, { n: number, wrong: number }>} */
const byReason = {};

let josaN = 0;
let josaWrong = 0;
let morphN = 0;
let morphWrong = 0;
let morphWrongBefore = 0;

/** @type {Map<string, string>} */
const beforeById = new Map(
  flow.candidates.map((c) => [c.id, c.defaultDecision]),
);

for (const c of candidates) {
  const morph = morphAtJoin(c.left, c.right);
  const reasonKey = c.reason === 'midword' ? morph.label : c.reason;
  const decided = decisions[c.id];
  let wrong = false;
  if (c.reason === 'josa') {
    josaN += 1;
    // 오른이 조사면 붙임이 맞음.
    const josaAttachOk =
      morph.label.startsWith('어절+조사') || morph.rightFam === '조사';
    const expect = josaAttachOk ? 'nospace' : 'space';
    if (decided !== expect) {
      wrong = true;
      josaWrong += 1;
    }
  } else if (c.reason === 'midword') {
    morphN += 1;
    const before = beforeById.get(c.id) || 'nospace';
    if (morph.eye === 'Y' && before === 'nospace') morphWrongBefore += 1;
    if (morph.eye === 'A' && before === 'space') morphWrongBefore += 1;
    if (morph.eye === 'A' && decided === 'space') wrong = true;
    if (morph.eye === 'Y' && decided === 'nospace') wrong = true;
    if (wrong) morphWrong += 1;
  }

  if (!byReason[c.reason]) byReason[c.reason] = { n: 0, wrong: 0 };
  byReason[c.reason].n += 1;
  if (wrong) byReason[c.reason].wrong += 1;

  if (!byMorph[reasonKey]) byMorph[reasonKey] = { n: 0, wrong: 0, samples: [] };
  byMorph[reasonKey].n += 1;
  if (wrong) byMorph[reasonKey].wrong += 1;
  if (byMorph[reasonKey].samples.length < 4) {
    byMorph[reasonKey].samples.push({
      id: c.id,
      decided,
      eye: morph.eye,
      detail: morph.detail,
      left: c.left.slice(-28),
      right: c.right.slice(0, 28),
      wrong,
    });
  }
}

// PDF 전 줄쌍(모달 밖 포함) softwrap 유사 통계
let pairN = 0;
let pairJoin = 0;
/** @type {Record<string, number>} */
const allJoinMorph = {};
for (const page of cleaned) {
  const lines = page.lines ?? [];
  const layouts = page.lineLayout ?? [];
  const ctx = buildParagraphContext(lines, layouts);
  for (let i = 0; i < lines.length - 1; i += 1) {
    pairN += 1;
    const v = classifyParagraphPair(
      lines[i],
      lines[i + 1],
      layouts[i],
      layouts[i + 1],
      ctx,
    );
    if (v.action !== 'join') continue;
    pairJoin += 1;
    if (paragraphJoinGlue(lines[i], lines[i + 1]) !== '') continue;
    const m = morphAtJoin(lines[i], lines[i + 1]);
    const key = m.label;
    allJoinMorph[key] = (allJoinMorph[key] || 0) + 1;
  }
}

clearKiwiAnalyzeCache();
clearKiwiInstance();

function rate(wrong, n) {
  return n ? Number((wrong / n).toFixed(4)) : null;
}

const morphRows = Object.entries(byMorph)
  .map(([k, v]) => ({
    type: k,
    n: v.n,
    wrong: v.wrong,
    errorRate: rate(v.wrong, v.n),
    samples: v.samples,
  }))
  .sort((a, b) => b.n - a.n);

const out = {
  measuredAt: new Date().toISOString(),
  pdf: basename(pdfPath),
  note:
    '추천형 모달 80 후보 기준. midword는 Kiwi 형태소 이름(명사+명사 등). A=형태소중간(붙여 맞음), Y=어절 경계(띄워야 함). wrong=추천형 결정이 Kiwi 기준과 다름.',
  files: {
    draftUser: draftFile,
    recommendedUser: recFile,
    draftFromPdf: draftPdfStats,
    recommendedFromPdf: recPdfStats,
    deltaUser: {
      newlines_rec_minus_draft: recFile.newlines - draftFile.newlines,
      chars_rec_minus_draft: recFile.chars - draftFile.chars,
      hangul_rec_minus_draft: recFile.hangul - draftFile.hangul,
    },
    deltaPdfPipeline: {
      newlines_rec_minus_draft:
        recPdfStats.newlines - draftPdfStats.newlines,
      joinRate: pairN ? Number((pairJoin / pairN).toFixed(4)) : null,
      pairs: pairN,
      joins: pairJoin,
    },
  },
  modal80: {
    byReason: Object.fromEntries(
      Object.entries(byReason).map(([k, v]) => [
        k,
        { ...v, errorRate: rate(v.wrong, v.n) },
      ]),
    ),
    josa: { n: josaN, wrong: josaWrong, errorRate: rate(josaWrong, josaN) },
    morphInsteadOfMidword: {
      n: morphN,
      wrongAfterRecommend: morphWrong,
      wrongBeforeAnalyzer: morphWrongBefore,
      errorRateAfter: rate(morphWrong, morphN),
      errorRateBefore: rate(morphWrongBefore, morphN),
      byType: morphRows.filter((r) => r.type !== 'josa'),
    },
  },
  allNospaceJoinsMorphCounts: allJoinMorph,
};

mkdirSync(join(root, 'tmp'), { recursive: true });
const jsonPath = join(root, 'tmp', 'pdf-vs-txt-morph-error.json');
writeFileSync(jsonPath, JSON.stringify(out, null, 2));

const mdLines = [
  '# depressione PDF ↔ TXT 형태소·조사 오차',
  '',
  `- 측정: ${out.measuredAt}`,
  `- PDF: ${out.pdf}`,
  '',
  '## 파일 규모',
  '',
  `| | 검수전(사용자) | 추천형(사용자) | 차이(추천−검수전) |`,
  `|---|---:|---:|---:|`,
  `| 줄바꿈(개) | ${draftFile.newlines} | ${recFile.newlines} | ${recFile.newlines - draftFile.newlines} |`,
  `| 글자 | ${draftFile.chars} | ${recFile.chars} | ${recFile.chars - draftFile.chars} |`,
  `| 한글 음절 | ${draftFile.hangul} | ${recFile.hangul} | ${recFile.hangul - draftFile.hangul} |`,
  '',
  `PDF 파이프: 줄쌍 ${pairN}, 이음 ${pairJoin} (joinRate ${((pairJoin / pairN) * 100).toFixed(1)}%)`,
  '',
  '## 모달 80 — 조사 vs 형태소',
  '',
  `| 구분 | n | 오판 | 오차율 |`,
  `|---|---:|---:|---:|`,
  `| 조사 | ${josaN} | ${josaWrong} | ${((rate(josaWrong, josaN) || 0) * 100).toFixed(1)}% |`,
  `| 형태소 이음 · 분석기 전 | ${morphN} | ${morphWrongBefore} | ${((rate(morphWrongBefore, morphN) || 0) * 100).toFixed(1)}% |`,
  `| 형태소 이음 · 추천형 후 | ${morphN} | ${morphWrong} | ${((rate(morphWrong, morphN) || 0) * 100).toFixed(1)}% |`,
  '',
  '## 형태소 유형별 (구 「단어 중간」)',
  '',
  `| 유형 | n | 오판 | 오차율 |`,
  `|---|---:|---:|---:|`,
];
for (const r of morphRows) {
  if (r.type === 'josa') continue;
  mdLines.push(
    `| ${r.type} | ${r.n} | ${r.wrong} | ${r.errorRate == null ? '-' : `${(r.errorRate * 100).toFixed(1)}%`} |`,
  );
}
mdLines.push('', '## 표본', '');
for (const r of morphRows.slice(0, 8)) {
  mdLines.push(`### ${r.type} (n=${r.n})`);
  for (const s of r.samples) {
    mdLines.push(
      `- [${s.wrong ? '오판' : 'OK'}] ${s.eye}/${s.decided} · ${s.detail}`,
    );
    mdLines.push(`  - …${s.left} ↵ ${s.right}…`);
  }
  mdLines.push('');
}

const mdPath = join(desk, 'depressione-pdf-txt-morph-error.md');
writeFileSync(mdPath, mdLines.join('\n'), 'utf8');
writeFileSync(join(desk, 'depressione-pdf-txt-morph-error.json'), JSON.stringify(out, null, 2));

console.log(JSON.stringify({
  files: out.files,
  josa: out.modal80.josa,
  morph: {
    n: morphN,
    wrong: morphWrong,
    errorRate: rate(morphWrong, morphN),
    topTypes: morphRows.slice(0, 10).map((r) => ({
      type: r.type,
      n: r.n,
      wrong: r.wrong,
      errorRate: r.errorRate,
    })),
  },
  wrote: { jsonPath, mdPath },
}, null, 2));
