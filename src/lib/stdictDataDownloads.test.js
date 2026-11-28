import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  GOLDENDICT_ZIP_URL,
  STDICT_DATA_FILES,
  getStdictDataDownloadUrl,
} from './stdictDataDownloads.js';

const publicDataDir = fileURLToPath(new URL('../../public/data/', import.meta.url));

describe('stdictDataDownloads', () => {
  it('every local file exists in public/data', () => {
    for (const item of STDICT_DATA_FILES) {
      if (!item.file) continue;
      expect(existsSync(`${publicDataDir}${item.file}`), item.file).toBe(true);
    }
  });

  it('file ids are unique', () => {
    const ids = STDICT_DATA_FILES.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('builds download url under data/ with the base path', () => {
    const url = getStdictDataDownloadUrl({ id: 'x', label: 'x', note: 'x', file: 'stdict-pos-index.json' });
    expect(url.endsWith('/data/stdict-pos-index.json')).toBe(true);
  });

  it('uses the external release url for the GoldenDict zip', () => {
    const gd = STDICT_DATA_FILES.find((item) => item.id === 'goldendict');
    expect(getStdictDataDownloadUrl(gd)).toBe(GOLDENDICT_ZIP_URL);
    expect(GOLDENDICT_ZIP_URL.endsWith('/releases/download/stdict/2611_indiya_goldendict.zip')).toBe(true);
  });
});
