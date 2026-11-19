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
import {
  MIN_SYLLABLES,
  parseVerbsTsv,
  collectSpaceRequiredLemmas,
  collectHyphenOutsideK,
  lemmaFormsToObject,
} from './lib/stdict-verb-forms-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_JSON = path.join(ROOT, 'public/data/stdict-verb-forms.json');

const SOURCE = '국립국어원 표준국어대사전';
const DOWNLOADED = '2026-11-06';
const LICENSE = 'CC BY-SA 2.0 KR';
const LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/2.0/kr/';

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
const { lemmaForms, mixedFormCount, spaceRequiredFormCount } =
  collectSpaceRequiredLemmas(parsed.formSides);
const lemmas = lemmaFormsToObject(lemmaForms);
const { H, hyphenLemmasOutsideK } = collectHyphenOutsideK(
  parsed.rows,
  lemmaForms,
);

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
    hyphenLemmaCount: H.size,
    hyphenOutsideKCount: hyphenLemmasOutsideK.length,
  },
  lemmas,
  /** H∖K — 런타임 붙임표 게이트는 K ∪ 이 목록 (= H) */
  hyphenLemmasOutsideK,
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
console.log(
  `붙임표 H ${H.size}개 / H∖K ${hyphenLemmasOutsideK.length}개 (K ⊆ H 검증 OK)`,
);
console.log(`생성: ${OUT_JSON}`);
