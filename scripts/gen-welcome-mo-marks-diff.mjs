/**
 * m_before + m_after3 → m_before_aligned(본문 글자 동기화) + diff 레이어 + JSON.
 * PNG 교체 후: node scripts/gen-welcome-mo-marks-diff.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const welcomeDir = path.join(root, 'public/welcome');
const sourceBeforePath = path.join(welcomeDir, 'm_before.png');
const alignedBeforePath = path.join(welcomeDir, 'm_before_aligned.png');
const afterPath = path.join(welcomeDir, 'm_after3.png');
const REGIONS_OUT = path.join(root, 'src/welcome/mobile/welcome-mo-reveal-regions.json');

const LAYER_FILES = {
  highlight: 'm_diff_highlight.png',
  callout: 'm_diff_callout.png',
  connector: 'm_diff_connector.png',
};

function pixelDelta(before, after, i) {
  return (
    Math.abs(before.data[i] - after.data[i]) +
    Math.abs(before.data[i + 1] - after.data[i + 1]) +
    Math.abs(before.data[i + 2] - after.data[i + 2])
  );
}

function isOrange(ar, ag, ab) {
  return ar > 215 && ag > 130 && ag < 200 && ab < 110 && ar - ag > 30;
}

function isDarkText(ar, ag, ab) {
  return ar < 100 && ag < 100 && ab < 100;
}

/** 본문 밑줄용 빨강 — 캡션 글씨(밝은 빨강) 제외 */
function isRedUnderline(ar, ag, ab) {
  return (
    ar > 130 &&
    ar < 205 &&
    ag < 120 &&
    ab < 120 &&
    ar > ag + 25 &&
    !isDarkText(ar, ag, ab)
  );
}

function isRedInk(ar, ag, ab) {
  return ar > 130 && ag < 115 && ab < 115 && ar > ag + 25;
}

function inConnectorZone(x, y, w, h) {
  return x > w * 0.7 && x < w * 0.94 && y > h * 0.28 && y < h * 0.58;
}

/** @returns {'highlight'|'callout'|'connector'|null} */
function classifyLayer(ar, ag, ab, x, y, w, h) {
  if (isOrange(ar, ag, ab)) return 'highlight';
  if (!isRedInk(ar, ag, ab)) return null;
  if (inConnectorZone(x, y, w, h)) return 'connector';
  if (y < h * 0.2 || y > h * 0.86) return null;
  return 'callout';
}

function isAnnotationPixel(ar, ag, ab, x, y, w, h) {
  return classifyLayer(ar, ag, ab, x, y, w, h) !== null;
}

/** m_after3에서 교정된 검은 본문 글자만 이전 before에 반영 */
function buildAlignedBefore(sourceBefore, after) {
  const { width: w, height: h } = sourceBefore;
  const aligned = new PNG({ width: w, height: h });
  let textPatches = 0;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (w * y + x) * 4;
      aligned.data[i] = sourceBefore.data[i];
      aligned.data[i + 1] = sourceBefore.data[i + 1];
      aligned.data[i + 2] = sourceBefore.data[i + 2];
      aligned.data[i + 3] = sourceBefore.data[i + 3];

      if (sourceBefore.data[i + 3] < 200 || after.data[i + 3] < 200) continue;
      if (pixelDelta(sourceBefore, after, i) <= 25) continue;

      const ar = after.data[i];
      const ag = after.data[i + 1];
      const ab = after.data[i + 2];
      if (isAnnotationPixel(ar, ag, ab, x, y, w, h)) continue;
      if (ar > 100 || ag > 100 || ab > 100) continue;

      aligned.data[i] = ar;
      aligned.data[i + 1] = ag;
      aligned.data[i + 2] = ab;
      aligned.data[i + 3] = after.data[i + 3];
      textPatches += 1;
    }
  }

  fs.writeFileSync(alignedBeforePath, PNG.sync.write(aligned));
  console.log(`Wrote ${alignedBeforePath} (${textPatches} text pixels synced from m_after3)`);
  return aligned;
}

