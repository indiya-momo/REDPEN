import { describe, it, expect } from 'vitest';
import { buildLoanwordMatchers, runLoanwordCheck } from './loanwordCheck.js';

/** 시험용 오식 대조표 */
const DICT = {
  가디건: { c: ['카디건'], s: 'cardigan' },
  쏠루션: { c: ['솔루션', '설루션'], s: 'solution' },
  지로: { c: ['자이로'], s: 'gyro' },
  '제트더블유 형': { c: ['제트더블유형'], s: 'ZW형' },
};

const BOTH_ON = { main: true, short: true };
const MAIN_ONLY = { main: true, short: false };

/** @param {string} text */
const page = (text, pageNum = 1) => ({ pageNum, text });

describe('buildLoanwordMatchers', () => {
  it('켜진 묶음의 오표기만 포함한다', () => {
    const mainOnly = buildLoanwordMatchers(DICT, MAIN_ONLY);
    expect(mainOnly).toHaveLength(1);
    expect(mainOnly[0].test('가디건')).toBe(true);
    expect(new RegExp(mainOnly[0].source).test('지로')).toBe(false);
  });

  it('모두 꺼짐이면 빈 목록', () => {
    expect(buildLoanwordMatchers(DICT, { main: false, short: false })).toEqual(
      [],
    );
  });
});

describe('runLoanwordCheck', () => {
  it('오표기를 찾아 바른 표기와 근거를 붙인다', () => {
    const results = runLoanwordCheck(
      [page('겨울엔 가디건을 입는다')],
      DICT,
      MAIN_ONLY,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      find: '가디건',
      replace: '카디건',
      label: '가디건 → 카디건',
      category: 'loanword',
      tip: "cardigan — 국어원 용례집 등재 표기는 '카디건'",
    });
    expect(results[0].instances[0]).toMatchObject({
      pageNum: 1,
      matchedText: '가디건',
      suggestedText: '카디건',
      index: 4,
    });
  });

  it('바른 표기가 둘 이상이면 또는으로 잇고 편집자 확인 문구', () => {
    const [group] = runLoanwordCheck(
      [page('이 쏠루션은 훌륭하다')],
      DICT,
      MAIN_ONLY,
    );
    expect(group.replace).toBe('솔루션 또는 설루션');
    expect(group.tip).toBe('solution — 바른 표기가 둘 이상, 편집자 확인 필요');
  });

  it('2음절 이하 묶음은 꺼져 있으면 지적하지 않는다', () => {
    expect(runLoanwordCheck([page('지로 용지')], DICT, MAIN_ONLY)).toEqual([]);
    const on = runLoanwordCheck([page('지로 용지')], DICT, BOTH_ON);
    expect(on).toHaveLength(1);
    expect(on[0].find).toBe('지로');
  });

  it('앞글자가 붙은 부분일치는 제외한다', () => {
    expect(
      runLoanwordCheck([page('아지로 마을에 갔다')], DICT, BOTH_ON),
    ).toEqual([]);
  });

  it('조사가 붙어도 찾는다 (뒤 경계는 자유)', () => {
    const results = runLoanwordCheck([page('가디건이 좋다')], DICT, MAIN_ONLY);
    expect(results).toHaveLength(1);
  });

  it('여러 페이지·여러 건을 페이지 순으로 모은다', () => {
    const results = runLoanwordCheck(
      [page('가디건 하나', 3), page('가디건 둘과 쏠루션', 1)],
      DICT,
      MAIN_ONLY,
    );
    expect(results.map((g) => g.find)).toEqual(['가디건', '쏠루션']);
    expect(results[0].instances.map((i) => i.pageNum)).toEqual([1, 3]);
  });

  it('전체 제외 문구는 지적하지 않는다', () => {
    expect(
      runLoanwordCheck([page('가디건')], DICT, MAIN_ONLY, {
        globalExcludePhrases: ['가디건'],
      }),
    ).toEqual([]);
  });

  it('줄바꿈에 걸친 다단어 오표기는 제외한다', () => {
    expect(
      runLoanwordCheck([page('제트더블유\n형')], DICT, BOTH_ON),
    ).toEqual([]);
  });
});
