/**
 * 검수전 TXT — 줄바꿈이 단어 중간인 곳만 Kiwi 형태소로 붙여 저장.
 * 사용: node scripts/_join_txt_linebreak_morph.mjs "<검수전.txt>" [outPath]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeLine, clearKiwiAnalyzeCache } from '../src/lib/kiwiMorph/analyze.js';
import { loadKiwiNode } from '../src/lib/kiwiMorph/loadNode.js';
import { clearKiwiInstance } from '../src/lib/kiwiMorph/runtime.js';
import {
  isHangulSyllableChar,
  isLikelyHangulEojeolBoundary,
  isUnifyHangulMidWordSoftWrap,
} from '../src/lib/pdfPageText.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const SENTENCE_END_RE = /[.!?…。」』》]$/u;

/**
 * @param {string} raw
 * @returns {{ pageNum: number, lines: string[] }[]}
 */
function parseDraftPages(raw) {
  const text = String(raw ?? '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const chunks = text.split(/\n\n(?=--- p\.\d+ ---(?:\n|$))/u);
  /** @type {{ pageNum: number, lines: string[] }[]} */
  const pages = [];
  for (let i = 0; i < chunks.length; i += 1) {
    let body = chunks[i];
    let pageNum = i + 1;
    const m = body.match(/^--- p\.(\d+) ---\n?/u);
    if (m) {
      pageNum = Number(m[1]);
      body = body.slice(m[0].length);
    }
    const lines = body.replace(/\s+$/u, '').split('\n');
    if (lines.length === 1 && lines[0] === '') continue;
    pages.push({ pageNum, lines });
  }
  return pages;
}

/**
 * @param {{ pageNum: number, lines: string[] }[]} pages
 */
function joinPagesWithMarkers(pages) {
  /** @type {string[]} */
  const blocks = [];
  for (const page of pages ?? []) {
    const body = (page.lines ?? []).join('\n').replace(/\s+$/u, '');
    if (!body) continue;
    if (blocks.length === 0) blocks.push(body);
    else blocks.push(`--- p.${page.pageNum} ---\n${body}`);
  }
  return blocks.join('\n\n');
}

/**
 * 이음 지점이 형태소 한가운데면 붙인다.
 * @param {string} left
 * @param {string} right
 * @param {(s: string) => { tokens?: { position: number, length: number, str?: string, tag?: string }[] } | null} analyze
 */
function hangulSyllableCount(s) {
  let n = 0;
  for (const ch of String(s ?? '')) {
    if (isHangulSyllableChar(ch)) n += 1;
  }
  return n;
}

function shouldJoinByMorph(left, right, analyze) {
  const L = String(left ?? '').replace(/\s+$/u, '');
  const R = String(right ?? '').replace(/^\s+/u, '');
  if (!L || !R) return false;
  if (SENTENCE_END_RE.test(L)) return false;
  const last = L[L.length - 1];
  const first = R[0];
  if (!isHangulSyllableChar(last) || !isHangulSyllableChar(first)) return false;

  const lastEojeol = L.split(/\s+/u).filter(Boolean).pop() ?? '';
  const rightFirstHangul = (R.match(/^[\uAC00-\uD7A3]+/u) || [''])[0];
  const lastSyl = hangulSyllableCount(lastEojeol);
  const rightSyl = hangulSyllableCount(rightFirstHangul);

  // 다단 오접 흔한 패턴: …으/아/어 + 니다/까요 (다른 단의 어미)
  if (/[으아어]$/u.test(L) && /^(니다|까요)/u.test(R)) return false;

  // 후보: 1음절 soft-wrap, 또는 짧은 끝+짧은은 이음(입니|다)
  const soft =
    isUnifyHangulMidWordSoftWrap(L, R) ||
    (!isLikelyHangulEojeolBoundary(L, R) &&
      lastSyl <= 2 &&
      rightSyl <= 4) ||
    (!isLikelyHangulEojeolBoundary(L, R) &&
      lastSyl <= 6 &&
      rightSyl === 1);
  if (!soft) return false;

  const leftTail = L.slice(Math.max(0, L.length - 10));
  const rightHead = R.slice(0, 10);
  const window = leftTail + rightHead;
  const at = leftTail.length;
  const analyzed = analyze(window);
  const tokens = analyzed?.tokens ?? [];
  if (!tokens.length) return false;

  for (const t of tokens) {
    const start = Number(t.position) || 0;
    const len = Number(t.length) || 0;
    const end = start + len;
    if (start < at && end > at && len >= 2) return true;
  }
  return false;
}

/**
 * @param {{ pageNum: number, lines: string[] }[]} pages
 * @param {(s: string) => ReturnType<typeof analyzeLine>} analyze
 */
function applyMorphJoins(pages, analyze) {
  let joinCount = 0;
  /** @type {{ pageNum: number, left: string, right: string }[]} */
  const samples = [];

  const nextPages = pages.map((page) => {
    const lines = [...(page.lines ?? [])];
    if (lines.length < 2) return { ...page, lines };

    /** @type {string[]} */
    const out = [];
    let buf = lines[0];
    for (let i = 0; i < lines.length - 1; i += 1) {
      const left = buf;
      const right = lines[i + 1];
      if (shouldJoinByMorph(left, right, analyze)) {
        const L = left.replace(/\s+$/u, '');
        const R = right.replace(/^\s+/u, '');
        buf = L + R;
        joinCount += 1;
        if (samples.length < 40) {
          samples.push({
            pageNum: page.pageNum,
            left: L.slice(-20),
            right: R.slice(0, 20),
          });
        }
      } else {
        out.push(buf);
        buf = right;
      }
    }
    out.push(buf);
    return { ...page, lines: out };
  });

  return { pages: nextPages, joinCount, samples };
}

const inPath = process.argv[2];
if (!inPath || !fs.existsSync(inPath)) {
  console.error('검수전 TXT 경로가 없습니다:', inPath);
  process.exit(1);
}

const outPath =
  process.argv[3] ||
  inPath.replace(/\.txt$/i, '_형태소줄붙임.txt');

console.log('[morph-join] load kiwi…');
const kiwi = await loadKiwiNode({ rootDir: root, register: true });
if (!kiwi?.ready?.()) {
  console.error('Kiwi를 불러오지 못했습니다.');
  process.exit(2);
}
clearKiwiAnalyzeCache();

const raw = fs.readFileSync(inPath, 'utf8');
const pages = parseDraftPages(raw);
console.log('[morph-join] pages=', pages.length);

const { pages: joinedPages, joinCount, samples } = applyMorphJoins(
  pages,
  (s) => analyzeLine(s, { kiwi }),
);

const body = joinPagesWithMarkers(joinedPages);
const encoded = `\uFEFF${body.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')}`;
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, encoded, 'utf8');

const workspaceOut = path.join(
  root,
  'tmp',
  path.basename(outPath),
);
fs.mkdirSync(path.dirname(workspaceOut), { recursive: true });
fs.writeFileSync(workspaceOut, encoded, 'utf8');

console.log('[morph-join] joins=', joinCount);
for (const s of samples.slice(0, 15)) {
  console.log(`  p.${s.pageNum} …${s.left}|${s.right}…`);
}
console.log('[morph-join] wrote', outPath);
console.log('[morph-join] wrote', workspaceOut);

clearKiwiInstance();
