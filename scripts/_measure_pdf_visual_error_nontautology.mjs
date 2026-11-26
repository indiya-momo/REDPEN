/**
 * 순환 없는 PDF 시각 오차 측정.
 *
 * 정답: 사람이 PDF를 눈으로 읽어 고정한 골든(금지 mash · 필수 구문 · 시각 이웃).
 * 금지: cleanPageLinesForTxt 줄을 y/단으로 재정렬한 것을 정답으로 쓰는 자기대조.
 *
 * 사용:
 *   npx vite-node scripts/_measure_pdf_visual_error_nontautology.mjs
 *
 * 산출: 콘솔 JSON + (있으면) Project store docs 경로를 stdout에 안내.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const sampleDir = join(desk, '인디야/인디야샘플PDF');

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

/** 사람 라벨 mash · 잘못 이음 (스트리트 표/본문) */
const STREET_FORBIDDEN = [
  { id: 'mash_stable_raw', re: /안정적인원 자 재/u },
  { id: 'mash_raw_corp', re: /원 자 재 가 격 상 승기업/u },
  { id: 'mash_organic_dup', re: /유기적유기적/u },
  { id: 'bad_dal_guk', re: /달국에/u },
  { id: 'bad_wage_price', re: /임금가격/u },
  { id: 'bad_profit_join', re: /는지총이익/u },
];

/** PDF에서 칸으로 읽히는 문자열이 TXT에 칸으로 남아야 함 */
const STREET_CELLS = [
  '원 자 재 가 격 상 승',
  '근로자들이 실질 임금',
  '비용 감소와 안정적인',
  '기업은 투입 비용의 상',
];

/**
 * depressione 사람 시각 읽기 골든 (p.12→13 인용 이음).
 * 출처: depressione-pdf-visual-order-sample.md · 책 원문.
 */
const DEPRESSIONE_GOLDEN = [
  {
    id: '불치병→의_희생자',
    note: 'p.12 끝 「이 새로운 불치병」 다음 시각 본문은 「의 희생자가 되었다…」',
    leftNeedle: '이 새로운 불치병',
    expectNextPrefix: '의 희생자',
    forbidNextPrefix: '지 않는다면',
    expectContiguous: /불치병\s*의\s*희생자/u,
    forbidContiguous: /불치병\s*지\s*않는다면/u,
  },
  {
    id: '그러→지_않는다면',
    note: '같은 인용 「…한다. 그러」 다음 시각 본문은 「지 않는다면…」',
    leftNeedle: '세워야만 한다. 그러',
    expectNextPrefix: '지 않는다면',
    forbidNextPrefix: '의 희생자',
    expectContiguous: /그러\s*지\s*않는다면/u,
    forbidContiguous: /그러\s*의\s*희생자/u,
  },
];

function compact(s) {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/\s+/gu, '');
}

function scoreForbidden(text, patterns) {
  const lines = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .split('\n');
  const nonEmpty = lines.filter((l) => l.trim());
  /** @type {Record<string, number>} */
  const hits = {};
  let errorLines = 0;
  /** @type {string[]} */
  const samples = [];
  for (const line of nonEmpty) {
    let bad = false;
    for (const p of patterns) {
      if (p.re.test(line)) {
        hits[p.id] = (hits[p.id] || 0) + 1;
        bad = true;
      }
    }
    if (bad) {
      errorLines += 1;
      if (samples.length < 8) samples.push(line.slice(0, 120));
    }
  }
  return {
    nonEmptyLines: nonEmpty.length,
    errorLines,
    errorRate: nonEmpty.length ? Number((errorLines / nonEmpty.length).toFixed(6)) : 0,
    hits,
    samples,
  };
}

/**
 * 추출 줄 배열에서 leftNeedle를 포함한 줄 다음이 무엇인지 본다.
 * (재정렬 없이 — 파이프라인 출력 순서 그대로)
 * @param {{ pageNum: number, lines: string[] }[]} cleaned
 * @param {string} leftNeedle
 */
function findExtractNext(cleaned, leftNeedle) {
  /** @type {{ pageNum: number, lineIndex: number, text: string }[]} */
  const flat = [];
  for (const page of cleaned ?? []) {
    const lines = page.lines ?? [];
    for (let i = 0; i < lines.length; i += 1) {
      flat.push({ pageNum: page.pageNum, lineIndex: i, text: lines[i] });
    }
  }
  for (let i = 0; i < flat.length; i += 1) {
    if (!String(flat[i].text).includes(leftNeedle)) continue;
    const next = flat[i + 1] || null;
    return {
      left: {
        pageNum: flat[i].pageNum,
        lineIndex: flat[i].lineIndex,
        text: flat[i].text,
      },
      next: next
        ? {
            pageNum: next.pageNum,
            lineIndex: next.lineIndex,
            text: next.text,
          }
        : null,
    };
  }
  return null;
}

