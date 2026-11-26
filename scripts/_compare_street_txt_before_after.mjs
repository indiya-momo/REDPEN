/**
 * 스트리트 TXT 이전 vs (x칸 분리 강화) 이후 비교 · 오차 지표
 * npx vite-node scripts/_compare_street_txt_before_after.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractAllPagesText, loadPdfFromBuffer } from '../src/lib/pdfService.js';
import { cleanPageLinesForTxt } from '../src/lib/pdfTxtBodyClean.js';
import { analyzeParagraphFlow } from '../src/lib/pdfTxtParagraph.js';
import {
  applyLinebreakDecisions,
  joinPagesWithMarkers,
} from '../src/lib/pdfTxtLinebreakReview.js';
import {
  applyUncertainSuggestionsToCandidates,
  suggestUncertainLinebreakDecisions,
} from '../src/lib/pdfTxtUncertainAnalyzer.js';
import { loadKiwiNode } from '../src/lib/kiwiMorph/loadNode.js';
import { analyzeLine, clearKiwiAnalyzeCache } from '../src/lib/kiwiMorph/analyze.js';
import { clearKiwiInstance } from '../src/lib/kiwiMorph/runtime.js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const desk = 'C:/Users/gikan/OneDrive/바탕 화면';
const prevPath = join(desk, '260107_스트리트 이코노미-본문(4교).txt');
const pdfPath = join(
  desk,
  '인디야/인디야샘플PDF/260107_스트리트 이코노미-본문(4교).pdf',
);

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

/** 표 mash · 잘못 이음으로 보는 패턴 */
const ERROR_PATTERNS = [
  { id: 'mash_spaced_cells', re: /원 자 재 가 격.*기업은|안정적인원 자 재/u },
  { id: 'mash_wage_price', re: /실질 임금\s*가격 덕분에|임금가격/u },
  { id: 'mash_organic_dup', re: /유기적유기적/u },
  { id: 'mash_organic_join', re: /유기적신규|신규판매동력 물량/u },
  { id: 'bad_dal_guk', re: /달국에|금액의 달국/u },
  { id: 'bad_profit_join', re: /는지총이익|판매하는지총/u },
];

/**
 * @param {string} text
 */
function scoreText(text) {
  const norm = String(text ?? '').normalize('NFC');
  const lines = norm.replace(/\r\n/g, '\n').split('\n');
  /** @type {Record<string, number>} */
  const hits = {};
  let errorLines = 0;
  for (const line of lines) {
    let bad = false;
    for (const p of ERROR_PATTERNS) {
      if (p.re.test(line)) {
        hits[p.id] = (hits[p.id] || 0) + 1;
        bad = true;
      }
    }
    // 한 줄에 표 조각 두 칸이 붙은 경우 (짧은 헤더 반복)
    if (/(?:유기적){2,}/u.test(line) || /원 자 재 가 격 상 승기업/u.test(line)) {
      bad = true;
    }
    if (bad) errorLines += 1;
  }
  const nonEmpty = lines.filter((l) => l.trim().length > 0).length;
  return {
    chars: norm.length,
    newlines: (norm.match(/\n/g) || []).length,
    nonEmptyLines: nonEmpty,
    errorLines,
    errorRate: nonEmpty ? errorLines / nonEmpty : 0,
    hits,
  };
}

function encodeTxt(text) {
  const body = String(text ?? '').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  return `\uFEFF${body}`;
}

await loadKiwiNode({ rootDir: root, register: true });

const prevRaw = readFileSync(prevPath, 'utf8').replace(/^\uFEFF/, '');
const prevScore = scoreText(prevRaw);

const buf = readFileSync(pdfPath);
const pdf = await loadPdfFromBuffer(
  new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
);
const pages = await extractAllPagesText(pdf);
await pdf.destroy?.();
const cleaned = cleanPageLinesForTxt(pages);
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

const draft = joinPagesWithMarkers(cleaned);
const finalTxt = applyLinebreakDecisions(cleaned, decisions, {
  autoParagraph: true,
});

const afterDraftScore = scoreText(draft);
const afterFinalScore = scoreText(finalTxt);

const outFinal = join(desk, '260107_스트리트_이코노미-본문(4교)-x칸분리후.txt');
const outDraft = join(desk, '260107_스트리트_이코노미-본문(4교)-x칸분리후_검수전.txt');
writeFileSync(outFinal, encodeTxt(finalTxt), 'utf8');
writeFileSync(outDraft, encodeTxt(draft), 'utf8');

