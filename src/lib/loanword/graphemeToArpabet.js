/**
 * 철자 → 발음(ARPABET) 추정 모듈 (G2P 폴백).
 *
 * 발음 사전(CMU)에 없는 단어를 위해 영어 철자 규칙으로 발음을 추정한다.
 * 사전 조회와 달리 근사치이므로, 결과는 반드시 "철자 기반 추정"으로
 * 표시해야 한다. (교정자가 사전에 없는 고유명사를 철자 보고 읽어내는
 * 일을 기계가 대신하는 것 — 정확도보다 "결과가 반드시 나온다"가 목적)
 *
 * 검증: 국립국어원 용례집의 발음 사전 미등재 1,530건 대조에서
 * 약 34%가 용례집 표기와 완전 일치 (2026-07-12 측정).
 */

/** 어말 접미 패턴 (긴 것부터 검사, 하나만 적용) */
const SUFFIX_RULES = [
  ['borough', 'B ER0 AH0'],
  ['burgh', 'B ER0 G'],
  ['burg', 'B ER0 G'],
  ['ington', 'IH0 NG T AH0 N'],
  ['tion', 'SH AH0 N'],
  ['sion', 'SH AH0 N'],
  ['ville', 'V IH0 L'],
  ['shire', 'SH ER0'],
  ['ston', 'S T AH0 N'],
  ['son', 'S AH0 N'],
  ['ton', 'T AH0 N'],
  ['ham', 'AH0 M'],
  ['ley', 'L IY0'],
  ['ney', 'N IY0'],
  ['ey', 'IY0'],
  ['ay', 'EY1'],
  ['ee', 'IY1'],
  ['gue', 'G'],
  ['que', 'K'],
  ['y', 'IY0'],
  ['a', 'AH0'],
  ['o', 'OW0'],
  ['i', 'IY0'],
];

const VOWEL_CHARS = 'aeiouy';
const isVowelChar = (c) => VOWEL_CHARS.includes(c);

/**
 * @param {string} word 영어 철자 (한 단어)
 * @returns {string} ARPABET 발음 문자열 (빈 문자열이면 추정 불가)
 */
