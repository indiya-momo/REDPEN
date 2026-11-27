import { describe, it, expect } from 'vitest';
import {
  correctionPairsOfGroup,
  isDictBundleGroup,
} from './stdictLinkPairs.js';

describe('isDictBundleGroup', () => {
  it('표준국어대사전 등재 묶음만 true', () => {
    expect(isDictBundleGroup({ dividerLabel: '표준국어대사전 등재(명사)' })).toBe(true);
    expect(isDictBundleGroup({ dividerLabel: '표준국어대사전 등재(동사·형용사)' })).toBe(true);
    expect(isDictBundleGroup({ dividerLabel: '띄어쓰기' })).toBe(false);
    expect(isDictBundleGroup({})).toBe(false);
    expect(isDictBundleGroup(null)).toBe(false);
  });
});

describe('correctionPairsOfGroup', () => {
  it('변형 행은 variantFind → suggestedText 로 쌍을 뽑는다', () => {
    const group = {
      instances: [
        { variantFind: '그 중', suggestedText: '그중', matchedText: '그 중' },
        { variantFind: '도 중', suggestedText: '도중', matchedText: '도 중' },
      ],
    };
    expect(correctionPairsOfGroup(group)).toEqual([
      { find: '그 중', replace: '그중' },
      { find: '도 중', replace: '도중' },
    ]);
  });

  it('^ 분류 라벨 행은 pairFind 를 쓴다', () => {
    const group = {
      instances: [{ pairFind: '거북치', suggestedText: '거북지', matchedText: '거북치' }],
    };
    expect(correctionPairsOfGroup(group)).toEqual([{ find: '거북치', replace: '거북지' }]);
  });

  it('일반 행은 matchedText → suggestedText', () => {
    const group = {
      instances: [{ matchedText: '부재 중', suggestedText: '부재중' }],
    };
    expect(correctionPairsOfGroup(group)).toEqual([{ find: '부재 중', replace: '부재중' }]);
  });

  it('같은 쌍은 한 번만, 빈 값은 건너뛴다', () => {
    const group = {
      instances: [
        { matchedText: '부재 중', suggestedText: '부재중' },
        { matchedText: '부재 중', suggestedText: '부재중' },
        { matchedText: '', suggestedText: '부재중' },
        { matchedText: '부재 중', suggestedText: '' },
      ],
    };
    expect(correctionPairsOfGroup(group)).toEqual([{ find: '부재 중', replace: '부재중' }]);
  });

  it('인스턴스가 없으면 빈 배열', () => {
    expect(correctionPairsOfGroup({})).toEqual([]);
    expect(correctionPairsOfGroup(null)).toEqual([]);
  });
});
