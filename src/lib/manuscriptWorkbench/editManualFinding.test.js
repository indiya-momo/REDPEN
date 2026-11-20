import { describe, expect, it } from 'vitest';
import { addManualFinding } from './addManualFinding.js';
import { countManualInstances } from './findingsSink.js';
import {
  commitEditedManual,
  instanceToEditDraft,
} from './editManualFinding.js';

const page = {
  pageNum: 15,
  text: '맞춰 두면',
  visualText: '맞춰 두면',
  items: [],
  itemRefs: [{ start: 0, end: 5, itemIndex: 0 }],
};

function addOnce() {
  return addManualFinding(
    [],
    {
      pageNum: 15,
      start: 0,
      end: 2,
      matchedText: '맞춰',
      replace: '맞혀',
      tip: '',
      source: 'manual',
    },
    page,
  );
}

describe('editManualFinding', () => {
  it('카드에서 입력창 초안을 채운다', () => {
    const groups = addOnce();
    const inst = groups[0].instances[0];
    expect(instanceToEditDraft(inst)).toEqual({
      draft: { pageNum: 15, start: 0, end: 2, matchedText: '맞춰' },
      replace: '맞혀',
      tip: '',
      editingTarget: { pageNum: 15, index: 0 },
    });
  });

  it('빈 카드는 초안이 없다', () => {
    expect(instanceToEditDraft(null)).toBeNull();
    expect(instanceToEditDraft({ pageNum: 1, index: 0, matchedText: '' })).toBeNull();
  });

  it('하이라이트 상자 구간을 원본으로 쓴다', () => {
    expect(
      instanceToEditDraft({
        pageNum: 4,
        index: 10,
        start: 12,
        end: 14,
        matchedText: '가는',
        suggestedText: '가늘다',
        tip: '굵기',
        fromHighlight: true,
      }),
    ).toEqual({
      draft: {
        pageNum: 4,
        start: 12,
        end: 14,
        matchedText: '가는',
        fromHighlight: true,
      },
      replace: '가늘다',
      tip: '굵기',
      editingTarget: { pageNum: 4, index: 10 },
    });
  });

  it('고친 내용으로 그 카드만 덮어쓴다', () => {
    const groups = addOnce();
    const next = commitEditedManual(
      groups,
      { pageNum: 15, index: 0 },
      {
        pageNum: 15,
        start: 0,
        end: 2,
        matchedText: '맞춰',
        replace: '맞추어',
        tip: '표기',
        source: 'manual',
      },
      page,
    );
    expect(countManualInstances(next)).toBe(1);
    expect(next[0].replace).toBe('맞추어');
    expect(next[0].instances[0]).toMatchObject({
      pageNum: 15,
      index: 0,
      suggestedText: '맞추어',
      tip: '표기',
    });
  });

  it('원본을 다른 구간으로 바꾸면 옛 카드는 빠진다', () => {
    const groups = addOnce();
    const next = commitEditedManual(
      groups,
      { pageNum: 15, index: 0 },
      {
        pageNum: 15,
        start: 3,
        end: 5,
        matchedText: '두면',
        replace: '두다',
        source: 'manual',
      },
      page,
    );
    expect(countManualInstances(next)).toBe(1);
    expect(next[0].find).toBe('두면');
    expect(next[0].instances[0].index).toBe(3);
  });

  it('거부되면 목록을 그대로 둔다', () => {
    const groups = addOnce();
    const next = commitEditedManual(
      groups,
      { pageNum: 15, index: 0 },
      {
        pageNum: 15,
        start: 0,
        end: 2,
        matchedText: '맞춰',
        replace: '맞춰',
        source: 'manual',
      },
      page,
    );
    expect(next).toBe(groups);
    expect(next[0].replace).toBe('맞혀');
  });
});
