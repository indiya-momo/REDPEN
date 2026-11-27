/**
 * 표준국어대사전 링크 색인 생성 (결과 카드 고칠 말 → target_code[]).
 *
 * 사용법:
 *   (샘플, 파일 쓰기 없음)
 *   명사: node scripts/build-stdict-link-index.mjs --sample "<사전 JSON 폴더>" 경제관념 도중
 *   용언: node scripts/build-stdict-link-index.mjs --sample-pos "<사전 JSON 폴더>" "<kiwi 모델 폴더>" 부끄러워했 자신만만하
 *   (전체 생성)
 *   node scripts/build-stdict-link-index.mjs --full "<사전 JSON 폴더>" "<kiwi 모델 폴더>"
 *     → public/data/stdict-link-index.json, tmp/stdict-link-index-report.md
 *
 * 명사·대명사 교정형은 표제어와 바로 대조한다.
 * 용언 교정형은 ① 교정형+다 ② 했/한/할→하다, 된/될/됨→되다 ③ 교정형+하다 순으로 찾고,
 * 셋 다 실패할 때만 형태소 분석(kiwi-nlp)을 쓴다. 어느 단계든 품사가 동사·형용사인 후보만 남긴다.
 *
 * 출처: 국립국어원 표준국어대사전 (내려받기 2026-11-06), CC BY-SA 2.0 KR
 * 원본 JSON은 레포에 넣지 않는다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KiwiBuilder, Match } from 'kiwi-nlp';
import {
  cardPairsOfRow,
  dictHeadwordKey,
  directLemmaStages,
  isDictBundleRow,
  isPredicatePos,
  lemmaFromTokens,
  pickNounCodes,
  sharesLeadingChars,
} from './lib/stdict-link-index-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RULES_JSON = path.join(ROOT, 'public/data/spelling-rules.json');
const KIWI_WASM = path.join(ROOT, 'node_modules/kiwi-nlp/dist/kiwi-wasm.wasm');

// 샘플 출력용. 앱 쪽 주소 형식은 2단계 src/lib/stdictLinks.js 한 곳에만 둔다.
const SEARCH_URL = 'https://kdict.korean.go.kr/standard/search/searchResult.do?pageSize=10&searchKeyword=';
const VIEW_URL = 'https://kdict.korean.go.kr/standard/search/searchView.do?searchKeywordTo=3&wordNo=';

const KIWI_MODEL_FILES = [
  'combiningRule.txt',
  'default.dict',
  'extract.mdl',
  'multi.dict',
  'sj.morph',
  'cong.mdl',
  'nounchr.mdl',
  'dialect.dict',
];

function loadDictRows() {
  const rows = JSON.parse(fs.readFileSync(RULES_JSON, 'utf8'));
  return rows.filter(isDictBundleRow);
}

/** 교정형 → 카드가 내는 출처(규칙·묶음·찾은 말) 목록 */
function indexCorrections(rows) {
  /** @type {Map<string, { rule: string, group: string, bundle: string, from: string, predicate: boolean }[]>} */
  const map = new Map();
  for (const row of rows) {
    const bundle = String(row.dividerLabel ?? '');
    for (const { find, replace } of cardPairsOfRow(row)) {
      if (!map.has(replace)) map.set(replace, []);
      map.get(replace).push({
        rule: String(row.find),
        group: String(row.dividerGroup ?? ''),
        bundle,
        from: find,
        predicate: bundle.includes('동사'),
      });
    }
  }
  return map;
}

function* iterDictItems(dir) {
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    const items = data?.channel?.item;
    if (!Array.isArray(items)) continue;
    for (const item of items) yield item;
  }
}

function posOf(wordInfo) {
  return [...new Set((wordInfo.pos_info ?? []).map((p) => p.pos))].filter(Boolean).join('/');
}

