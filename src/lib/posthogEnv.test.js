import { describe, expect, it } from 'vitest';
import { resolvePostHogHost, resolvePostHogKey } from './posthogEnv.js';

describe('resolvePostHogKey', () => {
  it('prefers VITE_PUBLIC_POSTHOG_KEY', () => {
    expect(
      resolvePostHogKey({
        VITE_PUBLIC_POSTHOG_KEY: ' phc_local ',
        NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'phc_vercel',
      }),
    ).toBe('phc_local');
  });

  it('falls back to Vercel Marketplace variable names', () => {
    expect(
      resolvePostHogKey({
        NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'phc_vercel',
        NEXT_PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com',
      }),
    ).toBe('phc_vercel');
  });

  it('returns empty when unset', () => {
    expect(resolvePostHogKey({})).toBe('');
  });
});

describe('resolvePostHogHost', () => {
  it('uses VITE_PUBLIC_POSTHOG_HOST when set', () => {
    expect(
      resolvePostHogHost({
        VITE_PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',
      }),
    ).toBe('https://us.i.posthog.com');
  });

  it('defaults to EU ingest', () => {
    expect(resolvePostHogHost({})).toBe('https://eu.i.posthog.com');
  });
});
