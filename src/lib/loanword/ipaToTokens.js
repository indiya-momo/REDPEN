/**
 * IPA(국제 음성 기호) → 규칙 엔진 토큰 어댑터.
 *
 * eSpeak-NG(영국식 en-gb)가 출력하는 IPA를 표기 규칙 엔진이 먹는
 * 토큰 열로 바꾼다. ARPABET 어댑터(arpabet.js)와 같은 역할이며,
 * 영국식 발음이 입력이므로 미국식 교정(철자 힌트 등)은 필요 없고
 * 승인된 관용 조정(어말 a → 아, -son → 슨)만 동일하게 적용한다.
 *
 * 검증: 용례집 사전 미등재 1,512건 대조에서 49.9% 완전 일치
 * (자체 철자 추정 34.5% 대비 +15.4%p, 2026-07-13 측정)
 */

const DIPHTHONGS = [
  ['aɪ', 'ai'], ['aʊ', 'au'], ['eɪ', 'ei'], ['ɔɪ', 'ɔi'], ['əʊ', 'ou'], ['oʊ', 'ou'],
];
/** 중향 이중모음: 모음 + [ə]로 풀어 이어·에어·우어가 되게 한다 */
const CENTERING = [['ɪə', 'i'], ['eə', 'e'], ['ʊə', 'u']];
const IPA_VOWELS = {
  ɪ: 'i', i: 'i', ᵻ: 'i', e: 'e', ɛ: 'e', æ: 'æ', a: 'æ',
  ɑ: 'ɑ', ɒ: 'ɔ', ʌ: 'ʌ', ɔ: 'ɔ', ʊ: 'u', u: 'u', ə: 'ə', ɜ: 'ə', ɐ: 'ə',
};
const IPA_CONSONANTS = {
  p: 'p', b: 'b', t: 't', d: 'd', k: 'k', g: 'g', ɡ: 'g',
  f: 'f', v: 'v', θ: 'θ', ð: 'ð', s: 's', z: 'z', ʃ: 'ʃ', ʒ: 'ʒ',
  m: 'm', n: 'n', ŋ: 'ŋ', l: 'l', ɹ: 'r', r: 'r', h: 'h',
};
const OBSTRUENTS = new Set(['p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 'θ', 'ð', 's', 'z']);
const isVowelish = (t) => t && (t.kind === 'V' || t.kind === 'G');

/**
 * @param {string} ipaRaw eSpeak-NG --ipa 출력 (예: "tˈəʊsən")
 * @param {string} [word] 영어 철자 (관용 조정용)
 * @returns {{ tokens: Array, notes: Array<string> }}
 */
export function ipaToTokens(ipaRaw, word) {
  const s = String(ipaRaw).replace(/[ˈˌ̩̯͡]/g, '').trim();
  const tokens = [];
  const notes = [];
  let i = 0;

  while (i < s.length) {
    const two = s.slice(i, i + 2);
    const diph = DIPHTHONGS.find(([d]) => d === two);
    if (diph) {
      tokens.push({ kind: 'V', diph: diph[1] });
      i += 2;
      if (s[i] === 'ː') i += 1;
      continue;
    }
    const centering = CENTERING.find(([d]) => d === two);
    if (centering) {
      tokens.push({ kind: 'V', ph: centering[1] });
      tokens.push({ kind: 'V', ph: 'ə' });
      i += 2;
      continue;
    }
    if (two === 'tʃ') { tokens.push({ kind: 'C', ph: 'ʧ' }); i += 2; continue; }
    if (two === 'dʒ') { tokens.push({ kind: 'C', ph: 'ʤ' }); i += 2; continue; }
    const c = s[i];
    if (c === 'w') { tokens.push({ kind: 'G', ph: 'w' }); i += 1; continue; }
    if (c === 'j') { tokens.push({ kind: 'G', ph: 'j' }); i += 1; continue; }
    if (IPA_VOWELS[c]) {
      const token = { kind: 'V', ph: IPA_VOWELS[c] };
      i += 1;
      if (s[i] === 'ː') { token.long = true; i += 1; }
      tokens.push(token);
      continue;
    }
    if (IPA_CONSONANTS[c]) { tokens.push({ kind: 'C', ph: IPA_CONSONANTS[c] }); i += 1; continue; }
    i += 1; // 미지 기호는 건너뜀
  }

  // 모음 뒤 r가 자음 앞·어말에 남아 있으면 영국식으로 정리 (연결음 r 등)
  for (let k = 0; k < tokens.length; k += 1) {
    const t = tokens[k];
    if (!(t.kind === 'C' && t.ph === 'r')) continue;
    const prev = tokens[k - 1];
    const next = tokens[k + 1];
    const beforeVowel = next && (next.kind === 'V' || (next.kind === 'G' && next.ph === 'j'));
    if (!prev || prev.kind !== 'V' || beforeVowel) continue;
    if (prev.diph || ['i', 'u', 'e'].includes(prev.ph)) {
      tokens.splice(k, 1, { kind: 'V', ph: 'ə' });
    } else {
      tokens.splice(k, 1);
      prev.long = true;
      k -= 1;
    }
  }

  // [au]+[ə] → [auə] (제8항 아워)
  for (let k = 0; k < tokens.length - 1; k += 1) {
    if (tokens[k].diph === 'au' && tokens[k + 1].kind === 'V' && tokens[k + 1].ph === 'ə' && !tokens[k + 1].diph) {
      tokens.splice(k, 2, { kind: 'V', diph: 'auə' });
    }
  }

  // t+s / d+z 병합 (모음 앞 제외, 제4항)
  for (let k = 0; k < tokens.length - 1; k += 1) {
    const t = tokens[k];
    const next = tokens[k + 1];
    const after = tokens[k + 2];
    if (t.kind !== 'C' || next.kind !== 'C' || isVowelish(after)) continue;
    if (t.ph === 't' && next.ph === 's') tokens.splice(k, 2, { kind: 'C', ph: 'ʦ' });
    else if (t.ph === 'd' && next.ph === 'z') tokens.splice(k, 2, { kind: 'C', ph: 'ʣ' });
  }

  // 어말 음절성 l 정규화 (장애음 + [ə] + [l])
  const n = tokens.length;
  if (
    n >= 3 &&
    tokens[n - 1].kind === 'C' && tokens[n - 1].ph === 'l' &&
    tokens[n - 2].kind === 'V' && tokens[n - 2].ph === 'ə' && !tokens[n - 2].diph &&
    tokens[n - 3].kind === 'C' && OBSTRUENTS.has(tokens[n - 3].ph)
  ) {
    tokens.splice(n - 2, 1);
  }

  // 관용 조정 (승인 범위): 어말 철자 a → 아, -son → 슨
  if (word) {
    const spelling = String(word).trim().toLowerCase();
    const last = tokens[tokens.length - 1];
    if (/a$/.test(spelling) && last && last.kind === 'V' && !last.diph && last.ph === 'ə') {
      last.ph = 'ɑ';
      notes.push('관용 조정: 어말 철자 a는 아로 (용례집 관행)');
    }
    const m = tokens.length;
    if (
      /son$/.test(spelling) && m >= 3 &&
      tokens[m - 1].kind === 'C' && tokens[m - 1].ph === 'n' &&
      tokens[m - 2].kind === 'V' && !tokens[m - 2].diph && tokens[m - 2].ph === 'ə' &&
      tokens[m - 3].kind === 'C' && tokens[m - 3].ph === 's'
    ) {
      tokens.splice(m - 2, 1);
      notes.push('관용 조정: 어말 -son은 슨으로 (용례집 관행)');
    }
  }

  return { tokens, notes };
}
