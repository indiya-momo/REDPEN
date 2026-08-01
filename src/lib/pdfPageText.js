/**
 * PDF 텍스트 항목 → page.text 조립 (pdfjs·Vite worker 없음 — Node 스크립트·테스트용)
 */

import { splitSpreadColumns } from './spreadColumnSplit.js';
import { splitPageColumns } from './pageColumnSplit.js';

/**
 * @typedef {Object} TextItemRef
 * @property {number} start
 * @property {number} end
 * @property {number} itemIndex
 */

/** @typedef {{ item: import('pdfjs-dist').TextItem, itemIndex: number }} TextEntry */
/**
 * @typedef {{
 *   y: number,
 *   entries: TextEntry[],
 *   text: string,
 *   textLayout: string,
 *   lineRefs: TextItemRef[],
 *   lineRefsLayout: TextItemRef[],
 *   startFont: number,
 *   endFont: number,
 * }} BuiltLine
 */

/** @param {string} ch */
export function isHangulSyllableChar(ch) {
  return typeof ch === 'string' && ch.length > 0 && ch >= '\uAC00' && ch <= '\uD7A3';
}

/** @param {string} s */
function endsWithHangulSyllable(s) {
  const t = String(s).trimEnd();
  if (!t) return false;
  return isHangulSyllableChar(t[t.length - 1]);
}

/** @param {string} s */
function startsWithHangulSyllable(s) {
  const t = String(s).trimStart();
  if (!t) return false;
  return isHangulSyllableChar(t[0]);
}

/** soft-wrap 다음 줄이 인용·괄호로 시작하면 줄바꿈 유지 */
const SOFT_BREAK_KEEP_NEXT = new Set([
  '"',
  "'",
  '\u201c',
  '\u201d',
  '\u2018',
  '\u2019',
  '(',
  '[',
  '{',
  '「',
  '『',
  '〈',
  '《',
]);

/**
 * 줄끝이 조사·어미 경계로 보이면 soft wrap 하지 않음.
 * 단음절 `다`만 보면 `바다`도 막히거나, 반대로 어간 음절까지 과차단되므로
 * 2~3음절 접미 + 좁은 조사 + (다/요/까 + 다음 줄 어절) 조합을 쓴다.
 */
const HANGUL_LINE_END_SUFFIXES = [
  '습니다',
  '입니다',
  '합니다',
  '됩니다',
  '습니까',
  '는다',
  '한다',
  '된다',
  '인다',
  '운다',
  '린다',
  '진다',
  '았다',
  '었다',
  '였다',
  '했다',
  '까요',
  '네요',
  '군요',
  '구나',
  '는데',
  '니까',
  '면서',
  '지만',
  '도록',
  '으러',
  '으로',
  '로서',
  '로써',
  '부터',
  '까지',
  '처럼',
  '만큼',
  '마저',
  '조차',
  '이다',
];

/** 단독으로도 어절 끝 조사로 보는 음절(종결 `다`·연결 `고` 등은 여기 넣지 않음) */
const HANGUL_NARROW_JOSA = new Set(
  Array.from('은는이가을를의만와과도'),
);

/** 종결·의문 후보 — 다음 줄이 새 어절로 보일 때만 줄바꿈 유지 */
const HANGUL_CLOSING_TAIL = new Set(['다', '요', '까', '네']);

/**
 * @param {string} leftText
 * @param {string} rightLine
 */
export function isLikelyHangulEojeolBoundary(leftText, rightLine) {
  const left = String(leftText ?? '').replace(INLINE_SPACE_RE_END, '');
  const rightRaw = String(rightLine ?? '');
  let ri = 0;
  while (ri < rightRaw.length && isInlineSpaceChar(rightRaw[ri])) ri += 1;
  const right = rightRaw.slice(ri);
  if (!left || !right) return true;

  for (const suf of HANGUL_LINE_END_SUFFIXES) {
    if (left.endsWith(suf)) return true;
  }

  const L = left[left.length - 1];
  if (HANGUL_NARROW_JOSA.has(L)) return true;

  const R = right[0];
  // 명사 끝 등 + 다음 줄이 조사로만/조사+공백으로 시작 (바다\n가 …)
  if (
    isHangulSyllableChar(L) &&
    HANGUL_NARROW_JOSA.has(R) &&
    (right.length === 1 ||
      isInlineSpaceChar(right[1]) ||
      !isHangulSyllableChar(right[1]))
  ) {
    return true;
  }

  // 종결 후보 + 다음 줄이 2음절 이상 한글 어절 (보인다\n그래서)
  if (
    HANGUL_CLOSING_TAIL.has(L) &&
    right.length >= 2 &&
    isHangulSyllableChar(R) &&
    isHangulSyllableChar(right[1])
  ) {
    return true;
  }

  return false;
}

