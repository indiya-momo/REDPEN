/**
 * 국립국어원 "용례 목록 - 외래어 표기법" xlsx → 앱 내장 JSON 생성 스크립트.
 *
 * 사용법:
 *   node scripts/build-yongrye-data.mjs "<xlsx 파일 경로>"
 *
 * 결과: src/lib/loanword/yongryeEnglish.json
 *
 * 추출 규칙:
 *  - 언어명(F열)이 '영어'인 레코드만 사용
 *  - 원어 표기가 단순형(알파벳·하이픈·어깻점·공백)이면 그대로 표제어로 색인
 *  - "성표기, 이름표기" 형식의 인명은 원어의 성(마지막 단어)으로 색인
 *  - 같은 표제어의 중복 항목 제거, 표제어당 최대 6항목
 *
 * 국립국어원이 용례집을 갱신하면 새 xlsx로 이 스크립트만 다시 돌리면 된다.
 * (조판에 비유하면: 새 판 원고가 오면 조판 데이터를 다시 뽑는 공정)
 */

import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

const xlsxPath = process.argv[2];
if (!xlsxPath) {
  console.error('사용법: node scripts/build-yongrye-data.mjs "<xlsx 파일 경로>"');
  process.exit(1);
}

const OUT_PATH = path.resolve('src/lib/loanword/yongryeEnglish.json');
const SIMPLE_KEY = /^[a-z][a-z' -]*$/;
const NAME_TOKEN = /^[a-z'-]+$/;
const SKIP_TOKENS = new Set(['jr', 'sr', 'ii', 'iii']);

const text = (v) => {
  if (v == null) return '';
  if (typeof v === 'object' && v.richText) return v.richText.map((t) => t.text).join('');
  return String(v).trim();
};

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(xlsxPath);
const sheet = workbook.worksheets[0];

const data = {};
let simple = 0;
let surname = 0;
let dropped = 0;

const add = (key, entry) => {
  const list = data[key] ?? (data[key] = []);
  const sig = `${entry.h}|${entry.c ?? ''}|${entry.m ?? ''}`;
  if (list.some((e) => `${e.h}|${e.c ?? ''}|${e.m ?? ''}` === sig)) return;
  if (list.length >= 6) return;
  list.push(entry);
};

sheet.eachRow((row, rowNumber) => {
  if (rowNumber === 1) return; // 머리글
  // 언어명이 '영어'이거나 공란인 레코드 포함
  // (뉴욕 등 유명 지명·다국적 인명 다수가 언어명 공란으로 등재되어 있음)
  const lang = text(row.getCell(6).value);
  if (lang !== '영어' && lang !== '') return;

  const rawOriginal = text(row.getCell(4).value)
    .replace(/❲[^❳]*❳/g, ' ') // 병기 표기 제거
    .replace(/\s+/g, ' ')
    .trim();
  const rawWord = rawOriginal.toLowerCase();
  const hangul = text(row.getCell(3).value);
  const category = text(row.getCell(2).value);
  const meaning = text(row.getCell(15).value);
  if (!rawWord || !hangul) return;

  if (SIMPLE_KEY.test(rawWord)) {
    const entry = { h: hangul };
    const alts = [7, 8, 9].map((c) => text(row.getCell(c).value)).filter(Boolean);
    if (alts.length) entry.a = alts;
    if (category) entry.c = category;
    if (meaning) entry.m = meaning;
    add(rawWord, entry);
    simple += 1;
    return;
  }

  // 인명 형식: 한글 "성, 이름 …" → 원어의 성으로 색인
  // (영어 행: 마지막 단어가 성 / 언어명 공란 행: 전부 대문자인 단어가 성)
  if (hangul.includes(',')) {
    let surnameEn = null;
    if (lang === '영어') {
      let clean = rawWord.replace(/[（(][^)）]*[)）]/g, ' ');
      clean = clean.split(/[^a-z' .-]/)[0] ?? '';
      const tokens = clean
        .split(/\s+/)
        .filter((t) => NAME_TOKEN.test(t) && !SKIP_TOKENS.has(t));
      if (tokens.length) surnameEn = tokens[tokens.length - 1];
    } else {
      const caps = rawOriginal
        .replace(/[（(][^)）]*[)）]/g, ' ')
        .split(/\s+/)
        .filter((t) => /^[A-Z][A-Z'-]+$/.test(t));
      if (caps.length === 1) surnameEn = caps[0].toLowerCase();
    }
    const surnameKo = hangul.split(',')[0].trim();
    if (surnameEn && surnameKo && NAME_TOKEN.test(surnameEn)) {
      const full = hangul.replace(/\s+/g, ' ');
      add(surnameEn, {
        h: surnameKo,
        c: category || '인명',
        m: `${meaning ? `${meaning} ` : ''}[전체 표기: ${full}]`,
      });
      surname += 1;
      return;
    }
  }
  dropped += 1;
});

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(data));

const headwords = Object.keys(data).length;
const entries = Object.values(data).reduce((n, v) => n + v.length, 0);
console.log(`표제어 ${headwords} · 항목 ${entries} (단순형 ${simple}, 성 색인 ${surname}, 제외 ${dropped})`);
console.log(`저장: ${OUT_PATH} (${(fs.statSync(OUT_PATH).size / 1048576).toFixed(2)} MB)`);