/** 사전 레코드를 한 번 훑어 키(표제어 숫자·-를 뺀 형태)별 후보를 모은다. */
function collectDictHits(dictDir, keys) {
  const wanted = new Set(keys);
  /** @type {Map<string, { code: number, word: string, unit: string, pos: string }[]>} */
  const hits = new Map(keys.map((k) => [k, []]));
  let scanned = 0;
  for (const item of iterDictItems(dictDir)) {
    scanned += 1;
    const info = item.word_info ?? {};
    const key = dictHeadwordKey(info.word);
    if (key && wanted.has(key)) {
      hits.get(key).push({ code: item.target_code, word: info.word, unit: info.word_unit, pos: posOf(info) });
    }
  }
  return { hits, scanned };
}

function printHits(found) {
  console.log(`  사전 후보: ${found.length}개`);
  for (const h of found) console.log(`    - target_code ${h.code} · ${h.word} · ${h.unit} · ${h.pos}`);
}

function printLink(key, found) {
  if (found.length === 1) console.log(`  링크(직결): ${VIEW_URL}${found[0].code}`);
  else if (found.length > 1) console.log(`  링크(검색): ${SEARCH_URL}${encodeURIComponent(key)}`);
  else console.log('  링크: 없음');
}

function runSample(dictDir, words) {
  const rows = loadDictRows();
  const corrections = indexCorrections(rows);
  console.log(`규칙 행(등재 묶음): ${rows.length}개, 카드가 낼 수 있는 교정형: ${corrections.size}개\n`);

  const { hits, scanned } = collectDictHits(dictDir, words);
  console.log(`사전 레코드 읽음: ${scanned}건\n`);

  for (const w of words) {
    console.log(`■ ${w}`);
    const src = corrections.get(w);
    if (!src) console.log('  규칙 쪽: 카드가 내는 교정형에 없음');
    else {
      for (const s of src.slice(0, 3)) {
        console.log(`  규칙 쪽: [${s.group}] ${s.bundle} / 규칙 find「${s.rule}」 / 찾은 말「${s.from}」→「${w}」`);
      }
      if (src.length > 3) console.log(`  (그 밖에 ${src.length - 3}건)`);
    }
    const found = hits.get(w);
    printHits(found);
    printLink(w, found);
    console.log('');
  }
}

async function loadKiwi(modelDir) {
  const modelFiles = {};
  for (const name of KIWI_MODEL_FILES) {
    modelFiles[name] = new Uint8Array(fs.readFileSync(path.join(modelDir, name)));
  }
  const builder = await KiwiBuilder.create(KIWI_WASM);
  return builder.build({
    modelFiles,
    modelType: 'cong',
    loadDefaultDict: true,
    loadMultiDict: true,
    loadTypoDict: false,
  });
}

async function runSamplePos(dictDir, modelDir, surfaces) {
  const rows = loadDictRows();
  const corrections = indexCorrections(rows);
  const kiwi = await loadKiwi(modelDir);

  const analyzed = [];
  for (const surface of surfaces) {
    const result = await kiwi.analyze(surface, Match.all);
    const tokens = result?.tokens ?? [];
    analyzed.push({ surface, tokens, lemma: lemmaFromTokens(tokens) });
  }
  const keys = analyzed.map((a) => a.lemma).filter(Boolean);
  const { hits, scanned } = collectDictHits(dictDir, keys);
  console.log(`사전 레코드 읽음: ${scanned}건\n`);

  for (const a of analyzed) {
    console.log(`■ ${a.surface} (교정형)`);
    const src = corrections.get(a.surface);
    if (!src) console.log('  규칙 쪽: 카드가 내는 교정형에 없음');
    else {
      for (const s of src.slice(0, 3)) {
        console.log(`  규칙 쪽: [${s.group}] ${s.bundle} / 규칙 find「${s.rule}」 / 찾은 말「${s.from}」→「${a.surface}」`);
      }
    }
    console.log(`  형태소: ${a.tokens.map((t) => `${t.str}/${t.tag}`).join(' + ')}`);
    if (!a.lemma) {
      console.log('  사전형: 용언 어간을 찾지 못함\n');
      continue;
    }
    console.log(`  사전형: ${a.lemma}`);
    const found = hits.get(a.lemma);
    printHits(found);
    printLink(a.lemma, found);
    console.log('');
  }
}