/**
 * @param {string} pdfPath
 */
async function loadCleaned(pdfPath) {
  const buf = readFileSync(pdfPath);
  const pdf = await loadPdfFromBuffer(
    new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
  );
  const pages = await extractAllPagesText(pdf);
  await pdf.destroy?.();
  return cleanPageLinesForTxt(pages);
}

/**
 * @param {{ pageNum: number, lines: string[], lineLayout?: object[] }[]} cleaned
 */
async function pipelineFinalTxt(cleaned) {
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
  return {
    candidates,
    finalTxt: applyLinebreakDecisions(cleaned, decisions, {
      autoParagraph: true,
    }),
  };
}

function rate(ok, n) {
  return n ? Number((ok / n).toFixed(4)) : null;
}

async function measureStreet() {
  const pdfPath = join(sampleDir, '260107_스트리트 이코노미-본문(4교).pdf');
  const prevTxtPath = join(desk, '260107_스트리트 이코노미-본문(4교).txt');
  const afterTxtPath = join(
    desk,
    '260107_스트리트_이코노미-본문(4교)-x칸분리후.txt',
  );

  const cleaned = await loadCleaned(pdfPath);
  const surface = cleaned.map((p) => (p.lines ?? []).join('\n')).join('\n');
  const { finalTxt } = await pipelineFinalTxt(cleaned);

  const prevTxt = existsSync(prevTxtPath)
    ? readFileSync(prevTxtPath, 'utf8')
    : '';
  const afterTxt = existsSync(afterTxtPath)
    ? readFileSync(afterTxtPath, 'utf8')
    : '';

  const surfaceMash = scoreForbidden(surface, STREET_FORBIDDEN);
  const prevMash = scoreForbidden(prevTxt, STREET_FORBIDDEN);
  const afterMash = scoreForbidden(afterTxt, STREET_FORBIDDEN);
  const pipeMash = scoreForbidden(finalTxt, STREET_FORBIDDEN);

  const cellPresence = STREET_CELLS.map((cell) => ({
    cell,
    inPdfSurface: surface.includes(cell),
    inPrevTxt: prevTxt.includes(cell),
    inAfterTxt: afterTxt.includes(cell),
    inPipelineFinal: finalTxt.includes(cell),
  }));

  const mashTargets = [
    { id: 'pdf_surface', ...surfaceMash },
    { id: 'prev_txt', ...prevMash },
    { id: 'after_txt_file', ...afterMash },
    { id: 'pipeline_final', ...pipeMash },
  ];

  return {
    book: 'street',
    pdf: basename(pdfPath),
    method:
      '사람 라벨 금지 mash 패턴 · 칸 문자열 존재. 추출 재정렬 비교 없음.',
    mash: mashTargets,
    cells: cellPresence,
    summary: {
      pdfSurfaceMashLines: surfaceMash.errorLines,
      afterTxtMashLines: afterMash.errorLines,
      pipelineFinalMashLines: pipeMash.errorLines,
      cellsMissingInAfter: cellPresence.filter((c) => !c.inAfterTxt).length,
      cellsMissingInPipeline: cellPresence.filter((c) => !c.inPipelineFinal)
        .length,
    },
  };
}

