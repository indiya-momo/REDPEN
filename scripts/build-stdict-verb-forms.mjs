/**
 * 표준국어대사전 용언 TSV → 띄움 필수 활용형 JSON 생성.
 *
 * 사용법:
 *   node scripts/build-stdict-verb-forms.mjs "<verbs.tsv 경로>"
 *
 * 결과:
 *   public/data/stdict-verb-forms.json
 *   public/data/stdict-verb-forms.md  (출처 표기는 이 스크립트가 덮어쓰지 않음)
 *
 * 판정 규칙:
 *   3음절 이상 활용형이고, 그 활용형을 가진 모든 후보 기본형이 복합어일 때만
 *   띄움 필수. 단일어만 있거나 복합어·단일어가 섞이면(mixed) 넣지 않는다.
 *   다음 단계에서 활용형 조회는 로드 시 lemmas를 뒤집어 쓰면 된다.
 *
 * 출처: 국립국어원 표준국어대사전 (내려받기 2026-11-06)
 * 라이선스: CC BY-SA 2.0 KR
 * 원본 JSON이 아니라 추출본만 레포에 둔다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_JSON = path.join(ROOT, 'public/data/stdict-verb-forms.json');

const SOURCE = '국립국어원 표준국어대사전';
const DOWNLOADED = '2026-11-06';
const LICENSE = 'CC BY-SA 2.0 KR';
const LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/2.0/kr/';
const MIN_SYLLABLES = 3;

const tsvPath = process.argv[2];
if (!tsvPath) {
  console.error('사용법: node scripts/build-stdict-verb-forms.mjs "<verbs.tsv 경로>"');
  process.exit(1);
}

const resolvedTsv = path.resolve(tsvPath);
if (!fs.existsSync(resolvedTsv) || !fs.statSync(resolvedTsv).isFile()) {
  console.error(`입력 파일이 없습니다: ${resolvedTsv}`);
  process.exit(1);
}

/**
 * 한글 음절 수. 공백·기호는 세지 않는다.
 * @param {string} s
 */
function hangulSyllableCount(s) {
  let n = 0;
  for (const ch of String(s)) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xac00 && cp <= 0xd7a3) n += 1;
  }
  return n;
}

/**
 * 표제어에서 붙임표와 어깨번호를 뺀 기본형. `갈-리다03` → `갈리다`
 * @param {string} word
 */
function cleanLemma(word) {
  return String(word ?? '')
    .replace(/-/g, '')
    .replace(/\d+$/g, '');
}

/**
 * @param {string} text
 */
function parseVerbsTsv(text) {
  const lines = text.split(/\r?\n/);
  if (!lines.length) {
    throw new Error('빈 TSV입니다.');
  }
  const header = lines[0].split('\t');
  if (
    header[0] !== '표제어' ||
    header[1] !== '품사' ||
    header[2] !== '복합어' ||
    header[3] !== '활용형'
  ) {
    throw new Error(`예상과 다른 머리글입니다: ${lines[0]}`);
  }

  /** @type {Map<string, { compound: Set<string>, simple: Set<string> }>} */
  const formSides = new Map();
  let verbCount = 0;
  let compoundVerbCount = 0;
  let verbWithFormsCount = 0;
  let skippedRows = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split('\t');
    if (cols.length < 4) {
      skippedRows += 1;
      continue;
    }
    const word = cols[0];
    const isCompound = cols[2] === '1';
    const forms = cols[3] ? cols[3].split(',').filter(Boolean) : [];
    if (!word) {
      skippedRows += 1;
      continue;
    }
    verbCount += 1;
    if (isCompound) compoundVerbCount += 1;
    if (forms.length) verbWithFormsCount += 1;
    const side = isCompound ? 'compound' : 'simple';
    for (const form of forms) {
      let bucket = formSides.get(form);
      if (!bucket) {
        bucket = { compound: new Set(), simple: new Set() };
        formSides.set(form, bucket);
      }
      bucket[side].add(word);
    }
  }

  return {
    formSides,
    verbCount,
    compoundVerbCount,
    verbWithFormsCount,
    skippedRows,
  };
}

function seoulDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const raw = fs.readFileSync(resolvedTsv, 'utf8');
const parsed = parseVerbsTsv(raw);

/** @type {Map<string, Set<string>>} */
const lemmaForms = new Map();
let mixedFormCount = 0;
let spaceRequiredFormCount = 0;

for (const [form, sides] of parsed.formSides) {
  if (hangulSyllableCount(form) < MIN_SYLLABLES) continue;
  const hasCompound = sides.compound.size > 0;
  const hasSimple = sides.simple.size > 0;
  if (hasCompound && hasSimple) {
    mixedFormCount += 1;
    continue;
  }
  if (!hasCompound) continue;
  spaceRequiredFormCount += 1;
  for (const word of sides.compound) {
    const lemma = cleanLemma(word);
    if (!lemma) continue;
    let forms = lemmaForms.get(lemma);
    if (!forms) {
      forms = new Set();
      lemmaForms.set(lemma, forms);
    }
    forms.add(form);
  }
}

const lemmas = {};
for (const lemma of [...lemmaForms.keys()].sort((a, b) => a.localeCompare(b, 'ko'))) {
  lemmas[lemma] = [...lemmaForms.get(lemma)].sort((a, b) => a.localeCompare(b, 'ko'));
}

const data = {
  meta: {
    source: SOURCE,
    downloaded: DOWNLOADED,
    license: LICENSE,
    licenseUrl: LICENSE_URL,
    generatedAt: seoulDate(),
    verbCount: parsed.verbCount,
    compoundVerbCount: parsed.compoundVerbCount,
    verbWithFormsCount: parsed.verbWithFormsCount,
    lemmaCount: lemmaForms.size,
    spaceRequiredFormCount,
    mixedFormCount,
    minSyllables: MIN_SYLLABLES,
  },
  lemmas,
};

fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.writeFileSync(OUT_JSON, `${JSON.stringify(data)}\n`);

console.log(`입력: ${resolvedTsv}`);
console.log(
  `용언 ${parsed.verbCount}개 (복합어 ${parsed.compoundVerbCount}, 활용형 있음 ${parsed.verbWithFormsCount})`,
);
if (parsed.skippedRows) {
  console.log(`건너뛴 행 ${parsed.skippedRows}개`);
}
console.log(
  `띄움 필수 기본형 ${lemmaForms.size}개 / 활용형 ${spaceRequiredFormCount}개 / 3음절 mixed ${mixedFormCount}개`,
);
console.log(`생성: ${OUT_JSON}`);