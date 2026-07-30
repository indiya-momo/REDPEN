import { describe, expect, it } from 'vitest';
import {
  discoverSpacingUnifyCandidates,
  formatUnifyClusterRegisterInput,
  formatUnifySpacingDecisionOverlay,
  buildUnifyCandidatePreviewGroups,
  firstWrongUnifyInstance,
  instancesForUnifyVariant,
  isValidSpacedUnifyVariant,
  isExcludedUnifyCandidateRaw,
  spacedPartIsBareJosa,
  stripTrailingUnifyAffixes,
  normalizeUnifyVariant,
  pickRecommendedUnify,
  prepareUnifyScanText,
  splitUnifyScanLines,
  stripTrailingJosa,
  unifySpacingKey,
} from './unifyCandidateDiscover.js';
import { normalizeSpacingClusters } from './unifyCandidateCollapse.js';

/** discover 후 정규화(공통 접두·짧은 단위 흡수) */
function discoverNormalized(pageTexts) {
  return normalizeSpacingClusters(discoverSpacingUnifyCandidates(pageTexts));
}

describe('splitUnifyScanLines', () => {
  it('줄마다 자르고 줄 경계는 이어 붙이지 않는다', () => {
    expect(splitUnifyScanLines('수도\n있다')).toEqual(['수도', '있다']);
    expect(splitUnifyScanLines('있\n다')).toEqual(['있', '다']);
    expect(splitUnifyScanLines('금융 \n위기')).toEqual(['금융', '위기']);
  });

  it('같은 줄 공백만 한 칸으로 합친다', () => {
    expect(splitUnifyScanLines('금융  위기')).toEqual(['금융 위기']);
  });
});

describe('prepareUnifyScanText', () => {
  it('NFC만 하고 줄바꿈은 유지한다', () => {
    expect(prepareUnifyScanText('수도\n있다')).toBe('수도\n있다');
  });
});

describe('isValidSpacedUnifyVariant', () => {
  it('각 덩어리 한글 2음절 이상만 통과', () => {
    expect(isValidSpacedUnifyVariant('금융 위기')).toBe(true);
    expect(isValidSpacedUnifyVariant('경제 성장')).toBe(true);
    expect(isValidSpacedUnifyVariant('제1차 세계대전')).toBe(true);
  });

  it('1음절·숫자만 덩어리는 탈락', () => {
    expect(isValidSpacedUnifyVariant('있 다')).toBe(false);
    expect(isValidSpacedUnifyVariant('안 되다')).toBe(false);
    expect(isValidSpacedUnifyVariant('1차 세계')).toBe(false);
    expect(isValidSpacedUnifyVariant('2024 년도')).toBe(false);
  });
});

describe('isExcludedUnifyCandidateRaw', () => {
  it('쉼표·조사만 띄운 형태는 true', () => {
    expect(isExcludedUnifyCandidateRaw('개인, 은행')).toBe(true);
    expect(isExcludedUnifyCandidateRaw('경기 에서')).toBe(true);
    expect(spacedPartIsBareJosa('경기 에서')).toBe(true);
  });

  it('어간에 조사가 붙은 형태는 제외하지 않는다(어간 합침)', () => {
    expect(isExcludedUnifyCandidateRaw('경제왕국의')).toBe(false);
    expect(isExcludedUnifyCandidateRaw('경기침체에서')).toBe(false);
    expect(isExcludedUnifyCandidateRaw('개인 소득')).toBe(false);
  });
});

