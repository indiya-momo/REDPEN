import { describe, expect, it } from 'vitest';
import {
  cautionChipLinkParts,
  cautionTipLinkParts,
  cautionTipLinkSpecs,
  cautionTipLinkTerms,
  findPosSurfaceInTip,
} from './stdictCautionChipParts.js';
import { cautionPosWordNo } from './stdictCautionPosCodes.js';

describe('cautionChipLinkParts', () => {
  it('이형태는 쉼표로 나눠 각각 말로 뽑는다', () => {
    expect(cautionChipLinkParts('그러다, 그렇다')).toEqual([
      { kind: 'word', text: '그러다' },
      { kind: 'sep', text: ', ' },
      { kind: 'word', text: '그렇다' },
    ]);
  });

  it('괄호 안 품사 안내는 링크로 만들지 않는다', () => {
    expect(cautionChipLinkParts('대로(조사 또는 의존명사)')).toEqual([
      { kind: 'word', text: '대로' },
      { kind: 'note', text: '(조사 또는 의존명사)' },
    ]);
  });

  it('쉼표와 괄호가 함께 있어도 괄호 안 쉼표는 나누지 않는다', () => {
    expect(cautionChipLinkParts('가량, 쯤(접사)')).toEqual([
      { kind: 'word', text: '가량' },
      { kind: 'sep', text: ', ' },
      { kind: 'word', text: '쯤' },
      { kind: 'note', text: '(접사)' },
    ]);
  });

  it('띄어 쓴 말도 한 덩어리로 둔다', () => {
    expect(cautionChipLinkParts('한 번, 한번')).toEqual([
      { kind: 'word', text: '한 번' },
      { kind: 'sep', text: ', ' },
      { kind: 'word', text: '한번' },
    ]);
  });

  it('쉼표 뒤 공백이 없어도 나눈다', () => {
    expect(cautionChipLinkParts('다음 날,다음날')).toEqual([
      { kind: 'word', text: '다음 날' },
      { kind: 'sep', text: ', ' },
      { kind: 'word', text: '다음날' },
    ]);
  });

  it('빈 값은 빈 배열', () => {
    expect(cautionChipLinkParts('')).toEqual([]);
    expect(cautionChipLinkParts(null)).toEqual([]);
  });
});

describe('cautionTipLinkTerms · cautionTipLinkParts', () => {
  it('대로 설명에서 조사와 의존명사를 각각 링크로 뽑고 대로는 빼 둔다', () => {
    const tip =
      '체언 뒤는 조사로 붙이고(마대로), \n용언 뒤는 의존명사라 띄어 쓴다(갈 대로)';
    const specs = cautionTipLinkSpecs('대로(조사 또는 의존명사)', tip);
    expect(cautionTipLinkTerms('대로(조사 또는 의존명사)', tip)).toEqual(
      expect.arrayContaining(['조사', '의존명사']),
    );
    expect(cautionTipLinkTerms('대로(조사 또는 의존명사)', tip)).not.toContain('대로');
    const words = cautionTipLinkParts(tip, specs).filter((p) => p.kind === 'word');
    expect(words.map((p) => p.text)).toEqual(['조사', '의존명사']);
    expect(words[0]).toEqual({ kind: 'word', text: '조사', lookup: '대로', pos: '조사' });
    expect(words[1]).toEqual({
      kind: 'word',
      text: '의존명사',
      lookup: '대로',
      pos: '의존명사',
    });
    expect(cautionPosWordNo(words[0].lookup, words[0].pos)).toBe(78254);
    expect(cautionPosWordNo(words[1].lookup, words[1].pos)).toBe(411247);
  });

  it('의존명사 안의 명사는 따로 잡지 않는다', () => {
    const tip = '용언 뒤는 의존명사라 띄어 쓴다';
    const terms = cautionTipLinkTerms('대로(조사 또는 의존명사)', tip);
    const words = cautionTipLinkParts(tip, terms)
      .filter((p) => p.kind === 'word')
      .map((p) => p.text);
    expect(words).toEqual(['의존명사']);
    expect(words).not.toContain('명사');
  });

  it('같은 설명에서 형용사만 뽑고 같은·같다는 빼 둔다', () => {
    const tip =
      '비교나 비유\'의 뜻으로 쓰이거나 \'어떤 기준\'을 나타내는 "같은"은 형용사 "같다"의 활용형이므로, 앞말과 띄어쓴다(사전형 제외)';
    const specs = cautionTipLinkSpecs('같은(형용사)', tip);
    expect(cautionTipLinkTerms('같은(형용사)', tip)).toEqual(['형용사']);
    const words = cautionTipLinkParts(tip, specs)
      .filter((p) => p.kind === 'word')
      .map((p) => p.text);
    expect(words).toEqual(['형용사']);
  });

  it('그러다·한 번처럼 이름에 품사가 없으면 설명에도 달지 않는다', () => {
    expect(
      cautionTipLinkSpecs('그러다, 그렇다', '그러다: 동사(그리하다)\n그렇다: 형용사(그러하다)'),
    ).toEqual([]);
    expect(
      cautionTipLinkSpecs('한 번, 한번', '한 번: 1회\n한번: 지난 때'),
    ).toEqual([]);
  });

  it('보조사 안의 조사는 자리로 보지 않는다', () => {
    expect(findPosSurfaceInTip("보조사 '커녕'은 앞말에 붙여 쓴다", '조사')).toBeNull();
  });

  it('조사하다는 품사 조사로 자르지 않는다', () => {
    const tip = '찾아보다(본용언+보조용언) :조사하다';
    const specs = cautionTipLinkSpecs('찾아 보다, 찾아보다', tip);
    const words = cautionTipLinkParts(tip, specs)
      .filter((p) => p.kind === 'word')
      .map((p) => p.text);
    expect(words).not.toContain('조사');
  });

  it('만큼 설명의 체언·용언 괄호 품사는 만큼의 쓰임이 아니다', () => {
    const tip =
      '체언(명사, 대명사, 수사) 뒤는 조사로 붙이고, \n용언(동사, 형용사) 뒤는 의존명사로 띄어 쓴다';
    const specs = cautionTipLinkSpecs('만큼(조사 또는 의존명사)', tip);
    const words = cautionTipLinkParts(tip, specs).filter((p) => p.kind === 'word');
    expect(words.map((p) => p.text)).toEqual(['조사', '의존명사']);
    expect(words.map((p) => p.lookup)).toEqual(['만큼', '만큼']);
  });
});