function mergeClusters(clusters, gapY = 20, gapX = 14) {
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < clusters.length; i += 1) {
      for (let j = i + 1; j < clusters.length; j += 1) {
        const a = clusters[i];
        const b = clusters[j];
        const overlapX = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
        const minW = Math.min(a.maxX - a.minX, b.maxX - b.minX);
        const closeY = Math.abs(a.cy - b.cy) < gapY;
        const closeX = Math.abs(a.cx - b.cx) < 80;
        if ((overlapX > minW * 0.2 || closeX) && closeY) {
          a.minX = Math.min(a.minX, b.minX);
          a.maxX = Math.max(a.maxX, b.maxX);
          a.minY = Math.min(a.minY, b.minY);
          a.maxY = Math.max(a.maxY, b.maxY);
          a.cx = (a.minX + a.maxX) / 2;
          a.cy = (a.minY + a.maxY) / 2;
          clusters.splice(j, 1);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }
  return clusters;
}

function clusterToRegion(cluster, w, h) {
  const pad = 4;
  const minX = Math.max(0, cluster.minX - pad);
  const minY = Math.max(0, cluster.minY - pad);
  const maxX = Math.min(w - 1, cluster.maxX + pad);
  const maxY = Math.min(h - 1, cluster.maxY + pad);
  return {
    x: +((minX / w) * 100).toFixed(2),
    y: +((minY / h) * 100).toFixed(2),
    w: +(((maxX - minX + 1) / w) * 100).toFixed(2),
    h: +(((maxY - minY + 1) / h) * 100).toFixed(2),
  };
}

function buildRegions(layerPixels, w, h, options = {}) {
  const { minW = 6, minH = 4, gapY = 20, mergeAll = false } = options;
  const clusters = [];
  for (const p of layerPixels) {
    let cluster = clusters.find(
      (c) => Math.abs(c.cy - p.y) < 14 && p.x >= c.minX - 12 && p.x <= c.maxX + 12,
    );
    if (!cluster) {
      cluster = { minX: p.x, maxX: p.x, minY: p.y, maxY: p.y, cx: p.x, cy: p.y };
      clusters.push(cluster);
    }
    cluster.minX = Math.min(cluster.minX, p.x);
    cluster.maxX = Math.max(cluster.maxX, p.x);
    cluster.minY = Math.min(cluster.minY, p.y);
    cluster.maxY = Math.max(cluster.maxY, p.y);
    cluster.cx = (cluster.minX + cluster.maxX) / 2;
    cluster.cy = (cluster.minY + cluster.maxY) / 2;
  }

  let merged = mergeClusters(clusters, gapY);
  if (mergeAll && merged.length > 1) {
    const all = {
      minX: Math.min(...merged.map((c) => c.minX)),
      maxX: Math.max(...merged.map((c) => c.maxX)),
      minY: Math.min(...merged.map((c) => c.minY)),
      maxY: Math.max(...merged.map((c) => c.maxY)),
    };
    merged = [all];
  }

  return merged
    .filter((c) => c.maxX - c.minX >= minW && c.maxY - c.minY >= minH)
    .sort((a, b) => a.minY - b.minY || a.minX - b.minX)
    .map((c) => clusterToRegion(c, w, h));
}

const sourceBefore = PNG.sync.read(fs.readFileSync(sourceBeforePath));
const after = PNG.sync.read(fs.readFileSync(afterPath));

if (sourceBefore.width !== after.width || sourceBefore.height !== after.height) {
  throw new Error('m_before and m_after3 must be the same size');
}

buildAlignedBefore(sourceBefore, after);

/** 1단계 연출 베이스·diff는 원본 before 기준 (교정 글자는 2단계 after에서만) */
const before = sourceBefore;
const { width: w, height: h } = before;
const layerBuffers = Object.fromEntries(
  Object.keys(LAYER_FILES).map((id) => [id, new PNG({ width: w, height: h })]),
);
const layerPixels = Object.fromEntries(
  Object.keys(LAYER_FILES).map((id) => [id, []]),
);

for (let y = 0; y < h; y += 1) {
  for (let x = 0; x < w; x += 1) {
    const i = (w * y + x) * 4;
    if (before.data[i + 3] < 200 || after.data[i + 3] < 200) continue;
    if (pixelDelta(before, after, i) <= 25) continue;

    const ar = after.data[i];
    const ag = after.data[i + 1];
    const ab = after.data[i + 2];
    if (isDarkText(ar, ag, ab)) continue;

    const layer = classifyLayer(ar, ag, ab, x, y, w, h);
    if (!layer) continue;
    if (layer === 'highlight' && !isOrange(ar, ag, ab)) continue;

    layerBuffers[layer].data[i] = ar;
    layerBuffers[layer].data[i + 1] = ag;
    layerBuffers[layer].data[i + 2] = ab;
    layerBuffers[layer].data[i + 3] = 255;
    layerPixels[layer].push({ x, y });
  }
}

// 하이라이트: 밑줄(빨간)도 주황 영역 인근이면 포함
for (let y = 0; y < h; y += 1) {
  for (let x = 0; x < w; x += 1) {
    const i = (w * y + x) * 4;
    if (layerBuffers.highlight.data[i + 3] > 200) continue;
    if (before.data[i + 3] < 200 || after.data[i + 3] < 200) continue;
    if (pixelDelta(before, after, i) <= 25) continue;
    const ar = after.data[i];
    const ag = after.data[i + 1];
    const ab = after.data[i + 2];
    if (!isRedUnderline(ar, ag, ab) || inConnectorZone(x, y, w, h)) continue;
    let nearOrange = false;
    for (let dy = -3; dy <= 3 && !nearOrange; dy += 1) {
      for (let dx = -8; dx <= 8 && !nearOrange; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = (w * ny + nx) * 4;
        if (layerBuffers.highlight.data[j + 3] > 200) nearOrange = true;
      }
    }
    if (!nearOrange) continue;
    layerBuffers.highlight.data[i] = ar;
    layerBuffers.highlight.data[i + 1] = ag;
    layerBuffers.highlight.data[i + 2] = ab;
    layerBuffers.highlight.data[i + 3] = 255;
    layerPixels.highlight.push({ x, y });
  }
}

for (const [id, file] of Object.entries(LAYER_FILES)) {
  const out = path.join(welcomeDir, file);
  fs.writeFileSync(out, PNG.sync.write(layerBuffers[id]));
  console.log(`Wrote ${out} (${layerPixels[id].length} px)`);
}

const highlightRegions = buildRegions(layerPixels.highlight, w, h, { minW: 20, minH: 10, gapY: 24 });
const calloutRegions = buildRegions(layerPixels.callout, w, h, { minW: 30, minH: 8, gapY: 30 });
const connectorRegions = buildRegions(layerPixels.connector, w, h, { minW: 4, minH: 4, mergeAll: true });

const layerOrder = [
  { id: 'highlight', regions: highlightRegions },
  { id: 'callout', regions: calloutRegions },
  { id: 'connector', regions: connectorRegions },
];

let globalIndex = 0;
const manifest = {
  source: 'm_after3.png',
  base: 'm_before.png',
  size: { width: w, height: h },
  staggerMs: 600,
  layers: layerOrder.map((layer) => ({
    id: layer.id,
    src: `/welcome/${LAYER_FILES[layer.id]}`,
    regions: layer.regions.map((region) => ({ ...region, i: globalIndex++ })),
  })),
};

fs.writeFileSync(REGIONS_OUT, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${REGIONS_OUT}`);
for (const layer of manifest.layers) {
  console.log(`  ${layer.id}: ${layer.regions.length} regions`);
}
