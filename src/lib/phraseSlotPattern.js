import {
  FLEX_SPACE,
  PHRASE_START,
  escapeRegex,
} from './compoundPatternCommon.js';
import { encodeSpacesVisible } from './spaceVisibleText.js';

const SLOT = '@';
const LEGACY_SLOT = 'NN';
const LEGACY_M = 'M';

/** @param {string} ch */
function isSlotMarker(ch) {
  return ch === SLOT || ch === LEGACY_M;
}

/**
 * @typedef {'slot' | 'space' | 'lit'} SlotToken
 * @typedef {{ type: SlotToken, value?: string }} Token
 */

/**
 * @param {string} raw
 * @returns {Token[] | null}
 */
function tokenizeSlotPattern(raw) {
  const t = raw.trim();
  if (!t) return null;

  if (t.includes('+')) {
    return tokenizePlusPattern(t);
  }

  if (!t.includes(SLOT) && !t.includes(LEGACY_M)) return null;

  /** @type {Token[]} */
  const tokens = [];
  let literal = '';

  for (const ch of t) {
    if (isSlotMarker(ch)) {
      if (literal) {
        tokens.push({ type: 'lit', value: literal });
        literal = '';
      }
      tokens.push({ type: 'slot' });
    } else if (ch === ' ' || ch === '\u00A0') {
      if (literal) {
        tokens.push({ type: 'lit', value: literal });
        literal = '';
      }
      tokens.push({ type: 'space' });
    } else {
      literal += ch;
    }
  }
  if (literal) tokens.push({ type: 'lit', value: literal });
  return tokens.length ? tokens : null;
}

/**
 * @param {string} t
 * @returns {Token[] | null}
 */
function tokenizePlusPattern(t) {
  const chunks = t.split('+');
  if (!chunks.length) return null;

  /** @type {Token[]} */
  const tokens = [];

  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i];
    if (i > 0) {
      if (/^[ \u00A0]/.test(chunk)) {
        tokens.push({ type: 'space' });
        chunk = chunk.trimStart();
      }
    }
    if (!chunk) continue;

    if (chunk === LEGACY_SLOT || chunk === SLOT || chunk === LEGACY_M) {
      tokens.push({ type: 'slot' });
      continue;
    }

    const inner = tokenizeSlotPattern(chunk.replace(/\+/g, ''));
    if (!inner) {
      tokens.push({ type: 'lit', value: chunk });
      continue;
    }
    tokens.push(...inner);
  }

  return tokens.length ? tokens : null;
}

/**
 * @param {Token[]} tokens
 */
function tokensToRegexFrag(tokens) {
  let frag = '';
  for (const tok of tokens) {
    if (tok.type === 'slot') frag += String.raw`\S+`;
    else if (tok.type === 'space') frag += FLEX_SPACE;
    else if (tok.type === 'lit' && tok.value) frag += escapeRegex(tok.value);
  }
  return frag;
}

/** @param {string} s */
export function isPhraseSlotPattern(s) {
  const t = s.trim();
  if (!t) return false;
  if (t.includes('+') && t.includes(LEGACY_SLOT)) return true;
  if (t.includes(SLOT) || t.includes(LEGACY_M)) {
    return /[\uAC00-\uD7A3]/.test(t) || /[A-Za-z]/.test(t);
  }
  return false;
}

/**
 * @시대 → 조선시대 / @˅시대 → 조선 시대 — 패턴에 넣은 공백만 반영
 * @param {string} pattern
 */
export function buildPhraseSlotFindRules(pattern) {
  const raw = pattern.trim();
  if (!isPhraseSlotPattern(raw)) return [];

  const tokens = tokenizeSlotPattern(raw);
  if (!tokens?.length) return [];

  const hasSlot = tokens.some((t) => t.type === 'slot');
  if (!hasSlot) return [];

  const frag = tokensToRegexFrag(tokens);
  if (!frag) return [];

  const base = {
    enabled: true,
    pattern: 'regex',
    patternKind: 'phrase-slot-find',
    tailWord: raw,
    replace: '$0',
    label: encodeSpacesVisible(raw),
  };

  return [
    {
      ...base,
      find: String.raw`${PHRASE_START}${frag}`,
    },
  ];
}

/** @param {import('./ruleTypes.js').Rule[]} rules @param {string} pattern */
export function hasPhraseSlotFind(rules, pattern) {
  const t = pattern.trim();
  return rules.some(
    (r) => r.patternKind === 'phrase-slot-find' && r.tailWord === t,
  );
}

/** @param {import('./ruleTypes.js').Rule[]} rules @param {string} pattern */
export function removePhraseSlotFind(rules, pattern) {
  const t = pattern.trim();
  return rules.filter(
    (r) => !(r.patternKind === 'phrase-slot-find' && r.tailWord === t),
  );
}