async function measureDepressione() {
  const pdfPath = join(sampleDir, 'depressione_PDF_v1.pdf');
  const cleaned = await loadCleaned(pdfPath);
  const { finalTxt, candidates } = await pipelineFinalTxt(cleaned);
  const surface = cleaned.map((p) => (p.lines ?? []).join('\n')).join('\n');
  const compactFinal = compact(finalTxt);
  const compactSurface = compact(surface);

  /** @type {object[]} */
  const adjacency = [];
  let pass = 0;
  let fail = 0;

  for (const g of DEPRESSIONE_GOLDEN) {
    const extract = findExtractNext(cleaned, g.leftNeedle);
    const nextText = extract?.next?.text ?? '';
    const nextOk =
      Boolean(nextText) && nextText.trimStart().startsWith(g.expectNextPrefix);
    const nextForbidden =
      Boolean(nextText) &&
      nextText.trimStart().startsWith(g.forbidNextPrefix);

    const expectInFinal = g.expectContiguous.test(finalTxt);
    const forbidInFinal = g.forbidContiguous.test(finalTxt);
    const expectInSurface = g.expectContiguous.test(surface);
    const forbidInSurface = g.forbidContiguous.test(surface);

    // 최종 판정: 시각 이웃이 추출 다음이 아니면 오차; 금지 이음이 최종 TXT에 있으면 오차
    const extractOrderOk = nextOk && !nextForbidden;
    const contiguousOk = expectInFinal && !forbidInFinal;
    const ok = extractOrderOk && contiguousOk;
    if (ok) pass += 1;
    else fail += 1;

    adjacency.push({
      id: g.id,
      note: g.note,
      extractLeft: extract?.left ?? null,
      extractNext: extract?.next ?? null,
      extractOrderOk,
      expectInFinal,
      forbidInFinal,
      expectInSurface,
      forbidInSurface,
      compactFinalHasExpect: compactFinal.includes('불치병의희생자'),
      compactFinalHasForbid: compactFinal.includes('불치병지않는다면'),
      ok,
    });
  }

  // 페이지 넘김 후보 중 left가 불치병으로 끝나는 것
  const pageCand = (candidates ?? []).filter((c) => {
    const id = String(c.id ?? '');
    return (
      id.endsWith(':page') &&
      String(c.left ?? '').includes('불치병')
    );
  });

  return {
    book: 'depressione',
    pdf: basename(pdfPath),
    method:
      '사람 골든 시각 이웃(불치병→의 희생자, 그러→지 않는다면). 추출/최종 TXT를 골든과 대조. 재정렬 자기대조 없음.',
    goldenN: DEPRESSIONE_GOLDEN.length,
    pass,
    fail,
    errorRate: rate(fail, DEPRESSIONE_GOLDEN.length),
    adjacency,
    pageCandidatesAbout불치병: pageCand.map((c) => ({
      id: c.id,
      decided: c.defaultDecision,
      reason: c.reason,
      left: String(c.left).slice(-48),
      right: String(c.right).slice(0, 48),
    })),
    surfaceNote: {
      compactHas불치병의희생자: compactSurface.includes('불치병의희생자'),
      compactHas불치병지않는다면: compactSurface.includes('불치병지않는다면'),
    },
  };
}

function tautologyReminder() {
  return {
    rejectedMetric:
      'cleanPageLinesForTxt 줄을 col/y/x로 재정렬한 seq와 추출 인접을 비교',
    whyCircular:
      '정답이 같은 파이프라인 산출물의 재정렬이라, 추출이 이미 그 규칙이면 오차 0%가 설계상 나옴 (세이노·스트리트 사례).',
    evidenceFile: join(desk, 'pdf-visual-order-tautology-check.md'),
  };
}

const only = (process.argv[2] || '').toLowerCase(); // street | depressione | (빈=둘다)

await loadKiwiNode({ rootDir: root, register: true });

const street =
  only === 'depressione' ? null : await measureStreet();
const depressione =
  only === 'street' ? null : await measureDepressione();

clearKiwiAnalyzeCache();
clearKiwiInstance();

const measuredAt = new Date().toISOString();
const out = {
  measuredAt,
  scope: only || 'street+depressione',
  definition: {
    error: 'PDF 눈으로 읽는 칸·문장 순서와 TXT/추출이 다를 때',
    notError: 'Kiwi A/Y vs 추천 자기일치',
    groundTruth: '사람 골든(금지 mash · 필수 칸 · 시각 이웃 구문)',
    forbidden: '추출↔재정렬 순환 측정',
  },
  tautology: tautologyReminder(),
  street,
  depressione,
};

const tmpDir = join(root, 'tmp');
if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
const jsonPath = join(tmpDir, 'pdf-visual-error-nontautology.json');
writeFileSync(jsonPath, JSON.stringify(out, null, 2), 'utf8');

