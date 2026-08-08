/**
 * 공통 항목 — 접미 stem 붙임/띄움 스타일 신호 (참고용, 표기통일 승격 아님).
 * @see docs/superpowers/specs/2026-08-08-phrase-slot-style-signal-design.md
 */
import { tokenizePhraseSlotPattern } from './phraseSlotPattern.js';
import {
  SPACE_VISIBLE_CHAR,
  decodeSpacesVisible,
} from './spaceVisibleText.js';

/**
 * @typedef {{
 *   stem: string,
 *   gluedCount: number,
 *   spacedCount: number,
 *   mixed: boolean,
 * }} PhraseSlotStemStyleSignal
 */

/**
 * @param {string} pattern
 * @returns {string}
 */
export function phraseSlotStemFromPattern(pattern) {
  const raw = String(pattern ?? '').trim();
  if (!raw) return '';
  const decoded = decodeSpacesVisible(raw);
  const tokens = tokenizePhraseSlotPattern(decoded);
  if (tokens?.length) {
    return tokens
      .filter((t) => t.type === 'lit' && t.value)
      .map((t) => t.value)
      .join('')
      .normalize('NFC');
  }
  return decoded
    .replace(/[@]/g, '')
    .replace(new RegExp(`[\\s\\u00A0${SPACE_VISIBLE_CHAR}]`, 'g'), '')
    .normalize('NFC');
}

/**
 * 1차: space 토큰. 토큰화 실패 시에만 문자열 폴백.
 * @param {string} pattern
 * @returns {boolean}
 */
export function isPhraseSlotSpacedPattern(pattern) {
  const raw = String(pattern ?? '').trim();
  if (!raw) return false;
  const decoded = decodeSpacesVisible(raw);
  const tokens = tokenizePhraseSlotPattern(decoded);
  if (tokens?.length) {
    return tokens.some((t) => t.type === 'space');
  }
  return /[\s\u00A0]/.test(decoded) || raw.includes(SPACE_VISIBLE_CHAR);
}

/**
 * @param {{ patternKind?: string, tailWord?: string, label?: string, instances?: unknown[] } | null | undefined} group
 * @returns {string}
 */
function patternKeyFromGroup(group) {
  const tw = String(group?.tailWord ?? '').trim();
  if (tw) return tw;
  return decodeSpacesVisible(String(group?.label ?? '').trim());
}

/**
 * phrase-slot 결과 그룹에서 stem별 붙임/띄움 occurrence 집계.
 * occurrence 합 0인 stem은 제외.
 * @param {Iterable<{ patternKind?: string, tailWord?: string, label?: string, instances?: unknown[] } | null | undefined>} groups
 * @returns {PhraseSlotStemStyleSignal[]}
 */
export function collectPhraseSlotStemStyleSignals(groups) {
  /** @type {Map<string, { glued: number, spaced: number }>} */
  const byStem = new Map();

  for (const group of groups ?? []) {
    if (group?.patternKind !== 'phrase-slot-find') continue;
    const pattern = patternKeyFromGroup(group);
    const stem = phraseSlotStemFromPattern(pattern);
    if (!stem) continue;
    const n = Array.isArray(group.instances) ? group.instances.length : 0;
    if (n <= 0) continue;
    let acc = byStem.get(stem);
    if (!acc) {
      acc = { glued: 0, spaced: 0 };
      byStem.set(stem, acc);
    }
    if (isPhraseSlotSpacedPattern(pattern)) acc.spaced += n;
    else acc.glued += n;
  }

  /** @type {PhraseSlotStemStyleSignal[]} */
  const out = [];
  for (const [stem, { glued, spaced }] of byStem) {
    if (glued + spaced < 1) continue;
    out.push({
      stem,
      gluedCount: glued,
      spacedCount: spaced,
      mixed: glued > 0 && spaced > 0,
    });
  }
  out.sort((a, b) => a.stem.localeCompare(b.stem, 'ko'));
  return out;
}

/**
 * 공통 항목 결과 목록: 각 stem의 첫 카드 앞에 요약 행 1회 삽입 (카드 순서 유지).
 * @template {{ group?: { patternKind?: string, tailWord?: string, label?: string, instances?: unknown[] } }} E
 * @param {E[]} entries
 * @returns {Array<
 *   | { kind: 'stem-signal', signal: PhraseSlotStemStyleSignal }
 *   | { kind: 'entry', entry: E }
 * >}
 */
export function interleavePhraseSlotStemStyleSignals(entries) {
  const list = entries ?? [];
  const signals = collectPhraseSlotStemStyleSignals(
    list.map((e) => e?.group).filter(Boolean),
  );
  /** @type {Map<string, PhraseSlotStemStyleSignal>} */
  const byStem = new Map(signals.map((s) => [s.stem, s]));
  /** @type {Set<string>} */
  const emitted = new Set();
  /** @type {Array<
   *   | { kind: 'stem-signal', signal: PhraseSlotStemStyleSignal }
   *   | { kind: 'entry', entry: E }
   * >} */
  const out = [];

  for (const entry of list) {
    const pattern = patternKeyFromGroup(entry?.group);
    const stem = phraseSlotStemFromPattern(pattern);
    if (stem && !emitted.has(stem)) {
      emitted.add(stem);
      const signal = byStem.get(stem);
      if (signal) {
        out.push({ kind: 'stem-signal', signal });
      }
    }
    out.push({ kind: 'entry', entry });
  }
  return out;
}

/**
 * @param {PhraseSlotStemStyleSignal} signal
 * @returns {string}
 */
export function formatPhraseSlotStemStyleSignalText(signal) {
  const base = `붙임 ${signal.gluedCount} · 띄움 ${signal.spacedCount}`;
  return signal.mixed ? `${base} · 스타일 혼재` : base;
}