// 모달 후보 중 keep(table/outdent) vs midword join
let modalKeepLayout = 0;
let modalMidJoin = 0;
for (const c of candidates) {
  if (c.defaultDecision === 'keep') modalKeepLayout += 1;
  if (
    c.reason === 'midword' &&
    (c.defaultDecision === 'space' || c.defaultDecision === 'nospace')
  ) {
    modalMidJoin += 1;
  }
}

clearKiwiAnalyzeCache();
clearKiwiInstance();

const md = [];
md.push('# 스트리트 TXT · x칸 분리 전후 비교');
md.push('');
md.push(`- 이전: \`${prevPath}\``);
md.push(`- 이후 최종: \`${outFinal}\``);
md.push(`- 이후 검수전: \`${outDraft}\``);
md.push('');
md.push('## 오차 정의 (이 비교)');
md.push('');
md.push('줄 단위로 아래 패턴이 있으면 오차 줄:');
md.push('- `안정적인원 자 재` / `원 자 재…기업은` (칸 mash)');
md.push('- `유기적유기적`');
md.push('- `달국에` · `는지총이익` · `임금가격` (잘못 이음)');
md.push('');
md.push('| 본문 | 비어있지 않은 줄 | 오차 줄 | 오차율 |');
md.push('|---|---:|---:|---:|');
md.push(
  `| 이전 TXT | ${prevScore.nonEmptyLines} | ${prevScore.errorLines} | ${(prevScore.errorRate * 100).toFixed(2)}% |`,
);
md.push(
  `| 이후 최종 TXT | ${afterFinalScore.nonEmptyLines} | ${afterFinalScore.errorLines} | ${(afterFinalScore.errorRate * 100).toFixed(2)}% |`,
);
md.push(
  `| 이후 검수전 TXT | ${afterDraftScore.nonEmptyLines} | ${afterDraftScore.errorLines} | ${(afterDraftScore.errorRate * 100).toFixed(2)}% |`,
);
md.push('');
md.push('## 패턴별 적중 (줄 수)');
md.push('');
md.push('| 패턴 | 이전 | 이후 최종 | 이후 검수전 |');
md.push('|---|---:|---:|---:|');
for (const p of ERROR_PATTERNS) {
  md.push(
    `| ${p.id} | ${prevScore.hits[p.id] || 0} | ${afterFinalScore.hits[p.id] || 0} | ${afterDraftScore.hits[p.id] || 0} |`,
  );
}
md.push('');
md.push('## 규모');
md.push('');
md.push(
  `| | 이전 | 이후 최종 | 이후 검수전 |`,
);
md.push('|---|---:|---:|---:|');
md.push(
  `| 글자 | ${prevScore.chars} | ${afterFinalScore.chars} | ${afterDraftScore.chars} |`,
);
md.push(
  `| 줄바꿈 | ${prevScore.newlines} | ${afterFinalScore.newlines} | ${afterDraftScore.newlines} |`,
);
md.push('');
md.push('## 모달(이후 파이프)');
md.push('');
md.push(`- 후보 ${candidates.length}`);
md.push(`- keep 기본 ${modalKeepLayout}`);
md.push(`- midword 이음(space/nospace) ${modalMidJoin}`);
md.push('');

const mdPath = join(desk, 'street-txt-xcell-before-after.md');
writeFileSync(mdPath, md.join('\n'), 'utf8');
writeFileSync(
  join(desk, 'street-txt-xcell-before-after.json'),
  JSON.stringify(
    {
      prev: prevScore,
      afterFinal: afterFinalScore,
      afterDraft: afterDraftScore,
      outFinal,
      outDraft,
      modal: {
        n: candidates.length,
        keep: modalKeepLayout,
        midJoin: modalMidJoin,
      },
    },
    null,
    2,
  ),
  'utf8',
);

console.log(JSON.stringify({
  mdPath,
  prevErrorRate: prevScore.errorRate,
  afterFinalErrorRate: afterFinalScore.errorRate,
  afterDraftErrorRate: afterDraftScore.errorRate,
  prevErrorLines: prevScore.errorLines,
  afterFinalErrorLines: afterFinalScore.errorLines,
  hitsPrev: prevScore.hits,
  hitsAfter: afterFinalScore.hits,
  outFinal,
}, null, 2));
console.log(md.join('\n'));
