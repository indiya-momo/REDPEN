import { describe, expect, it } from 'vitest';
import {
  collectDocSuffixContextFromPageTexts,
  filterGroupsByDocSuffixOrphan,
  pruneUnifyIndexDocSuffixOrphans,
  spacedVariantHitsDocSuffixOrphan,
} from './unifyNoiseDocSuffixOrphan.js';
import { shouldRejectByNoiseList } from './unifyNoiseList.js';

describe('unifyNoiseDocSuffixOrphan', () => {
  it('프로그램·프로그램지출 증인 → 로그램 지출 DROP', () => {
    const doc = new Set(['프로그램', '프로그램지출', '지출']);
    expect(spacedVariantHitsDocSuffixOrphan('로그램 지출', doc)).toBe(true);
    expect(spacedVariantHitsDocSuffixOrphan('그램 지출', doc)).toBe(false);
  });

  it('환매조+건부 → 환매조건부 (앞 어절 전체)', () => {
    const doc = new Set(['환매조건부', '채권']);
    const pairs = [{ prev: '환매조', curr: '건부' }];
    expect(spacedVariantHitsDocSuffixOrphan('건부 채권', doc, pairs)).toBe(
      true,
    );
  });

  it('경제 성장 — 오른쪽 칸은 인접 앞어절로 DROP 안 함', () => {
    const doc = new Set(['경제성장', '경제', '성장']);
    const pairs = [{ prev: '경제', curr: '성장' }];
    expect(spacedVariantHitsDocSuffixOrphan('경제 성장', doc, pairs)).toBe(
      false,
    );
  });

  it('프로그램을(조사) 증인 → 로그램 지출 DROP', () => {
    expect(
      spacedVariantHitsDocSuffixOrphan(
        '로그램 지출',
        new Set(['프로그램을', '지출']),
      ),
    ).toBe(true);
  });

  it('A — 대기업 증인이어도 기업 문화 KEEP', () => {
    const doc = new Set(['대기업', '기업', '문화']);
    expect(spacedVariantHitsDocSuffixOrphan('기업 문화', doc)).toBe(false);
  });

  it('B — 부시장 증인이어도 노동 시장(오른쪽) KEEP', () => {
    const doc = new Set(['부시장', '노동', '시장']);
    expect(spacedVariantHitsDocSuffixOrphan('노동 시장', doc)).toBe(false);
  });

  it('A+B — 로그램 지출 DROP·건부 채권(인접) DROP 유지', () => {
    const docProg = new Set(['프로그램', '지출']);
    expect(spacedVariantHitsDocSuffixOrphan('로그램 지출', docProg)).toBe(true);
    const docAdj = new Set(['환매조건부', '채권']);
    const pairs = [{ prev: '환매조', curr: '건부' }];
    expect(spacedVariantHitsDocSuffixOrphan('건부 채권', docAdj, pairs)).toBe(
      true,
    );
  });

  it('prune — 붙임 증인만 있어도 로그램 띄움 제거', () => {
    const doc = new Set(['프로그램지출', '로그램', '지출']);
    /** @type {Map<string, { counts: Map<string, number>, occurrences: Map<string, unknown[]> }>} */
    const byKey = new Map([
      [
        '로그램지출',
        {
          counts: new Map([
            ['로그램 지출', 1],
            ['로그램지출', 1],
          ]),
          occurrences: new Map([
            ['로그램 지출', [{}]],
            ['로그램지출', [{}]],
          ]),
        },
      ],
    ]);
    pruneUnifyIndexDocSuffixOrphans(byKey, doc);
    expect(byKey.get('로그램지출')?.counts.has('로그램 지출')).toBe(false);
  });

  it('리스트 단독으로는 앞잘림을 DROP하지 않음', () => {
    expect(shouldRejectByNoiseList('건부 채권')).toBe(false);
    expect(shouldRejectByNoiseList('비스 지출')).toBe(false);
  });
});

