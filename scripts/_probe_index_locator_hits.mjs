/**
 * 색인 A축 전제 검증: findPhraseHitsInPdfItems 재현·과매칭 + 표제어당 히트/쪽 분포.
 * npx vite-node scripts/_probe_index_locator_hits.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { findPhraseHitsInPdfItems } from '../src/lib/pdfItemPhraseFind.js';
import { compileLiteralFindBody } from '../src/lib/regexFromFind.js';
import { countHangulSurface } from '../src/lib/unifyOrthographyAnchorSpike.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.resolve(
    __dirname,
    '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  ),
).href;

const pdfPath =
  'C:\\Users\\gikan\\OneDrive\\바탕 화면\\인디야샘플PDF\\260107_스트리트 이코노미-본문(4교).pdf';

const HEADWORDS = [
  '경제',
  '시장',
  '케인즈',
  '주식시장',
  '경제성장',
  '경제 성장',
  '인플레이션',
  '연방준비제도',
];

const JOSA = ['은', '는', '이', '가', '을', '를', '의', '에', '도', '만', '와', '과', '로', '으로', '부터', '까지', '처럼', '보다'];

function classifyAfter(text, idx, needleLen) {
  const after = text.slice(idx + needleLen);
  const m = after.match(/^[\uAC00-\uD7A3]+/);
  if (!m) return { kind: 'boundary', rest: '' };
  const rest = m[0];
  const josas = [...JOSA].sort((a, b) => b.length - a.length);
  for (const j of josas) {
    if (rest === j) return { kind: 'josa', rest };
  }
  // 경제가는 → 가+는 등: 앞이 조사면 josa로 약분류
  for (const j of josas) {
    if (rest.startsWith(j) && rest.length <= j.length + 2) {
      const tail = rest.slice(j.length);
      if (!tail || josas.includes(tail)) return { kind: 'josa', rest };
    }
  }
  return { kind: 'compoundish', rest };
}

function classifyLiteralHits(pageText, needle) {
  const body = compileLiteralFindBody(needle);
  if (!body) return { total: 0, josa: 0, compoundish: 0, boundary: 0 };
  const re = new RegExp(body, 'gu');
  let total = 0;
  let josa = 0;
  let compoundish = 0;
  let boundary = 0;
  let m;
  while ((m = re.exec(pageText)) !== null) {
    total += 1;
    const c = classifyAfter(pageText, m.index, m[0].length);
    if (c.kind === 'josa') josa += 1;
    else if (c.kind === 'compoundish') compoundish += 1;
    else boundary += 1;
  }
  return { total, josa, compoundish, boundary };
}

const fileBuf = fs.readFileSync(pdfPath);
const data = new Uint8Array(fileBuf.buffer, fileBuf.byteOffset, fileBuf.byteLength);
const pdf = await pdfjsLib.getDocument({
  data,
  cMapUrl:
    pathToFileURL(path.resolve(__dirname, '../public/pdfjs/cmaps')).href + '/',
  cMapPacked: true,
}).promise;

/** @type {Record<string, any>} */
const byWord = Object.fromEntries(
  HEADWORDS.map((w) => [
    w,
    {
      itemHits: 0,
      pagesWithItemHit: 0,
      literal: { total: 0, josa: 0, compoundish: 0, boundary: 0 },
      surfaceStemCount: 0,
      pageHitCounts: /** @type {number[]} */ ([]),
    },
  ]),
);

const maxPage = Math.min(pdf.numPages, 199);
for (let n = 1; n <= maxPage; n += 1) {
  const page = await pdf.getPage(n);
  const content = await page.getTextContent({ includeMarkedContent: false });
  const items = content.items.filter((it) => typeof it?.str === 'string');
  const pageText = items.map((it) => it.str).join('\n');

  for (const w of HEADWORDS) {
    const hits = findPhraseHitsInPdfItems(items, w);
    if (hits.length) {
      byWord[w].itemHits += hits.length;
      byWord[w].pagesWithItemHit += 1;
      byWord[w].pageHitCounts.push(hits.length);
    }
    const lit = classifyLiteralHits(pageText, w);
    byWord[w].literal.total += lit.total;
    byWord[w].literal.josa += lit.josa;
    byWord[w].literal.compoundish += lit.compoundish;
    byWord[w].literal.boundary += lit.boundary;
    byWord[w].surfaceStemCount += countHangulSurface(pageText, w.replace(/\s+/g, ''));
  }
}

function pct(n, d) {
  if (!d) return 0;
  return Math.round((1000 * n) / d) / 10;
}

const summary = {};
for (const w of HEADWORDS) {
  const b = byWord[w];
  const counts = b.pageHitCounts;
  const sorted = [...counts].sort((a, c) => a - c);
  const mid = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const maxOnPage = sorted.length ? sorted[sorted.length - 1] : 0;
  const lit = b.literal;
  summary[w] = {
    itemHits: b.itemHits,
    pagesWithItemHit: b.pagesWithItemHit,
    medianHitsPerHitPage: mid,
    maxHitsOnOnePage: maxOnPage,
    literalTotal: lit.total,
    literalBoundaryPct: pct(lit.boundary, lit.total),
    literalJosaPct: pct(lit.josa, lit.total),
    literalCompoundishPct: pct(lit.compoundish, lit.total),
    surfaceStemCount: b.surfaceStemCount,
    note:
      w.includes(' ')
        ? 'spaced needle — glued body may miss'
        : lit.compoundish > lit.josa + lit.boundary
          ? 'compound overmatch likely dominates'
          : 'boundary+josa-ish majority or sparse',
  };
}

console.log(
  JSON.stringify(
    {
      pdf: path.basename(pdfPath),
      pages: maxPage,
      summary,
      takeaway: {
        spacedVsGlued: {
          '경제성장_itemHits': summary['경제성장'].itemHits,
          '경제 성장_itemHits': summary['경제 성장'].itemHits,
        },
      },
    },
    null,
    2,
  ),
);
