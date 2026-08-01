import { describe, expect, it } from 'vitest';
import { buildPageByNum } from './matchReadingOrder.js';
import {
  discoverSpacingUnifyCandidates,
  formatUnifyClusterRegisterInput,
  formatUnifySpacingDecisionOverlay,
  buildUnifyCandidatePreviewGroups,
  buildUnifyOccurrenceIndex,
  firstWrongUnifyInstance,
  instancesForUnifyVariant,
  isValidSpacedUnifyVariant,
  isExcludedUnifyCandidateRaw,
  mapLayoutIndexToVisualIndex,
  assignUniqueUnifyHighlightIndices,
  enrichOccurrencesWithItemHits,
  collectUnifyPhraseStarts,
  spacedPartIsBareJosa,
  stripTrailingUnifyAffixes,
  normalizeUnifyVariant,
  pickRecommendedUnify,
  prepareUnifyScanText,
  resolveHighlightIndex,
  splitUnifyScanLines,
  stripTrailingJosa,
  stripUnifyPeripheralDigits,
  unifySpacingKey,
  mergeUnifyHangulSoftWrapScanLines,
} from './unifyCandidateDiscover.js';
import { normalizeSpacingClusters } from './unifyCandidateCollapse.js';
import { highlightRangeForSpelling } from './pdfHighlightRange.js';
import { buildPageText } from './pdfPageText.js';

/** discover 후 정규화(공통 접두·짧은 단위 흡수) */
function discoverNormalized(pageTexts) {
  return normalizeSpacingClusters(discoverSpacingUnifyCandidates(pageTexts));
}

describe('stripUnifyPeripheralDigits', () => {
  it('앞 숫자 어절·붙임 숫자를 떼어 노동시장으로 만든다', () => {
    expect(stripUnifyPeripheralDigits('174 노동 시장')).toBe('노동 시장');
    expect(stripUnifyPeripheralDigits('174노동시장')).toBe('노동시장');
    expect(stripUnifyPeripheralDigits('노동시장175')).toBe('노동시장');
  });

  it('남은 한글이 짧으면 앞 숫자를 유지한다', () => {
    expect(stripUnifyPeripheralDigits('2024년')).toBe('2024년');
  });
});

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

