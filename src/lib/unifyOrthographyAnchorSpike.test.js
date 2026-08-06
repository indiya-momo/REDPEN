import { describe, expect, it } from 'vitest';
import {
  areOrthoVariantSurfaces,
  countHangulSurface,
  discoverOrthographyFromLatinParenAnchors,
  discoverOrthographyFromPages,
  extractLatinParenAnchors,
  hangulToJamo,
  isOrthoLatinKeyAcceptable,
  isOrthoNounSurface,
  jamoEditDistance,
  pickMajoritySurface,
  syllableDiffPairs,
} from './unifyOrthographyAnchorSpike.js';

describe('unifyOrthographyAnchorSpike', () => {
  it('병기 앵커를 뽑는다', () => {
    const text =
      '주인공 도널드(Donald)가 나타났다. 초콜릿(Chocolate)도 있다.';
    const anchors = extractLatinParenAnchors(text);
    expect(anchors.map((a) => [a.hangul, a.latinKey])).toEqual([
      ['도널드', 'donald'],
      ['초콜릿', 'chocolate'],
    ]);
  });

  it('짧은 라틴·뜻풀이 병기(공백)는 앵커로 쓰지 않는다', () => {
    expect(isOrthoLatinKeyAcceptable('sce')).toBe(false);
    expect(isOrthoLatinKeyAcceptable('donald')).toBe(true);
    expect(isOrthoLatinKeyAcceptable('street knowledge')).toBe(false);
    expect(isOrthoLatinKeyAcceptable('say no')).toBe(false);
    expect(isOrthoLatinKeyAcceptable('me first')).toBe(false);
    expect(
      extractLatinParenAnchors('지식(street knowledge) 주식 자식'),
    ).toEqual([]);
  });

  it('자식·주식·지식은 이형태가 아니다', () => {
    expect(areOrthoVariantSurfaces('자식', '지식')).toBe(false);
    expect(areOrthoVariantSurfaces('주식', '지식')).toBe(false);
    expect(areOrthoVariantSurfaces('록커', '롹커')).toBe(true);
    expect(areOrthoVariantSurfaces('도널드', '도날드')).toBe(true);
  });

  it('같은 라틴에 한글이 둘이면 latin-multi-hangul', () => {
    const text = [
      '도널드(Donald)가 왔다.',
      '한편 도날드(Donald)도 등장한다.',
      '도널드가 다시 말한다. 도널드!',
    ].join(' ');
    const { mixClusters } = discoverOrthographyFromLatinParenAnchors({
      text,
      includeNearNeighbors: false,
    });
    expect(mixClusters).toHaveLength(1);
    const c = mixClusters[0];
    expect(c.kind).toBe('latin-multi-hangul');
    expect(c.variants.toSorted()).toEqual(['도날드', '도널드']);
    expect(c.recommendedUnify).toBe('도널드');
    expect(c.needsVerification).toBe(true);
    expect(c.counts['도널드']).toBeGreaterThan(c.counts['도날드']);
  });

  it('록커/롹커는 자모 거리가 가깝다', () => {
    expect(jamoEditDistance('록커', '롹커')).toBeLessThanOrEqual(2);
    expect(hangulToJamo('록커')).not.toBe(hangulToJamo('롹커'));
  });

  it('앵커 한글과 가까운 이웃을 보조로 묶는다(명시적 켤 때만)', () => {
    const text = [
      '록커(Rocker)가 무대에 올랐다.',
      '관객은 롹커를 연호했다. 롹커 롹커.',
    ].join(' ');
    const { mixClusters } = discoverOrthographyFromLatinParenAnchors({
      text,
      includeNearNeighbors: true,
      maxJamoDistance: 1,
    });
    const c = mixClusters.find((x) => x.latinKey === 'rocker');
    expect(c).toBeTruthy();
    expect(c.kind).toBe('anchor-near-hangul');
    expect(c.variants).toEqual(expect.arrayContaining(['록커', '롹커']));
    expect(c.recommendedUnify).toBe('롹커');
  });

  it('뜻풀이 병기로 자식·주식·지식을 묶지 않는다', () => {
    const text = [
      '지식(street knowledge)이 중요하다.',
      '주식 자식 지식 지식 지식',
    ].join(' ');
    const { mixClusters, anchors } = discoverOrthographyFromLatinParenAnchors({
      text,
      includeNearNeighbors: true,
    });
    expect(anchors).toEqual([]);
    expect(mixClusters).toEqual([]);
  });

  it('조사(SCE)류 초성 폭주 목록을 만들지 않는다', () => {
    const junk = [
      '자다',
      '자사',
      '자산',
      '자세',
      '재산',
      '저가',
      '조각',
      '조기',
      '조달',
      '조사',
      '조상',
      '좋다',
      '좁다',
      '조사로',
      '조사에',
      '조사하',
    ];
    const text = `조사(SCE) ${junk.join(' ')}`;
    const { mixClusters, anchors } = discoverOrthographyFromLatinParenAnchors({
      text,
    });
    expect(anchors).toEqual([]);
    expect(mixClusters).toEqual([]);
  });

  it('다수형을 고른다', () => {
    const counts = new Map([
      ['도날드', 1],
      ['도널드', 3],
    ]);
    expect(pickMajoritySurface(counts, ['도날드', '도널드'])).toBe('도널드');
  });

  it('조사 붙은 어절에서도 표면을 센다', () => {
    expect(countHangulSurface('도날드가 왔다. 도날드와 산다.', '도날드')).toBe(
      2,
    );
  });

  it('음절 차를 관찰한다', () => {
    expect(syllableDiffPairs('도널드', '도날드')).toEqual(['널↔날']);
  });

  it('PDF 페이지 — 병기 두 한글이면 혼용을 잡는다', () => {
    const pages = [
      { pageNum: 1, text: '도널드(Donald)를 소개한다.' },
      { pageNum: 2, text: '도날드(Donald)가 다시 나온다. 도날드.' },
    ];
    const { mixClusters } = discoverOrthographyFromPages(pages);
    expect(mixClusters).toHaveLength(1);
    expect(mixClusters[0].counts['도날드']).toBe(2);
    expect(mixClusters[0].pagesByVariant['도날드']).toEqual([2]);
    expect(mixClusters[0].pagesByVariant['도널드']).toEqual([1]);
  });

  it('명사만 앵커·변형으로 쓰고 용언·…다는 버린다', () => {
    expect(isOrthoNounSurface('도널드')).toBe(true);
    expect(isOrthoNounSurface('만들어')).toBe(false);
    expect(isOrthoNounSurface('오래')).toBe(false);
    expect(isOrthoNounSurface('좋다')).toBe(false);
    expect(isOrthoNounSurface('조사로')).toBe(false);
    expect(isOrthoNounSurface('말아라')).toBe(false);
    expect(isOrthoNounSurface('말하라')).toBe(false);
    expect(isOrthoNounSurface('말하자')).toBe(false);
    expect(isOrthoNounSurface('바다')).toBe(true);

    const { anchors, clusters, mixClusters } =
      discoverOrthographyFromLatinParenAnchors({
        text: [
          '만들어(Make) 두 번 만들어 만들어.',
          '도널드(Donald)와 도날드(Donald).',
        ].join(' '),
      });
    expect(anchors.every((a) => a.hangul !== '만들어')).toBe(true);
    expect(clusters.every((c) => !c.variants.includes('만들어'))).toBe(true);
    expect(mixClusters.some((c) => c.latinKey === 'donald')).toBe(true);
  });

  it('세이노(Say No) 뜻풀이 병기는 앵커에서 제외한다', () => {
    const text = [
      '세이노(Say No)가 말한다.',
      '말아라(Say No) 말하라(Say No) 말하자(Say No)',
      '세이노 세이노 세이노 말아라 말아라 말하라',
    ].join(' ');
    const { mixClusters, anchors } = discoverOrthographyFromLatinParenAnchors({
      text,
    });
    expect(anchors).toEqual([]);
    expect(mixClusters).toEqual([]);
  });
});
