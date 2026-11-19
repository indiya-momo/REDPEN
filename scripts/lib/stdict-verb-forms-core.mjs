/**
 * 표준국어대사전 용언 TSV → 띄움 필수 활용형 집합 (순수 로직).
 * 생성·대조 스크립트가 같이 import한다. 최상위에서 파일을 쓰지 않는다.
 */

export const MIN_SYLLABLES = 3;

/**
 * 한글 음절 수. 공백·기호는 세지 않는다.
 * @param {string} s
 */
export function hangulSyllableCount(s) {
  let n = 0;
  for (const ch of String(s)) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xac00 && cp <= 0xd7a3) n += 1;
  }
  return n;
}

/**
 * 표제어에서 붙임표와 어깨번호를 뺀 기본형. `갈-리다03` → `갈리다`
 * @param {string} word
 */
export function cleanLemma(word) {
  return String(word ?? '')
    .replace(/-/g, '')
    .replace(/\d+$/g, '');
}

/**
 * @param {string} text
 */
export function parseVerbsTsv(text) {
  const lines = text.split(/\r?\n/);
  if (!lines.length) {
    throw new Error('빈 TSV입니다.');
  }
  const header = lines[0].split('\t');
  if (
    header[0] !== '표제어' ||
    header[1] !== '품사' ||
    header[2] !== '복합어' ||
    header[3] !== '활용형'
  ) {
    throw new Error(`예상과 다른 머리글입니다: ${lines[0]}`);
  }

  /** @type {Map<string, { compound: Set<string>, simple: Set<string> }>} */
  const formSides = new Map();
  /** @type {{ word: string, pos: string, isCompound: boolean, forms: string[] }[]} */
  const rows = [];
  let verbCount = 0;
  let compoundVerbCount = 0;
  let verbWithFormsCount = 0;
  let skippedRows = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split('\t');
    if (cols.length < 4) {
      skippedRows += 1;
      continue;
    }
    const word = cols[0];
    const pos = cols[1] || '';
    const isCompound = cols[2] === '1';
    const forms = cols[3] ? cols[3].split(',').filter(Boolean) : [];
    if (!word) {
      skippedRows += 1;
      continue;
    }
    verbCount += 1;
    if (isCompound) compoundVerbCount += 1;
    if (forms.length) verbWithFormsCount += 1;
    rows.push({ word, pos, isCompound, forms });
    const side = isCompound ? 'compound' : 'simple';
    for (const form of forms) {
      let bucket = formSides.get(form);
      if (!bucket) {
        bucket = { compound: new Set(), simple: new Set() };
        formSides.set(form, bucket);
      }
      bucket[side].add(word);
    }
  }

  return {
    formSides,
    rows,
    verbCount,
    compoundVerbCount,
    verbWithFormsCount,
    skippedRows,
  };
}

/**
 * 띄움 필수 기본형·탈락 사유(기본형 단위).
 * 원본 판정 순서: 음절 → 혼합 → 복합 없음.
 * @param {Map<string, { compound: Set<string>, simple: Set<string> }>} formSides
 * @param {number} [minSyllables]
 */
export function collectSpaceRequiredLemmas(formSides, minSyllables = MIN_SYLLABLES) {
  /** @type {Map<string, Set<string>>} */
  const lemmaForms = new Map();
  /** @type {Map<string, { short: Set<string>, mixedHomograph: Set<string>, mixedOther: Set<string> }>} */
  const droppedByLemma = new Map();
  let mixedFormCount = 0;
  let spaceRequiredFormCount = 0;

  const noteDropped = (lemma, kind, form) => {
    let entry = droppedByLemma.get(lemma);
    if (!entry) {
      entry = {
        short: new Set(),
        mixedHomograph: new Set(),
        mixedOther: new Set(),
      };
      droppedByLemma.set(lemma, entry);
    }
    entry[kind].add(form);
  };

  for (const [form, sides] of formSides) {
    const hasCompound = sides.compound.size > 0;
    const hasSimple = sides.simple.size > 0;

    if (hangulSyllableCount(form) < minSyllables) {
      if (hasCompound) {
        for (const word of sides.compound) {
          const lemma = cleanLemma(word);
          if (lemma) noteDropped(lemma, 'short', form);
        }
      }
      continue;
    }
    if (hasCompound && hasSimple) {
      mixedFormCount += 1;
      const simpleLemmas = new Set([...sides.simple].map(cleanLemma));
      for (const word of sides.compound) {
        const lemma = cleanLemma(word);
        if (!lemma) continue;
        noteDropped(
          lemma,
          simpleLemmas.has(lemma) ? 'mixedHomograph' : 'mixedOther',
          form,
        );
      }
      continue;
    }
    if (!hasCompound) continue;
    spaceRequiredFormCount += 1;
    for (const word of sides.compound) {
      const lemma = cleanLemma(word);
      if (!lemma) continue;
      let forms = lemmaForms.get(lemma);
      if (!forms) {
        forms = new Set();
        lemmaForms.set(lemma, forms);
      }
      forms.add(form);
    }
  }

  return {
    lemmaForms,
    droppedByLemma,
    mixedFormCount,
    spaceRequiredFormCount,
  };
}

