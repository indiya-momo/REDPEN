import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  findDeterminerNounSpacingHits,
  stripTrailingJosaHeuristic,
} from './determinerNounSpacing.js';
import { ensureStdictPosIndexLoaded } from './stdictPosIndex.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

beforeAll(async () => {
  const raw = readFileSync(
    join(root, 'public/data/stdict-pos-index.json'),
    'utf8',
  );
  await ensureStdictPosIndexLoaded({ posIndex: JSON.parse(raw) });
}, 60_000);

describe('stripTrailingJosaHeuristic', () => {
  it('조사를 뗀다', () => {
    expect(stripTrailingJosaHeuristic('그줄을')).toBe('그줄');
    expect(stripTrailingJosaHeuristic('이질문을')).toBe('이질문');
  });
});

describe('findDeterminerNounSpacingHits', () => {
  it('그줄을·이질문을 띄운다', () => {
    const hits = findDeterminerNounSpacingHits(
      '그줄을 읽고 이질문을 받는다',
    );
    expect(hits.map((h) => [h.matchedText, h.suggestedText])).toEqual([
      ['그줄을', '그 줄을'],
      ['이질문을', '이 질문을'],
    ]);
  });

  it('표제어·except는 미매칭', () => {
    const text =
      '이후 이상 이중 그중 이불 그림 이메일 그때 이순신 그랜드 그룹';
    expect(findDeterminerNounSpacingHits(text)).toEqual([]);
  });
});
