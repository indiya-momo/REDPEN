import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { evaluateGolden } from './evaluateGolden.js';

const fixtures = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../test-fixtures/visual-golden',
);

describe('evaluateGolden', () => {
  it('V4 센티넬: 옛 오산출물은 depressione V1 두 항목 FAIL', () => {
    const golden = JSON.parse(
      readFileSync(join(fixtures, 'depressione.golden.json'), 'utf8'),
    );
    const bad = JSON.parse(
      readFileSync(join(fixtures, 'sentinel-depressione-bad-artifacts.json'), 'utf8'),
    );
    const report = evaluateGolden(golden, {
      mode: 'analyzer-off',
      decisionsMode: 'untouched',
      extractLines: bad.extractLines,
      finalTxt: bad.finalTxt,
    });
    const adj = report.items.filter((i) => i.kind === 'visualAdjacency');
    expect(adj).toHaveLength(2);
    expect(adj.every((i) => i.status === 'FAIL')).toBe(true);
    expect(report.totals.fail).toBeGreaterThanOrEqual(2);
  });

  it('올바른 순서·구문이면 visualAdjacency PASS', () => {
    const golden = JSON.parse(
      readFileSync(join(fixtures, 'depressione.golden.json'), 'utf8'),
    );
    const report = evaluateGolden(golden, {
      extractLines: [
        { pageNum: 12, lineIndex: 0, text: '세워야만 한다. 그러' },
        { pageNum: 12, lineIndex: 1, text: '지 않는다면 정말' },
        { pageNum: 12, lineIndex: 2, text: '이 새로운 불치병' },
        { pageNum: 13, lineIndex: 0, text: '의 희생자가 되었다' },
      ],
      finalTxt:
        '세워야만 한다. 그러지 않는다면. 이 새로운 불치병의 희생자가 되었다.',
    });
    const adj = report.items.filter((i) => i.kind === 'visualAdjacency');
    expect(adj.every((i) => i.status === 'PASS')).toBe(true);
  });

  it('street forbiddenMash·requiredCells를 판정한다', () => {
    const golden = JSON.parse(
      readFileSync(join(fixtures, 'street.golden.json'), 'utf8'),
    );
    const bad = evaluateGolden(golden, {
      finalTxt: '안정적인원 자 재 달국에',
      extractLines: [],
    });
    expect(bad.items.some((i) => i.checkId === 'mash_stable_raw' && i.status === 'FAIL')).toBe(
      true,
    );
    const goodTxt = [
      '원 자 재 가 격 상 승',
      '근로자들이 실질 임금',
      '비용 감소와 안정적인',
      '기업은 투입 비용의 상',
    ].join('\n');
    const good = evaluateGolden(golden, { finalTxt: goodTxt, extractLines: [] });
    expect(good.items.filter((i) => i.kind === 'forbiddenMash').every((i) => i.status === 'PASS')).toBe(
      true,
    );
    expect(good.items.filter((i) => i.kind === 'requiredCells').every((i) => i.status === 'PASS')).toBe(
      true,
    );
  });
});