const md = [];
md.push('# 순환 없는 PDF 시각 오차 측정');
md.push('');
md.push(`- 측정(UTC): ${measuredAt}`);
md.push(`- 커밋 맥락: 5900dae (표 칸 분리·keep) 이후 파이프라인`);
md.push('');
md.push('## 오차 정의');
md.push('');
md.push('| 항목 | 내용 |');
md.push('|---|---|');
md.push('| 정답 | PDF를 눈으로 읽어 고정한 골든 |');
md.push('| 오차 | TXT/추출이 그 골든과 다를 때 |');
md.push('| 오차 아님 | Kiwi A/Y vs 추천 |');
md.push('| 금지 | 같은 추출을 y/단으로 재정렬해 비교(순환) |');
md.push('');
md.push('## 순환 지표 (쓰지 않음)');
md.push('');
md.push(`- 거부: ${out.tautology.rejectedMetric}`);
md.push(`- 이유: ${out.tautology.whyCircular}`);
md.push(`- 증거: \`${out.tautology.evidenceFile}\``);
md.push('');
if (street) {
  md.push('## 1) 스트리트 — mash · 칸 존재');
  md.push('');
  md.push('| 대상 | 비어있지 않은 줄 | mash 오차 줄 | 오차율 |');
  md.push('|---|---:|---:|---:|');
  for (const m of street.mash) {
    md.push(
      `| ${m.id} | ${m.nonEmptyLines} | ${m.errorLines} | ${(m.errorRate * 100).toFixed(3)}% |`,
    );
  }
  md.push('');
  md.push('| 칸(골든) | PDF표면 | 이전TXT | 이후TXT | 파이프최종 |');
  md.push('|---|---|---|---|---|');
  for (const c of street.cells) {
    md.push(
      `| ${c.cell} | ${c.inPdfSurface ? 'Y' : 'N'} | ${c.inPrevTxt ? 'Y' : 'N'} | ${c.inAfterTxt ? 'Y' : 'N'} | ${c.inPipelineFinal ? 'Y' : 'N'} |`,
    );
  }
  md.push('');
  md.push(
    `- 요약: PDF표면 mash ${street.summary.pdfSurfaceMashLines} · 이후TXT mash ${street.summary.afterTxtMashLines} · 파이프최종 mash ${street.summary.pipelineFinalMashLines}`,
  );
  md.push('');
}
if (depressione) {
  md.push('## 2) depressione — 시각 이웃 골든');
  md.push('');
  md.push(`| 골든 n | 통과 | 실패 | 오차율 |`);
  md.push('|---:|---:|---:|---:|');
  md.push(
    `| ${depressione.goldenN} | ${depressione.pass} | ${depressione.fail} | ${((depressione.errorRate || 0) * 100).toFixed(1)}% |`,
  );
  md.push('');
  for (const a of depressione.adjacency) {
    md.push(`### ${a.id}`);
    md.push('');
    md.push(`- ${a.note}`);
    md.push(
      `- 추출 left: p.${a.extractLeft?.pageNum}[${a.extractLeft?.lineIndex}] …${String(a.extractLeft?.text ?? '').slice(-40)}`,
    );
    md.push(
      `- 추출 next: p.${a.extractNext?.pageNum}[${a.extractNext?.lineIndex}] ${String(a.extractNext?.text ?? '').slice(0, 40)}…`,
    );
    md.push(
      `- 추출순서 OK: ${a.extractOrderOk} · 최종에 기대구문: ${a.expectInFinal} · 최종에 금지구문: ${a.forbidInFinal} · **판정 ${a.ok ? 'PASS' : 'FAIL'}**`,
    );
    md.push('');
  }
  if (depressione.pageCandidatesAbout불치병?.length) {
    md.push('### 관련 페이지넘김 후보');
    md.push('');
    for (const c of depressione.pageCandidatesAbout불치병) {
      md.push(`- ${c.id} · ${c.decided}/${c.reason}`);
      md.push(`  - …${c.left} ↵ ${c.right}…`);
    }
    md.push('');
  }
}
md.push('## 재현');
md.push('');
md.push('```powershell');
md.push('cd C:\\Users\\gikan\\Documents\\pdf-publish-proofread');
md.push('npx vite-node scripts/_measure_pdf_visual_error_nontautology.mjs');
md.push('# 또는 한쪽만: ...mjs street | ...mjs depressione');
md.push('```');
md.push('');
md.push(`JSON: \`${jsonPath}\``);
md.push('');

const mdBody = md.join('\n');
const mdTmp = join(tmpDir, 'pdf-visual-error-nontautology.md');
writeFileSync(mdTmp, mdBody, 'utf8');

console.log(JSON.stringify({ jsonPath, mdTmp, ...out }, null, 2));
console.log('\n--- markdown ---\n');
console.log(mdBody);
