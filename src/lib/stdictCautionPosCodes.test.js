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
        (s) => s.search === true || Array.isArray(s.numbered) || resolveCautionTipWordNo(s) != null,
      );
      return cautionTipLinkParts(tip, specs)
        .filter((p) => p.kind === 'word')
        .map((p) => [
          p.text,
          p.numbered ? p.numbered.map((n) => n.wordNo) : p.search ? 'search' : resolveCautionTipWordNo(p),
        ]);
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
  it('지정표에 §12-4 카드가 모두 들어 있다', () => {
    expect(CAUTION_MANUAL_WORD_NO).toMatchObject({
      'uinoun-jungdo': { 정도: 479967 },
      'noun-ttae': { 때: 98401 },
      'josa-attach-keonyeong': { 커녕: 490407 },
      'josa-uinoun-mankum': { "만큼|'은 조사": 423733, "만큼|'은 의존명사": 423733 },
      'josa-attach-bakke': { 밖에: 131192 },
      'jubsa-garyang': { 가량: 387733, 쯤: 321212 },
    });
  });

  it('정도는 설명의 「정도」에서 정도11(479967)로 간다', () => {
    expect(linkedWords('uinoun-jungdo')).toEqual([['정도', 479967]]);
  });

  it('만큼: 따옴표 속 「만큼」마다 — 조사·의존명사 모두 423733', () => {
    expect(linkedWords('josa-uinoun-mankum')).toEqual([
      ['만큼', 423733],
      ['만큼', 423733],
    ]);
  });

  it('때는 설명의 「명사」에서 때01로 간다', () => {
    expect(linkedWords('noun-ttae')).toEqual([['때', 98401]]);
  });

  it('가량·쯤은 제목과 같은 말이라도 설명에서 처음 나온 자리에 단다(§12-2 예외)', () => {
    expect(linkedWords('jubsa-garyang')).toEqual([
      ['가량', 387733],
      ['쯤', 321212],
    ]);
  });

  it('견본: 잘하다는 제목과 같은 말 「잘하다」(둘째 줄)에 단다', () => {
    expect(linkedWords('bon-bojo-jalhada')).toEqual([['잘하다', 475843]]);
  });

  it('-던지·-든지: 「-든지」는 글자 하나에 번호 둘이라 「조사」→94197, 「-든지」→417515로 나눠 단다', () => {
    expect(linkedWords('eomi-eomi-deongi')).toEqual([
      ['-더라', 412877],
      ['-던', 416298],
      ['-던지', 83003],
      ['조사', 94197],
      ['-든지', 417515],
    ]);
  });

  it('수동 지정표의 자리는 모두 설명에서 찾아져 링크가 된다', () => {
    for (const [itemId, table] of Object.entries(CAUTION_MANUAL_WORD_NO)) {
      expect(linkedWords(itemId).length, itemId).toBe(Object.keys(table).length);
    }
  });

  it('견본: 안되다는 번호가 아니라 뜻풀이 말에 단다', () => {
    expect(linkedWords('bon-bojo-anda')).toEqual([
      ['좋게 이루어지지 않다', 219149],
      ['사람이 보기에 가엾다', 222730],
    ]);
  });

  it('붙이다·부치다: 「붙이다」는 153137 직결, 「부치다」는 어깨번호 01·02·04·05로 번호별 직결(§14-2). 붙다·뜻풀이 말은 달지 않는다', () => {
    expect(linkedWords('verb-verbi-but')).toEqual([
      ['붙이다', 153137],
      ['부치다', [438761, 438538, 154384, 154385]],
    ]);
  });

  it('대로: 따옴표 속 「대로」마다 링크 — 조사 자리 78254, 의존명사 자리 411247', () => {
    expect(linkedWords('josa-uinoun-daero')).toEqual([
      ['대로', 78254],
      ['대로', 411247],
    ]);
  });

  it('뿐: 따옴표 속 「뿐」마다 링크 — 조사 자리 156866, 의존명사 자리 443239', () => {
    expect(linkedWords('josa-uinoun-ppun')).toEqual([
      ['뿐', 156866],
      ['뿐', 443239],
    ]);
  });

  it('2026-11-28 승인 10개 카드: 설명 속 그 말 자리에 단다(커녕·밖에·투성이·가지·같다·같이·것)', () => {
    expect(linkedWords('josa-attach-keonyeong')).toEqual([['커녕', 490407]]);
    expect(linkedWords('josa-attach-bakke')).toEqual([['밖에', 131192]]);
    expect(linkedWords('jubsa-attach-tuseongi')).toEqual([['투성이', 343647]]);
    expect(linkedWords('dannoun-space-gaji')).toEqual([['가지', 6053]]);
    expect(linkedWords('eogan-katten')).toEqual([['같다', 391368]]);
    expect(linkedWords('josa-busa-gachi')).toEqual([['같이', 389853]]);
    expect(linkedWords('uinoun-geot')).toEqual([['것', 390852]]);
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