/** soft wrap으로 볼 y 간격(포인트): fontSize 배수 */
const SOFT_WRAP_DY_MIN_RATIO = 0.4;
const SOFT_WRAP_DY_MAX_RATIO = 1.85;
/** 짧은 한 줄(쪽번호·단음절)은 soft wrap으로 붙이지 않음 — 연속 soft-wrap 조각(2~3자)은 허용 */
const SOFT_WRAP_MIN_LEFT_CHARS = 2;

/**
 * soft-wrap 판별용 가로 공백(개행 제외).
 * ASCII 공백·탭·NBSP + Thin/Ideographic 등 유니코드 가로 공백.
 * `\s` 전체는 `\\n`을 포함하므로 쓰지 않는다.
 */
const INLINE_SPACE_RE = /[\t \u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\u200B]/;
const INLINE_SPACE_RE_END = /[\t \u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\u200B]+$/u;

/** @param {string} ch */
function isInlineSpaceChar(ch) {
  return typeof ch === 'string' && ch.length === 1 && INLINE_SPACE_RE.test(ch);
}

/**
 * 한글 음절 사이 soft wrap(`자\\n리`)만 제거. 줄끝 공백이 있으면 \\n만 지워 어절 경계 유지.
 * @param {string} text
 * @param {TextItemRef[]} [itemRefs]
 * @returns {{ text: string, itemRefs: TextItemRef[] }}
 */
export function rejoinHangulSoftLineBreaks(text, itemRefs = []) {
  const src = String(text ?? '');
  if (!src.includes('\n')) {
    return { text: src, itemRefs: itemRefs.map((r) => ({ ...r })) };
  }

  let out = '';
  /** @type {number[]} 원본에서 삭제된 인덱스(오름차순) */
  const removed = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i];
    if (ch !== '\n') {
      out += ch;
      i += 1;
      continue;
    }

    let left = i - 1;
    while (left >= 0 && isInlineSpaceChar(src[left])) {
      left -= 1;
    }
    const L = left >= 0 ? src[left] : '';

    let right = i + 1;
    while (right < src.length && isInlineSpaceChar(src[right])) {
      right += 1;
    }

    if (right >= src.length || src[right] === '\n') {
      out += '\n';
      i += 1;
      continue;
    }

    const R = src[right];
    if (SOFT_BREAK_KEEP_NEXT.has(R)) {
      out += '\n';
      i += 1;
      continue;
    }

    if (isHangulSyllableChar(L) && isHangulSyllableChar(R)) {
      if (isLikelyHangulEojeolBoundary(out, src.slice(right))) {
        out += '\n';
        i += 1;
        continue;
      }
      // \\n 및 다음 줄 머리 공백 삭제. 줄끝 공백은 이미 out에 있음.
      for (let p = i; p < right; p += 1) removed.push(p);
      i = right;
      continue;
    }

    out += '\n';
    i += 1;
  }

  const shiftedRefs = shiftItemRefsAfterRemovals(itemRefs, removed);
  return { text: out, itemRefs: shiftedRefs };
}

/**
 * @param {TextItemRef[]} itemRefs
 * @param {number[]} removedAsc
 */
function shiftItemRefsAfterRemovals(itemRefs, removedAsc) {
  if (!itemRefs.length || !removedAsc.length) {
    return itemRefs.map((r) => ({ ...r }));
  }
  return itemRefs.map((ref) => {
    let start = ref.start;
    let end = ref.end;
    for (const p of removedAsc) {
      if (p < start) start -= 1;
      if (p < end) end -= 1;
    }
    return { ...ref, start, end };
  });
}

