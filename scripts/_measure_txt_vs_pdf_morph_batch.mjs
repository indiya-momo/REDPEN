/**
 * 여러 PDF 형태소·조사 오차 일괄 측정 (PDF 파이프 기준, 사용자 TXT 있으면 함께).
 * npx vite-node scripts/_measure_txt_vs_pdf_morph_batch.mjs [pdf...]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  if (!L || !R) return { label: 'skip', eye: 'skip', detail: '', rightFam: '' };
  const last = L[L.length - 1];
  const first = R[0];
  if (!isHangulSyllableChar(last) || !isHangulSyllableChar(first)) {
    return { label: '비한글경계', eye: 'skip', detail: '', rightFam: '' };
  }

  const leftTail = L.slice(Math.max(0, L.length - 14));
  const rightHead = R.slice(0, 14);
  const window = leftTail + rightHead;
  const at = leftTail.length;
  const analyzed = analyzeLine(window);
  const tokens = analyzed?.tokens ?? [];
  if (!tokens.length) {
    return { label: '분석실패', eye: 'skip', detail: '', rightFam: '' };
  }

  for (const t of tokens) {
    const start = Number(t.position) || 0;
    const len = Number(t.length) || 0;
    const end = start + len;
    if (start < at && end > at && len >= 2) {
      const fam = tagFamily(t.tag);
      return {
        label: `형태소중간(${fam})`,
        eye: 'A',
        detail: `${t.str}/${t.tag}`,
        rightFam: fam,
      };
    }
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
    rightFam: rf,
  };
}

function rate(wrong, n) {
  return n ? Number((wrong / n).toFixed(4)) : null;
}

function pct(r) {
  return r == null ? '-' : `${(r * 100).toFixed(1)}%`;
}

function safeStem(name) {
  return String(name)
    .replace(/\.pdf$/i, '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .slice(0, 80);
}

/**
 * @param {string} pdfPath
 */
