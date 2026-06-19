import { describe, expect, it } from 'vitest';
import {
  clearVisibilityForSource,
  countVisibleInstances,
  emptyResultVisibilityState,
  getGroupVisibilityMode,
  instanceVisibilityKey,
  isInstanceVisible,
  normalizeResultVisibilityState,
  pruneResultVisibility,
  serializeResultVisibility,
  toggleGroupVisibilityState,
  toggleInstanceVisibilityState,
} from './checkResultUtils.js';

const source = 'spelling';

/** @type {import('./ruleEngine.js').GroupedResult} */
const group = {
  find: 'F1',
  replace: 'R1',
  label: '먹고사',
  instances: [
    {
      find: 'F1',
      replace: 'R1',
      matchedText: '먹고 사',
      suggestedText: '먹고사',
      pageNum: 8,
      index: 10,
    },
    {
      find: 'F1',
      replace: 'R1',
      matchedText: '먹고 사',
      suggestedText: '먹고사',
      pageNum: 9,
      index: 20,
    },
    {
      find: 'F1',
      replace: 'R1',
      matchedText: '먹고 사',
      suggestedText: '먹고사',
      pageNum: 76,
      index: 30,
    },
  ],
};

describe('result instance visibility', () => {
  it('instanceVisibilityKey는 pageNum·index·matchedText로 구분한다', () => {
    expect(instanceVisibilityKey(group.instances[0])).toBe('8:10:먹고 사');
    expect(instanceVisibilityKey(group.instances[1])).toBe('9:20:먹고 사');
  });

  it('legacy group hidden map을 normalize한다', () => {
    const state = normalizeResultVisibilityState({
      [`spelling:${group.find}\0${group.replace}`]: false,
    });
    expect(getGroupVisibilityMode(state, source, group)).toBe('hidden');
  });

  it('instance 1건만 제외하면 partial이다', () => {
    let state = emptyResultVisibilityState();
    state = toggleInstanceVisibilityState(state, source, group, group.instances[0]);
    state = toggleInstanceVisibilityState(state, source, group, group.instances[1]);
    expect(getGroupVisibilityMode(state, source, group)).toBe('partial');
    expect(countVisibleInstances(state, source, group)).toBe(1);
    expect(isInstanceVisible(state, source, group, group.instances[2])).toBe(true);
  });

  it('그룹 토글 — visible이면 전체 숨김, partial이면 전체 표시', () => {
    let state = emptyResultVisibilityState();
    state = toggleGroupVisibilityState(state, source, group);
    expect(getGroupVisibilityMode(state, source, group)).toBe('hidden');

    state = toggleInstanceVisibilityState(state, source, group, group.instances[0]);
    expect(getGroupVisibilityMode(state, source, group)).toBe('partial');

    state = toggleGroupVisibilityState(state, source, group);
    expect(getGroupVisibilityMode(state, source, group)).toBe('visible');
    expect(countVisibleInstances(state, source, group)).toBe(3);
  });

  it('pruneResultVisibility — 없어진 그룹·instance 키를 제거한다', () => {
    let state = emptyResultVisibilityState();
    state = toggleInstanceVisibilityState(state, source, group, group.instances[0]);
    const pruned = pruneResultVisibility(state, [group], []);
    expect(isInstanceVisible(pruned, source, group, group.instances[0])).toBe(
      false,
    );

    const orphan = {
      hiddenGroups: { 'spelling:gone\0x': true },
      hiddenInstances: {
        [`spelling:${group.find}\0${group.replace}`]: {
          '99:0:orphan': true,
        },
      },
    };
    const cleaned = pruneResultVisibility(orphan, [group], []);
    expect(cleaned.hiddenGroups['spelling:gone\0x']).toBeUndefined();
    expect(cleaned.hiddenInstances[`spelling:${group.find}\0${group.replace}`]).toBeUndefined();
  });

  it('serializeResultVisibility — 빈 상태는 null', () => {
    expect(serializeResultVisibility(emptyResultVisibilityState())).toBeNull();
    let state = emptyResultVisibilityState();
    state = toggleInstanceVisibilityState(state, source, group, group.instances[1]);
    expect(serializeResultVisibility(state)).not.toBeNull();
  });

  it('source별 visibility를 지운다', () => {
    let state = emptyResultVisibilityState();
    state = toggleInstanceVisibilityState(state, 'spelling', group, group.instances[0]);
    state = toggleInstanceVisibilityState(state, 'consistency', group, group.instances[1]);
    state = clearVisibilityForSource(state, 'spelling');
    expect(isInstanceVisible(state, 'spelling', group, group.instances[0])).toBe(true);
    expect(isInstanceVisible(state, 'consistency', group, group.instances[1])).toBe(
      false,
    );
  });
});
