import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.resolve('src/index.css');
const outPath = path.resolve('src/styles/welcome-gate.css');

/** 1-based inclusive line ranges (PC welcome only; mobile stays in welcome-gate-mobile.css) */
const ranges = [
  [204, 208],
  [3161, 3651],
];

const lines = fs.readFileSync(cssPath, 'utf8').split('\n');
const extractIndexes = new Set();

for (const [start, end] of ranges) {
  for (let line = start; line <= end; line += 1) {
    extractIndexes.add(line - 1);
  }
}

const extracted = [
  '/* WelcomeScreen PC — extracted from index.css (mobile @media in welcome-gate-mobile.css) */',
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