async function measureOne(pdfPath) {
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

  const draftPdfStats = {
    newlines: (draftFromPdf.match(/\n/g) || []).length,
    chars: draftFromPdf.length,
    lines: cleaned.reduce((n, p) => n + (p.lines?.length || 0), 0),
    hangul: [...draftFromPdf].filter((ch) => isHangulSyllableChar(ch)).length,
  };
  const recPdfStats = {
    newlines: (recFromPdf.match(/\n/g) || []).length,
    chars: recFromPdf.length,
    hangul: [...recFromPdf].filter((ch) => isHangulSyllableChar(ch)).length,
  };

  /** @type {Record<string, { n: number, wrong: number, wrongBefore: number, samples: object[] }>} */
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
    let wrongBefore = false;

    if (c.reason === 'josa') {
      josaN += 1;
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
      if (morph.eye === 'Y' && before === 'nospace') {
        morphWrongBefore += 1;
        wrongBefore = true;
      }
      if (morph.eye === 'A' && before === 'space') {
        morphWrongBefore += 1;
        wrongBefore = true;
      }
      if (morph.eye === 'A' && decided === 'space') wrong = true;
      if (morph.eye === 'Y' && decided === 'nospace') wrong = true;
      if (wrong) morphWrong += 1;
    }

    if (!byReason[c.reason]) byReason[c.reason] = { n: 0, wrong: 0 };
    byReason[c.reason].n += 1;
    if (wrong) byReason[c.reason].wrong += 1;

    if (!byMorph[reasonKey]) {
      byMorph[reasonKey] = { n: 0, wrong: 0, wrongBefore: 0, samples: [] };
    }
    byMorph[reasonKey].n += 1;
    if (wrong) byMorph[reasonKey].wrong += 1;
    if (wrongBefore) byMorph[reasonKey].wrongBefore += 1;
    if (byMorph[reasonKey].samples.length < 3) {
      byMorph[reasonKey].samples.push({
        id: c.id,
        decided,
        eye: morph.eye,
        detail: morph.detail,
        left: c.left.slice(-28),
        right: c.right.slice(0, 28),
        wrong,
        wrongBefore,
      });
    }
  }

  let pairN = 0;
  let pairJoin = 0;
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
      if (v.action === 'join') pairJoin += 1;
    }
  }

  const morphRows = Object.entries(byMorph)
    .map(([k, v]) => ({
      type: k,
      n: v.n,
      wrong: v.wrong,
      wrongBefore: v.wrongBefore,
      errorRate: rate(v.wrong, v.n),
      errorRateBefore: rate(v.wrongBefore, v.n),
      samples: v.samples,
    }))
    .sort((a, b) => b.n - a.n);

  const stem = safeStem(basename(pdfPath));
  const out = {
    measuredAt: new Date().toISOString(),
    pdf: basename(pdfPath),
    pdfPath,
    note:
      '모달 상한 후보 기준. midword→형태소 이름. wrong=추천형 후 Kiwi 불일치. wrongBefore=분석기 전.',
    files: {
      draftFromPdf: draftPdfStats,
      recommendedFromPdf: recPdfStats,
      deltaPdfPipeline: {
        newlines_rec_minus_draft:
          recPdfStats.newlines - draftPdfStats.newlines,
        hangul_rec_minus_draft: recPdfStats.hangul - draftPdfStats.hangul,
        joinRate: pairN ? Number((pairJoin / pairN).toFixed(4)) : null,
        pairs: pairN,
        joins: pairJoin,
      },
    },
    modal: {
      shown: candidates.length,
      omitted: flow.stats.omitted,
      byReason: Object.fromEntries(
        Object.entries(byReason).map(([k, v]) => [
          k,
          { ...v, errorRate: rate(v.wrong, v.n) },
        ]),
      ),
      josa: { n: josaN, wrong: josaWrong, errorRate: rate(josaWrong, josaN) },
      morph: {
        n: morphN,
        wrongAfterRecommend: morphWrong,
        wrongBeforeAnalyzer: morphWrongBefore,
        errorRateAfter: rate(morphWrong, morphN),
        errorRateBefore: rate(morphWrongBefore, morphN),
        byType: morphRows.filter((r) => r.type !== 'josa'),
      },
    },
  };

  const mdLines = [
    `# ${out.pdf} — PDF ↔ TXT 형태소·조사 오차`,
    '',
    `- 측정: ${out.measuredAt}`,
    '',
    '## PDF 파이프 규모',
    '',
    `| | 검수전(조판줄) | 추천형 | 차이 |`,
    `|---|---:|---:|---:|`,
    `| 줄바꿈 | ${draftPdfStats.newlines} | ${recPdfStats.newlines} | ${recPdfStats.newlines - draftPdfStats.newlines} |`,
    `| 한글 음절 | ${draftPdfStats.hangul} | ${recPdfStats.hangul} | ${recPdfStats.hangul - draftPdfStats.hangul} |`,
    '',
    `줄쌍 ${pairN}, 이음 ${pairJoin} (joinRate ${pct(pairN ? pairJoin / pairN : null)})`,
    '',
    '## 모달 후보 — 조사 vs 형태소',
    '',
    `| 구분 | n | 오판 | 오차율 |`,
    `|---|---:|---:|---:|`,
    `| 조사 | ${josaN} | ${josaWrong} | ${pct(rate(josaWrong, josaN))} |`,
    `| 형태소 이음 · 분석기 전 | ${morphN} | ${morphWrongBefore} | ${pct(rate(morphWrongBefore, morphN))} |`,
    `| 형태소 이음 · 추천형 후 | ${morphN} | ${morphWrong} | ${pct(rate(morphWrong, morphN))} |`,
    '',
    `모달 표시 ${candidates.length}곳 / 생략 ${flow.stats.omitted}`,
    '',
    '## 형태소 유형별',
    '',
    `| 유형 | n | 분석기 전 오차 | 추천형 후 오차 |`,
    `|---|---:|---:|---:|`,
  ];
  for (const r of morphRows) {
    if (r.type === 'josa') continue;
    mdLines.push(
      `| ${r.type} | ${r.n} | ${pct(r.errorRateBefore)} | ${pct(r.errorRate)} |`,
    );
  }
  mdLines.push('', '## 표본', '');
  for (const r of morphRows.slice(0, 8)) {
    mdLines.push(`### ${r.type} (n=${r.n})`);
    for (const s of r.samples) {
      mdLines.push(
        `- [${s.wrong ? '후오판' : s.wrongBefore ? '전오판→수정' : 'OK'}] ${s.eye}/${s.decided} · ${s.detail}`,
      );
      mdLines.push(`  - …${s.left} ↵ ${s.right}…`);
    }
    mdLines.push('');
  }

  const mdPath = join(desk, `${stem}-pdf-txt-morph-error.md`);
  const jsonPath = join(desk, `${stem}-pdf-txt-morph-error.json`);
  writeFileSync(mdPath, mdLines.join('\n'), 'utf8');
  writeFileSync(jsonPath, JSON.stringify(out, null, 2), 'utf8');
  writeFileSync(
    join(root, 'tmp', `${stem}-pdf-txt-morph-error.json`),
    JSON.stringify(out, null, 2),
  );

  return {
    pdf: out.pdf,
    joinRate: out.files.deltaPdfPipeline.joinRate,
    newlinesDelta: out.files.deltaPdfPipeline.newlines_rec_minus_draft,
    hangulDelta: out.files.deltaPdfPipeline.hangul_rec_minus_draft,
    modalShown: candidates.length,
    omitted: flow.stats.omitted,
    josa: out.modal.josa,
    morph: {
      n: morphN,
      errorRateBefore: out.modal.morph.errorRateBefore,
      errorRateAfter: out.modal.morph.errorRateAfter,
      topTypes: morphRows
        .filter((r) => r.type !== 'josa')
        .slice(0, 6)
        .map((r) => ({
          type: r.type,
          n: r.n,
          before: r.errorRateBefore,
          after: r.errorRate,
        })),
    },
    mdPath,
    jsonPath,
  };
}

