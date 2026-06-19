import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WORK_GUIDE_ONBOARDING_MAX_EXPOSURES,
  commitWorkGuideOnboardingExposureSlot,
  isWorkGuideOnboardingExposureAllowed,
  readWorkGuideOnboardingExposure,
} from './workGuideOnboardingExposure.js';

/** @type {Record<string, string>} */
const store = {};

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  vi.stubGlobal('localStorage', {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const openChain = {
  workGuideOpen: true,
  showLeftCriteriaGuide: true,
};

describe('workGuideOnboardingExposure', () => {
  it('오늘 첫 노출만 count를 1 증가시킨다', () => {
    expect(commitWorkGuideOnboardingExposureSlot('u1', '2026-06-01')).toEqual({
      ok: true,
      committed: true,
    });
    expect(readWorkGuideOnboardingExposure('u1')).toEqual({
      count: 1,
      lastDayId: '2026-06-01',
    });
    expect(commitWorkGuideOnboardingExposureSlot('u1', '2026-06-01')).toEqual({
      ok: true,
      committed: false,
    });
    expect(readWorkGuideOnboardingExposure('u1').count).toBe(1);
  });

  it('다른 날 방문 시 누적 count가 증가한다', () => {
    commitWorkGuideOnboardingExposureSlot('u1', '2026-06-01');
    commitWorkGuideOnboardingExposureSlot('u1', '2026-06-03');
    expect(readWorkGuideOnboardingExposure('u1')).toEqual({
      count: 2,
      lastDayId: '2026-06-03',
    });
  });

  it('5회 소진 후 노출 불가', () => {
    for (let i = 1; i <= WORK_GUIDE_ONBOARDING_MAX_EXPOSURES; i += 1) {
      commitWorkGuideOnboardingExposureSlot('u1', `2026-06-0${i}`);
    }
    expect(readWorkGuideOnboardingExposure('u1').count).toBe(5);
    expect(
      isWorkGuideOnboardingExposureAllowed(
        'u1',
        openChain,
        'work-left-criteria-v1',
        false,
        '2026-06-10',
      ),
    ).toBe(false);
  });

  it('오늘 이미 노출했고 dismiss했으면 같은 날 재노출 안 함', () => {
    commitWorkGuideOnboardingExposureSlot('u1', '2026-06-05');
    expect(
      isWorkGuideOnboardingExposureAllowed(
        'u1',
        openChain,
        'work-left-criteria-v1',
        true,
        '2026-06-05',
      ),
    ).toBe(false);
  });

  it('오늘 노출했지만 아직 dismiss 전이면 계속 보여준다', () => {
    commitWorkGuideOnboardingExposureSlot('u1', '2026-06-05');
    expect(
      isWorkGuideOnboardingExposureAllowed(
        'u1',
        openChain,
        'work-left-criteria-v1',
        false,
        '2026-06-05',
      ),
    ).toBe(true);
  });
});
