import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GUEST_BROWSE_CAPABILITIES,
  GUEST_BROWSE_PROJECT_NAME,
  GUEST_BROWSE_TIMING,
  beginGuestBrowse,
  clearGuestBrowseConsistencyChips,
  endGuestBrowse,
  finishGuestBrowseConsistencyResultThenUnlockExportGuide,
  finishGuestBrowseResultThenUnlockNextGuide,
  guestBrowseAllowsCheckAndResults,
  guestBrowseAllowsDemoPdfAutoLoad,
  guestBrowseAllowsWorkspaceStay,
  guestBrowseAutoRunsCriteriaCheck,
  guestBrowseHidesGreetingText,
  guestBrowseHidesProjectList,
  guestBrowseHidesProjectSaveUi,
  guestBrowseHidesThumbStrip,
  guestBrowseProjectDisplayName,
  guestBrowseShowsWorkGuideChain,
  isGuestBrowseExportGuideReady,
  isGuestBrowseNextGuideReady,
  markGuestBrowseCriteriaClick,
  findGuestBrowseDemoSpellingGroup,
  prepareGuestBrowseConsistencyRules,
} from './guestBrowsePolicy.js';

describe('guestBrowsePolicy', () => {
  beforeEach(() => {
    endGuestBrowse();
    vi.useRealTimers();
  });

  it('둘러보기 — 프로젝트 목록 숨김·표시 이름', () => {
    expect(guestBrowseHidesProjectList()).toBe(false);
    expect(guestBrowseProjectDisplayName()).toBe(null);
    expect(guestBrowseShowsWorkGuideChain()).toBe(false);
    beginGuestBrowse();
    expect(guestBrowseHidesProjectList()).toBe(true);
    expect(guestBrowseProjectDisplayName()).toBe(GUEST_BROWSE_PROJECT_NAME);
    expect(guestBrowseShowsWorkGuideChain()).toBe(true);
  });

  it('활성 시 정책 플래그에 따라 허용·숨김', () => {
    beginGuestBrowse();
    expect(guestBrowseAllowsWorkspaceStay()).toBe(
      GUEST_BROWSE_CAPABILITIES.stayOnMainWithoutLogin,
    );
    expect(guestBrowseAllowsDemoPdfAutoLoad()).toBe(
      GUEST_BROWSE_CAPABILITIES.demoPdfAutoLoad,
    );
    expect(guestBrowseAllowsCheckAndResults()).toBe(
      GUEST_BROWSE_CAPABILITIES.runCheckAndResultPopup,
    );
    expect(guestBrowseHidesProjectSaveUi()).toBe(
      GUEST_BROWSE_CAPABILITIES.hideProjectSaveUi,
    );
    expect(guestBrowseHidesGreetingText()).toBe(
      GUEST_BROWSE_CAPABILITIES.hideGreetingText,
    );
    expect(guestBrowseHidesThumbStrip()).toBe(
      GUEST_BROWSE_CAPABILITIES.hideThumbStrip,
    );
    expect(guestBrowseAutoRunsCriteriaCheck()).toBe(
      GUEST_BROWSE_CAPABILITIES.autoRunCriteriaCheck,
    );
  });

  it('손 클릭 후 결과 팝업 → 확인 뒤에만 다음 가이드', async () => {
    vi.useFakeTimers();
    beginGuestBrowse();
    expect(isGuestBrowseNextGuideReady()).toBe(false);

    markGuestBrowseCriteriaClick();
    expect(isGuestBrowseNextGuideReady()).toBe(false);

    let alertOpenedAt = 0;
    let resolveAlert;
    const alertPromise = finishGuestBrowseResultThenUnlockNextGuide(
      async (extra = {}) => {
        alertOpenedAt = Date.now();
        expect(extra.showGuideHand).toBe(true);
        await new Promise((resolve) => {
          resolveAlert = resolve;
        });
      },
    );

    await vi.advanceTimersByTimeAsync(
      GUEST_BROWSE_TIMING.resultAfterClickMs - 1,
    );
    expect(alertOpenedAt).toBe(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(alertOpenedAt).toBeGreaterThan(0);
    expect(isGuestBrowseNextGuideReady()).toBe(false);

    resolveAlert();
    await alertPromise;
    expect(isGuestBrowseNextGuideReady()).toBe(true);
  });

  it('표기 통일 결과 팝업 → 확인 뒤에만 다운로드 가이드', async () => {
    beginGuestBrowse();
    expect(isGuestBrowseExportGuideReady()).toBe(false);

    let alertOpened = false;
    let resolveAlert;
    const alertPromise =
      finishGuestBrowseConsistencyResultThenUnlockExportGuide(
        async (extra = {}) => {
          alertOpened = true;
          expect(extra.showGuideHand).toBe(true);
          await new Promise((resolve) => {
            resolveAlert = resolve;
          });
        },
      );

    await Promise.resolve();
    expect(alertOpened).toBe(true);
    expect(isGuestBrowseExportGuideReady()).toBe(false);

    resolveAlert();
    await alertPromise;
    expect(isGuestBrowseExportGuideReady()).toBe(true);
  });

  it('표기 통일 준비 — 칩 제거·본·보 전체 선택', () => {
    const rules = [
      {
        id: 'lit-1',
        patternKind: 'compound-find',
        find: '가',
        replace: '가',
        enabled: true,
        tailWord: '가',
        consistencyLiteralEntry: true,
      },
      {
        id: 'uni-1',
        patternKind: 'compound-find',
        find: '나',
        replace: '나',
        enabled: true,
        tailWord: '나',
        consistencyUnifyEntry: true,
      },
      {
        id: 'slot-1',
        patternKind: 'phrase-slot-find',
        find: '다',
        replace: '다',
        enabled: true,
        tailWord: '다',
      },
      {
        id: 'aux-1',
        patternKind: 'auxiliary-verb',
        find: '하다',
        replace: '하다',
        enabled: false,
        tailWord: '하다',
        bonBojoItemId: 'verb-hada',
      },
      {
        id: 'aux-2',
        patternKind: 'auxiliary-verb',
        find: '되다',
        replace: '되다',
        enabled: false,
        tailWord: '되다',
        bonBojoItemId: 'verb-doeda',
      },
    ];
    const next = prepareGuestBrowseConsistencyRules(rules);
    expect(next.every((r) => r.patternKind === 'auxiliary-verb')).toBe(true);
    expect(next.every((r) => r.enabled === true)).toBe(true);
    expect(next).toHaveLength(2);
  });

  it('clearGuestBrowseConsistencyChips removes find chips but keeps aux enablement', () => {
    const rules = [
      {
        id: 'lit-1',
        patternKind: 'compound-find',
        find: '마한',
        replace: '마한',
        enabled: true,
        tailWord: '마한',
        consistencyLiteralEntry: true,
      },
      {
        id: 'aux-1',
        patternKind: 'auxiliary-verb',
        find: '하다',
        replace: '하다',
        enabled: false,
        tailWord: '하다',
        bonBojoItemId: 'verb-hada',
      },
    ];
    const next = clearGuestBrowseConsistencyChips(rules);
    expect(next).toHaveLength(1);
    expect(next[0].patternKind).toBe('auxiliary-verb');
    expect(next[0].enabled).toBe(false);
  });

  it('findGuestBrowseDemoSpellingGroup matches 빼곡이 builtin group', () => {
    const group = findGuestBrowseDemoSpellingGroup([
      { category: 'caution', label: '가량, 쯤' },
      { category: 'spelling', label: '빼곡이' },
    ]);
    expect(group?.label).toBe('빼곡이');
  });
});