await loadKiwiNode({ rootDir: root, register: true });
mkdirSync(join(root, 'tmp'), { recursive: true });

/** @type {object[]} */
const summaries = [];
for (const pdfPath of pdfPaths) {
  if (!existsSync(pdfPath)) {
    console.error(`missing: ${pdfPath}`);
    continue;
  }
  console.error(`measuring: ${basename(pdfPath)}`);
  summaries.push(await measureOne(pdfPath));
}

clearKiwiAnalyzeCache();
clearKiwiInstance();

const summaryPath = join(desk, 'pdf-txt-morph-error-3books-summary.md');
const summaryLines = [
  '# 3권 PDF ↔ TXT 형태소·조사 오차 요약',
  '',
  `- 측정: ${new Date().toISOString()}`,
  '',
  '| PDF | joinRate | 줄바꿈Δ | 조사 오차 | 형태소 전 | 형태소 후 | 모달/생략 |',
  '|---|---:|---:|---:|---:|---:|---:|',
];
for (const s of summaries) {
  summaryLines.push(
    `| ${s.pdf} | ${pct(s.joinRate)} | ${s.newlinesDelta} | ${pct(s.josa.errorRate)} (${s.josa.wrong}/${s.josa.n}) | ${pct(s.morph.errorRateBefore)} | ${pct(s.morph.errorRateAfter)} | ${s.modalShown}/${s.omitted} |`,
  );
}
summaryLines.push('', '## 형태소 상위 유형', '');
for (const s of summaries) {
  summaryLines.push(`### ${s.pdf}`);
  for (const t of s.morph.topTypes) {
    summaryLines.push(
      `- ${t.type}: n=${t.n}, 전 ${pct(t.before)}, 후 ${pct(t.after)}`,
    );
  }
  summaryLines.push(`- 보고서: \`${s.mdPath}\``);
  summaryLines.push('');
}
writeFileSync(summaryPath, summaryLines.join('\n'), 'utf8');

console.log(JSON.stringify({ summaries, summaryPath }, null, 2));
