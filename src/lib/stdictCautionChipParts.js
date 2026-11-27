/**
 * 편집자 검토 카드·기준 칩 문구 (설계안 §12).
 * 제목은 링크로 만들지 않습니다. 설명에서 항목 이름의 품사 이름이 나온 자리에만 답니다.
 */
import { cautionManualPlaces } from './stdictCautionPosCodes.js';

/**
 * @param {string} raw
 * @returns {string[]}
 */
function splitCommaOutsideParens(raw) {
  /** @type {string[]} */
  const out = [];
  let buf = '';
  let depth = 0;
  for (const ch of raw) {
    if (ch === '(') depth += 1;
    if (ch === ')' && depth > 0) depth -= 1;
    if ((ch === ',' || ch === '，') && depth === 0) {
      const piece = buf.trim();
      if (piece) out.push(piece);
      buf = '';
      continue;
    }
    buf += ch;
  }
  const last = buf.trim();
  if (last) out.push(last);
  return out;
}

/**
 * @param {string} raw cautionResultChipLabel / cautionDisplayLabel 결과
 * @returns {{ kind: 'word' | 'note' | 'sep', text: string }[]}
 */
export function cautionChipLinkParts(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return [];
  const chunks = splitCommaOutsideParens(text);
  /** @type {{ kind: 'word' | 'note' | 'sep', text: string }[]} */
  const parts = [];
  chunks.forEach((chunk, i) => {
    if (i > 0) parts.push({ kind: 'sep', text: ', ' });
    const note = chunk.match(/^(.*?)(\([^)]+\))$/);
    if (note && note[1].trim()) {
      parts.push({ kind: 'word', text: note[1].trim() });
      parts.push({ kind: 'note', text: note[2] });
      return;
    }
    parts.push({ kind: 'word', text: chunk });
  });
  return parts;
}

/** @param {string} ch */
function isHangulSyllable(ch) {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3;
}

