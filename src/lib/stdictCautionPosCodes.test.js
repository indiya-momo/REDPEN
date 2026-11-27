import { describe, expect, it } from 'vitest';
import { stdictViewUrl } from './stdictLinks.js';
import {
  CAUTION_MANUAL_WORD_NO,
  CAUTION_POS_WORD_NO,
  cautionPosWordNo,
  resolveCautionTipWordNo,
} from './stdictCautionPosCodes.js';
import {
  cautionTipLinkParts,
  cautionTipLinkSpecs,
} from './stdictCautionChipParts.js';
import {
  CAUTION_GROUPS,
  cautionDisplayLabel,
  cautionItemTip,
} from './cautionRules.js';

/** 항목 id로 설명 속 링크 자리를 뽑는다 (카드가 쓰는 경로와 같다) */
function linkedWords(itemId) {
  for (const group of CAUTION_GROUPS) {
    for (const item of group.items ?? []) {
      if (item.id !== itemId) continue;
      const label = cautionDisplayLabel(item);
      const tip = cautionItemTip(item, group);
      const specs = cautionTipLinkSpecs(label, tip, item.id).filter(
        (s) => resolveCautionTipWordNo(s) != null,
      );
      return cautionTipLinkParts(tip, specs)
        .filter((p) => p.kind === 'word')
        .map((p) => [p.text, resolveCautionTipWordNo(p)]);
    }
  }
  throw new Error(`항목 없음: ${itemId}`);
}

describe('§12-3 자동 판정 표', () => {
  it('대로 조사는 대로10이다', () => {
    expect(cautionPosWordNo('대로', '조사')).toBe(78254);
    expect(stdictViewUrl(78254)).toBe(
      'https://kdict.korean.go.kr/standard/search/searchView.do?wordNo=78254&searchKeywordTo=3',
    );
  });

  it('번호가 표와 같다', () => {
    expect(CAUTION_POS_WORD_NO.대로).toEqual({ 조사: 78254, 의존명사: 411247 });
    expect(CAUTION_POS_WORD_NO.뿐).toEqual({ 조사: 156866, 의존명사: 443239 });
    expect(CAUTION_POS_WORD_NO.만큼.조사).toBe(423733);
    expect(CAUTION_POS_WORD_NO.만큼.의존명사).toBe(423733);
    expect(CAUTION_POS_WORD_NO.같이.조사).toBe(389853);
    expect(CAUTION_POS_WORD_NO.같이.부사).toBe(389853);
    expect(CAUTION_POS_WORD_NO.투성이.접미사).toBe(343647);
    expect(CAUTION_POS_WORD_NO.가지.단위명사).toBe(6053);
    expect(CAUTION_POS_WORD_NO.같은.형용사).toBe(391368);
  });

  it('수동 지정 항목은 자동 표에 없다', () => {
    for (const w of ['정도', '때', '가량', '쯤', '커녕', '밖에']) {
      expect(CAUTION_POS_WORD_NO[w]).toBeUndefined();
    }
  });

  it('품사 이름만으로는 항이 없다', () => {
    expect(resolveCautionTipWordNo({ text: '조사', lookup: '조사' })).toBeNull();
    expect(resolveCautionTipWordNo({ text: '그리하다', lookup: '그리하다' })).toBeNull();
  });
});

describe('§12-4 수동 지정표', () => {
  it('지정표가 설계안과 같다', () => {
    expect(CAUTION_MANUAL_WORD_NO).toEqual({
      'uinoun-jungdo': { 명사: 479967 },
      'noun-ttae': { 명사: 98401 },
      'jubsa-garyang': { 가량: 387733, 쯤: 321212 },
      'josa-attach-keonyeong': { 보조사: 490407 },
      'josa-attach-bakke': { 보조사: 131192 },
    });
  });

  it('정도는 설명의 「명사」에서 정도11로 간다', () => {
    expect(linkedWords('uinoun-jungdo')).toEqual([['명사', 479967]]);
  });

  it('때는 설명의 「명사」에서 때01로 간다', () => {
    expect(linkedWords('noun-ttae')).toEqual([['명사', 98401]]);
  });

  it('가량·쯤은 따옴표 단어 자리에 각각 달고 「접사」에는 달지 않는다', () => {
    expect(linkedWords('jubsa-garyang')).toEqual([
      ['가량', 387733],
      ['쯤', 321212],
    ]);
  });

  it('커녕·밖에는 설명의 「보조사」에서 직결한다', () => {
    expect(linkedWords('josa-attach-keonyeong')).toEqual([['보조사', 490407]]);
    expect(linkedWords('josa-attach-bakke')).toEqual([['보조사', 131192]]);
  });

  it('수동 지정은 설명에 자리가 없으면 달지 않는다', () => {
    const specs = cautionTipLinkSpecs('정도(명사)', '의존명사로 띄어 쓴다', 'uinoun-jungdo');
    expect(specs).toEqual([]);
  });
});

describe('§12-2 다는 위치(자동)', () => {
  it('대로 설명의 조사·의존명사만 해당 항으로 간다', () => {
    const tip =
      '체언 뒤는 조사로 붙이고(마대로), \n용언 뒤는 의존명사라 띄어 쓴다(갈 대로)';
    const specs = cautionTipLinkSpecs('대로(조사 또는 의존명사)', tip).filter(
      (s) => resolveCautionTipWordNo(s) != null,
    );
    const words = cautionTipLinkParts(tip, specs).filter((p) => p.kind === 'word');
    expect(words.map((p) => p.text)).toEqual(['조사', '의존명사']);
    expect(resolveCautionTipWordNo(words[0])).toBe(78254);
    expect(resolveCautionTipWordNo(words[1])).toBe(411247);
  });

  it('같은 설명은 형용사만 같고, 같다·같은은 달지 않는다', () => {
    const tip =
      '비교나 비유\'의 뜻으로 쓰이거나 \'어떤 기준\'을 나타내는 "같은"은 형용사 "같다"의 활용형이므로, 앞말과 띄어쓴다(사전형 제외)';
    const specs = cautionTipLinkSpecs('같은(형용사)', tip);
    const words = cautionTipLinkParts(tip, specs)
      .filter((p) => p.kind === 'word')
      .map((p) => p.text);
    expect(words).toEqual(['형용사']);
  });

  it('그러다처럼 이름에 품사가 없으면 달지 않는다', () => {
    const tip = '그러다: 동사(그리하다)\n그렇다: 형용사(그러하다)';
    expect(cautionTipLinkSpecs('그러다, 그렇다', tip)).toEqual([]);
  });

  it('가지 설명의 단위 명사는 가지04로 간다', () => {
    const tip = "수관형사+단위 명사 '가지'는 띄어 쓰는 것을 원칙으로 한다";
    const specs = cautionTipLinkSpecs('가지(단위명사)', tip);
    expect(specs[0].text).toBe('단위 명사');
    expect(resolveCautionTipWordNo(specs[0])).toBe(6053);
  });
});