describe('stripTrailingUnifyAffixes', () => {
  it('유틸: 조사·기를 떼면 경기 침체가 된다(파이프라인에서는 미사용)', () => {
    expect(stripTrailingUnifyAffixes('경기 침체에서')).toBe('경기 침체');
    expect(stripTrailingUnifyAffixes('경기침체기')).toBe('경기침체');
    expect(stripTrailingUnifyAffixes('경기 침체나')).toBe('경기 침체');
    expect(stripTrailingUnifyAffixes('경기 침체란')).toBe('경기 침체');
    expect(stripTrailingUnifyAffixes('경기침체기인지')).toBe('경기침체');
  });

  it('끝 기호가 붙은 뉴욕타임스는 기호만 제거한다', () => {
    expect(stripTrailingUnifyAffixes('뉴욕타임스>')).toBe('뉴욕타임스');
    expect(stripTrailingUnifyAffixes('뉴욕 타임스>')).toBe('뉴욕 타임스');
    expect(unifySpacingKey('뉴욕타임스>')).toBe(unifySpacingKey('뉴욕타임스'));
  });

  it('키는 기호만 제거하고 조사·활용은 남긴다', () => {
    expect(unifySpacingKey("경제 왕국'이기")).toBe('경제왕국이기');
    expect(unifySpacingKey("경제왕국'이라")).toBe('경제왕국이라');
    expect(unifySpacingKey('경제 이론들')).toBe('경제이론들');
    expect(unifySpacingKey('경제이론이다')).toBe('경제이론이다');
    expect(unifySpacingKey('경제왕국의')).toBe('경제왕국의');
  });
});

describe('stripTrailingJosa', () => {
  it('유틸: 경제왕국의를 경제왕국으로 만든다(파이프라인에서는 미사용)', () => {
    expect(stripTrailingJosa('경제왕국')).toBe('경제왕국');
    expect(stripTrailingJosa('경제왕국의')).toBe('경제왕국');
    expect(stripTrailingJosa('경제왕국을')).toBe('경제왕국');
  });

  it('띄움형 마지막 어절 조사만 제거한다', () => {
    expect(stripTrailingJosa('경제 왕국의')).toBe('경제 왕국');
  });

  it('어간이 너무 짧으면 조사를 떼지 않는다', () => {
    expect(stripTrailingJosa('나이')).toBe('나이');
  });

  it('4음절 어절에서는 가·이를 떼지 않는다', () => {
    expect(stripTrailingJosa('가치평가')).toBe('가치평가');
    expect(stripTrailingJosa('경제왕국')).toBe('경제왕국');
    expect(stripTrailingUnifyAffixes('가치평가')).toBe('가치평가');
  });
});

describe('normalizeUnifyVariant / unifySpacingKey', () => {
  it('NFC·연속 공백을 한 칸으로 맞춘다', () => {
    expect(normalizeUnifyVariant('경제  성장')).toBe('경제 성장');
    expect(unifySpacingKey('경제  성장')).toBe('경제성장');
    expect(unifySpacingKey('경제성장')).toBe('경제성장');
  });

  it('NFD 한글도 NFC 키로 합친다', () => {
    const nfd = '경제성장'.normalize('NFD');
    expect(unifySpacingKey(nfd)).toBe('경제성장');
    expect(unifySpacingKey(nfd)).toBe(unifySpacingKey('경제성장'));
  });
});

describe('pickRecommendedUnify', () => {
  it('다수형을 고른다', () => {
    expect(
      pickRecommendedUnify([
        { variant: '경제 성장', count: 5 },
        { variant: '경제성장', count: 2 },
      ]),
    ).toBe('경제 성장');
  });

  it('동률이면 붙임(내부 정책)을 고른다', () => {
    expect(
      pickRecommendedUnify([
        { variant: '경제 성장', count: 3 },
        { variant: '경제성장', count: 3 },
      ]),
    ).toBe('경제성장');
  });
});

