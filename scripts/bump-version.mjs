#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nextVersion, shouldSkipVersionBump } from '../src/lib/bumpVersion.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG_PATH = path.join(ROOT, 'package.json');
const IS_DIRECT_RUN =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string[]}
 */
function getStagedFiles(env = process.env) {
  try {
    const output = execSync('git diff --cached --name-only -z', {
      cwd: ROOT,
      encoding: 'utf8',
      env,
    });
    return output.split('\0').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * @returns {{ from: string, to: string, skipped: boolean }}
 */
export function bumpPackageVersion() {
  const stagedFiles = getStagedFiles();
  if (shouldSkipVersionBump(process.env, stagedFiles)) {
    const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
    return { from: pkg.version, to: pkg.version, skipped: true };
  }

  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  const from = pkg.version;
  const to = nextVersion(from);
  pkg.version = to;
  fs.writeFileSync(PKG_PATH, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  return { from, to, skipped: false };
}

function main() {
  const result = bumpPackageVersion();
  if (result.skipped) {
    console.log(`version bump skipped (stay ${result.from})`);
    return;
  }
  console.log(`version ${result.from} -> ${result.to}`);
}

if (IS_DIRECT_RUN) {
  main();
}
