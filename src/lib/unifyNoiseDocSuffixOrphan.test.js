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

  it('인접 P+F — 전체 발견 증거 없으면 KEEP', () => {
    const doc = new Set(['비스', '지출', '비스지출']);
    const pairs = [{ prev: '서', curr: '비스', crossLine: true }];
    expect(spacedVariantHitsDocSuffixOrphan('비스 지출', doc, pairs)).toBe(
      false,
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

  it('전체 발견에 프로그램 증인 → 로그램 orphan DROP (복원·merge 없음)', async () => {
    const groups = singleGroup([
      spacedCluster('로그램지출', '로그램 지출'),
      spacedCluster('프로그램지출', '프로그램 지출'),
      spacedCluster('경제성장', '경제 성장'),
    ]);
    const pageTexts = [
      {
        pageNum: 1,
        textLayout: '로그램 지출과 로그램지출',
        text: '프로그램지출과 로그램 지출 로그램지출',
      },
    ];
    const out = await filterGroupsByDocSuffixOrphan(groups, pageTexts);
    expect(out.applied).toBe(true);
    expect(out.remapped).toBe(0);
    expect(out.dropped).toBeGreaterThanOrEqual(1);
    const keys = out.groups.flatMap((g) => g.clusters.map((c) => c.key));
    expect(keys).not.toContain('로그램지출');
    expect(keys).toContain('프로그램지출');
    expect(keys).toContain('경제성장');
    const prog = out.groups[0].clusters.find((c) => c.key === '프로그램지출');
    // merge 없음 — 프로그램 쪽 count는 그대로
    expect(prog.totalCount).toBe(2);
  });

  it('본문에만 프로그램·발견에는 없으면 로그램 KEEP', async () => {
    const groups = singleGroup([
      spacedCluster('로그램지출', '로그램 지출'),
      spacedCluster('경제성장', '경제 성장'),
    ]);
    const pageTexts = [
      {
        pageNum: 1,
        text: '프로그램지출과 로그램 지출 로그램지출 경제 성장 경제성장',
        textLayout: '프로그램지출과 로그램 지출 로그램지출 경제 성장 경제성장',
      },
    ];
    const out = await filterGroupsByDocSuffixOrphan(groups, pageTexts);
    const keys = out.groups.flatMap((g) => g.clusters.map((c) => c.key));
    expect(keys).toContain('로그램지출');
    expect(keys).toContain('경제성장');
  });

  it('환매조 건부 — 발견에 환매조건부 + 인접쌍으로 DROP', async () => {
    const groups = singleGroup([
      spacedCluster('건부채권', '건부 채권'),
      spacedCluster('환매조건부', '환매 조건부'),
    ]);
    const pageTexts = [
      {
        pageNum: 1,
        text: '환매조건부 채권과 환매조 건부 채권 건부채권',
        textLayout: '환매조건부 채권과 환매조 건부 채권 건부채권',
      },
    ];
    const out = await filterGroupsByDocSuffixOrphan(groups, pageTexts);
    const keys = out.groups.flatMap((g) => g.clusters.map((c) => c.key));
    expect(keys).not.toContain('건부채권');
    expect(keys).toContain('환매조건부');
  });

  it('줄바꿈 인접 — 이전 줄 끝+현재 줄 첫(환매조\\n건부)으로 DROP', async () => {
    const groups = singleGroup([
      spacedCluster('건부채권', '건부 채권'),
      spacedCluster('환매조건부', '환매 조건부'),
      spacedCluster('경제성장', '경제 성장'),
    ]);
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

  it('줄바꿈 — 발견에 서비스·프로그램 없으면 soft DROP 안 함', async () => {
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
    expect(keys).toContain('비스지출');
    expect(keys).toContain('로그램지출');
    expect(keys).toContain('경제성장');
  });

  it('줄바꿈 — 발견에 서비스·프로그램 있으면 orphan DROP (복원 키 없음)', async () => {
    const groups = singleGroup([
      spacedCluster('비스지출', '비스 지출'),
      spacedCluster('로그램지출', '로그램 지출'),
      spacedCluster('서비스', '서 비스'),
      spacedCluster('프로그램', '프로 그램'),
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
    expect(keys).not.toContain('서비스지출');
    expect(keys).not.toContain('프로그램지출');
    expect(keys).toContain('서비스');
    expect(keys).toContain('프로그램');
    expect(keys).toContain('경제성장');
  });

  it('대기업·부시장 있어도 기업/시장 띄움 KEEP', async () => {
    const groups = singleGroup([
      spacedCluster('기업문화', '기업 문화'),
      spacedCluster('노동시장', '노동 시장'),
      spacedCluster('대기업', '대 기업'),
      spacedCluster('부시장', '부 시장'),
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

  it('@서비스 계열 affix만 있어도 비스 orphan DROP (서비스지출로 복원 안 함)', async () => {
    const groups = [
      {
        type: 'series',
        affix: '서비스',
        affixType: 'suffix',
        label: '@서비스',
        clusters: [
          spacedCluster('금융서비스', '금융 서비스'),
          spacedCluster('비스지출', '비스 지출'),
        ],
      },
    ];
    const out = await filterGroupsByDocSuffixOrphan(groups, [
      { pageNum: 1, text: '금융서비스 비스 지출', textLayout: '금융서비스 비스 지출' },
    ]);
    const keys = out.groups.flatMap((g) => g.clusters.map((c) => c.key));
    expect(keys).not.toContain('비스지출');
    expect(keys).toContain('금융서비스');
    expect(keys).not.toContain('서비스지출');
  });

  it('접두 미국@ — 하미국 증인이 있어도 미국 칸을 바꾸거나 지우지 않는다', async () => {
    const groups = [
      {
        type: 'series',
        affix: '미국',
        affixType: 'prefix',
        label: '미국@',
        clusters: [
          spacedCluster('미국노동통계국', '미국 노동통계국'),
          spacedCluster('미국경제분석국', '미국 경제분석국'),
        ],
      },
    ];
    const witnessGroups = [
      ...groups,
      {
        type: 'pair',
        clusters: [spacedCluster('하미국', '하 미국')],
      },
    ];
    const out = await filterGroupsByDocSuffixOrphan(
      groups,
      [
        {
          pageNum: 1,
          text: '미국 노동통계국. 미국 경제분석국.',
          textLayout: '미국 노동통계국. 미국 경제분석국.',
        },
      ],
      { witnessGroups },
    );
    const variants = out.groups.flatMap((g) =>
      g.clusters.flatMap((c) => Object.keys(c.counts ?? {})),
    );
    expect(out.remapped).toBe(0);
    expect(variants).toEqual(
      expect.arrayContaining(['미국 노동통계국', '미국 경제분석국']),
    );
    expect(variants).not.toContain('하미국 노동통계국');
    expect(variants).not.toContain('하미국노동통계국');
  });

  it('하미국 증인만으로 pair 미국 칸을 하미국으로 바꾸지 않는다', async () => {
    const groups = [
      {
        type: 'pair',
        clusters: [spacedCluster('미국노동통계국', '미국 노동통계국')],
      },
    ];
    const witnessGroups = [
      ...groups,
      {
        type: 'pair',
        clusters: [spacedCluster('하미국', '하 미국')],
      },
    ];
    const out = await filterGroupsByDocSuffixOrphan(
      groups,
      [
        {
          pageNum: 1,
          text: '미국 노동통계국',
          textLayout: '미국 노동통계국',
        },
      ],
      { witnessGroups },
    );
    const variants = out.groups.flatMap((g) =>
      g.clusters.flatMap((c) => Object.keys(c.counts ?? {})),
    );
    expect(out.remapped).toBe(0);
    expect(variants).toContain('미국 노동통계국');
    expect(variants).not.toContain('하미국 노동통계국');
  });

  it('접미 @세계 — 탈세계화 증인이 있어도 세계 칸을 바꾸지 않는다', async () => {
    const groups = [
      {
        type: 'series',
        affix: '세계',
        affixType: 'suffix',
        label: '@세계',
        clusters: [spacedCluster('세계경제', '세계 경제')],
      },
    ];
    const witnessGroups = [
      ...groups,
      {
        type: 'pair',
        clusters: [
          {
            key: '탈세계화',
            variants: ['탈세계화'],
            counts: { 탈세계화: 1 },
            kind: /** @type {const} */ ('single-form'),
            totalCount: 1,
          },
        ],
      },
    ];
    const out = await filterGroupsByDocSuffixOrphan(
      groups,
      [
        {
          pageNum: 1,
          text: '세계 경제. 탈세계화.',
          textLayout: '세계 경제. 탈세계화.',
        },
      ],
      { witnessGroups },
    );
    const variants = out.groups.flatMap((g) =>
      g.clusters.flatMap((c) => Object.keys(c.counts ?? {})),
    );
    expect(out.remapped).toBe(0);
    expect(out.dropped).toBe(0);
    expect(variants).toContain('세계 경제');
    expect(variants).not.toContain('탈세계화 경제');
    expect(variants).not.toContain('탈세계화경제');
  });

  it('금융서비스 붙임만(띄움 이형태 없음)이면 비스 KEEP', async () => {
    // 붙임「금융서비스」만으로는 exact F「비스」증인(서비스)이 안 생김
    const groups = singleGroup([
      {
        key: '금융서비스',
        variants: ['금융서비스'],
        counts: { 금융서비스: 1 },
        kind: /** @type {const} */ ('single-form'),
        totalCount: 1,
      },
      spacedCluster('비스지출', '비스 지출'),
    ]);
    const out = await filterGroupsByDocSuffixOrphan(groups, [
      { pageNum: 1, text: '금융서비스', textLayout: '금융서비스' },
    ]);
    const keys = out.groups.flatMap((g) => g.clusters.map((c) => c.key));
    expect(keys).toContain('비스지출');
    expect(keys).toContain('금융서비스');
  });

  it('rawByKey에 프로그램만 있어도 로그램 orphan DROP', async () => {
    const groups = singleGroup([
      spacedCluster('로그램지출', '로그램 지출'),
      spacedCluster('경제성장', '경제 성장'),
    ]);
    /** @type {Map<string, { counts: Map<string, number> }>} */
    const rawByKey = new Map([
      [
        '프로그램',
        { counts: new Map([['프로그램', 2]]) },
      ],
      [
        '로그램지출',
        {
          counts: new Map([
            ['로그램 지출', 1],
            ['로그램지출', 1],
          ]),
        },
      ],
    ]);
    const out = await filterGroupsByDocSuffixOrphan(
      groups,
      [{ pageNum: 1, text: 'x', textLayout: 'x' }],
      { rawByKey },
    );
    const keys = out.groups.flatMap((g) => g.clusters.map((c) => c.key));
    expect(keys).not.toContain('로그램지출');
    expect(keys).not.toContain('프로그램지출');
    expect(keys).toContain('경제성장');
  });

  it('발견 증인으로 head-cut 불가하면 KEEP', async () => {
    const groups = singleGroup([spacedCluster('엑스지출', '엑스 지출')]);
    const out = await filterGroupsByDocSuffixOrphan(groups, [
      { pageNum: 1, text: '엑스 지출과 엑스지출만', textLayout: '엑스 지출과 엑스지출만' },
    ]);
    expect(out.groups.flatMap((g) => g.clusters).length).toBe(1);
  });

  it('2차: 증인=1차 목록, 2차 로그램만 orphan DROP', async () => {
    const primary = singleGroup([
      spacedCluster('프로그램지출', '프로그램 지출'),
      spacedCluster('경제성장', '경제 성장'),
    ]);
    const secondary = singleGroup([
      spacedCluster('로그램지출', '로그램 지출'),
      spacedCluster('경제성장', '경제 성장'),
    ]);
    const out = await filterGroupsByDocSuffixOrphan(
      secondary,
      [{ pageNum: 1, text: 'x', textLayout: 'x' }],
      { witnessGroups: [...primary, ...secondary] },
    );
    const keys = out.groups.flatMap((g) => g.clusters.map((c) => c.key));
    expect(keys).not.toContain('로그램지출');
    expect(keys).not.toContain('프로그램지출');
    expect(keys).toContain('경제성장');
    expect(primary[0].clusters.map((c) => c.key)).toContain('프로그램지출');
  });
});