describe('discoverSpacingUnifyCandidates', () => {
  it('붙임·띄움 이형태를 한 클러스터로 묶는다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      {
        pageNum: 1,
        text: '여기 경제성장 저기 경제 성장 또 경제성장.',
      },
    ]);
    const hit = clusters.find((c) => c.key === '경제성장');
    expect(hit).toBeTruthy();
    expect(hit.variants).toEqual(
      expect.arrayContaining(['경제성장', '경제 성장']),
    );
    expect(hit.counts['경제성장']).toBe(2);
    expect(hit.counts['경제 성장']).toBe(1);
    expect(hit.recommendedUnify).toBe('경제성장');
    expect(hit.occurrencesByVariant['경제 성장']?.length).toBe(1);
    expect(hit.occurrencesByVariant['경제 성장'][0].pageNum).toBe(1);
  });

  it('짧은 단위가 있으면 조사 붙은 긴 키를 흡수한다(조사는 떼지 않음)', () => {
    const clusters = discoverNormalized([
      {
        pageNum: 1,
        text: '경제왕국 경제 왕국 경제왕국의 경제 왕국의',
      },
    ]);
    const hit = clusters.find((c) => c.key === '경제왕국');
    expect(hit).toBeTruthy();
    expect(clusters.find((c) => c.key === '경제왕국의')).toBeUndefined();
    expect(hit.variants).toEqual(
      expect.arrayContaining(['경제왕국', '경제 왕국']),
    );
  });

  it('가치 평가도·평가에 는 가치 평가로 합친다', () => {
    const clusters = discoverNormalized([
      { pageNum: 90, text: '가치 평가에 가치평가에' },
      { pageNum: 114, text: '주식의 가치 평가도 비슷해서 가치평가도' },
    ]);
    expect(clusters.find((c) => c.key === '가치평')).toBeUndefined();
    const hit = clusters.find((c) => c.key === '가치평가');
    expect(hit).toBeTruthy();
    expect(hit.variants).toEqual(
      expect.arrayContaining(['가치평가', '가치 평가']),
    );
    expect(hit.totalCount).toBeGreaterThanOrEqual(4);
  });

  it("경제 왕국'이기·이라 는 공통 접두로 경제 왕국으로 합친다", () => {
    const clusters = discoverNormalized([
      {
        pageNum: 4,
        text: "경제왕국'이라 경제 왕국'이라",
      },
      {
        pageNum: 15,
        text: "경제 왕국'이기 경제왕국'이기",
      },
    ]);
    const hit = clusters.find((c) => c.key === '경제왕국');
    expect(hit).toBeTruthy();
    expect(hit.variants).toEqual(
      expect.arrayContaining(['경제왕국', '경제 왕국']),
    );
    expect(hit.totalCount).toBeGreaterThanOrEqual(4);
  });

  it('경제 이론들·이다 는 공통 접두로 경제 이론으로 합친다', () => {
    const clusters = discoverNormalized([
      { pageNum: 22, text: '경제이론이다 경제 이론이다' },
      { pageNum: 170, text: '경제 이론들 경제이론들' },
    ]);
    const hit = clusters.find((c) => c.key === '경제이론');
    expect(hit).toBeTruthy();
    expect(hit.variants).toEqual(
      expect.arrayContaining(['경제이론', '경제 이론']),
    );
    expect(hit.totalCount).toBeGreaterThanOrEqual(4);
  });

  it('조사만 띄운 경기 에서는 후보에서 뺀다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      {
        pageNum: 1,
        text: '경기에서 경기 에서 경기에서',
      },
    ]);
    expect(clusters.find((c) => c.key === '경기에서')).toBeUndefined();
  });

  it('경기 침체 계열은 짧은 단위 흡수로 경기 침체로 합친다', () => {
    const clusters = discoverNormalized([
      {
        pageNum: 1,
        text:
          '경기침체 경기 침체 경기침체기 경기 침체기 경기침체에서 경기 침체에서 경기침체나 경기 침체나',
      },
    ]);
    const hit = clusters.find((c) => c.key === '경기침체');
    expect(hit).toBeTruthy();
    expect(clusters.filter((c) => c.key.startsWith('경기침체'))).toHaveLength(1);
    expect(hit.variants).toEqual(
      expect.arrayContaining(['경기침체', '경기 침체']),
    );
  });

  it('뉴욕타임스> 는 뉴욕타임스와 한 클러스터로 합친다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      {
        pageNum: 1,
        text: '뉴욕타임스 뉴욕 타임스 뉴욕타임스> 뉴욕 타임스>',
      },
    ]);
    const hit = clusters.find((c) => c.key === '뉴욕타임스');
    expect(hit).toBeTruthy();
    expect(clusters.filter((c) => /뉴욕타임스/.test(c.key))).toHaveLength(1);
    expect(hit.variants.some((v) => v.includes('>'))).toBe(false);
    expect(hit.totalCount).toBe(4);
  });

  it('쉼표가 포함된 개인, 은행·개인,은행은 후보에서 제외한다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      {
        pageNum: 1,
        text: '개인, 은행과 개인,은행, 개인, 은행, 기업 등',
      },
    ]);
    expect(clusters.some((c) => c.key.includes(','))).toBe(false);
    expect(clusters.some((c) => c.variants.some((v) => v.includes(',')))).toBe(
      false,
    );
  });

  it('금융위기·금융 위기를 잡는다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      {
        pageNum: 1,
        text: '금융위기와 금융 위기, 다시 금융위기.',
      },
    ]);
    const hit = clusters.find((c) => c.key === '금융위기');
    expect(hit).toBeTruthy();
    expect(hit.variants).toEqual(
      expect.arrayContaining(['금융위기', '금융 위기']),
    );
    expect(hit.recommendedUnify).toBe('금융위기');
  });

  it('줄바꿈으로 생긴 이형태는 전부 제외한다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      {
        pageNum: 1,
        text: '있다 있\n다 있다\n수도\n있다\n필요가\n있다\n금융위\n기',
      },
    ]);
    expect(clusters.find((c) => c.key === '있다')).toBeUndefined();
    expect(clusters.find((c) => c.key === '수도있다')).toBeUndefined();
    expect(clusters.find((c) => c.key === '필요가있다')).toBeUndefined();
    expect(clusters.find((c) => c.key === '금융위기')).toBeUndefined();
  });

  it('같은 줄의 있 다(1음절)는 후보에서 뺀다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      {
        pageNum: 1,
        text: '있다 있 다 있다',
      },
    ]);
    expect(clusters.find((c) => c.key === '있다')).toBeUndefined();
  });

  it('안되다/안 되다 의미 분기형은 후보에서 뺀다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      {
        pageNum: 1,
        text: '안되다 안 되다 안되다',
      },
    ]);
    expect(clusters.find((c) => c.key === '안되다')).toBeUndefined();
  });

  it('text의 자간 가짜 공백(인플레이 션을)은 textLayout으로 무시한다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      {
        pageNum: 1,
        text: '인플레이션을 언급하고 인플레이 션을 또 언급',
        textLayout: '인플레이션을 언급하고 인플레이션을 또 언급',
      },
    ]);
    expect(clusters.find((c) => c.key === '인플레이션을')).toBeUndefined();
  });

  it('textLayout에 있는 진짜 띄어쓰기 혼재는 잡는다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      {
        pageNum: 1,
        text: '금융위기와 금융 위기 그리고 금융위기',
        textLayout: '금융위기와 금융 위기 그리고 금융위기',
      },
    ]);
    const hit = clusters.find((c) => c.key === '금융위기');
    expect(hit).toBeTruthy();
    expect(hit.variants).toEqual(
      expect.arrayContaining(['금융위기', '금융 위기']),
    );
  });

  it('공백 개수만 다른 표기는 한 variant로 합친다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      {
        pageNum: 1,
        text: '경제 성장 과 경제  성장 그리고 경제성장',
      },
    ]);
    const hit = clusters.find((c) => c.key === '경제성장');
    expect(hit.variants).toHaveLength(2);
    expect(hit.counts['경제 성장']).toBe(2);
  });

  it('결과 클러스터는 추천 통일형 가나다순으로 정렬한다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      {
        pageNum: 1,
        text:
          '노동시장 노동 시장 경제성장 경제 성장 서울시장 서울 시장',
      },
    ]);
    expect(clusters.map((c) => c.recommendedUnify)).toEqual([
      '경제성장',
      '노동시장',
      '서울시장',
    ]);
  });

  it('변형이 하나뿐이면 제외한다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      { pageNum: 1, text: '경제성장 경제성장 경제성장' },
    ]);
    expect(clusters.find((c) => c.key === '경제성장')).toBeUndefined();
  });

  it('제1차세계대전·제1차 세계대전을 일반 규칙으로 묶는다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      {
        pageNum: 1,
        text: '제1차세계대전, 제1차 세계대전, 제1차세계대전',
      },
    ]);
    const hit = clusters.find((c) => c.key === '제1차세계대전');
    expect(hit).toBeTruthy();
    expect(hit.variants).toEqual(
      expect.arrayContaining(['제1차세계대전', '제1차 세계대전']),
    );
    expect(hit.recommendedUnify).toBe('제1차세계대전');
  });
});

