import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FEEDBACK_THANK_SIGNAL_KEY,
  publishFeedbackThankYouSignal,
  takeFeedbackThankYouSignal,
} from './feedbackThankYouSignal.js';

/** @type {Record<string, string>} */
const store = {};

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  vi.stubGlobal('window', {});
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

describe('feedbackThankYouSignal', () => {
  it('publish 후 take하면 uid를 돌려주고 키를 비운다', () => {
    publishFeedbackThankYouSignal('u1');
    expect(takeFeedbackThankYouSignal('u1')).toEqual({
      uid: 'u1',
      at: expect.any(Number),
    });
    expect(store[FEEDBACK_THANK_SIGNAL_KEY]).toBeUndefined();
  });

  it('uid가 다르면 take하지 않는다', () => {
    publishFeedbackThankYouSignal('u1');
    expect(takeFeedbackThankYouSignal('u2')).toBeNull();
    expect(store[FEEDBACK_THANK_SIGNAL_KEY]).toBeTruthy();
  });
});