/**
 * 붙임표 표제어 집합 H와 H∖K 배열. 빌드·런타임 ④ 게이트용.
 * K ⊆ H, |K|+|H∖K|=|H|를 검증한다.
 * @param {{ word: string, pos?: string }[]} rows
 * @param {Map<string, Set<string>>} lemmaForms
 */
export function collectHyphenOutsideK(rows, lemmaForms) {
  /** @type {Set<string>} */
  const H = new Set();
  for (const { word, pos } of rows ?? []) {
    if (!String(word ?? '').includes('-')) continue;
    if (!/동사|형용사|보조/.test(String(pos ?? ''))) continue;
    const lemma = cleanLemma(word);
    if (lemma) H.add(lemma);
  }
  const K = new Set(lemmaForms.keys());
  for (const k of K) {
    if (!H.has(k)) {
      throw new Error(`K ⊆ H 검증 실패: K에만 있음 «${k}»`);
    }
  }
  const hyphenLemmasOutsideK = [...H]
    .filter((l) => !K.has(l))
    .sort((a, b) => a.localeCompare(b, 'ko'));
  if (K.size + hyphenLemmasOutsideK.length !== H.size) {
    throw new Error(
      `|K∪(H∖K)|≠|H|: K=${K.size} outside=${hyphenLemmasOutsideK.length} H=${H.size}`,
    );
  }
  return { H, K, hyphenLemmasOutsideK };
}

/**
 * 붙임표 게이트 측정용. citation이 K·H∖K 어느 쪽인지 분류한다.
 * @param {string} citation
 * @param {{
 *   K: Set<string>,
 *   H: Set<string>,
 *   droppedByLemma: Map<string, { short: Set<string>, mixedHomograph: Set<string>, mixedOther: Set<string> }>,
 * }} sets
 * @returns {'inK'|'noForms'|'onlyShort'|'mixedHomograph'|'mixedOtherOnly'|'shortAndMixed'|'outsideH'}
 */
export function classifyHyphenLemma(citation, sets) {
  const q = String(citation ?? '');
  if (!q) return 'outsideH';
  if (sets.K.has(q)) return 'inK';
  if (!sets.H.has(q)) return 'outsideH';
  const d = sets.droppedByLemma.get(q);
  if (!d) return 'noForms';
  const hasShort = d.short.size > 0;
  const hasMixed = d.mixedHomograph.size + d.mixedOther.size > 0;
  if (hasShort && hasMixed) return 'shortAndMixed';
  if (hasShort) return 'onlyShort';
  if (d.mixedHomograph.size > 0) return 'mixedHomograph';
  if (d.mixedOther.size > 0) return 'mixedOtherOnly';
  return 'noForms';
}

/**
 * @param {Map<string, Set<string>>} lemmaForms
 */
export function lemmaFormsToObject(lemmaForms) {
  const lemmas = {};
  for (const lemma of [...lemmaForms.keys()].sort((a, b) =>
    a.localeCompare(b, 'ko'),
  )) {
    lemmas[lemma] = [...lemmaForms.get(lemma)].sort((a, b) =>
      a.localeCompare(b, 'ko'),
    );
  }
  return lemmas;
}