describe('formatUnifyClusterRegisterInput', () => {
  it('추천형을 앞에 두고 슬롯 한도만큼 자른다', () => {
    const input = formatUnifyClusterRegisterInput(
      {
        key: 'k',
        variants: ['ab', 'a b', 'x'],
        counts: { ab: 3, 'a b': 2, x: 1 },
        occurrencesByVariant: {},
        recommendedUnify: 'ab',
        totalCount: 6,
      },
      3,
    );
    expect(input).toBe('ab,a b,x');
  });
});

describe('buildUnifyCandidatePreviewGroups', () => {
  it('다수형 칩은 숨기고 소수형·1회만 인스턴스 그룹으로 만든다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      {
        pageNum: 2,
        text: '경제성장 경제 성장 경제성장',
      },
    ]);
    const groups = buildUnifyCandidatePreviewGroups(clusters);
    expect(groups.every((g) => g.find !== '경제성장')).toBe(true);
    const spaced = groups.find((g) => g.find === '경제 성장');
    expect(spaced?.instances?.length).toBe(1);
    expect(spaced?.instances[0].pageNum).toBe(2);
    const cluster = clusters.find((c) => c.key === '경제성장');
    expect(instancesForUnifyVariant(cluster, '경제성장')).toEqual([]);
    expect(instancesForUnifyVariant(cluster, '경제 성장')).toHaveLength(1);
  });

  it('양쪽이 1회면 둘 다 칩을 만든다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      { pageNum: 1, text: '공생관계' },
      { pageNum: 2, text: '공생 관계' },
    ]);
    const cluster = clusters.find((c) => c.key === '공생관계');
    expect(cluster).toBeTruthy();
    expect(instancesForUnifyVariant(cluster, '공생관계')).toHaveLength(1);
    expect(instancesForUnifyVariant(cluster, '공생 관계')).toHaveLength(1);
    const groups = buildUnifyCandidatePreviewGroups(clusters);
    expect(groups.map((g) => g.find).sort()).toEqual(
      ['공생 관계', '공생관계'].sort(),
    );
  });

  it('붙임 선택 시 띄움 인스턴스에 →…^… 오버레이', () => {
    const clusters = discoverSpacingUnifyCandidates([
      { pageNum: 1, text: '조선시대 조선시대 조선 시대' },
    ]);
    const cluster = clusters.find((c) => c.key === '조선시대');
    expect(cluster).toBeTruthy();
    const groups = buildUnifyCandidatePreviewGroups(clusters, {
      registeredByKey: new Map([[cluster.key, '조선시대']]),
    });
    expect(groups.map((g) => g.find)).toEqual(['조선 시대']);
    expect(groups[0].overlayReplace).toBe('→조선^시대');
    expect(formatUnifySpacingDecisionOverlay('조선시대', cluster)).toBe(
      '→조선^시대',
    );
  });

  it('띄움 선택 시 붙임 인스턴스에 →…∨… 오버레이', () => {
    const clusters = discoverSpacingUnifyCandidates([
      { pageNum: 1, text: '조선시대 조선시대 조선 시대' },
    ]);
    const cluster = clusters.find((c) => c.key === '조선시대');
    const groups = buildUnifyCandidatePreviewGroups(clusters, {
      registeredByKey: new Map([[cluster.key, '조선 시대']]),
    });
    expect(groups.map((g) => g.find)).toEqual(['조선시대']);
    expect(groups[0].overlayReplace).toBe('→조선∨시대');
    expect(groups[0].instances?.length).toBe(2);
  });

  it('선택 후 페이지 칩은 틀린 표기만·replace=선택형', () => {
    const clusters = discoverSpacingUnifyCandidates([
      { pageNum: 1, text: '조선시대 조선시대 조선 시대' },
    ]);
    const cluster = clusters.find((c) => c.key === '조선시대');
    expect(
      instancesForUnifyVariant(cluster, '조선시대', {
        chosenVariant: '조선시대',
      }),
    ).toEqual([]);
    const wrong = instancesForUnifyVariant(cluster, '조선 시대', {
      chosenVariant: '조선시대',
    });
    expect(wrong).toHaveLength(1);
    expect(wrong[0].replace).toBe('조선시대');
    expect(firstWrongUnifyInstance(cluster, '조선시대')?.find).toBe(
      '조선 시대',
    );
  });
});
