import { describe, expect, it } from 'vitest';
import {
  buildProjectCardSummary,
  PROJECT_CARD_NONE_LABEL,
} from './projectCardSummary.js';

/** 최소 형태의 RuleSet 헬퍼 */
function makeSet(overrides = {}) {
  return {
    id: 'set_test',
    name: '1111',
    builtInEnabled: {},
    cautionEnabled: {},
    customRules: [],
    globalExcludePhrases: [],
    ...overrides,
  };
}

describe('buildProjectCardSummary', () => {
  it('선택·입력이 없으면 모든 찾기 항목과 검수 제외 단어를 "없음"으로 표시한다', () => {
    const summary = buildProjectCardSummary(makeSet());
    expect(summary.consistency.excludeWords).toBe(PROJECT_CARD_NONE_LABEL);
    expect(summary.consistency.find).toBe(PROJECT_CARD_NONE_LABEL);
    expect(summary.consistency.commonString).toBe(PROJECT_CARD_NONE_LABEL);
    expect(summary.auxiliary).toBe(PROJECT_CARD_NONE_LABEL);
    expect(typeof summary.spelling.editorReview).toBe('number');
    expect(typeof summary.spelling.spelling).toBe('number');
    expect(typeof summary.spelling.loanword).toBe('number');
  });

  it('선택하지 않은(비활성) 항목은 대표단어·개수에서 제외한다', () => {
    const summary = buildProjectCardSummary(
      makeSet({
        customRules: [
          { patternKind: 'phrase-slot-find', tailWord: '@시대', enabled: false },
        ],
      }),
    );
    expect(summary.consistency.commonString).toBe(PROJECT_CARD_NONE_LABEL);
  });

  it('검수 제외 단어는 공백을 정리하고 빈 항목을 버린 뒤 쉼표로 잇는다', () => {
    const summary = buildProjectCardSummary(
      makeSet({ globalExcludePhrases: ['  서울 ', '', '부산'] }),
    );
    expect(summary.consistency.excludeWords).toBe('서울, 부산');
  });

  it('공통 항목 찾기 1건은 "단어" N건 형태로 표시한다', () => {
    const summary = buildProjectCardSummary(
      makeSet({
        customRules: [
          { patternKind: 'phrase-slot-find', tailWord: '@시대', enabled: true },
        ],
      }),
    );
    expect(summary.consistency.commonString).toBe('"@시대" 1건');
  });

  it('항목이 여러 건이면 대표 단어 뒤에 "포함 N건"을 붙인다', () => {
    const summary = buildProjectCardSummary(
      makeSet({
        customRules: [
          { patternKind: 'phrase-slot-find', tailWord: '가나다', enabled: true },
          { patternKind: 'phrase-slot-find', tailWord: '마바사', enabled: true },
        ],
      }),
    );
    expect(summary.consistency.commonString).toBe('"가나다" 포함 2건');
  });

  it('savedAt이 있으면 한국어 저장일로, 없으면 빈 문자열로 표시한다', () => {
    const dated = buildProjectCardSummary(
      makeSet({ savedAt: '2026-06-22T12:00:00' }),
    );
    expect(dated.savedDate).toBe('26년 6월 22일');

    const undated = buildProjectCardSummary(makeSet({ savedAt: undefined }));
    expect(undated.savedDate).toBe('');
  });
});
