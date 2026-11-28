import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  clearStdictPosIndexCache,
  lookupStdictPosHits,
  setStdictPosIndexForTests,
  stdictPosIndexBareKeyCount,
} from './stdictPosIndex.js';
import {
  UNLISTED_POS_NOUN_LABEL,
  findUnlistedPosNounSpacingHits,
} from './unlistedPosNounSpacing.js';
import { mergeSpacingFolderIntoSpellingResults } from './spacingFolderCheck.js';

function bySuggested(text) {
  return Object.fromEntries(
    findUnlistedPosNounSpacingHits(text).map((hit) => [
      hit.matchedText,
      hit.suggestedText,
    ]),
  );
}

describe('사전에 없는 명사+위치 명사', () => {
  beforeAll(() => {
    const data = JSON.parse(
      readFileSync(new URL('../../public/data/stdict-pos-index.json', import.meta.url), 'utf8'),
    );
    setStdictPosIndexForTests(data);
    expect(stdictPosIndexBareKeyCount()).toBeGreaterThan(1000);
  });

  afterAll(() => {
    clearStdictPosIndexCache();
  });

  it('무릎위·책상위·머리위와 조사 붙임은 띄운다', () => {
    expect(bySuggested('무릎위에 앉았다.')).toEqual({ 무릎위에: '무릎 위에' });
    expect(bySuggested('무릎위')).toEqual({ 무릎위: '무릎 위' });
    expect(bySuggested('무릎위를 쳤다')).toEqual({ 무릎위를: '무릎 위를' });
    expect(bySuggested('무릎위에서 봤다')).toEqual({ 무릎위에서: '무릎 위에서' });
    expect(bySuggested('책상위')).toEqual({ 책상위: '책상 위' });
    expect(bySuggested('머리위')).toEqual({ 머리위: '머리 위' });
    expect(bySuggested('학교앞')).toEqual({ 학교앞: '학교 앞' });
    expect(bySuggested('가방안')).toEqual({ 가방안: '가방 안' });
  });

  it('등재 복합어와 위치 명사가 아닌 끝은 내지 않는다', () => {
    const silent = [
      '눈앞',
      '눈앞에',
      '손위',
      '손위가',
      '윗사람',
      '윗사람을',
      '바위',
      '가위',
      '단위',
      '방안',
      '제안',
      '집안',
      '마음속',
      '코앞',
      '발밑',
      '다보탑',
      '너무앞',
      '안전이',
    ];
    for (const word of silent) {
      expect(findUnlistedPosNounSpacingHits(word), word).toEqual([]);
    }
    expect(lookupStdictPosHits('눈앞').length).toBeGreaterThan(0);
    expect(lookupStdictPosHits('손위').length).toBeGreaterThan(0);
    expect(lookupStdictPosHits('윗사람').length).toBeGreaterThan(0);
    expect(lookupStdictPosHits('무릎위')).toEqual([]);
  });

  it('숫자+단위+위치 명사는 단위에서 끊는다', () => {
    expect(bySuggested('3일뒤')).toEqual({ 일뒤: '일 뒤' });
    expect(bySuggested('5분뒤에')).toEqual({ 분뒤에: '분 뒤에' });
    expect(bySuggested('3시간안에')).toEqual({ 시간안에: '시간 안에' });
    expect(bySuggested('시간동안')).toEqual({ 시간동안: '시간 동안' });
    expect(bySuggested('시간밖')).toEqual({ 시간밖: '시간 밖' });
  });

  it('숫자+1음절 단위+동안은 숫자까지 잡아 단위와 동안 사이만 띄운다(일동 안으로 쪼개지 않음)', () => {
    expect(findUnlistedPosNounSpacingHits('기간은 3일동안 걸렸다.')).toEqual([
      { index: 4, matchedText: '3일동안', suggestedText: '3일 동안' },
    ]);
    expect(bySuggested('2년동안')).toEqual({ '2년동안': '2년 동안' });
    expect(bySuggested('3일동안의 일이다.')).toEqual({ '3일동안의': '3일 동안의' });
    expect(bySuggested('10분동안')).toEqual({ '10분동안': '10분 동안' });
    expect(bySuggested('1,000년동안')).toEqual({ '1,000년동안': '1,000년 동안' });
  });

  it('숫자 뒤가 아니면 1음절 단위는 풀지 않고, 띄어 쓴 것·등재어·표제어 게이트는 침묵한다', () => {
    for (const word of ['일동안', '3일 동안', '그동안', '한동안', '3일안', '3일안에']) {
      expect(findUnlistedPosNounSpacingHits(word), word).toEqual([]);
    }
  });

  it('조사 「밖에」는 위치 명사로 끊지 않는다', () => {
    for (const word of ['사람밖에 없다', '시간밖에 못 잤다', '3일밖에', '5분밖에 안 남았다']) {
      expect(findUnlistedPosNounSpacingHits(word), word).toEqual([]);
    }
    expect(bySuggested('창문밖에서 봤다')).toEqual({ 창문밖에서: '창문 밖에서' });
    expect(bySuggested('창문밖')).toEqual({ 창문밖: '창문 밖' });
  });

  it('띄어쓰기 폴더에 켜면 제2항 카드로 붙고, 시트와 겹치면 빠진다', () => {
    const pages = [{ pageNum: 1, text: '무릎위에 앉았다.' }];
    const enabled = { unlistedNounNoun: true, nonAeoAux: false };
    const groups = mergeSpacingFolderIntoSpellingResults(pages, [], enabled);
    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBe('spacing:unlistedNounNoun');
    expect(groups[0].label).toBe(UNLISTED_POS_NOUN_LABEL);
    expect(UNLISTED_POS_NOUN_LABEL).toBe(
      '사전에 등재되지 않은 명사+명사 (2항)',
    );
    expect(groups[0].tip).toContain('제2항');
    expect(groups[0].instances[0].suggestedText).toBe('무릎 위에');
    const sheet = [
      {
        category: 'spelling',
        instances: [{ pageNum: 1, index: 0, matchedText: '무릎위에' }],
      },
    ];
    expect(mergeSpacingFolderIntoSpellingResults(pages, sheet, enabled)).toEqual([]);
  });

  it('색인이 없으면 내지 않는다', () => {
    clearStdictPosIndexCache();
    expect(findUnlistedPosNounSpacingHits('무릎위에')).toEqual([]);
    const data = JSON.parse(
      readFileSync(new URL('../../public/data/stdict-pos-index.json', import.meta.url), 'utf8'),
    );
    setStdictPosIndexForTests(data);
  });
});
