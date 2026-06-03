/**
 * 명사 어근 + 연결 `-해` — 본용언+보조가 아님 (생각해 보다, 사랑해 주다 등)
 * bon_allow·검사 모두에서 제외
 * @type {ReadonlySet<string>}
 */
export const BON_NOUN_HAE_HEAD_CAPTURES = new Set([
  '생각해',
  '이야기해',
  '사랑해',
  '미워해',
]);

/** @param {string} headCapture */
export function isNounRootHaeHead(headCapture) {
  return BON_NOUN_HAE_HEAD_CAPTURES.has(headCapture.trim());
}

/**
 * @param {string[]} phrases
 * @returns {{ kept: string[], dropped: string[] }}
 */
export function partitionBonVerbAllowPhrases(phrases) {
  /** @type {string[]} */
  const kept = [];
  /** @type {string[]} */
  const dropped = [];
  for (const raw of phrases) {
    const p = String(raw ?? '').trim();
    if (!p) continue;
    if (BON_NOUN_HAE_HEAD_CAPTURES.has(p) || isNounRootHaeHead(p)) {
      dropped.push(p);
    } else {
      kept.push(p);
    }
  }
  return { kept, dropped };
}
