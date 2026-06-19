/**
 * src/data · public/data JSON 스키마 검증 (sync 없이 로컬 파일만)
 *
 *   npm run validate-data
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertNoValidationIssues,
  formatValidationIssues,
  validateBonBojoRules,
  validateCautionRules,
  validateSpellingRules,
} from '../src/lib/validateDataJson.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/** @type {{ rel: string, validate: (data: unknown, label: string) => import('../src/lib/validateDataJson.js').ValidationIssue[] }[]} */
const DATASETS = [
  {
    rel: 'src/data/spelling-rules.json',
    validate: validateSpellingRules,
  },
  {
    rel: 'src/data/caution-rules.json',
    validate: validateCautionRules,
  },
  {
    rel: 'src/data/bon-bojo-rules.json',
    validate: validateBonBojoRules,
  },
];

/**
 * @param {string} relPath
 */
async function readJson(relPath) {
  const abs = path.join(ROOT, relPath);
  const text = await readFile(abs, 'utf8');
  return { abs, data: JSON.parse(text) };
}

/**
 * @param {string} srcRel
 * @param {string} publicRel
 */
async function assertPublicMirror(srcRel, publicRel) {
  const src = path.join(ROOT, srcRel);
  const pub = path.join(ROOT, publicRel);
  let srcText;
  let pubText;
  try {
    srcText = await readFile(src, 'utf8');
    pubText = await readFile(pub, 'utf8');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`public mirror missing for ${srcRel}: ${msg}`);
  }
  if (srcText !== pubText) {
    throw new Error(
      `${publicRel} is out of sync with ${srcRel}. Run the matching npm run sync-* command.`,
    );
  }
}

async function main() {
  /** @type {import('../src/lib/validateDataJson.js').ValidationIssue[]} */
  const allIssues = [];

  for (const { rel, validate } of DATASETS) {
    const { data } = await readJson(rel);
    const issues = validate(data, rel);
    if (issues.length) {
      console.error(formatValidationIssues(issues, rel));
      allIssues.push(...issues);
    } else {
      console.log(`OK ${rel}`);
    }

    const publicRel = rel.replace(/^src\//, 'public/');
    try {
      await assertPublicMirror(rel, publicRel);
      console.log(`OK ${publicRel} (matches ${rel})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(msg);
      throw err;
    }
  }

  assertNoValidationIssues(allIssues, 'data JSON');

  console.log('validate-data: all checks passed');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