/** 조판 자간 수준 gap — 이보다 좁으면 같은 어절로 보고 공백을 넣지 않음 */
const SYLLABLE_BOUNDARY_MIN_GAP_RATIO = 0.1;
/** 본용언+보조용언 경계는 PDF 추출에서 붙는 경우가 많아 기준을 완화 */
const AUX_BOUNDARY_MIN_GAP_RATIO = 0.015;

const AUXILIARY_LEAD_SYLLABLES = new Set([
  '주',
  '줄',
  '보',
  '본',
  '지',
  '하',
  '가',
  '오',
  '있',
  '두',
  '내',
  '놓',
]);

/** @param {string} leftStr @param {string} rightStr */
function isLikelyAuxiliaryBoundary(leftStr, rightStr) {
  const left = String(leftStr ?? '').trimEnd();
  const right = String(rightStr ?? '').trimStart();
  if (!left || !right) return false;
  const leftLast = left[left.length - 1];
  const rightLead = right[0];
  return (
    (leftLast === '어' || leftLast === '아' || leftLast === '해') &&
    AUXILIARY_LEAD_SYLLABLES.has(rightLead)
  );
}

/** 본용언+보조용언 — 넓은 gap(어절·칸)만 공백, 음절 자간 삽입 없음 */
export function shouldInsertLayoutSpaceBetweenPdfItems(gap, lineH) {
  return gap > lineH;
}

export function shouldInsertSpaceBetweenPdfItems(gap, lineH, leftStr, rightStr) {
  if (shouldInsertLayoutSpaceBetweenPdfItems(gap, lineH)) return true;
  const minGap =
    lineH *
    (isLikelyAuxiliaryBoundary(leftStr, rightStr)
      ? AUX_BOUNDARY_MIN_GAP_RATIO
      : SYLLABLE_BOUNDARY_MIN_GAP_RATIO);
  return (
    gap >= minGap &&
    endsWithHangulSyllable(leftStr) &&
    startsWithHangulSyllable(rightStr)
  );
}

/** 소제목·본문이 비슷한 y인데 포인트만 다를 때 한 줄로 묶지 않음 */
const FONT_LINE_SPLIT_RATIO = 1.18;
/** 왼쪽 여백으로 다시 돌아오면 새 줄(인디자인 소제목) */
const LINE_X_RESET_PT = 36;
/** 조판 PDF 검색·출력 이중 레이어 — 좌표 양자화(한컴 등 x·y 1~2pt 흔들림) */
const OVERLAY_POS_BUCKET_PT = 2;

/**
 * Hancom·인디자인 등 — 동일 (x,y)에 같은 str이 2번 들어오면 검수 건수가 2배로 늘어남
 * @param {import('pdfjs-dist').TextItem[]} items
 */
