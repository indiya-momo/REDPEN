import { describe, expect, it, vi } from 'vitest';
import {
  WELCOME_MOBILE_MQ,
  isWelcomeMobileViewport,
  shouldAutoEnterMainFromWelcome,
} from './welcomeViewport.js';

describe('welcomeViewport', () => {
  it('exports the same breakpoint as welcome screen split', () => {
    expect(WELCOME_MOBILE_MQ).toBe('(max-width: 600px)');
  });

  it('treats narrow viewport as mobile welcome', () => {
    vi.stubGlobal('window', {
      matchMedia: (query) => ({
        matches: query === WELCOME_MOBILE_MQ,
      }),
    });
    expect(isWelcomeMobileViewport()).toBe(true);
    expect(shouldAutoEnterMainFromWelcome()).toBe(false);
    vi.unstubAllGlobals();
  });

  it('allows auto main entry on desktop welcome', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
    });
    expect(isWelcomeMobileViewport()).toBe(false);
    expect(shouldAutoEnterMainFromWelcome()).toBe(true);
    vi.unstubAllGlobals();
  });
});