/** @param {string} pos 항목 이름 괄호 속 품사 */
export function posNameSurfaces(pos) {
  const compact = String(pos ?? '').replace(/\s+/g, '');
  if (!compact) return [];
  /** @type {string[]} */
  const surfaces = [compact];
  if (compact === '의존명사') surfaces.push('의존 명사');
  if (compact === '단위명사') surfaces.push('단위 명사');
  return [...new Set(surfaces)].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

/**
 * 설명에서 그 품사 이름이 한글로 붙지 않은 채 나오는 표기.
 * 보조사 안의 조사, 의존명사 안의 명사는 자리로 보지 않는다 (§12-6).
 * @param {string} tip
 * @param {string} pos
 * @returns {string | null}
 */
export function findPosSurfaceInTip(tip, pos) {
  const text = String(tip ?? '');
  for (const surface of posNameSurfaces(pos)) {
    let from = 0;
    while (from <= text.length - surface.length) {
      const idx = text.indexOf(surface, from);
      if (idx < 0) break;
      const prev = idx > 0 ? text[idx - 1] : '';
      if (!(isHangulSyllable(prev) && isHangulSyllable(surface[0]))) {
        return surface;
      }
      from = idx + 1;
    }
  }
  return null;
}

/**
 * @typedef {{ text: string, lookup: string, pos?: string, wordNo?: number }} CautionTipLinkSpec
 */

/**
 * 설명 속 자리 표기. 앞이 한글이면 다른 말의 일부(보조사 안의 조사 등)라 자리로 보지 않는다.
 * @param {string} tip
 * @param {string} place
 * @returns {string | null}
 */
function findPlaceInTip(tip, place) {
  const text = String(tip ?? '');
  const word = String(place ?? '').trim();
  if (!word) return null;
  let from = 0;
  while (from <= text.length - word.length) {
    const idx = text.indexOf(word, from);
    if (idx < 0) return null;
    const prev = idx > 0 ? text[idx - 1] : '';
    if (!(isHangulSyllable(prev) && isHangulSyllable(word[0]))) return word;
    from = idx + 1;
  }
  return null;
}

/**
 * 설명에 링크로 넣을 자리.
 * 수동 지정(§12-4)이 있으면 그것만 쓰고, 없으면 항목 이름의 품사로 자동 판정한다(§12-1).
 * 제목은 링크로 만들지 않고, 따옴표 말·사전형은 넣지 않는다(§12-2, §12-5).
 * @param {string} chipLabel
 * @param {string} tip
 * @param {string} [itemId] caution item_id
 * @returns {CautionTipLinkSpec[]}
 */
export function cautionTipLinkSpecs(chipLabel, tip, itemId) {
  /** @type {CautionTipLinkSpec[]} */
  const specs = [];
  const seen = new Set();
  const add = (spec) => {
    const text = String(spec?.text ?? '').trim();
    const lookup = String(spec?.lookup ?? '').trim();
    const pos = spec.pos ? String(spec.pos).trim() : '';
    const wordNo = Number.isFinite(spec.wordNo) ? spec.wordNo : undefined;
    if (!text || !lookup || (!pos && wordNo == null)) return;
    const key = `${text}\0${lookup}\0${pos}\0${wordNo ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    specs.push({
      text,
      lookup,
      ...(pos ? { pos } : {}),
      ...(wordNo != null ? { wordNo } : {}),
    });
  };

  /** @type {string[]} */
  const titleList = [];
  /** @type {string[]} */
  const labelPos = [];
  for (const part of cautionChipLinkParts(chipLabel)) {
    if (part.kind === 'word' && part.text) titleList.push(part.text);
    if (part.kind === 'note') {
      const inner = part.text.replace(/[()]/g, '');
      for (const bit of inner.split(/\s*또는\s*|[·,，]/)) {
        const pos = bit.trim();
        if (pos) labelPos.push(pos);
      }
    }
  }

  const manual = cautionManualPlaces(itemId);
  if (manual.length) {
    // 수동 지정 카드(§12-10 · 가량·쯤)는 제목과 같은 말이라도 설명에서 처음 나온 자리에 단다(§12-2 예외).
    const tipText = String(tip ?? '');
    for (const [place, wordNo] of manual) {
      const surface = findPlaceInTip(tipText, place);
      if (surface) add({ text: surface, lookup: place, wordNo });
    }
    return specs;
  }

  const tipStr = String(tip ?? '');
  for (const pos of labelPos) {
    const surface = findPosSurfaceInTip(tipStr, pos);
    if (!surface) continue;
    for (const w of titleList) add({ text: surface, lookup: w, pos });
  }
  return specs;
}

/**
 * 카드 제목과 설명에서, 설명에 링크로 넣을 말을 모은다.
 * @param {string} chipLabel
 * @param {string} tip
 * @returns {string[]}
 */
export function cautionTipLinkTerms(chipLabel, tip, itemId) {
  const terms = new Set(cautionTipLinkSpecs(chipLabel, tip, itemId).map((s) => s.text));
  return [...terms].filter(Boolean).sort((a, b) => b.length - a.length || a.localeCompare(b));
}

/**
 * 설명 문자열을 링크할 말과 나머지로 나눈다. 긴 말부터 맞춘다.
 * @param {string} raw
 * @param {Array<CautionTipLinkSpec | string>} specs
 * @returns {{ kind: 'word' | 'text', text: string, lookup?: string, pos?: string, wordNo?: number }[]}
 */
export function cautionTipLinkParts(raw, specs) {
  const text = String(raw ?? '');
  if (!text) return [];
  /** @type {Map<string, CautionTipLinkSpec>} */
  const byText = new Map();
  for (const item of specs ?? []) {
    const spec =
      typeof item === 'string' ? { text: item, lookup: item } : item;
    if (spec?.text && !byText.has(spec.text)) byText.set(spec.text, spec);
  }
  const sorted = [...byText.keys()].sort(
    (a, b) => b.length - a.length || a.localeCompare(b),
  );
  /** @type {{ kind: 'word' | 'text', text: string, lookup?: string, pos?: string }[]} */
  const parts = [];
  let i = 0;
  let buf = '';
  const flush = () => {
    if (buf) {
      parts.push({ kind: 'text', text: buf });
      buf = '';
    }
  };
  // 순서대로 처음 나온 자리만 링크한다. 같은 말은 한 번만 링크(§12, 2026-11-27 지시).
  const linked = new Set();
  while (i < text.length) {
    let hit = '';
    for (const t of sorted) {
      if (t && text.startsWith(t, i)) {
        hit = t;
        break;
      }
    }
    // 마대로의 「대로」처럼 한글 뒤에 붙은 말은 빼 둔다. 조사로·의존명사라는 허용.
    const prev = i > 0 ? text[i - 1] : '';
    if (hit && isHangulSyllable(prev) && isHangulSyllable(hit[0])) {
      buf += text[i];
      i += 1;
      continue;
    }
    if (hit && linked.has(hit)) {
      buf += hit;
      i += hit.length;
      continue;
    }
    if (hit) {
      linked.add(hit);
      const spec = byText.get(hit);
      flush();
      parts.push({
        kind: 'word',
        text: hit,
        lookup: spec?.lookup || hit,
        ...(spec?.pos ? { pos: spec.pos } : {}),
        ...(Number.isFinite(spec?.wordNo) ? { wordNo: spec.wordNo } : {}),
      });
      i += hit.length;
    } else {
      buf += text[i];
      i += 1;
    }
  }
  flush();
  return parts;
}
