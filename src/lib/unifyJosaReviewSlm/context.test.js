import { describe, expect, it } from 'vitest';
import {
  JOSA_SLM_CONTEXT_MAX,
  buildJosaSlmContextForCluster,
  findMatchRangeInLine,
  graphemeCount,
  sliceJosaSlmContextFromLine,
  sliceJosaSlmContextSide,
} from './context.js';

describe('graphemeCount', () => {
  it('한글 음절을 문자 단위로 센다', () => {
    expect(graphemeCount('양자역학')).toBe(4);
  });
});

describe('sliceJosaSlmContextSide', () => {
  const line = '앞부분 문장이다. 양자 역학 은 물리학의 기초이며 뒤에도 계속된다.';

  it('매칭 앞 40자 이내', () => {
    const before = sliceJosaSlmContextSide(line, line.indexOf('양자'), line.indexOf('양자'), 'before');
    expect(graphemeCount(before)).toBeLessThanOrEqual(JOSA_SLM_CONTEXT_MAX);
    expect(before).toContain('문장');
  });

  it('매칭 뒤 40자 이내', () => {
    const start = line.indexOf('양자');
    const end = line.indexOf('기초') + '기초'.length;
    const after = sliceJosaSlmContextSide(line, start, end, 'after');
    expect(graphemeCount(after)).toBeLessThanOrEqual(JOSA_SLM_CONTEXT_MAX);
    expect(after).toContain('뒤');
  });
});

describe('sliceJosaSlmContextFromLine', () => {
  it('앞·뒤를 함께 반환한다', () => {
    const line = '연구자들은 활동 이며 성장을 이어갔다.';
    const start = line.indexOf('활동');
    const end = line.indexOf('이며') + '이며'.length;
    const ctx = sliceJosaSlmContextFromLine(line, start, end);
    expect(ctx.contextBefore).toContain('연구');
    expect(ctx.contextAfter).toContain('성장');
  });
});

describe('findMatchRangeInLine', () => {
  it('matchedText로 구간을 찾는다', () => {
    const range = findMatchRangeInLine('양자 역학 은', '역학 은', '역학 은');
    expect(range?.start).toBeGreaterThanOrEqual(0);
  });
});

describe('buildJosaSlmContextForCluster', () => {
  it('pageTexts에서 대표 occurrence 맥락을 만든다', () => {
    const cluster = {
      key: '역학은',
      variants: ['역학은', '역학 은'],
      counts: { '역학은': 2, '역학 은': 1 },
      occurrencesByVariant: {
        '역학 은': [
          { pageNum: 1, index: 10, matchedText: '역학 은' },
        ],
      },
      recommendedUnify: '역학은',
      totalCount: 3,
    };
    const pageTexts = [
      {
        pageNum: 1,
        text: '현대 양자 역학 은 물리학이다.\n',
      },
    ];
    const ctx = buildJosaSlmContextForCluster(cluster, pageTexts);
    expect(ctx.contextBefore).toContain('양자');
    expect(ctx.contextAfter).toContain('물리');
  });
});
