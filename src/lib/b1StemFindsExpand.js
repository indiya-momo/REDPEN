/**
 * B1(잘못된 표현 동사·형용사) finds 전개 — 순수 가드·병합.
 * Kiwi joinSent는 스크립트에서만 호출.
 * @see project-docs/b1-stem-finds-expand-design-2026-08-06.md
 */

/** @type {readonly { form: string, tag: string }[]} */
export const B1_EXPAND_ENDING_MORPHS = Object.freeze([
  { form: '은', tag: 'ETM' },
  { form: '는', tag: 'ETM' },
  { form: '을', tag: 'ETM' },
  { form: '고', tag: 'EC' },
  { form: '어', tag: 'EC' },
  { form: '아', tag: 'EC' },
  { form: '었', tag: 'EP' },
  { form: '았', tag: 'EP' },
]);

/** 어간 태그 — VV·VA 합집합 */
export const B1_EXPAND_STEM_TAGS = Object.freeze(['VV', 'VA']);

/** 짧은·위험·명사성 어간 — 전개 제외 */
export const B1_EXPAND_STEM_BLOCKLIST = Object.freeze(
  new Set(['스런', '꺼야', '오랫만', '삼가토록']),
);

/**
 * 받침 불일치 등 — find 기준 스킵
 * @type {ReadonlySet<string>}
 */
export const B1_EXPAND_FIND_SKIP = Object.freeze(
  new Set(['안절부절하', '잊혀', '짜여진']),
);

/** 이미 관형·일부 활용 표면으로 보이는 끝 (재전개 금지) */
const ALREADY_FINITE_TAILS = Object.freeze([
  '는',
  '은',
  '을',
  '던',
  '된',
  'ㄹ',
  'ㄴ',
]);

const HANGUL_ONLY = /^[\uAC00-\uD7A3]+$/u;

/**
 * @param {string} surface
 */
export function hangulOnlyB1(surface) {
  return String(surface ?? '')
    .normalize('NFC')
    .replace(/[^\uAC00-\uD7A3]/gu, '');
}

/**
 * @param {string} findHangul
 */
export function findLooksAlreadyFinite(findHangul) {
  const h = hangulOnlyB1(findHangul);
  if (h.length < 2) return false;
  return ALREADY_FINITE_TAILS.some((t) => h.endsWith(t));
}

/**
 * @param {{ find?: string, replace?: string, dividerGroup?: string }} row
 * @returns {string | null} 스킵 이유, 전개 가능하면 null
 */
export function b1ExpandSkipReason(row) {
  if (String(row?.dividerGroup ?? '').trim() !== 'B1') {
    return 'not-B1';
  }
  const find = String(row?.find ?? '').trim();
  const replace = String(row?.replace ?? '').trim();
  if (!find || !replace) return 'empty';
  if (/\s/.test(find)) return 'spaced-find';
  if (/\s/.test(replace) || replace.includes('또는')) return 'complex-replace';
  if (B1_EXPAND_FIND_SKIP.has(find)) return 'batchim-mismatch-skip';
  if (B1_EXPAND_STEM_BLOCKLIST.has(find)) return 'stem-blocklist';
  const stem = hangulOnlyB1(find);
  if (!stem || stem !== find.normalize('NFC')) return 'non-hangul-find';
  if (findLooksAlreadyFinite(stem)) return 'already-finite';
  return null;
}

/**
 * @param {string} stem
 * @param {string} surface
 */
export function isValidB1ExpandedSurface(stem, surface) {
  const s = String(surface ?? '').normalize('NFC').trim();
  if (!s || !HANGUL_ONLY.test(s)) return false;
  if (s === stem) return false;
  if (!s.startsWith(stem) && s.length < stem.length) {
    // join이 축약(한←하+은)하면 startsWith 실패 — 허용하되 자모 없음만
  }
  return true;
}

/**
 * @param {string} find
 * @param {string[] | undefined} existingFinds
 * @param {Iterable<string>} generated
 * @returns {string[] | undefined} 2개 미만이면 undefined (묶음 아님)
 */
export function mergeB1Finds(find, existingFinds, generated) {
  const set = new Set();
  const add = (v) => {
    const t = String(v ?? '').normalize('NFC').trim();
    if (t) set.add(t);
  };
  add(find);
  for (const f of existingFinds ?? []) add(f);
  for (const g of generated) {
    if (isValidB1ExpandedSurface(hangulOnlyB1(find) || find, g) || g === find) {
      add(g);
    }
  }
  // find는 항상 포함; 생성분 중 유효만 (위에서 stem===surface 제외했으나 find는 add됨)
  const list = [...set].toSorted((a, b) => {
    if (a === find) return -1;
    if (b === find) return 1;
    return a.localeCompare(b, 'ko');
  });
  if (list.length < 2) return undefined;
  return list;
}

/**
 * @param {{ joinSent: Function }} kiwi
 * @param {string} stem
 * @returns {string[]}
 */
export function joinB1StemSurfaces(kiwi, stem) {
  const out = new Set();
  for (const tag of B1_EXPAND_STEM_TAGS) {
    for (const ending of B1_EXPAND_ENDING_MORPHS) {
      try {
        const result = kiwi.joinSent(
          [
            { form: stem, tag },
            { form: ending.form, tag: ending.tag },
          ],
          true,
        );
        const str = String(result?.str ?? '').normalize('NFC').trim();
        if (isValidB1ExpandedSurface(stem, str)) out.add(str);
      } catch {
        /* skip morph pair */
      }
    }
  }
  return [...out];
}

/**
 * @param {object} row
 * @param {{ joinSent: Function }} kiwi
 * @returns {{ row: object, changed: boolean, skip?: string, added?: string[] }}
 */
export function expandB1SpellingRow(row, kiwi) {
  const skip = b1ExpandSkipReason(row);
  if (skip) return { row, changed: false, skip };

  const find = String(row.find).trim();
  const stem = hangulOnlyB1(find);
  const generated = joinB1StemSurfaces(kiwi, stem);
  const prev = Array.isArray(row.finds) ? [...row.finds] : undefined;
  const merged = mergeB1Finds(find, prev, generated);

  if (!merged) {
    return { row, changed: false, added: [] };
  }

  const prevKey = (prev ?? [find]).toSorted().join('\u0001');
  const nextKey = merged.toSorted().join('\u0001');
  if (prevKey === nextKey && (prev?.length ?? 0) >= 2) {
    return { row, changed: false, added: [] };
  }

  const added = merged.filter((s) => s !== find && !(prev ?? []).includes(s));
  return {
    row: { ...row, finds: merged },
    changed: true,
    added,
  };
}
