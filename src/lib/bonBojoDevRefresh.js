import { bonBojoRulesFingerprint } from './bonBojoRules.js';

/** @returns {Promise<import('../data/bon-bojo-rules.json') | null>} */
export async function fetchBonBojoRulesFromPublic() {
  const base = String(import.meta.env.BASE_URL ?? '/');
  const path = `${base}data/bon-bojo-rules.json`.replace(/\/{2,}/g, '/');
  const url = `${path}${path.includes('?') ? '&' : '?'}_=${Date.now()}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** @param {import('../data/bon-bojo-rules.json')} data */
export function fingerprintBonBojoPayload(data) {
  return bonBojoRulesFingerprint(data);
}
