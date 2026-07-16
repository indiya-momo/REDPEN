/**
 * 국립국어원 "용례 목록 - 외래어 표기법" xlsx → 외래어 오표기 검수 데이터 생성 스크립트.
 *
 * 사용법:
 *   node scripts/build-loanword-typos.mjs "<xlsx 파일 경로>"
 *
 * 결과:
 *   src/data/loanword-typos.json       오표기 → { c: 바른 표기[], s: 원어 }
 *   src/data/loanword-typos-meta.json  묶음별 개수 (패널 표시용, 본 데이터 없이 로드)
 *
 * 추출 규칙:
 *  - 오표기1~5 열(J~N)에서 "(X)" 표시가 있는 값만 사용 (오염 데이터 차단)
 *  - 인명 "성, 이름" 형식은 성만 바른 표기로 사용
 *  - 같은 오표기가 여러 행에 등장하면 바른 표기를 합침 (최대 3개)
 *  - 오표기 == 바른 표기인 행은 제외
 *
 * 국립국어원이 용례집을 갱신하면 새 xlsx로 이 스크립트만 다시 돌리면 된다.
 * (조판에 비유하면: 오식 대조표를 새 판 원고 기준으로 다시 뽑는 공정)
 */

import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

const xlsxPath = process.argv[2];
if (!xlsxPath) {
  console.error('사용법: node scripts/build-loanword-typos.mjs "<xlsx 파일 경로>"');
  process.exit(1);
}

const OUT_PATH = path.resolve('src/data/loanword-typos.json');
const META_PATH = path.resolve('src/data/loanword-typos-meta.json');

/** "(X)" / "(x)" 꼬리표 — 이 표시가 있어야 진짜 오표기 값 */
const X_MARK_RE = /[（(]\s*[xX]\s*[)）]\s*$/;
/** 바른 표기로 합칠 최대 개수 (동일 오표기가 여러 인명에 걸린 경우 등) */
const MAX_CORRECTS = 3;

const text = (v) => {
  if (v == null) return '';
  if (typeof v === 'object' && v.richText) return v.richText.map((t) => t.text).join('');
  return String(v).trim();
};

/** 공백 정리 */
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** 원어 표기 정리 — 병기(❲…❳)·괄호 읽기 제거 */
function cleanSource(raw) {
  return clean(
    String(raw ?? '')
      .replace(/❲[^❳]*❳/g, ' ')
      .replace(/[（(][^)）]*[)）]/g, ' '),
  );
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(xlsxPath);
const sheet = workbook.worksheets[0];

/** @type {Map<string, { corrects: string[], src: string }>} */
const byTypo = new Map();
let rows = 0;
let accepted = 0;
let droppedNoMark = 0;
let droppedSame = 0;

sheet.eachRow((row, rowNumber) => {
  if (rowNumber === 1) return; // 머리글
  rows += 1;

  const hangul = clean(text(row.getCell(3).value));
  if (!hangul) return;
  // 인명 "성, 이름" → 성만 바른 표기로 (오표기도 성 단위로 등재됨)
  const correct = clean(hangul.split(',')[0]);
  if (!correct) return;
  const src = cleanSource(text(row.getCell(4).value));

  // 오표기1~5 = J~N열 (10~14)
  for (let col = 10; col <= 14; col += 1) {
    const raw = text(row.getCell(col).value);
    if (!raw) continue;
    if (!X_MARK_RE.test(raw)) {
      droppedNoMark += 1;
      continue;
    }
    const typo = clean(raw.replace(X_MARK_RE, ''));
    if (!typo) continue;
    if (typo === correct) {
      droppedSame += 1;
      continue;
    }
    const entry = byTypo.get(typo) ?? { corrects: [], src: '' };
    if (!entry.corrects.includes(correct) && entry.corrects.length < MAX_CORRECTS) {
      entry.corrects.push(correct);
    }
    if (!entry.src && src) entry.src = src;
    byTypo.set(typo, entry);
    accepted += 1;
  }
});

/** 한글 음절 수 (공백 제외) — 묶음 분류와 동일 기준 */
function hangulSyllableCount(s) {
  let n = 0;
  for (const ch of String(s)) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xac00 && cp <= 0xd7a3) n += 1;
  }
  return n;
}

/** @type {Record<string, { c: string[], s?: string }>} */
const data = {};
let mainCount = 0;
let shortCount = 0;
for (const [typo, entry] of [...byTypo.entries()].sort((a, b) =>
  a[0].localeCompare(b[0], 'ko'),
)) {
  data[typo] = { c: entry.corrects, ...(entry.src ? { s: entry.src } : {}) };
  if (hangulSyllableCount(typo) >= 3) mainCount += 1;
  else shortCount += 1;
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(data));
fs.writeFileSync(
  META_PATH,
  `${JSON.stringify({ main: mainCount, short: shortCount, total: mainCount + shortCount }, null, 2)}\n`,
);

console.log(
  `행 ${rows}개 → 오표기 ${byTypo.size}개 (수록 ${accepted}건, ` +
    `(X) 없음 제외 ${droppedNoMark}건, 표기 동일 제외 ${droppedSame}건)`,
);
console.log(`3음절 이상 ${mainCount}개 / 2음절 이하 ${shortCount}개`);
console.log(`생성: ${OUT_PATH}`);
console.log(`생성: ${META_PATH}`);