describe('2차 filterGroupsByDocSuffixOrphan', () => {
  function singleGroup(clusters) {
    return [{ type: 'single', clusters }];
  }

  function spacedCluster(key, spaced) {
    return {
      key,
      variants: [key, spaced],
      counts: { [key]: 1, [spaced]: 1 },
      kind: /** @type {const} */ ('conflict'),
      totalCount: 2,
    };
  }

  it('layout만 잘려도 text 증인으로 로그램 지출 DROP', async () => {
    const groups = singleGroup([
      spacedCluster('로그램지출', '로그램 지출'),
      spacedCluster('경제성장', '경제 성장'),
    ]);
    const pageTexts = [
      {
        pageNum: 1,
        // layout: OCR 잘림만 / text: 온전한 프로그램
        textLayout: '로그램 지출과 로그램지출',
        text: '프로그램지출과 로그램 지출 로그램지출',
      },
    ];
    const ctx = collectDocSuffixContextFromPageTexts(pageTexts);
    expect(ctx.witnesses.has('프로그램') || ctx.witnesses.has('프로그램지출')).toBe(
      true,
    );
    const out = await filterGroupsByDocSuffixOrphan(groups, pageTexts);
    expect(out.applied).toBe(true);
    expect(out.dropped).toBeGreaterThanOrEqual(1);
    const keys = out.groups.flatMap((g) => g.clusters.map((c) => c.key));
    expect(keys).not.toContain('로그램지출');
    expect(keys).toContain('경제성장');
  });

  it('환매조 건부 — 인접쌍으로 건부 띄움 DROP', async () => {
    const groups = singleGroup([spacedCluster('건부채권', '건부 채권')]);
    const pageTexts = [
      {
        pageNum: 1,
        text: '환매조건부 채권과 환매조 건부 채권 건부채권',
        textLayout: '환매조건부 채권과 환매조 건부 채권 건부채권',
      },
    ];
    const out = await filterGroupsByDocSuffixOrphan(groups, pageTexts);
    expect(out.dropped).toBeGreaterThanOrEqual(1);
    expect(out.groups.flatMap((g) => g.clusters)).toHaveLength(0);
  });

  it('줄바꿈 인접 — 이전 줄 끝+현재 줄 첫(환매조\\n건부)으로 DROP', async () => {
    const groups = singleGroup([
      spacedCluster('건부채권', '건부 채권'),
      spacedCluster('경제성장', '경제 성장'),
    ]);
    // 전역 slice(1)로는 건부가 안 잡힘 — 줄바꿈 인접(환매조+건부→환매조건부)만
    const pageTexts = [
      {
        pageNum: 1,
        text: '약정 환매조\n건부 채권과 건부채권 환매조건부 경제 성장 경제성장',
        textLayout:
          '약정 환매조\n건부 채권과 건부채권 환매조건부 경제 성장 경제성장',
      },
    ];
    const ctx = collectDocSuffixContextFromPageTexts(pageTexts);
    expect(
      ctx.adjacentPairs.some(
        (p) => p.prev === '환매조' && p.curr === '건부',
      ),
    ).toBe(true);
    const out = await filterGroupsByDocSuffixOrphan(groups, pageTexts);
    const keys = out.groups.flatMap((g) => g.clusters.map((c) => c.key));
    expect(keys).not.toContain('건부채권');
    expect(keys).toContain('경제성장');
  });

  it('줄바꿈 인접쌍 수집 — 서\\n비스·프\\n로그램', () => {
    const ctx = collectDocSuffixContextFromPageTexts([
      {
        pageNum: 1,
        text: '예산 서\n비스 지출 해당 프\n로그램 지출',
        textLayout: '예산 서\n비스 지출 해당 프\n로그램 지출',
      },
    ]);
    expect(
      ctx.adjacentPairs.some((p) => p.prev === '서' && p.curr === '비스'),
    ).toBe(true);
    expect(
      ctx.adjacentPairs.some((p) => p.prev === '프' && p.curr === '로그램'),
    ).toBe(true);
    expect(
      ctx.adjacentPairs.some(
        (p) => p.prev === '서' && p.curr === '비스' && p.crossLine,
      ),
    ).toBe(true);
  });

  it('줄바꿈 — 긴 형태 증인 없어도 서\\n비스·프\\n로그램 띄움 DROP', async () => {
    const groups = singleGroup([
      spacedCluster('비스지출', '비스 지출'),
      spacedCluster('로그램지출', '로그램 지출'),
      spacedCluster('경제성장', '경제 성장'),
    ]);
    const pageTexts = [
      {
        pageNum: 1,
        text: '예산 서\n비스 지출과 비스지출 해당 프\n로그램 지출과 로그램지출 경제 성장 경제성장',
        textLayout:
          '예산 서\n비스 지출과 비스지출 해당 프\n로그램 지출과 로그램지출 경제 성장 경제성장',
      },
    ];
    const out = await filterGroupsByDocSuffixOrphan(groups, pageTexts);
    const keys = out.groups.flatMap((g) => g.clusters.map((c) => c.key));
    expect(keys).not.toContain('비스지출');
    expect(keys).not.toContain('로그램지출');
    expect(keys).toContain('경제성장');
  });

  it('같은 줄 짧은P — 서비스 증인 없어도 서 비스 띄움 DROP', async () => {
    const groups = singleGroup([spacedCluster('비스지출', '비스 지출')]);
    const pageTexts = [
      {
        pageNum: 1,
        text: '예산 서 비스 지출과 비스지출',
        textLayout: '예산 서 비스 지출과 비스지출',
      },
    ];
    const out = await filterGroupsByDocSuffixOrphan(groups, pageTexts);
    expect(out.dropped).toBeGreaterThanOrEqual(1);
    expect(out.groups.flatMap((g) => g.clusters)).toHaveLength(0);
  });

  it('대기업·부시장 있어도 기업/시장 띄움 KEEP', async () => {
    const groups = singleGroup([
      spacedCluster('기업문화', '기업 문화'),
      spacedCluster('노동시장', '노동 시장'),
    ]);
    const pageTexts = [
      {
        pageNum: 1,
        text: '대기업과 기업 문화 기업문화 부시장과 노동 시장 노동시장',
        textLayout: '대기업과 기업 문화 기업문화 부시장과 노동 시장 노동시장',
      },
    ];
    const out = await filterGroupsByDocSuffixOrphan(groups, pageTexts);
    const keys = out.groups.flatMap((g) => g.clusters.map((c) => c.key));
    expect(keys).toEqual(expect.arrayContaining(['기업문화', '노동시장']));
  });

  it('증인 없으면 applied false에 가깝게 유지', async () => {
    const groups = singleGroup([spacedCluster('엑스지출', '엑스 지출')]);
    const out = await filterGroupsByDocSuffixOrphan(groups, [
      { pageNum: 1, text: '엑스 지출과 엑스지출만', textLayout: '엑스 지출과 엑스지출만' },
    ]);
    // 엑스 alone is not a 1-syllable head-cut of a longer witness in the same way
    // 로그램 pattern needs W.slice(1).startsWith(F); 엑스지출.slice(1)=스지출 not 엑스
    expect(out.groups.flatMap((g) => g.clusters).length).toBe(1);
  });
});
