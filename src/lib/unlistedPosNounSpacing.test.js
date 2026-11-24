import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  clearStdictPosIndexCache,
  lookupStdictPosHits,
  setStdictPosIndexForTests,
  stdictPosIndexBareKeyCount,
} from './stdictPosIndex.js';
import { findUnlistedPosNounSpacingHits } from './unlistedPosNounSpacing.js';
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

  it('띄어쓰기 폴더에 켜면 제2항 카드로 붙고, 시트와 겹치면 빠진다', () => {
    const pages = [{ pageNum: 1, text: '무릎위에 앉았다.' }];
    const enabled = { unlistedNounNoun: true, nonAeoAux: false };
    const groups = mergeSpacingFolderIntoSpellingResults(pages, [], enabled);
    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBe('spacing:unlistedNounNoun');
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
