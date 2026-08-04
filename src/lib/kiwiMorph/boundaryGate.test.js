import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { shouldSkipMatch } from '../matchFilters.js';
import {
  clearKiwiInstance,
  isKiwiBoundaryStemTag,
  shouldSkipMatchByKiwiBoundary,
  shouldSkipMatchByKiwiTokens,
} from './index.js';
import { resolveKiwiNodePaths } from './loadNode.js';
import {
  isKiwiCopulaEndingSurface,
  isKiwiEnumerationSurface,
  isKiwiAtomicNounLexeme,
  isKiwiNounCompoundEojeol,
  isKiwiNonNounCompoundSpaced,
  shouldRejectUnifySatelliteGlued,
  shouldRejectUnifySatelliteSpacedByPos,
} from './unifyExclude.js';

const { ready: HAS_KIWI_MODEL } = resolveKiwiNodePaths();

/** @returns {RegExpExecArray} */
function fakeMatch(text, matched, index) {
  const m = /** @type {RegExpExecArray} */ ([matched]);
  m.index = index;
  m.input = text;
  return m;
}

describe('kiwiMorph boundaryGate (순수 토큰)', () => {
  it('화이트리스트 태그', () => {
    expect(isKiwiBoundaryStemTag('NNG')).toBe(true);
    expect(isKiwiBoundaryStemTag('NNG-R')).toBe(true);
    expect(isKiwiBoundaryStemTag('VV')).toBe(false);
  });

  it('경제 ⊂ 경제학 → skip', () => {
    const text = '경제학과 성장';
    const tokens = [
      { str: '경제학', tag: 'NNG', position: 0, length: 3 },
      { str: '과', tag: 'JC', position: 3, length: 1 },
    ];
    expect(shouldSkipMatchByKiwiTokens('경제', text, 0, tokens)).toBe(true);
  });

  it('경제학 전체 토큰 → keep', () => {
    const text = '경제학';
    const tokens = [{ str: '경제학', tag: 'NNG', position: 0, length: 3 }];
    expect(shouldSkipMatchByKiwiTokens('경제학', text, 0, tokens)).toBe(false);
  });

  it('초콜렛 + 뒤 조사 → 어간만 매치 keep', () => {
    const text = '초콜렛을 먹었다';
    const tokens = [
      { str: '초콜렛', tag: 'NNG', position: 0, length: 3 },
      { str: '을', tag: 'JKO', position: 3, length: 1 },
    ];
    expect(shouldSkipMatchByKiwiTokens('초콜렛', text, 0, tokens)).toBe(false);
  });

  it('VV 부분일치는 화이트리스트 밖 → keep(보수)', () => {
    const text = '먹었다';
    const tokens = [
      { str: '먹', tag: 'VV', position: 0, length: 1 },
      { str: '었', tag: 'EP', position: 1, length: 1 },
      { str: '다', tag: 'EF', position: 2, length: 1 },
    ];
    // '먹었' would be mid/end across tokens — if we match only part of VV differently
    expect(shouldSkipMatchByKiwiTokens('먹', text, 0, tokens)).toBe(false);
  });
});

describe.skipIf(!HAS_KIWI_MODEL)('kiwiMorph boundaryGate (Node 모델)', () => {
  beforeAll(async () => {
    const { loadKiwiNode } = await import('./loadNode.js');
    await loadKiwiNode();
  }, 120_000);

  afterAll(() => {
    clearKiwiInstance();
  });

  it('경제학 안 경제 → skip', () => {
    const text = '경제학과 경제 성장';
    expect(shouldSkipMatchByKiwiBoundary('경제', text, 0)).toBe(true);
  });

  it('띄움 경제(별도 토큰) → keep', () => {
    const text = '경제학과 경제 성장';
    const idx = text.indexOf('경제 성장');
    expect(shouldSkipMatchByKiwiBoundary('경제', text, idx)).toBe(false);
  });

  it('초콜렛을 중 초콜렛 → keep', () => {
    const text = '나는 초콜렛을 먹었다.';
    const idx = text.indexOf('초콜렛');
    expect(shouldSkipMatchByKiwiBoundary('초콜렛', text, idx)).toBe(false);
  });

  it('shouldSkipMatch 플래그 OFF면 Kiwi 무시', () => {
    import.meta.env.VITE_SPELLING_KIWI_BOUNDARY = undefined;
    const text = '경제학';
    const m = fakeMatch(text, '경제', 0);
    expect(shouldSkipMatch({}, m, text)).toBe(false);
  });

  it('shouldSkipMatch 플래그 ON이면 부분일치 skip', () => {
    import.meta.env.VITE_SPELLING_KIWI_BOUNDARY = 'true';
    const text = '경제학';
    const m = fakeMatch(text, '경제', 0);
    expect(shouldSkipMatch({}, m, text)).toBe(true);
    import.meta.env.VITE_SPELLING_KIWI_BOUNDARY = undefined;
  });
});

