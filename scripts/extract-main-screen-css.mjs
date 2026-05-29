import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.resolve('src/index.css');
const outPath = path.resolve('src/styles/main-screen.css');

/** 1-based inclusive line ranges to extract */
const ranges = [
  [183, 768],
  [781, 880],
  [1363, 1365],
  [1387, 1397],
  [2448, 2456],
  [2469, 2505],
];

const lines = fs.readFileSync(cssPath, 'utf8').split('\n');
const extractIndexes = new Set();

for (const [start, end] of ranges) {
  for (let line = start; line <= end; line += 1) {
    extractIndexes.add(line - 1);
  }
}

const extracted = [
  '/* MainScreen layout shell — extracted from index.css (structure only, selectors unchanged) */',
  '',
];
const remaining = [];

for (let i = 0; i < lines.length; i += 1) {
  if (extractIndexes.has(i)) {
    extracted.push(lines[i]);
  } else {
    remaining.push(lines[i]);
  }
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${extracted.join('\n')}\n`, 'utf8');
fs.writeFileSync(cssPath, `${remaining.join('\n')}\n`, 'utf8');

console.log(`Extracted ${extractIndexes.size} lines -> ${outPath}`);
console.log(`index.css now ${remaining.length} lines`);
