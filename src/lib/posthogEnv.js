/**
 * PostHog 키·호스트 — 로컬 .env 와 Vercel Marketplace 동기화 변수명 모두 지원.
 * @see project-docs/vercel-posthog.md
 */

const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com';

/**
 * @param {Record<string, unknown>} [env]
 * @returns {string}
 */
export function resolvePostHogKey(env = import.meta.env) {
  const candidates = [
    env.VITE_PUBLIC_POSTHOG_KEY,
    env.VITE_POSTHOG_PROJECT_TOKEN,
    env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
  ];
  for (const raw of candidates) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (value) return value;
  }
  return '';
}

/**
 * @param {Record<string, unknown>} [env]
 * @returns {string}
 */
export function resolvePostHogHost(env = import.meta.env) {
  const candidates = [
    env.VITE_PUBLIC_POSTHOG_HOST,
    env.VITE_POSTHOG_HOST,
    env.NEXT_PUBLIC_POSTHOG_HOST,
  ];
  for (const raw of candidates) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (value) return value;
  }
  return DEFAULT_POSTHOG_HOST;
}
