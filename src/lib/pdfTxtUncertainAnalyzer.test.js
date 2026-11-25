import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findLinebreakCandidates } from './pdfTxtLinebreakReview.js';
import { paragraphJoinGlue } from './pdfTxtParagraph.js';
import { resolveKiwiNodePaths, loadKiwiNode } from './kiwiMorph/loadNode.js';
import { analyzeLine, clearKiwiAnalyzeCache } from './kiwiMorph/analyze.js';
import { clearKiwiInstance } from './kiwiMorph/runtime.js';
import {
  applyUncertainSuggestionsToCandidates,
  isLikelyLayoutBreakPair,
  isTxtLinebreakAnalyzerEnabled,
  labelMidwordJoin,
  mergeUncertainSuggestions,
  suggestUncertainLinebreakDecisions,
} from './pdfTxtUncertainAnalyzer.js';

const fixture = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures/txt-softwrap-glue-regression.json'),
    'utf8',
  ),
);

const kiwiReady = resolveKiwiNodePaths().ready;

describe('pdfTxtUncertainAnalyzer gate', () => {
  afterEach(() => {
    import.meta.env.VITE_TXT_LINEBREAK_ANALYZER = undefined;
    clearKiwiAnalyzeCache();
    clearKiwiInstance();
  });

  it('플래그 기본 OFF — 제안 없음·현행 유지', () => {
    import.meta.env.VITE_TXT_LINEBREAK_ANALYZER = undefined;
    expect(isTxtLinebreakAnalyzerEnabled()).toBe(false);

    const pages = fixture.Y_known_wrong_nospace.slice(0, 3).map((row, i) => ({
      pageNum: i + 1,
      lines: [String(row.left).trim(), String(row.right).trim()],
    }));
    const candidates = findLinebreakCandidates(pages);
    const result = suggestUncertainLinebreakDecisions(candidates);
    expect(result.enabled).toBe(false);
    expect(result.suggestions).toEqual({});
    expect(result.metrics.skipped).toBe('flag-off');
    expect(result.metrics.overridden).toBe(0);

    const base = Object.fromEntries(
      candidates.map((c) => [c.id, c.defaultDecision]),
    );
    expect(mergeUncertainSuggestions(base, result)).toEqual(base);
  });

  it('플래그 ON + Kiwi 없으면 현행 유지', () => {
    import.meta.env.VITE_TXT_LINEBREAK_ANALYZER = 'true';
    expect(isTxtLinebreakAnalyzerEnabled()).toBe(true);
    clearKiwiInstance();
    const result = suggestUncertainLinebreakDecisions([
      {
        id: '1:0',
        pageNum: 1,
        lineIndex: 0,
        left: '그러나 꼭',
        right: '그렇게',
        defaultDecision: 'nospace',
        glue: '',
        reason: 'midword',
      },
    ]);
    expect(result.enabled).toBe(true);
    expect(result.suggestions).toEqual({});
    expect(result.metrics.skipped).toBe('kiwi-unavailable');
  });

  it('mock analyze Y면 space, A면 현행 nospace', () => {
    const yAnalyze = () => ({ tokens: [{ position: 0, length: 1 }] });
    const aAnalyze = () => ({ tokens: [{ position: 0, length: 8 }] });
    const cand = {
      id: '1:0',
      pageNum: 1,
      lineIndex: 0,
      left: '쉽게 이해할',
      right: '수 있도록',
      defaultDecision: 'nospace',
      glue: '',
      reason: 'midword',
    };
    expect(labelMidwordJoin(cand.left, cand.right, yAnalyze)).toBe('Y');
    expect(labelMidwordJoin('복', '잡한', aAnalyze)).toBe('A');

    const yRes = suggestUncertainLinebreakDecisions([cand], {
      forceEnabled: true,
      analyze: yAnalyze,
    });
    expect(yRes.suggestions['1:0']).toBe('space');
    expect(yRes.metrics.yToSpace).toBe(1);

    const aRes = suggestUncertainLinebreakDecisions(
      [{ ...cand, left: '복', right: '잡한 경제' }],
      { forceEnabled: true, analyze: aAnalyze },
    );
    expect(aRes.suggestions).toEqual({});
    expect(aRes.metrics.aKept).toBe(1);
  });

  it('단·표 어긋남·다른 문장 → K=keep (띄움 아님)', () => {
    const pairs = [
      ['불', '그러나 2000'],
      ['년', '이에 앞서'],
      ['신용위기', '물론 현대'],
      ['개입', '다고 생각했다'],
      ['불치병', '지 않는다면'],
    ];
    for (const [left, right] of pairs) {
      expect(isLikelyLayoutBreakPair(left, right)).toBe(true);
      expect(labelMidwordJoin(left, right, () => ({ tokens: [] }))).toBe('K');
    }

    const cands = pairs.map(([left, right], i) => ({
      id: `1:${i}`,
      pageNum: 1,
      lineIndex: i,
      left,
      right,
      defaultDecision: 'nospace',
      glue: '',
      reason: 'midword',
    }));
    const res = suggestUncertainLinebreakDecisions(cands, {
      forceEnabled: true,
      analyze: () => ({ tokens: [{ position: 0, length: 1 }] }),
    });
    expect(Object.values(res.suggestions).every((d) => d === 'keep')).toBe(true);
    expect(res.metrics.yToKeep).toBe(5);
    expect(res.metrics.yToSpace).toBe(0);
  });

  it('softwrap Y→space 비율을 숫자로 잠근다 (기본 ON 논의 전 게이트)', () => {
    const rows = fixture.Y_known_wrong_nospace;
    let alreadySpace = 0;
    let stillNospace = 0;
    for (const row of rows) {
      if (paragraphJoinGlue(row.left, row.right) === ' ') alreadySpace += 1;
      else stillNospace += 1;
    }
    const rate = rows.length === 0 ? 0 : alreadySpace / rows.length;
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(stillNospace).toBeGreaterThanOrEqual(5);
    expect(rate).toBeGreaterThanOrEqual(0);
    expect(rate).toBeLessThan(1);
  });
});