export function dedupeOverlayTextItems(items) {
  const seen = new Set();
  /** @type {import('pdfjs-dist').TextItem[]} */
  const out = [];
  for (const item of items) {
    if (!('str' in item) || !item.str) continue;
    const t = item.transform ?? [];
    const x =
      Math.round(((t[4] ?? 0) / OVERLAY_POS_BUCKET_PT)) *
      OVERLAY_POS_BUCKET_PT;
    const y =
      Math.round(((t[5] ?? 0) / OVERLAY_POS_BUCKET_PT)) *
      OVERLAY_POS_BUCKET_PT;
    const key = `${item.str}\0${x}\0${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * @param {{ item: import('pdfjs-dist').TextItem, itemIndex: number }[]} entries
 */
function builtLineSignature(entries) {
  return [...entries]
    .sort(
      (a, b) =>
        (a.item.transform?.[4] ?? 0) - (b.item.transform?.[4] ?? 0),
    )
    .map(({ item }) => item.str ?? '')
    .join('');
}

/**
 * @param {{ item: import('pdfjs-dist').TextItem, itemIndex: number }[]} entries
 */
function normalizeBuiltLineSignature(entries) {
  return builtLineSignature(entries).replace(/\s+/g, ' ').trim();
}

/**
 * 페이지 전체가 [A,B,C,A,B,C]처럼 반복되면 앞 절반만 유지
 * @param {typeof builtLines} builtLines
 */
function dedupeMirroredPageBlock(builtLines) {
  const sigs = builtLines.map((line) =>
    normalizeBuiltLineSignature(line.entries),
  );
  const n = sigs.length;
  if (n < 2 || n % 2 !== 0) return builtLines;
  const half = n / 2;
  for (let i = 0; i < half; i++) {
    if (sigs[i] !== sigs[i + half]) return builtLines;
  }
  return builtLines.slice(0, half);
}

/**
 * 같은 줄 문장이 다른 y(검색·출력 레이어)로 한 번 더 들어온 경우 — 첫 줄만
 * @param {typeof builtLines} builtLines — y 내림차순(위→아래)
 */
function dedupeRepeatedBuiltLines(builtLines) {
  const seen = new Set();
  /** @type {typeof builtLines} */
  const kept = [];
  for (const line of builtLines) {
    const sig = normalizeBuiltLineSignature(line.entries);
    if (!sig) continue;
    if (seen.has(sig)) continue;
    seen.add(sig);
    kept.push(line);
  }
  return kept;
}

/**
 * @param {typeof builtLines} builtLines
 */
function dedupeOverlayBuiltLines(builtLines) {
  return dedupeRepeatedBuiltLines(dedupeMirroredPageBlock(builtLines));
}

/**
 * @param {import('pdfjs-dist').TextItem} item
 */
function pdfItemFontSize(item) {
  const t = item.transform ?? [];
  return Math.max(
    Math.abs(t[0] ?? 0),
    Math.abs(t[3] ?? 0),
    Math.hypot(t[2] ?? 0, t[3] ?? 0),
    8,
  );
}

/**
 * @param {{ item: import('pdfjs-dist').TextItem, itemIndex: number }} prev
 * @param {import('pdfjs-dist').TextItem} item
 */
function shouldStartNewTextLine(prev, item) {
  if (!prev) return false;
  const prevItem = prev.item;
  if (prevItem.hasEOL) return true;

  const y0 = prevItem.transform?.[5] ?? 0;
  const y1 = item.transform?.[5] ?? 0;
  const s0 = pdfItemFontSize(prevItem);
  const s1 = pdfItemFontSize(item);
  const lineH = Math.max(s0, s1) * 0.55;
  if (Math.abs(y0 - y1) > lineH) return true;

  const ratio = Math.max(s0, s1) / Math.min(s0, s1);
  if (ratio > FONT_LINE_SPLIT_RATIO) return true;

  const f0 = prevItem.fontName ?? '';
  const f1 = item.fontName ?? '';
  if (f0 && f1 && f0 !== f1) return true;

  const prevStr = prevItem.str ?? '';
  // Hancom 등: 공백 항목 width가 다음 글자까지 넓게 잡혀 x-reset 오탐 → 어절마다 줄바꿈
  if (!/^\s+$/.test(prevStr)) {
    const xEnd =
      (prevItem.transform?.[4] ?? 0) +
      (prevItem.width ?? prevItem.str.length * s0 * 0.5);
    const xStart = item.transform?.[4] ?? 0;
    if (xStart < xEnd - LINE_X_RESET_PT) return true;
  }

  return false;
}

/**
 * @param {{ item: import('pdfjs-dist').TextItem, itemIndex: number }[]} entries
 * @param {string} text
 * @param {TextItemRef[]} itemRefs
 * @param {(gap: number, lineH: number, left: string, right: string) => boolean} shouldGapSpace
 * @param {{ trailingNewline?: boolean }} [opts]
 */
function appendBuiltLine(entries, text, itemRefs, shouldGapSpace, opts = {}) {
  if (!entries.length) return text;
  const trailingNewline = opts.trailingNewline !== false;

  entries.sort(
    (a, b) => (a.item.transform?.[4] ?? 0) - (b.item.transform?.[4] ?? 0),
  );

  for (let i = 0; i < entries.length; i++) {
    const { item, itemIndex } = entries[i];
    const start = text.length;
    text += item.str;
    itemRefs.push({ start, end: text.length, itemIndex });
    if (i < entries.length - 1) {
      const gap =
        (entries[i + 1].item.transform?.[4] ?? 0) -
        ((item.transform?.[4] ?? 0) + (item.width ?? 0));
      const lineH =
        Math.max(
          Math.hypot(item.transform?.[2] ?? 0, item.transform?.[3] ?? 0),
          8,
        ) * 0.35;
      const nextStr = entries[i + 1].item.str ?? '';
      if (shouldGapSpace(gap, lineH, item.str, nextStr)) {
        text += ' ';
      }
    }
  }
  return trailingNewline ? `${text}\n` : text;
}

/**
 * @param {TextEntry[]} entries
 * @param {(gap: number, lineH: number, left: string, right: string) => boolean} shouldGapSpace
 * @returns {{ text: string, itemRefs: TextItemRef[] }}
 */
function joinLineEntries(entries, shouldGapSpace) {
  /** @type {TextItemRef[]} */
  const itemRefs = [];
  const text = appendBuiltLine(entries, '', itemRefs, shouldGapSpace, {
    trailingNewline: false,
  });
  return { text, itemRefs };
}

/**
 * 줄 문자열·refs·폰트를 한 번만 조립해 BuiltLine에 붙인다.
 * @param {{ y: number, entries: TextEntry[] }} line
 */
function materializeBuiltLine(line) {
  const sorted = [...line.entries].sort(
    (a, b) => (a.item.transform?.[4] ?? 0) - (b.item.transform?.[4] ?? 0),
  );
  const joined = joinLineEntries(sorted, shouldInsertSpaceBetweenPdfItems);
  const joinedLayout = joinLineEntries(sorted, (gap, lineH) =>
    shouldInsertLayoutSpaceBetweenPdfItems(gap, lineH),
  );
  return {
    y: line.y,
    entries: sorted,
    text: joined.text,
    textLayout: joinedLayout.text,
    lineRefs: joined.itemRefs,
    lineRefsLayout: joinedLayout.itemRefs,
    startFont: lineFirstFontSize(sorted),
    endFont: lineFontSize(sorted),
  };
}

/**
 * @param {{ y: number, entries: TextEntry[] }[]} builtLines
 */
function materializeBuiltLines(builtLines) {
  return builtLines.map((line) => materializeBuiltLine(line));
}

/**
 * @param {string} leftText — 직전 줄
 * @param {string} rightLine — 다음 줄
 * @param {number} leftFont
 * @param {number} rightFont
 * @param {{ prevY?: number, nextY?: number, leftLineOnly?: string }} [layout]
 * @returns {'' | '\n'}
 */
export function hangulSoftWrapSeparator(
  leftText,
  rightLine,
  leftFont,
  rightFont,
  layout = {},
) {
  const left = String(leftText ?? '');
  const right = String(rightLine ?? '');
  if (!left || !right) return '\n';

  const fontLo = Math.min(leftFont, rightFont);
  const fontHi = Math.max(leftFont, rightFont);
  if (fontLo > 0 && fontHi / fontLo > FONT_LINE_SPLIT_RATIO) return '\n';

  const { prevY, nextY } = layout;
  if (Number.isFinite(prevY) && Number.isFinite(nextY)) {
    const dy = prevY - nextY;
    const ref = Math.max(leftFont, rightFont, 8);
    if (dy < ref * SOFT_WRAP_DY_MIN_RATIO || dy > ref * SOFT_WRAP_DY_MAX_RATIO) {
      return '\n';
    }
  }

  const leftLine = String(layout.leftLineOnly ?? left);
  if (
    Number.isFinite(prevY) &&
    leftLine.replace(INLINE_SPACE_RE_END, '').length < SOFT_WRAP_MIN_LEFT_CHARS
  ) {
    return '\n';
  }

  let li = left.length - 1;
  while (li >= 0 && isInlineSpaceChar(left[li])) li -= 1;
  const L = li >= 0 ? left[li] : '';

  let ri = 0;
  while (ri < right.length && isInlineSpaceChar(right[ri])) ri += 1;
  if (ri >= right.length) return '\n';
  const R = right[ri];

  if (SOFT_BREAK_KEEP_NEXT.has(R)) return '\n';
  if (isLikelyHangulEojeolBoundary(left, right)) return '\n';
  if (isHangulSyllableChar(L) && isHangulSyllableChar(R)) return '';
  return '\n';
}

/**
 * @param {TextEntry[]} entries
 */
function lineFontSize(entries) {
  if (!entries.length) return 12;
  return pdfItemFontSize(entries[entries.length - 1].item);
}

/**
 * @param {TextEntry[]} entries
 */
function lineFirstFontSize(entries) {
  if (!entries.length) return 12;
  return pdfItemFontSize(entries[0].item);
}


/**
 * @param {TextEntry[]} orderedEntries — sourceItems 순서의 부분집합
 * @returns {BuiltLine[]}
 */
function buildBuiltLinesFromEntries(orderedEntries) {
  /** @type {BuiltLine[]} */
  const builtLines = [];
  /** @type {TextEntry[]} */
  let bucket = [];

  const flush = () => {
    if (!bucket.length) return;
    const y = bucket[0].item.transform?.[5] ?? 0;
    builtLines.push({ y, entries: bucket });
    bucket = [];
  };

  for (const row of orderedEntries) {
    if (bucket.length && shouldStartNewTextLine(bucket[bucket.length - 1], row.item)) {
      flush();
    }
    bucket.push(row);
    if (row.item.hasEOL) flush();
  }
  flush();

  builtLines.sort((a, b) => b.y - a.y);
  return materializeBuiltLines(dedupeOverlayBuiltLines(builtLines));
}

/**
 * @param {import('pdfjs-dist').TextItem[]} sourceItems
 * @returns {BuiltLine[]}
 */
function buildUniqueLines(sourceItems) {
  /** @type {TextEntry[]} */
  const allEntries = [];
  sourceItems.forEach((item, itemIndex) => {
    if (!('str' in item) || !item.str) return;
    allEntries.push({ item, itemIndex });
  });

  const spread = splitSpreadColumns(sourceItems);
  if (spread) {
    return [
      ...buildBuiltLinesFromEntries(spread.left),
      ...buildBuiltLinesFromEntries(spread.right),
    ];
  }

  const columns = splitPageColumns(sourceItems);
  if (columns) {
    return [
      ...buildBuiltLinesFromEntries(columns.left),
      ...buildBuiltLinesFromEntries(columns.right),
    ];
  }

  return buildBuiltLinesFromEntries(allEntries);
}

/**
 * @param {import('pdfjs-dist').TextItem[]} items
 */
export function buildPageText(items) {
  const sourceItems = dedupeOverlayTextItems(items);
  const uniqueLines = buildUniqueLines(sourceItems);

  let text = '';
  let textLayout = '';
  /** @type {TextItemRef[]} */
  const itemRefs = [];
  /** @type {TextItemRef[]} */
  const itemRefsLayout = [];

  for (let li = 0; li < uniqueLines.length; li += 1) {
    const line = uniqueLines[li];
    if (li > 0) {
      const prev = uniqueLines[li - 1];
      const softLayout = {
        prevY: prev.y,
        nextY: line.y,
        leftLineOnly: prev.text,
      };
      text += hangulSoftWrapSeparator(
        prev.text,
        line.text,
        prev.endFont,
        line.startFont,
        softLayout,
      );
      textLayout += hangulSoftWrapSeparator(
        prev.textLayout,
        line.textLayout,
        prev.endFont,
        line.startFont,
        { ...softLayout, leftLineOnly: prev.textLayout },
      );
    }

    const base = text.length;
    text += line.text;
    for (const ref of line.lineRefs) {
      itemRefs.push({
        start: base + ref.start,
        end: base + ref.end,
        itemIndex: ref.itemIndex,
      });
    }

    const baseLayout = textLayout.length;
    textLayout += line.textLayout;
    for (const ref of line.lineRefsLayout) {
      itemRefsLayout.push({
        start: baseLayout + ref.start,
        end: baseLayout + ref.end,
        itemIndex: ref.itemIndex,
      });
    }
  }

  if (uniqueLines.length > 0) {
    text += '\n';
    textLayout += '\n';
  }

  return { text, itemRefs, textLayout, itemRefsLayout };
}