const OUT_JSON = path.join(ROOT, 'public/data/stdict-link-index.json');
const OUT_REPORT = path.join(ROOT, 'tmp/stdict-link-index-report.md');

const candText = (cands) => cands.map((c) => `${c.code} ${c.word}(${c.pos})`).join(', ');
const sortCodes = (cands) => [...new Set(cands.map((c) => c.code))].sort((a, b) => a - b);

async function runFull(dictDir, modelDir) {
  const rows = loadDictRows();
  const corrections = indexCorrections(rows);

  /** @type {string[]} */ const nouns = [];
  /** @type {string[]} */ const predicates = [];
  /** @type {string[]} */ const mixed = [];
  for (const [surface, sources] of corrections) {
    if (new Set(sources.map((s) => s.predicate)).size > 1) mixed.push(surface);
    (sources[0].predicate ? predicates : nouns).push(surface);
  }

  // 사전 한 번 훑기: 명사 교정형 + 용언 직접 찾기 키. 형태소 분석 키는 직접 찾기가 실패할 때만 더한다.
  const keys = new Set(nouns);
  for (const surface of predicates) {
    for (const stage of directLemmaStages(surface)) keys.add(stage.key);
  }
  const { hits, scanned } = collectDictHits(dictDir, [...keys]);
  const predicateHits = (key) => (hits.get(key) ?? []).filter((h) => isPredicatePos(h.pos));

  /** @type {Record<string, number[]>} */
  const entries = {};

  // 명사·대명사
  const nounDirect = [];
  const nounMulti = [];
  const nounNone = [];
  for (const surface of nouns) {
    const found = hits.get(surface) ?? [];
    const codes = pickNounCodes(surface, found);
    if (codes.length === 0) nounNone.push(surface);
    else {
      entries[surface] = codes;
      (codes.length === 1 ? nounDirect : nounMulti).push(surface);
    }
  }

  // 용언: ① +다 ② 했/한/할·된/될/됨 ③ +하다. 용언 후보가 있는 첫 단계. 없으면 형태소 분석.
  const predRows = predicates.map((surface) => {
    let stage = 'none';
    let note = '';
    let lemma = null;
    let cands = [];
    for (const step of directLemmaStages(surface)) {
      const found = predicateHits(step.key);
      if (!found.length) continue;
      stage = step.stage;
      note = step.note;
      lemma = step.key;
      cands = found;
      break;
    }
    const dropped = lemma ? (hits.get(lemma) ?? []).length - cands.length : 0;
    return {
      surface,
      tokens: /** @type {{ str: string, tag: string }[]} */ ([]),
      kiwiLemma: /** @type {string | null} */ (null),
      stage,
      note,
      lemma,
      cands,
      dropped,
      src: corrections.get(surface)[0],
    };
  });

  const unresolved = predRows.filter((r) => r.stage === 'none');
  if (unresolved.length) {
    const kiwi = await loadKiwi(modelDir);
    const extraKeys = [];
    for (const row of unresolved) {
      const result = await kiwi.analyze(row.surface, Match.all);
      row.tokens = result?.tokens ?? [];
      row.kiwiLemma = lemmaFromTokens(row.tokens);
      if (row.kiwiLemma && !hits.has(row.kiwiLemma)) extraKeys.push(row.kiwiLemma);
    }
    if (extraKeys.length) {
      const more = collectDictHits(dictDir, extraKeys);
      for (const [key, list] of more.hits) hits.set(key, list);
    }
    for (const row of unresolved) {
      const found = row.kiwiLemma ? predicateHits(row.kiwiLemma) : [];
      if (!found.length) continue;
      row.stage = 'kiwi';
      row.note = '형태소';
      row.lemma = row.kiwiLemma;
      row.cands = found;
      row.dropped = (hits.get(row.kiwiLemma) ?? []).length - found.length;
    }
  }

  for (const row of predRows) {
    row.leadMismatch = row.lemma ? !sharesLeadingChars(row.surface, row.lemma) : false;
    if (row.cands.length) entries[row.surface] = sortCodes(row.cands);
  }

  const sorted = Object.fromEntries(
    Object.entries(entries).sort(([a], [b]) => a.localeCompare(b, 'ko')),
  );
  const lines = Object.entries(sorted).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  fs.writeFileSync(
    OUT_JSON,
    [
      '{',
      '  "source": "국립국어원 표준국어대사전",',
      '  "downloaded": "2026-11-06",',
      '  "license": "CC BY-SA 2.0 KR",',
      '  "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/kr/",',
      '  "generatedBy": "scripts/build-stdict-link-index.mjs",',
      `  "count": ${lines.length},`,
      '  "entries": {',
      lines.join(',\n'),
      '  }',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );

  // ── 보고 ──
  const byStage = (s) => predRows.filter((r) => r.stage === s);
  const none = byStage('none');
  const tok = (r) => (r.tokens.length ? r.tokens.map((t) => `${t.str}/${t.tag}`).join(' + ') : '');
  const STAGE_LABEL = {
    direct: '직접 찾기',
    ending: '했한할·된될됨 변환',
    hada: '+하다',
    kiwi: '형태소 분석',
    none: '링크 없음',
  };

  const out = [];
  out.push('# 표준국어대사전 링크 색인 보고', '');
  out.push(`사전 레코드 ${scanned}건 · 규칙 행 ${rows.length}개 · 교정형 ${corrections.size}개 (명사·대명사 ${nouns.length}, 용언 ${predicates.length})`);
  if (mixed.length) out.push(`명사·용언 묶음에 모두 나온 교정형: ${mixed.join(', ')}`);
  out.push('', '## 요약', '');
  out.push('| 구분 | 교정형 | 직결(후보 1) | 후보 여러 개 | 링크 없음 |', '| --- | --- | --- | --- | --- |');
  out.push(`| 명사·대명사 | ${nouns.length} | ${nounDirect.length} | ${nounMulti.length} | ${nounNone.length} |`);
  const pDirect = predRows.filter((r) => r.cands.length === 1).length;
  const pMulti = predRows.filter((r) => r.cands.length > 1).length;
  out.push(`| 용언 | ${predicates.length} | ${pDirect} | ${pMulti} | ${none.length} |`);
  out.push('');
  out.push('용언을 찾은 단계: ' + ['direct', 'ending', 'hada', 'kiwi', 'none'].map((s) => `${STAGE_LABEL[s]} ${byStage(s).length}`).join(' · '));
  out.push(`색인 항목 수: ${lines.length}`, '');

  out.push('## 명사·대명사', '');
  out.push(`### 링크 없음 (${nounNone.length})`, '');
  for (const s of nounNone) {
    const src = corrections.get(s)[0];
    out.push(`- ${s} — 규칙 find「${src.rule}」, 찾은 말「${src.from}」`);
  }
  out.push('', `### 후보 여러 개 → 검색 링크 (${nounMulti.length})`, '');
  if (!nounMulti.length) out.push('- 없음 (동음이의는 규칙 묶음에 맞는 표제어 하나로 직결)');
  for (const s of nounMulti) out.push(`- ${s} (${entries[s].length}): ${candText(hits.get(s))}`);

  out.push('', '## 용언 — 찾은 단계', '');
  const writeStage = (title, rowsOfStage) => {
    out.push(`### ${title} (${rowsOfStage.length})`, '');
    if (!rowsOfStage.length) out.push('- 없음');
    for (const r of rowsOfStage) {
      const morph = tok(r) ? ` — 분석: ${tok(r)}` : '';
      out.push(`- ${r.surface} — ${r.note} → ${r.lemma} · ${candText(r.cands)}${morph}`);
    }
    out.push('');
  };
  writeStage('직접 찾기', byStage('direct'));
  writeStage('했한할 변환', byStage('ending').filter((r) => r.note.endsWith('→하다')));
  writeStage('된될됨 변환', byStage('ending').filter((r) => r.note.endsWith('→되다')));
  writeStage('+하다', byStage('hada'));
  writeStage('형태소 분석', byStage('kiwi'));
  out.push(`### 링크 없음 (${none.length})`, '');
  if (!none.length) out.push('- 없음');
  for (const r of none) {
    const morph = r.kiwiLemma ? ` — 분석 사전형「${r.kiwiLemma}」 ${tok(r)}` : r.tokens.length ? ` — 분석: ${tok(r)}` : '';
    out.push(`- ${r.surface} — 규칙 find「${r.src.rule}」${morph}`);
  }

  const CHECKS = [
    { surface: '가닿', lemma: '가닿다', forbid: [707] },
    { surface: '맞닿', lemma: '맞닿다', forbid: [420703, 111365, 111572] },
    { surface: '외로워했', lemma: '외로워하다', allow: [534021] },
    { surface: '참고삼', lemma: '참고삼다', allow: [487509] },
    { surface: '그럴싸', lemma: '그럴싸하다', allow: [44725] },
  ];
  out.push('', '## 확인 단어', '');
  for (const check of CHECKS) {
    const row = predRows.find((r) => r.surface === check.surface);
    const codes = row ? sortCodes(row.cands) : [];
    const lemmaOk = row?.lemma === check.lemma;
    const forbidOk = !check.forbid?.some((code) => codes.includes(code));
    const allowOk = !check.allow || check.allow.every((code) => codes.includes(code));
    const ok = Boolean(row) && lemmaOk && forbidOk && allowOk && codes.length > 0;
    out.push(`- ${ok ? '맞음' : '다름'} ${check.surface} — ${STAGE_LABEL[row?.stage ?? 'none']} → ${row?.lemma ?? '-'} · ${row ? candText(row.cands) : '없음'}`);
  }

  const lead = predRows.filter((r) => r.leadMismatch);
  const multi = predRows.filter((r) => r.cands.length > 1);
  const filtered = predRows.filter((r) => r.dropped > 0);
  out.push('', '## 앞 두 글자 불일치 경고', '');
  out.push(lead.length ? lead.map((r) => `- ${r.surface} → ${r.lemma}`).join('\n') : '비어 있음');
  out.push('', '## 그 밖에', '');
  out.push(`- 용언 후보가 여러 개 (${multi.length}): ${multi.map((r) => `${r.surface}→${r.lemma}[${candText(r.cands)}]`).join(' / ') || '없음'}`);
  out.push(`- 품사 필터(동사·형용사)로 후보가 걸러짐 (${filtered.length}): ${filtered.map((r) => `${r.surface}→${r.lemma}(${r.dropped}개 제외)`).join(', ') || '없음'}`);

  const summaryText = out.join('\n');

  out.push('', '## 용언 전체 표', '');
  out.push('| 교정형 | 단계 | 적용 | 사전형 | 후보 |', '| --- | --- | --- | --- | --- |');
  for (const r of predRows) {
    out.push(`| ${r.surface} | ${STAGE_LABEL[r.stage]} | ${r.note || '-'} | ${r.lemma ?? '-'} | ${candText(r.cands) || '-'} |`);
  }
  fs.mkdirSync(path.dirname(OUT_REPORT), { recursive: true });
  fs.writeFileSync(OUT_REPORT, `${out.join('\n')}\n`, 'utf8');

  console.log(summaryText);
  console.log(`\n색인: ${path.relative(ROOT, OUT_JSON)} (${lines.length}개)\n보고: ${path.relative(ROOT, OUT_REPORT)}`);
}

const args = process.argv.slice(2);
if (args[0] === '--full' && args[1] && args[2]) {
  await runFull(args[1], args[2]);
} else if (args[0] === '--sample' && args[1] && args.length > 2) {
  runSample(args[1], args.slice(2));
} else if (args[0] === '--sample-pos' && args[1] && args[2] && args.length > 3) {
  await runSamplePos(args[1], args[2], args.slice(3));
} else {
  console.error('사용법:');
  console.error('  node scripts/build-stdict-link-index.mjs --full "<사전 JSON 폴더>" "<kiwi 모델 폴더>"');
  console.error('  node scripts/build-stdict-link-index.mjs --sample "<사전 JSON 폴더>" 단어1 단어2');
  console.error('  node scripts/build-stdict-link-index.mjs --sample-pos "<사전 JSON 폴더>" "<kiwi 모델 폴더>" 활용형1 활용형2');
  process.exit(1);
}
