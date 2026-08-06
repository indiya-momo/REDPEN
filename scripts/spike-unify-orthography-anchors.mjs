/**
 * 표기 통일 3단 스파이크 — 라틴 괄호 병기 앵커 진단.
 *
 *   npm run spike:unify-ortho-anchors
 *   npm run spike:unify-ortho-anchors -- path\to\text.txt
 *   npm run spike:unify-ortho-anchors -- --no-near
 *
 * stdin 없음. 인자 없으면 내장 샘플 텍스트로 돌린다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const modPath = path.join(root, 'src/lib/unifyOrthographyAnchorSpike.js');

const SAMPLE = `
서문에서 도널드(Donald)를 소개한다. 본문에는 도날드가 세 번 나온다.
도날드가 웃는다. 도날드와 친구가 산다. 다시 도널드(Donald)가 등장한다.

록커(Rocker)와 롹커 표기가 섞여 있다. 롹커 밴드.

초콜릿(Chocolate)만 병기되고 이형태는 없다.
`.trim();

function parseArgs(argv) {
  let includeNearNeighbors = true;
  /** @type {string | null} */
  let file = null;
  for (const a of argv) {
    if (a === '--no-near') includeNearNeighbors = false;
    else if (a.startsWith('-')) continue;
    else file = a;
  }
  return { includeNearNeighbors, file };
}

async function main() {
  const { discoverOrthographyFromLatinParenAnchors } = await import(
    pathToFileURL(modPath).href
  );
  const { includeNearNeighbors, file } = parseArgs(process.argv.slice(2));
  const text = file
    ? fs.readFileSync(path.resolve(file), 'utf8')
    : SAMPLE;

  const result = discoverOrthographyFromLatinParenAnchors({
    text,
    includeNearNeighbors,
  });

  const summary = {
    source: file || '(built-in sample)',
    includeNearNeighbors,
    anchorCount: result.anchors.length,
    clusterCount: result.clusters.length,
    mixClusterCount: result.mixClusters.length,
    observedSyllableDiffs: result.observedSyllableDiffs,
    mixClusters: result.mixClusters.map((c) => ({
      latin: c.latin,
      kind: c.kind,
      variants: c.variants,
      counts: c.counts,
      recommendedUnify: c.recommendedUnify,
      needsVerification: c.needsVerification,
      jamoDistances: c.jamoDistances,
      observedSyllableDiffs: c.observedSyllableDiffs,
    })),
    anchorOnly: result.clusters
      .filter((c) => c.kind === 'anchor-only')
      .map((c) => ({ latin: c.latin, hangul: c.variants[0], count: c.totalCount })),
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