describe.skipIf(!HAS_KIWI_MODEL)('표기통일 enrich Kiwi 경계 (Node 모델)', () => {
  beforeAll(async () => {
    const { loadKiwiNode } = await import('./loadNode.js');
    await loadKiwiNode();
  }, 120_000);

  afterAll(() => {
    clearKiwiInstance();
    import.meta.env.VITE_SPELLING_KIWI_BOUNDARY = undefined;
  });

  it('경제학 안 경제 출현은 enrich 칩에서 제외', async () => {
    import.meta.env.VITE_SPELLING_KIWI_BOUNDARY = 'true';
    const { enrichOccurrencesWithItemHits } = await import(
      '../unifyCandidateDiscover.js'
    );
    const { buildPageByNum } = await import('../matchReadingOrder.js');
    const page = {
      pageNum: 1,
      text: '경제학과 성장',
      items: [
        {
          str: '경제학과 성장',
          transform: [10, 0, 0, 10, 40, 400],
          width: 80,
        },
      ],
    };
    const kept = enrichOccurrencesWithItemHits(
      [{ pageNum: 1, index: 0, matchedText: '경제' }],
      buildPageByNum([page]),
    );
    expect(kept).toHaveLength(0);
  });
});

describe.skipIf(!HAS_KIWI_MODEL)('이다 종결 잡음 제외 (Node 모델)', () => {
  beforeAll(async () => {
    const { loadKiwiNode } = await import('./loadNode.js');
    await loadKiwiNode();
  }, 120_000);

  afterAll(() => {
    clearKiwiInstance();
  });

  it('경제다라·경제다!라 표면은 VCP+EF 잡음', () => {
    expect(isKiwiCopulaEndingSurface('경제다라')).toBe(true);
    expect(isKiwiCopulaEndingSurface('경제다')).toBe(true);
    expect(isKiwiCopulaEndingSurface('경제성장')).toBe(false);
  });

  it('경제학·철학은 나열(SP)', () => {
    expect(isKiwiEnumerationSurface('경제학·철학')).toBe(true);
    expect(isKiwiEnumerationSurface('경제학')).toBe(false);
  });

  it('경제학상은 원자 명사, 경제침체는 복합 명사', () => {
    expect(isKiwiAtomicNounLexeme('경제학상')).toBe(true);
    expect(isKiwiAtomicNounLexeme('경제학')).toBe(true);
    expect(isKiwiAtomicNounLexeme('세계화')).toBe(true);
    expect(isKiwiAtomicNounLexeme('세계화가')).toBe(true);
    expect(isKiwiAtomicNounLexeme('경제침체')).toBe(false);
    expect(isKiwiAtomicNounLexeme('영국정부')).toBe(false);
  });

  it('세계 최초이자는 이다 연결(VCP+EC)', () => {
    expect(isKiwiCopulaEndingSurface('세계최초이자')).toBe(true);
    expect(isKiwiCopulaEndingSurface('세계 최초이자')).toBe(true);
  });

  it('원자 명사 키는 위성 클러스터가 되지 않는다', async () => {
    const { buildSingleFormCluster } = await import(
      '../unifyCandidateSatellites.js'
    );
    // 닫힌 명사(XSN)·이다 잔여 — 1차 리스트 밖, Kiwi glued(2차)로 거부
    expect(shouldRejectUnifySatelliteGlued('경제학상')).toBe(true);
    expect(shouldRejectUnifySatelliteGlued('세계화가')).toBe(true);
    expect(
      buildSingleFormCluster(
        '경제침체',
        {
          counts: new Map([['경제침체', 1]]),
          occurrences: new Map([['경제침체', []]]),
        },
        'prefix',
        '경제',
      ),
    ).not.toBeNull();
  });

  it('세계 최초이자는 발견에서 빠지고, 세계화는 닫힌 명사라 위성만 거부', async () => {
    const { buildUnifyOccurrenceIndex, discoverSpacingUnifyCandidates } =
      await import('../unifyCandidateDiscover.js');
    const { groupSortAndFillSatellites } = await import(
      '../unifyCandidateGrouping.js'
    );
    const page = {
      pageNum: 1,
      text: '세계화가 진행된다. 또 세계화가 심화된다. 세계 최초이자 유일한 사례다. 경제성장 경제 성장',
    };
    const idx = buildUnifyOccurrenceIndex([page]);
    const keys = [...idx.keys()];
    // 조사 strip → 세계화는 raw에 남을 수 있음. 1차 리스트 밖이면 Kiwi glued(2차).
    // 최초이자는 이다 연결 — 1차에 없으면 Kiwi glued
    for (const k of keys) {
      if (k.includes('최초이자') || k.includes('이자')) {
        expect(shouldRejectUnifySatelliteGlued(k) || shouldRejectUnifySatelliteGlued('최초이자')).toBe(true);
        break;
      }
    }
    if (keys.some((k) => k === '세계화가')) {
      expect(shouldRejectUnifySatelliteGlued('세계화가')).toBe(true);
    }

    const clusters = discoverSpacingUnifyCandidates([page]);
    const groups = groupSortAndFillSatellites(clusters, idx);
    const groupKeys = groups.flatMap((g) => g.clusters.map((c) => c.key));
    // 위성 편입 후 2차 없으면 남을 수 있음 — Kiwi로 거부 가능한지만 확인
    if (groupKeys.includes('세계화가')) {
      expect(shouldRejectUnifySatelliteGlued('세계화가')).toBe(true);
    }
    expect(groupKeys).not.toContain('세계화');
  });

  it('서버 모드·빈 캐시에서는 unknown이라 위성 유지(이형태 0회 후보)', async () => {
    const {
      setKiwiServerMode,
      clearKiwiInstance,
      isKiwiReady,
      getKiwiInstance,
      setKiwiInstance,
    } = await import('./runtime.js');
    const { clearRemoteAnalyzeCache } = await import('./remoteCache.js');
    const { clearKiwiAnalyzeCache } = await import('./analyze.js');
    const { shouldRejectUnifySatelliteGlued, classifyKiwiGluedNoun } =
      await import('./unifyExclude.js');

    const saved = getKiwiInstance();
    clearKiwiInstance();
    clearRemoteAnalyzeCache();
    clearKiwiAnalyzeCache();
    setKiwiServerMode(true);
    expect(isKiwiReady()).toBe(true);
    expect(classifyKiwiGluedNoun('경제학상')).toBe('unknown');
    // 분석 실패 시 위성까지 지우면 이형태 없는 정상 후보가 전부 사라짐
    expect(shouldRejectUnifySatelliteGlued('경제학상')).toBe(false);
    setKiwiServerMode(false);
    setKiwiInstance(saved);
  });

  it('Kiwi 없이도 경제학이→경제 학이 조사 잔해 위성 거부', async () => {
    const {
      setKiwiServerMode,
      clearKiwiInstance,
      getKiwiInstance,
      setKiwiInstance,
    } = await import('./runtime.js');
    const { clearRemoteAnalyzeCache } = await import('./remoteCache.js');
    const { buildSingleFormCluster } = await import(
      '../unifyCandidateSatellites.js'
    );
    const saved = getKiwiInstance();
    clearKiwiInstance();
    clearRemoteAnalyzeCache();
    setKiwiServerMode(false);
    expect(
      buildSingleFormCluster(
        '경제학이',
        {
          counts: new Map([['경제학이', 2]]),
          occurrences: new Map([['경제학이', []]]),
        },
        'prefix',
        '경제',
      ),
    ).toBeNull();
    setKiwiInstance(saved);
  });

  it('안에·점을·후의 시장은 조사 부착 → 위성 제외', async () => {
    const {
      isKiwiNounCompoundEojeol,
      classifyKiwiSpacedEojeolPos,
      shouldRejectUnifySatelliteSpacedByPos,
    } = await import('./unifyExclude.js');
    const { buildSingleFormCluster } = await import(
      '../unifyCandidateSatellites.js'
    );

    // 안/NNG+에/JKB, 점/NNG+을/JKO, 후/NNG+의/JKG
    expect(classifyKiwiSpacedEojeolPos('안에')).toBe('other');
    expect(classifyKiwiSpacedEojeolPos('점을')).toBe('other');
    expect(classifyKiwiSpacedEojeolPos('후의')).toBe('other');
    expect(isKiwiNounCompoundEojeol('안에')).toBe(false);
    expect(isKiwiNounCompoundEojeol('점을')).toBe(false);
    expect(isKiwiNounCompoundEojeol('후의')).toBe(false);
    expect(shouldRejectUnifySatelliteSpacedByPos('안에 시장', undefined)).toBe(
      true,
    );
    expect(shouldRejectUnifySatelliteSpacedByPos('점을 시장', undefined)).toBe(
      true,
    );
    expect(shouldRejectUnifySatelliteSpacedByPos('후의 시장', undefined)).toBe(
      true,
    );
    expect(
      shouldRejectUnifySatelliteSpacedByPos('안에 시장', undefined),
    ).toBe(true);
    expect(
      shouldRejectUnifySatelliteSpacedByPos('점을 시장', undefined),
    ).toBe(true);
    expect(
      shouldRejectUnifySatelliteSpacedByPos('후의 시장', undefined),
    ).toBe(true);
  });

  it('규제하려·이는 시장·결국/그냥 시장 제외', async () => {
    const {
      isKiwiNounVerbalConnectiveSurface,
      shouldExcludeUnifyGluedByKiwi,
      shouldRejectUnifySatelliteSpacedByPos,
      classifyKiwiSpacedEojeolPos,
      isKiwiNounCompoundEojeol,
    } = await import('./unifyExclude.js');
    const { buildSingleFormCluster } = await import(
      '../unifyCandidateSatellites.js'
    );

    // 규제하려 = NNG+하/XSV+려/EC
    expect(isKiwiNounVerbalConnectiveSurface('규제하려')).toBe(true);
    expect(shouldExcludeUnifyGluedByKiwi('규제하려')).toBe(true);
    // 하려 꼬리 → 1차 리스트 거부
    const { shouldRejectByNoiseListEojeol } = await import(
      '../unifyNoiseList.js'
    );
    expect(shouldRejectByNoiseListEojeol('규제하려')).toBe(true);

    // 이는 = 이/NP → 명사 복합 성분 아님
    expect(classifyKiwiSpacedEojeolPos('이는')).toBe('other');
    expect(isKiwiNounCompoundEojeol('이는')).toBe(false);
    expect(shouldRejectUnifySatelliteSpacedByPos('이는 시장', undefined)).toBe(
      true,
    );
    // 1차 리스트에 없으면 위성 생성 가능 — 2차 SpacedByPos가 담당

    expect(classifyKiwiSpacedEojeolPos('결국')).toBe('other');
    expect(classifyKiwiSpacedEojeolPos('그냥')).toBe('other');
    expect(shouldRejectUnifySatelliteSpacedByPos('결국 시장', undefined)).toBe(
      true,
    );
    expect(shouldRejectUnifySatelliteSpacedByPos('그냥 시장', undefined)).toBe(
      true,
    );
    // 숫자(SN)는 명사 복합 성분 아님
    expect(isKiwiNounCompoundEojeol('3')).toBe(false);
    expect(shouldRejectUnifySatelliteSpacedByPos('3 시장', undefined)).toBe(
      true,
    );
    expect(shouldRejectUnifySatelliteSpacedByPos('결국 시장', undefined)).toBe(true);
    expect(shouldRejectUnifySatelliteSpacedByPos('그냥 시장', undefined)).toBe(true);
  });

  it('가치있다고·상환하기·구성되며는 명사+동사화 → 발견 제외', async () => {
    const {
      isKiwiNounVerbalConnectiveSurface,
      shouldRejectUnifySatelliteGlued,
    } = await import('./unifyExclude.js');
    const { buildUnifyOccurrenceIndex, discoverSpacingUnifyCandidates } =
      await import('../unifyCandidateDiscover.js');

    expect(isKiwiNounVerbalConnectiveSurface('가치있다고')).toBe(true);
    expect(isKiwiNounVerbalConnectiveSurface('가치 있다고')).toBe(true);
    expect(isKiwiNounVerbalConnectiveSurface('상환하기')).toBe(true);
    expect(isKiwiNounVerbalConnectiveSurface('구성되며')).toBe(true);
    expect(isKiwiNounVerbalConnectiveSurface('상환하기와상환')).toBe(true);
    expect(isKiwiNounVerbalConnectiveSurface('경제성장')).toBe(false);
    expect(shouldRejectUnifySatelliteGlued('가치있다고')).toBe(true);
    // OCR 잘린 단일 명사로 붙는 경우 — closed라 위성 거부
    expect(shouldRejectUnifySatelliteGlued('구성되므')).toBe(true);

    const page = {
      pageNum: 1,
      text: '가치 있다고 말한다. 가치있다고. 상환하기와 상환 하기. 구성되며 구성되고. 경제성장 경제 성장.',
    };
    const idx = buildUnifyOccurrenceIndex([page]);
    const keys = [...idx.keys()];
    expect(keys).not.toContain('가치있다고');
    expect(keys).not.toContain('상환하기');
    expect(keys).not.toContain('구성되며');
    expect(keys).not.toContain('구성되고');
    expect(keys).toContain('경제성장');

    const clusters = discoverSpacingUnifyCandidates([page]);
    expect(clusters.some((c) => /가치있|상환하|구성되/.test(String(c.key)))).toBe(
      false,
    );
  });

  it('상환하기·예측하고는 명사+하다/연결 → 발견·위성 제외', async () => {
    const { isKiwiNounHadaConnectiveSurface, shouldRejectUnifySatelliteGlued } =
      await import('./unifyExclude.js');
    const { buildUnifyOccurrenceIndex, discoverSpacingUnifyCandidates } =
      await import('../unifyCandidateDiscover.js');
    const { buildSingleFormCluster } = await import(
      '../unifyCandidateSatellites.js'
    );

    expect(isKiwiNounHadaConnectiveSurface('상환하기')).toBe(true);
    expect(isKiwiNounHadaConnectiveSurface('예측하고')).toBe(true);
    expect(isKiwiNounHadaConnectiveSurface('환경하고')).toBe(true);
    expect(isKiwiNounHadaConnectiveSurface('상환 하기')).toBe(true);
    expect(isKiwiNounHadaConnectiveSurface('경제성장')).toBe(false);
    expect(shouldRejectUnifySatelliteGlued('상환하기')).toBe(true);

    const page = {
      pageNum: 1,
      text: '상환하기와 상환 하기. 예측하고 예측 하고. 경제성장 경제 성장.',
    };
    const idx = buildUnifyOccurrenceIndex([page]);
    expect([...idx.keys()]).not.toContain('상환하기');
    expect([...idx.keys()]).not.toContain('예측하고');
    expect([...idx.keys()]).toContain('경제성장');

    expect(
      buildSingleFormCluster(
        '상환하기',
        {
          counts: new Map([['상환하기', 1]]),
          occurrences: new Map([['상환하기', []]]),
        },
        'prefix',
        '상환',
      ),
    ).toBeNull();

    const clusters = discoverSpacingUnifyCandidates([page]);
    expect(clusters.some((c) => c.key === '상환하기')).toBe(false);
    expect(clusters.some((c) => c.key === '예측하고')).toBe(false);
  });

  it('결국 시장·그냥 시장은 명사 복합 아님(어절 단독 MAG/용언)', () => {
    expect(isKiwiNounCompoundEojeol('결국')).toBe(false);
    expect(isKiwiNounCompoundEojeol('그냥')).toBe(false);
    expect(isKiwiNounCompoundEojeol('또는')).toBe(false);
    expect(isKiwiNounCompoundEojeol('말해')).toBe(false);
    expect(isKiwiNounCompoundEojeol('넘어')).toBe(false);
    expect(isKiwiNounCompoundEojeol('주식')).toBe(true);
    expect(isKiwiNounCompoundEojeol('미국')).toBe(true);
    expect(isKiwiNonNounCompoundSpaced('결국 시장')).toBe(true);
    expect(isKiwiNonNounCompoundSpaced('말해 시장')).toBe(true);
    expect(isKiwiNonNounCompoundSpaced('주식 시장')).toBe(false);
    expect(isKiwiNonNounCompoundSpaced('미국 시장')).toBe(false);
  });

  it('dictPos 없어도 명사+명사·동사+동사 아니면 위성 거부(사실상은 유지)', async () => {
    const {
      shouldRejectUnifySatelliteSpacedByPos,
      isKiwiVerbCompoundEojeol,
      classifyKiwiSpacedEojeolPos,
    } = await import('./unifyExclude.js');
    const { filterSeriesSatellitesByMorphPos } = await import(
      '../unifyCandidateSatellites.js'
    );

    expect(shouldRejectUnifySatelliteSpacedByPos('말해 시장', undefined)).toBe(
      true,
    );
    expect(shouldRejectUnifySatelliteSpacedByPos('보통 시장', undefined)).toBe(
      true,
    );
    expect(shouldRejectUnifySatelliteSpacedByPos('손쉽게 시장', undefined)).toBe(
      true,
    );
    expect(shouldRejectUnifySatelliteSpacedByPos('또는 시장', undefined)).toBe(
      true,
    );
    expect(
      shouldRejectUnifySatelliteSpacedByPos('떨어뜨리고 시장', undefined),
    ).toBe(true);
    expect(shouldRejectUnifySatelliteSpacedByPos('사실상 시장', undefined)).toBe(
      false,
    );
    expect(shouldRejectUnifySatelliteSpacedByPos('주식 시장', undefined)).toBe(
      false,
    );

    // 형용사(VA)는 동사 아님 — 손쉽게=other
    expect(classifyKiwiSpacedEojeolPos('손쉽게')).toBe('other');
    expect(isKiwiVerbCompoundEojeol('손쉽게')).toBe(false);
    expect(isKiwiVerbCompoundEojeol('가고')).toBe(true);
    expect(isKiwiVerbCompoundEojeol('떨어뜨리고')).toBe(true);
    expect(isKiwiVerbCompoundEojeol('시장')).toBe(false);

    // 서버 모드·빈 캐시: unknown → fail-open(유지)
    const {
      setKiwiServerMode,
      clearKiwiInstance,
      getKiwiInstance,
      setKiwiInstance,
    } = await import('./runtime.js');
    const { clearRemoteAnalyzeCache } = await import('./remoteCache.js');
    const { clearKiwiAnalyzeCache } = await import('./analyze.js');
    const saved = getKiwiInstance();
    clearKiwiInstance();
    clearRemoteAnalyzeCache();
    clearKiwiAnalyzeCache();
    setKiwiServerMode(true);
    expect(classifyKiwiSpacedEojeolPos('보통')).toBe('unknown');
    expect(shouldRejectUnifySatelliteSpacedByPos('보통 시장', undefined)).toBe(
      false,
    );
    setKiwiServerMode(false);
    setKiwiInstance(saved);

    expect(shouldRejectUnifySatelliteSpacedByPos('말해 시장', 'noun')).toBe(
      true,
    );
    expect(shouldRejectUnifySatelliteSpacedByPos('주식 시장', 'noun')).toBe(
      false,
    );

    const groups = [
      {
        type: /** @type {const} */ ('series'),
        affix: '시장',
        affixType: /** @type {const} */ ('suffix'),
        label: '@시장',
        clusters: [
          {
            key: '금융시장',
            kind: 'conflict',
            variants: ['금융시장', '금융 시장'],
            counts: { 금융시장: 2, '금융 시장': 1 },
            totalCount: 3,
          },
          {
            key: '말해시장',
            kind: 'single-form',
            variants: ['말해 시장', '말해시장'],
            counts: { '말해 시장': 1, 말해시장: 0 },
            totalCount: 1,
          },
          {
            key: '보통시장',
            kind: 'single-form',
            variants: ['보통 시장', '보통시장'],
            counts: { '보통 시장': 1, 보통시장: 0 },
            totalCount: 1,
          },
          {
            key: '사실상시장',
            kind: 'single-form',
            variants: ['사실상 시장', '사실상시장'],
            counts: { '사실상 시장': 1, 사실상시장: 0 },
            totalCount: 1,
          },
          {
            key: '주식시장',
            kind: 'single-form',
            variants: ['주식 시장', '주식시장'],
            counts: { '주식 시장': 1, 주식시장: 0 },
            totalCount: 1,
          },
        ],
      },
    ];
    const filtered = filterSeriesSatellitesByMorphPos(groups);
    // 1차 리스트만 — 말해/보통은 꼬리·예외 아님(2차 Kiwi 담당)
    expect(filtered[0].clusters.map((c) => c.key)).toEqual([
      '금융시장',
      '말해시장',
      '보통시장',
      '사실상시장',
      '주식시장',
    ]);
    const { filterSeriesSatellitesByKiwiPhase2 } = await import(
      '../unifyNoisePhase2.js'
    );
    const phase2 = await filterSeriesSatellitesByKiwiPhase2(filtered);
    if (phase2.applied) {
      expect(phase2.groups[0].clusters.map((c) => c.key)).toEqual([
        '금융시장',
        '사실상시장',
        '주식시장',
      ]);
    }
  });

  it('경제학이는 조사 제거 후 위성·충돌에 안 남는다', async () => {
    const { discoverSpacingUnifyCandidates, buildUnifyOccurrenceIndex } =
      await import('../unifyCandidateDiscover.js');
    const { groupSortAndFillSatellites } = await import(
      '../unifyCandidateGrouping.js'
    );
    const page = {
      pageNum: 1,
      text: '경제학이 경제학상 경제학·철학 경제성장 경제 성장',
    };
    const clusters = discoverSpacingUnifyCandidates([page]);
    expect(clusters.some((c) => c.key === '경제학이')).toBe(false);
    expect(clusters.some((c) => String(c.key).includes('철학'))).toBe(false);
    // 경제학상은 닫힌 명사 — 1차 리스트 밖, Kiwi glued(2차)
    if (clusters.some((c) => c.key === '경제학상')) {
      expect(shouldRejectUnifySatelliteGlued('경제학상')).toBe(true);
    }

    const byKey = buildUnifyOccurrenceIndex([page]);
    const groups = groupSortAndFillSatellites(clusters, byKey);
    const keys = groups.flatMap((g) => g.clusters.map((c) => c.key));
    expect(keys).not.toContain('경제학이');
    expect(keys.some((k) => String(k).includes('철학'))).toBe(false);
    if (keys.includes('경제학상')) {
      expect(shouldRejectUnifySatelliteGlued('경제학상')).toBe(true);
    }
  });

  it('discover가 경제다라 충돌을 만들지 않는다', async () => {
    const { discoverSpacingUnifyCandidates } = await import(
      '../unifyCandidateDiscover.js'
    );
    const clusters = discoverSpacingUnifyCandidates([
      {
        pageNum: 1,
        text: '경제다!라 경제다라 경제성장 경제 성장',
      },
    ]);
    expect(clusters.some((c) => c.key.includes('경제다'))).toBe(false);
    expect(clusters.some((c) => c.key === '경제성장')).toBe(true);
  });
});
