import { normalizeBareunTag } from './tags.js';

/**
 * @param {unknown} morph
 * @returns {{ str: string, tag: string, position: number, length: number } | null}
 */
function morphToToken(morph) {
  if (!morph || typeof morph !== 'object') return null;
  const m = /** @type {Record<string, unknown>} */ (morph);
  const text = m.text;
  let str = '';
  let position = 0;
  let length = 0;
  if (text && typeof text === 'object') {
    const span = /** @type {Record<string, unknown>} */ (text);
    str = String(span.content ?? span.text ?? '');
    position = Number(span.begin_offset ?? span.beginOffset ?? 0) || 0;
    length =
      Number(span.length ?? 0) ||
      (str ? [...str].length : 0);
  } else if (typeof m.form === 'string') {
    str = m.form;
    length = [...str].length;
  }
  if (!str) return null;
  return {
    str,
    tag: normalizeBareunTag(m.tag),
    position,
    length,
  };
}

/**
 * 바른 문장 응답 → Kiwi analyzeLine과 같은 형태.
 * @param {string} inputText
 * @param {unknown} sentence
 * @returns {{ tokens: { str: string, tag: string, position: number, length: number }[], surface1to1: boolean }}
 */
export function bareunSentenceToKiwiShape(inputText, sentence) {
  /** @type {{ str: string, tag: string, position: number, length: number }[]} */
  const tokens = [];
  if (sentence && typeof sentence === 'object') {
    const s = /** @type {Record<string, unknown>} */ (sentence);
    const wordTokens = Array.isArray(s.tokens) ? s.tokens : [];
    for (const wt of wordTokens) {
      if (!wt || typeof wt !== 'object') continue;
      const morphemes = /** @type {Record<string, unknown>} */ (wt).morphemes;
      if (!Array.isArray(morphemes)) continue;
      for (const morph of morphemes) {
        const tok = morphToToken(morph);
        if (tok) tokens.push(tok);
      }
    }
  }
  const joined = tokens.map((t) => t.str).join('');
  const surface = String(inputText ?? '').replace(/\s+/g, '');
  const surface1to1 = Boolean(surface) && joined.replace(/\s+/g, '') === surface;
  return { tokens, surface1to1 };
}

/**
 * AnalyzeSyntaxList 응답 + 입력 문장 배열 → Kiwi 배치 아이템.
 * @param {string[]} inputs
 * @param {unknown} body
 * @returns {{ text: string, tokens: { str: string, tag: string, position: number, length: number }[], surface1to1: boolean }[]}
 */
export function bareunListResponseToKiwiItems(inputs, body) {
  const sentences =
    body && typeof body === 'object' && Array.isArray(
      /** @type {Record<string, unknown>} */ (body).sentences,
    )
      ? /** @type {unknown[]} */ (
          /** @type {Record<string, unknown>} */ (body).sentences
        )
      : [];
  /** @type {{ text: string, tokens: { str: string, tag: string, position: number, length: number }[], surface1to1: boolean }[]} */
  const out = [];
  for (let i = 0; i < inputs.length; i += 1) {
    const text = String(inputs[i] ?? '');
    if (!text) continue;
    const shape = bareunSentenceToKiwiShape(text, sentences[i]);
    out.push({ text, ...shape });
  }
  return out;
}
