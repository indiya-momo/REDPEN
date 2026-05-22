import { readFile } from 'node:fs/promises';

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.some((x) => x.trim()));
}

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const env = await readFile(`${ROOT}/.env`, 'utf8');
const id = env.match(/SPREADSHEET_ID=(.+)/)[1].trim();
const gid = (env.match(/SPELLING_GID=(.+)/) || [])[1]?.trim() || '0';
const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}&_=${Date.now()}`;
const csv = await (await fetch(url)).text();
const rows = parseCsv(csv);

console.log(`gid=${gid}, CSV data rows: ${rows.length}\n`);
for (let i = 0; i < Math.min(6, rows.length); i += 1) {
  console.log(`--- ${i + 1}행 ---`);
  const labels = ['A(find)', 'B(replace)', 'C(enabled)', 'D(tip/memo)'];
  rows[i].forEach((v, j) => {
    const t = v.trim();
    if (t) {
      const col = String.fromCharCode(65 + j);
      console.log(`  ${col}${j + 1}: ${t.slice(0, 80)}`);
    }
  });
}

const r1 = rows[0];
if (r1) {
  console.log('\n1행 A열 전체 길이:', r1[0]?.length);
  console.log('1행 비어있지 않은 칸 수:', r1.filter((v) => v.trim()).length);
}
