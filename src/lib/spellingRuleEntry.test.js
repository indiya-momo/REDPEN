import { describe, expect, it } from 'vitest';
import {
  buildSpellingCheckRuleFromBuiltIn,
  builtInEnabledKey,
  parseSpellingFindsColumn,
  spellingRuleChecklistParts,
  spellingRuleDisplayLabel,
} from './spellingRuleEntry.js';

describe('parseSpellingFindsColumn', () => {
  it('쉼표로 구분한 이형태 2개 이상만 배열로 반환한다', () => {
    expect(parseSpellingFindsColumn('foo,bar', 'foo')).toEqual(['foo', 'bar']);
    expect(parseSpellingFindsColumn('foo', 'foo')).toBeNull();
    expect(parseSpellingFindsColumn('', 'foo')).toBeNull();
  });
});

describe('builtInEnabledKey', () => {
  it('ruleId가 있으면 ruleId를 쓴다', () => {
    expect(builtInEnabledKey({ ruleId: 'foreign-adam', find: '애덤' })).toBe(
      'foreign-adam',
    );
  });

  it('ruleId가 없으면 find를 쓴다', () => {
    expect(builtInEnabledKey({ find: '컨텐츠' })).toBe('컨텐츠');
  });
});

describe('spellingRuleDisplayLabel', () => {
  it('이형태가 있어도 대표 find만 표시한다', () => {
    expect(
      spellingRuleDisplayLabel({
        find: '봄 밤',
        replace: '봄밤',
        finds: ['가을 밤', '겨울 밤', '봄 밤', '여름 밤', '지난 밤'],
      }),
    ).toBe('봄 밤 → 봄밤');
  });

  it('→ 없는 displayLabel(분류 이름)은 적힌 그대로만 보인다', () => {
    expect(
      spellingRuleDisplayLabel({
        find: '봄 밤',
        replace: '봄밤',
        finds: ['봄 밤', '여름 밤'],
        displayLabel: '계절 밤',
      }),
    ).toBe('계절 밤');
    // ^(띄어쓰기 표시)도 그대로
    const parts = spellingRuleChecklistParts({
      find: '그 중',
      replace: '그중',
      finds: ['그 중', '부재 중'],
      displayLabel: '^중',
    });
    expect(parts).toEqual({ find: '^중', replace: '' });
    expect(
      spellingRuleDisplayLabel({ find: '갯수', replace: '개수', displayLabel: '사잇소리' }),
    ).toBe('사잇소리');
  });

  it('→가 있는 displayLabel은 기존처럼 좌우로 나눈다', () => {
    expect(
      spellingRuleChecklistParts({
        find: '거북치',
        replace: '거북지',
        finds: ['거북치', '깨끗치'],
        displayLabel: "거북치 → 거북지('하'줄임)",
      }),
    ).toEqual({ find: '거북치', replace: "거북지('하'줄임)" });
  });

  it('displayLabel이 →로 시작하면 finds를 앞에 붙인다', () => {
    expect(
      spellingRuleDisplayLabel({
        find: '맞은 편',
        replace: '맞은편',
        finds: ['이 편', '저 편', '그 편', '건너 편', '맞은 편'],
        displayLabel: '→이편·저편·그편·건너편·맞은편',
      }),
    ).toBe(
      '이 편, 저 편, 그 편, 건너 편, 맞은 편 → 이편·저편·그편·건너편·맞은편',
    );
  });

  it('봄 밤 묶음은 finds → display_label 오른쪽이다', () => {
    expect(
      spellingRuleDisplayLabel({
        find: '봄 밤',
        replace: '봄밤',
        finds: ['봄 밤', '여름 밤', '가을 밤', '겨울 밤', '지난 밤'],
        displayLabel: '→봄밤,여름밤,가을밤,겨울밤,지난밤',
      }),
    ).toBe(
      '봄 밤, 여름 밤, 가을 밤, 겨울 밤, 지난 밤 → 봄밤,여름밤,가을밤,겨울밤,지난밤',
    );
  });
});

describe('buildSpellingCheckRuleFromBuiltIn', () => {
  it('finds가 없어도 displayLabel·label을 붙인다', () => {
    const rule = { find: '컨텐츠', replace: '콘텐츠', enabled: true };
    expect(buildSpellingCheckRuleFromBuiltIn(rule)).toEqual({
      ...rule,
      label: '컨텐츠 → 콘텐츠',
    });
  });

  it('finds가 있으면 regex alternation과 spellingRuleId를 넣는다', () => {
    const out = buildSpellingCheckRuleFromBuiltIn({
      find: 'ab',
      replace: 'cd',
      finds: ['ab', 'xy'],
      ruleId: 'test-pair',
      enabled: true,
    });
    expect(out.pattern).toBe('regex');
    expect(out.spellingRuleId).toBe('test-pair');
    expect(out.find.startsWith('(?:')).toBe(true);
    expect(out.find).toContain('|');
  });
});