export function graphemeToArpabet(word) {
  let s = String(word).trim().toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return '';
  const out = [];
  let suffix = null;

  for (const [suf, arp] of SUFFIX_RULES) {
    if (s.length >= suf.length + 2 && s.endsWith(suf)) {
      suffix = arp;
      s = s.slice(0, -suf.length);
      break;
    }
  }

  let i = 0;
  const n = s.length;
  const at = (k) => s[i + k] ?? '';

  while (i < n) {
    const r = s.slice(i);
    const prev = s[i - 1] ?? '';

    /* ── 자음 조합 ── */
    if (r.startsWith('schw')) { out.push('SH', 'W'); i += 4; continue; }
    if (r.startsWith('sch')) { out.push('SH'); i += 3; continue; }
    if (r.startsWith('tch')) { out.push('CH'); i += 3; continue; }
    if (r.startsWith('chr')) { out.push('K', 'R'); i += 3; continue; }
    if (r.startsWith('ch')) { out.push('CH'); i += 2; continue; }
    if (r.startsWith('sh')) { out.push('SH'); i += 2; continue; }
    if (r.startsWith('th')) { out.push('TH'); i += 2; continue; }
    if (r.startsWith('ph')) { out.push('F'); i += 2; continue; }
    if (r.startsWith('wh')) { out.push('W'); i += 2; continue; }
    if (r.startsWith('ck')) { out.push('K'); i += 2; continue; }
    if (r.startsWith('qu')) { out.push('K', 'W'); i += 2; continue; }
    if (i === 0 && r.startsWith('kn')) { out.push('N'); i += 2; continue; }
    if (i === 0 && r.startsWith('wr')) { out.push('R'); i += 2; continue; }
    if (i === 0 && r.startsWith('gh')) { out.push('G'); i += 2; continue; }
    if (r.startsWith('gh')) { i += 2; continue; } // 모음 뒤 gh 묵음 (light)
    if (r.startsWith('dge')) { out.push('JH'); i += 3; continue; }
    if (r.startsWith('ng')) {
      if (isVowelChar(at(2))) out.push('NG', 'G');
      else out.push('NG');
      i += 2; continue;
    }
    if (r.startsWith('mb') && i + 2 === n) { out.push('M'); i += 2; continue; } // lamb형
    if (r.startsWith('cc')) {
      out.push('K');
      if ('eiy'.includes(at(2))) out.push('S');
      i += 2; continue;
    }
    if (s[i] === 'c') { out.push('eiy'.includes(at(1)) ? 'S' : 'K'); i += 1; continue; }
    if (s[i] === 'x') { out.push('K', 'S'); i += 1; continue; }
    if (s[i] === 'j') { out.push('JH'); i += 1; continue; }
    if (s[i] === 'g') { out.push('G'); i += 1; continue; }
    if (s[i] === 'y' && (i === 0 || (!isVowelChar(prev) && isVowelChar(at(1))))) {
      out.push('Y'); i += 1; continue;
    }

    /* ── 모음 조합 ── */
    if (r.startsWith('eigh')) { out.push('EY1'); i += 4; continue; }
    if (r.startsWith('igh')) { out.push('AY1'); i += 3; continue; }
    if (r.startsWith('ear')) { out.push('IH1', 'R'); i += 3; continue; }
    if (r.startsWith('air')) { out.push('EH1', 'R'); i += 3; continue; }
    if (r.startsWith('ai')) { out.push('EY1'); i += 2; continue; }
    if (r.startsWith('ay')) { out.push('EY1'); i += 2; continue; }
    if (r.startsWith('au')) { out.push('AO1'); i += 2; continue; }
    if (r.startsWith('aw')) { out.push('AO1'); i += 2; continue; }
    if (r.startsWith('ea')) { out.push('IY1'); i += 2; continue; }
    if (r.startsWith('ee')) { out.push('IY1'); i += 2; continue; }
    if (r.startsWith('ei')) { out.push('EY1'); i += 2; continue; }
    if (r.startsWith('eu')) { out.push('UW1'); i += 2; continue; }
    if (r.startsWith('ew')) { out.push('UW1'); i += 2; continue; }
    if (r.startsWith('ey')) { out.push('EY1'); i += 2; continue; }
    if (r.startsWith('ie')) { out.push(i + 2 >= n ? 'AY1' : 'IY1'); i += 2; continue; }
    if (r.startsWith('oa')) { out.push('OW1'); i += 2; continue; }
    if (r.startsWith('oe')) { out.push('OW1'); i += 2; continue; }
    if (r.startsWith('oi')) { out.push('OY1'); i += 2; continue; }
    if (r.startsWith('oy')) { out.push('OY1'); i += 2; continue; }
    if (r.startsWith('oo')) { out.push('kd'.includes(at(2)) ? 'UH1' : 'UW1'); i += 2; continue; }
    if (r.startsWith('ou')) { out.push('AW1'); i += 2; continue; }
    if (r.startsWith('ow')) { out.push(i + 2 >= n ? 'OW1' : 'AW1'); i += 2; continue; }
    if (r.startsWith('ue')) { out.push('UW1'); i += 2; continue; }
    if (r.startsWith('ui')) { out.push('UW1'); i += 2; continue; }
    if (r.startsWith('ar')) { out.push('AA1', 'R'); i += 2; continue; }
    if (r.startsWith('or')) { out.push('AO1', 'R'); i += 2; continue; }
    if (r.startsWith('er') || r.startsWith('ir') || r.startsWith('ur') || r.startsWith('yr')) {
      out.push('ER0'); i += 2; continue;
    }

    /* ── 단모음 (magic-e: 모음 + 자음 1개 + 어말 e → 장모음) ── */
    const c = s[i];
    if ('aeiou'.includes(c)) {
      const nx = at(1);
      const magic = nx && !isVowelChar(nx) && at(2) === 'e' && i + 3 === n;
      if (magic) {
        out.push({ a: 'EY1', e: 'IY1', i: 'AY1', o: 'OW1', u: 'UW1' }[c]);
        i += 1; continue;
      }
      if (c === 'e' && i + 1 === n) { i += 1; continue; } // 어말 e 묵음
      out.push({ a: 'AE1', e: 'EH1', i: 'IH1', o: 'AA1', u: 'AH1' }[c]);
      i += 1; continue;
    }
    if (c === 'y') { out.push('IH1'); i += 1; continue; }

    /* ── 단자음 (겹자음은 하나로) ── */
    const CONS = {
      b: 'B', d: 'D', f: 'F', h: 'HH', k: 'K', l: 'L', m: 'M',
      n: 'N', p: 'P', r: 'R', s: 'S', t: 'T', v: 'V', w: 'W', z: 'Z',
    };
    if (CONS[c]) {
      if (s[i + 1] === c) i += 1;
      out.push(CONS[c]);
      i += 1; continue;
    }
    i += 1; // 알 수 없는 문자는 건너뜀
  }

  if (suffix) out.push(suffix);
  return out.join(' ');
}