describe('mergeUnifyHangulSoftWrapScanLines', () => {
  it('단어 중간 soft-wrap(명|지 계곡)만 잇고 어절 경계는 유지한다', () => {
    const lines = [
      {
        line: '우리 나라에는 명',
        absIndex: (i) => i,
      },
      {
        line: '지 계곡 외에도 영월',
        absIndex: (i) => 100 + i,
      },
      {
        line: '수도',
        absIndex: (i) => 200 + i,
      },
      {
        line: '있다',
        absIndex: (i) => 300 + i,
      },
    ];
    const merged = mergeUnifyHangulSoftWrapScanLines(lines);
    expect(merged.map((l) => l.line)).toEqual([
      '우리 나라에는 명지 계곡 외에도 영월',
      '수도',
      '있다',
    ]);
    expect(merged[0].line.includes('명지 계곡')).toBe(true);
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
  it('유틸: 경제왕국의를 경제왕국으로 만든다(스캔 키에도 사용)', () => {
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

describe('resolveHighlightIndex / 같은 페이지 다중 출현', () => {
  it('preferNear에 가까운 출현을 고른다 (첫 indexOf 고정 금지)', () => {
    const text = 'AAA 고상 가옥 BBB 고상 가옥 CCC';
    const first = text.indexOf('고상 가옥');
    const second = text.indexOf('고상 가옥', first + 1);
    expect(resolveHighlightIndex(text, '고상 가옥', first)).toBe(first);
    expect(resolveHighlightIndex(text, '고상 가옥', second)).toBe(second);
  });

  it('한 페이지에 같은 띄움 표기가 두 번이면 occurrence index가 서로 다르다', () => {
    const text = [
      '열대 기후에서는 고상 가옥을 짓는다.',
      '한대 기후 지역에서도 고상 가옥을 짓는다.',
    ].join('\n');
    const byKey = buildUnifyOccurrenceIndex([{ pageNum: 22, text }]);
    const acc = byKey.get('고상가옥');
    expect(acc).toBeTruthy();
    const spaced = [...(acc.occurrences.get('고상 가옥') ?? [])];
    expect(spaced.length).toBeGreaterThanOrEqual(2);
    const indices = spaced.map((o) => o.index);
    expect(new Set(indices).size).toBe(indices.length);
    expect(indices[0]).not.toBe(indices[1]);

    const pageData = { text, itemRefs: [], items: [] };
    const r0 = highlightRangeForSpelling(pageData, {
      index: indices[0],
      matchedText: spaced[0].matchedText,
    });
    const r1 = highlightRangeForSpelling(pageData, {
      index: indices[1],
      matchedText: spaced[1].matchedText,
    });
    expect(r0?.start).toBe(indices[0]);
    expect(r1?.start).toBe(indices[1]);
    expect(r0?.start).not.toBe(r1?.start);
  });

  it('지도처럼 가로로 먼 라벨은 녹아내림강수량 이형태로 묶지 않는다', () => {
    const font = 11;
    /** @param {{ str: string, x: number, w?: number }[]} parts @param {number} y */
    function items(parts, y) {
      return parts.map((p) => ({
        str: p.str,
        transform: [font, 0, 0, font, p.x, y],
        width: p.w ?? p.str.length * font * 0.48,
      }));
    }
    const pageItems = [
      ...items([{ str: '빙하', x: 80, w: 28 }, { str: '녹아내림', x: 112, w: 48 }], 400),
      ...items([{ str: '강수량', x: 320, w: 40 }, { str: '증가', x: 364, w: 28 }], 398),
    ];
    const { text, textLayout } = buildPageText(pageItems);
    const clusters = discoverSpacingUnifyCandidates([
      { pageNum: 5, text, textLayout },
    ]);
    expect(clusters.some((c) => c.key === '녹아내림강수량')).toBe(false);
    expect(text).not.toMatch(/녹아내림강수량/);
    expect(text.includes('녹아내림 강수량')).toBe(false);
  });
});

describe('unify_should_not_cross_visual_line_boundary', () => {
  it('시각 줄로 나뉜 시간적/관점은 시간적관점 후보가 없다', () => {
    const visualText = '(1) 시간적\n관점\n';
    const clusters = discoverSpacingUnifyCandidates([
      { pageNum: 4, text: visualText, textLayout: visualText },
    ]);
    expect(clusters.some((c) => c.key === '시간적관점')).toBe(false);
    expect(
      clusters.some((c) => (c.variants ?? []).includes('시간적관점')),
    ).toBe(false);
  });

  it('buildPageText 목록 들여쓰기 줄도 시간적관점으로 묶지 않는다', () => {
    const font = 12;
    function line(parts, y) {
      return parts.map((p) => ({
        str: p.str,
        transform: [font, 0, 0, font, p.x, y],
        width: p.w ?? p.str.length * font * 0.5,
      }));
    }
    const { text, textLayout, visualText } = buildPageText([
      ...line([{ str: '(1) 시간적', x: 48, w: 72 }], 220),
      ...line([{ str: '관점', x: 78, w: 28 }], 205),
    ]);
    expect(visualText).toBe(text);
    expect(text).toMatch(/시간적\n관점/);
    const clusters = discoverSpacingUnifyCandidates([
      { pageNum: 4, text, textLayout },
    ]);
    expect(clusters.some((c) => c.key === '시간적관점')).toBe(false);
  });

  it('동해/태평양 줄 분리는 동해태평양 후보가 없다', () => {
    const visualText = '동해\n태평양\n동해 태평양\n';
    const clusters = discoverSpacingUnifyCandidates([
      { pageNum: 22, text: visualText, textLayout: visualText },
    ]);
    // 띄움만 있으면 붙임 이형태가 없어 클러스터 자체가 안 생기거나,
    // 붙임형이 줄 경계로 만들어지지 않는다.
    expect(clusters.some((c) => c.key === '동해태평양')).toBe(false);
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

  it('조사만 다른 붉은 표시가·붉은표시를 은 같은 후보로 묶는다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      {
        pageNum: 1,
        textLayout: '붉은 표시가 나타난다. 다른 문장. 붉은표시를 본다.',
      },
    ]);
    const hit = clusters.find((c) => c.key === '붉은표시');
    expect(hit).toBeTruthy();
    expect(hit.variants).toEqual(
      expect.arrayContaining(['붉은표시', '붉은 표시']),
    );
  });

  it('줄번호·각주 숫자가 붙어도 노동시장은 한 후보로 합친다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      {
        pageNum: 20,
        textLayout: '174 노동 시장 구조를 본다. 174노동시장도 있다.',
      },
      {
        pageNum: 21,
        textLayout: '175 노동 시장을 말한다. 175노동시장을 본다.',
      },
    ]);
    const hits = clusters.filter((c) => c.key === '노동시장');
    expect(hits).toHaveLength(1);
    expect(hits[0].variants).toEqual(
      expect.arrayContaining(['노동시장', '노동 시장']),
    );
    expect(hits[0].totalCount).toBeGreaterThanOrEqual(4);
    expect(clusters.some((c) => c.key.startsWith('174'))).toBe(false);
    expect(clusters.some((c) => c.key.startsWith('175'))).toBe(false);
  });

  it('5토큰 이상 합성어도 붙임·띄움 이형태를 잡는다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      {
        pageNum: 1,
        textLayout:
          '남북한경제협력사업 추진과 남북한 경제 협력 사업 검토',
      },
    ]);
    const hit = clusters.find((c) => c.key === '남북한경제협력사업');
    expect(hit).toBeTruthy();
    expect(hit.variants).toEqual(
      expect.arrayContaining(['남북한경제협력사업', '남북한 경제 협력 사업']),
    );
  });

  it('짧은 단위가 있으면 조사 붙은 긴 키를 흡수한다', () => {
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
  it('다수형·소수형 모두 인스턴스 그룹으로 만든다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      {
        pageNum: 2,
        text: '경제성장 경제 성장 경제성장',
      },
    ]);
    const groups = buildUnifyCandidatePreviewGroups(clusters);
    expect(groups.map((g) => g.find).sort()).toEqual(
      ['경제 성장', '경제성장'].sort(),
    );
    const glued = groups.find((g) => g.find === '경제성장');
    const spaced = groups.find((g) => g.find === '경제 성장');
    expect(glued?.instances?.length).toBe(2);
    expect(spaced?.instances?.length).toBe(1);
    const cluster = clusters.find((c) => c.key === '경제성장');
    expect(instancesForUnifyVariant(cluster, '경제성장')).toHaveLength(2);
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

  it('선택 후에도 통일형·틀린 표기 모두 페이지 칩을 만든다', () => {
    const clusters = discoverSpacingUnifyCandidates([
      { pageNum: 1, text: '조선시대 조선시대 조선 시대' },
    ]);
    const cluster = clusters.find((c) => c.key === '조선시대');
    const chosen = instancesForUnifyVariant(cluster, '조선시대', {
      chosenVariant: '조선시대',
    });
    expect(chosen).toHaveLength(2);
    expect(chosen[0].replace).toBe('조선시대');
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

describe('reading-order S1 — 칩/occurrence 기하 정렬', () => {
  it('펼침면에서 왼쪽 위→아래 후 오른쪽 순으로 occurrence를 정렬한다', () => {
    const size = 10;
    const yTop = 520;
    const yMid = 360;
    const yBottom = 200;
    const items = [
      // stream 순: 오른 → 왼하단 → 왼상단 (index 순이면 뒤섞임)
      { str: '명지', transform: [size, 0, 0, size, 420, yMid], width: 24 },
      { str: '명지', transform: [size, 0, 0, size, 72, yBottom], width: 24 },
      { str: '명지', transform: [size, 0, 0, size, 72, yTop], width: 24 },
    ];
    const text = '명지\n명지\n명지\n';
    const textLayout = text;
    const itemRefs = [
      { start: 0, end: 2, itemIndex: 0 },
      { start: 3, end: 5, itemIndex: 1 },
      { start: 6, end: 8, itemIndex: 2 },
    ];
    const page = {
      pageNum: 40,
      text,
      textLayout,
      items,
      itemRefs,
      itemRefsLayout: itemRefs,
    };
    // 붙임/띄움 충돌 클러스터가 아니어도 occurrence index는 정렬됨
    const byKey = buildUnifyOccurrenceIndex([
      page,
      { pageNum: 41, text: '명 지\n', textLayout: '명 지\n' },
    ]);
    const acc = byKey.get('명지');
    expect(acc).toBeTruthy();
    const glued = acc.occurrences.get('명지') ?? [];
    const on40raw = glued.filter((o) => o.pageNum === 40);
    expect(on40raw).toHaveLength(3);
    const pageByNum = buildPageByNum([page]);
    const on40 = enrichOccurrencesWithItemHits(on40raw, pageByNum);
    // item+bbox 경로: 왼 단 위→아래 후 오른 단 (itemIndexes 기준)
    expect(on40.map((o) => o.itemIndexes?.[0])).toEqual([2, 1, 0]);
    expect(on40.every((o) => typeof o.x === 'number')).toBe(true);
  });

  it('mapLayoutIndexToVisualIndex — 자간 길이 차이를 itemRefs로 투영한다', () => {
    const page = {
      itemRefs: [{ start: 10, end: 13, itemIndex: 0 }],
      itemRefsLayout: [{ start: 4, end: 6, itemIndex: 0 }],
    };
    expect(mapLayoutIndexToVisualIndex(page, 4)).toBe(10);
    expect(mapLayoutIndexToVisualIndex(page, 5)).toBe(11);
  });

  it('resolveHighlightIndex — 자간 공백이 있어도 preferNear에 가까운 출현을 고른다', () => {
    const text = 'AAA 명 지 BBB 명 지 CCC';
    const first = text.indexOf('명');
    const second = text.indexOf('명', first + 1);
    expect(resolveHighlightIndex(text, '명지', second)).toBe(second);
    expect(resolveHighlightIndex(text, '명지', first)).toBe(first);
  });

  it('enrichOccurrencesWithItemHits — items가 있으면 item hit으로 재배치한다', () => {
    const size = 10;
    const items = [
      { str: '명지 위', transform: [size, 0, 0, size, 80, 500], width: 40 },
      { str: '명지 아래', transform: [size, 0, 0, size, 80, 200], width: 48 },
      { str: '명지 오른', transform: [size, 0, 0, size, 420, 350], width: 48 },
      { str: 'padL', transform: [size, 0, 0, size, 40, 100], width: 20 },
      { str: 'padR', transform: [size, 0, 0, size, 700, 100], width: 20 },
    ];
    const page = {
      pageNum: 81,
      text: '명지 위 명지 아래 명지 오른',
      items,
    };
    const assigned = enrichOccurrencesWithItemHits(
      [
        { pageNum: 81, index: 0, matchedText: '명지' },
        { pageNum: 81, index: 0, matchedText: '명지' },
        { pageNum: 81, index: 0, matchedText: '명지' },
      ],
      buildPageByNum([page]),
    );
    expect(assigned).toHaveLength(3);
    expect(new Set(assigned.map((o) => o.itemIndexes?.[0])).size).toBe(3);
    expect(assigned.map((o) => o.itemIndexes?.[0])).toEqual([0, 1, 2]);
  });

  it('assignUniqueUnifyHighlightIndices — items 없어도 텍스트 슬롯 배정', () => {
    const text = '명지 위 명지 아래 명지 오른';
    const slots = collectUnifyPhraseStarts(text, '명지');
    expect(slots).toHaveLength(3);
    const assigned = assignUniqueUnifyHighlightIndices(
      [
        { pageNum: 81, index: slots[0], matchedText: '명지' },
        { pageNum: 81, index: slots[0], matchedText: '명지' },
        { pageNum: 81, index: slots[0], matchedText: '명지' },
      ],
      { pageNum: 81, text },
    );
    expect(assigned.map((o) => o.index).sort((a, b) => a - b)).toEqual(slots);
    expect(new Set(assigned.map((o) => o.index)).size).toBe(3);
  });
});