describe.skipIf(!kiwiReady)('pdfTxtUncertainAnalyzer + Kiwi', () => {
  afterEach(() => {
    import.meta.env.VITE_TXT_LINEBREAK_ANALYZER = undefined;
    clearKiwiAnalyzeCache();
    clearKiwiInstance();
  });

  it(
    'softwrap A는 space로 뒤집지 않고, Y nospace는 space 제안',
    async () => {
      await loadKiwiNode({ register: true });
      import.meta.env.VITE_TXT_LINEBREAK_ANALYZER = 'true';

      const aPages = fixture.A_nospace.slice(0, 8).map((row, i) => ({
        pageNum: i + 1,
        lines: [String(row.left).trim(), String(row.right).trim()],
      }));
      const aCands = findLinebreakCandidates(aPages).filter(
        (c) => c.reason === 'midword' && c.defaultDecision === 'nospace',
      );
      const aRes = suggestUncertainLinebreakDecisions(aCands, {
        analyze: analyzeLine,
      });
      const aFp = Object.values(aRes.suggestions).filter((d) => d === 'space')
        .length;
      // A-FP 상한: 표본 midword의 25% 또는 최소 2 (소표본·Kiwi 요동)
      expect(aFp).toBeLessThanOrEqual(
        Math.max(2, Math.floor(aCands.length * 0.25)),
      );

      const yStill = fixture.Y_known_wrong_nospace.filter(
        (row) => paragraphJoinGlue(row.left, row.right) === '',
      );
      const yPages = yStill.map((row, i) => ({
        pageNum: i + 1,
        lines: [String(row.left).trim(), String(row.right).trim()],
      }));
      const yCands = findLinebreakCandidates(yPages);
      const yRes = suggestUncertainLinebreakDecisions(yCands, {
        analyze: analyzeLine,
      });
      const applied = applyUncertainSuggestionsToCandidates(yCands, yRes);
      const spaceN = applied.filter((c) => c.defaultDecision === 'space').length;
      expect(spaceN).toBeGreaterThanOrEqual(1);
    },
    30_000,
  );
});
