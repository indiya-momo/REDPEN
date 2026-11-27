/**
 * 편집자 검토 카드·기준 칩 문구를 「말」 링크와 나머지 글자로 나눕니다.
 * 쉼표로 이은 이형태는 각각, 괄호 안 품사 안내는 링크로 만들지 않습니다.
 * 카드 아래 설명은 품사·사전형·이형태가 나오는 곳에 각각 링크를 겁니다.
 */

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

/** 설명에서 품사·사전형으로 잡을 말 (긴 것부터 맞춤) */
const TIP_POS_TERMS = [
  '의존명사',
  '단위명사',
  '접미사',
  '형용사',
  '대명사',
  '접사',
  '조사',
  '부사',
  '동사',
  '명사',
];

/**
 * 카드 제목과 설명에서, 설명에 링크로 넣을 말을 모은다.
 * @param {string} chipLabel
 * @param {string} tip
 * @returns {string[]}
 */
export function cautionTipLinkTerms(chipLabel, tip) {
  const terms = new Set();
  for (const part of cautionChipLinkParts(chipLabel)) {
    if (part.kind === 'word' && part.text) terms.add(part.text);
    if (part.kind === 'note') {
      const inner = part.text.replace(/[()]/g, '');
      for (const bit of inner.split(/\s*또는\s*|[·,，]/)) {
        const t = bit.trim();
        if (t) terms.add(t);
      }
    }
  }
  const tipStr = String(tip ?? '');
  for (const m of tipStr.matchAll(/"([^"]{1,30})"/g)) {
    const t = m[1].trim();
    if (t) terms.add(t);
  }
  for (const m of tipStr.matchAll(/「([^」]{1,30})」/g)) {
    const t = m[1].trim();
    if (t) terms.add(t);
  }
  for (const m of tipStr.matchAll(
    /(의존명사|단위명사|접미사|형용사|대명사|접사|조사|부사|동사|명사)\(([^)]+)\)/g,
  )) {
    terms.add(m[1]);
    const inner = m[2].trim();
    if (inner) terms.add(inner);
  }
  for (const pos of TIP_POS_TERMS) {
    if (tipStr.includes(pos)) terms.add(pos);
  }
  return [...terms].filter(Boolean).sort((a, b) => b.length - a.length || a.localeCompare(b));
}

/**
 * 설명 문자열을 링크할 말과 나머지로 나눈다. 긴 말부터 맞춘다.
 * @param {string} raw
 * @param {string[]} terms
 * @returns {{ kind: 'word' | 'text', text: string }[]}
 */
export function cautionTipLinkParts(raw, terms) {
  const text = String(raw ?? '');
  if (!text) return [];
  const sorted = [...new Set((terms ?? []).filter(Boolean))].sort(
    (a, b) => b.length - a.length || a.localeCompare(b),
  );
  /** @type {{ kind: 'word' | 'text', text: string }[]} */
  const parts = [];
  let i = 0;
  let buf = '';
  const flush = () => {
    if (buf) {
      parts.push({ kind: 'text', text: buf });
      buf = '';
    }
  };
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
    if (hit) {
      flush();
      parts.push({ kind: 'word', text: hit });
      i += hit.length;
    } else {
      buf += text[i];
      i += 1;
    }
  }
  flush();
  return parts;
}
