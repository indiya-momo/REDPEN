/**
 * ARPABET(CMU 발음 사전의 발음 기호) → 규칙 엔진용 음소 토큰 변환.
 *
 * CMU 사전은 미국식 발음이고, 외래어 표기법의 보기는 영국식 발음 기준이므로
 * 여기서 "교정" 단계로 두 가지 정규화를 한다.
 *  1. 모음 뒤의 r 처리 (미국식 r 발음 → 영국식 기준):
 *     - i·u·e 뒤의 r → [ə]로 바꿈  (year 이어, tour 투어, air 에어)
 *     - ɑ·ɔ·ʌ·ə·æ 뒤의 r → 생략하고 앞 모음을 장모음 취급 (part 파트, corn 콘)
 *     - 모음 사이의 r은 그대로 둠 (sheriff의 r 등)
 *  2. 어말 음절성 l 정규화: 장애음 + [ə] + 어말 l 의 [ə]를 제거
 *     (apple [æpl] 애플, whistle 슬 — 고시 보기의 발음 표기와 일치시키기 위함)
 *
 * 토큰 형태:
 *   { kind: 'C', ph: 'p' }                      자음
 *   { kind: 'V', ph: 'a', long?: true }          단모음 (long: 장모음 — 제7항에 따라 표기엔 반영 안 함)
 *   { kind: 'V', diph: 'ai' }                    이중모음 (제8항)
 *   { kind: 'G', ph: 'w' | 'j' }                 반모음 (제9항)
 */

const ARPA_CONSONANTS = {
  B: 'b',
  CH: 'ʧ',
  D: 'd',
  DH: 'ð',
  F: 'f',
  G: 'g',
  HH: 'h',
  JH: 'ʤ',
  K: 'k',
  L: 'l',
  M: 'm',
  N: 'n',
  NG: 'ŋ',
  P: 'p',
  R: 'r',
  S: 's',
  SH: 'ʃ',
  T: 't',
  TH: 'θ',
  V: 'v',
  Z: 'z',
  ZH: 'ʒ',
};

const ARPA_VOWELS = {
  AA: { ph: 'ɑ' },
  AE: { ph: 'æ' },
  AH0: { ph: 'ə' },
  AH: { ph: 'ʌ' },
  AO: { ph: 'ɔ' },
  AW: { diph: 'au' },
  AY: { diph: 'ai' },
  EH: { ph: 'e' },
  ER: { ph: 'ə', long: true, fromER: true },
  EY: { diph: 'ei' },
  IH: { ph: 'i' },
  IY: { ph: 'i', long: true },
  OW: { diph: 'ou' },
  OY: { diph: 'ɔi' },
  UH: { ph: 'u' },
  UW: { ph: 'u', long: true },
};

/**
 * 어말 음절성 l 정규화를 적용할 자음 집합 (파열음 + 평마찰음).
 * ʃ·ʒ·파찰음은 제외한다 — 이들 뒤의 [ə]는 표기에 필요하다.
 * (special 스페셜, Rachel 레이철 — [ə]를 지우면 스페슐·레이칠이 됨)
 */
const OBSTRUENTS = new Set([
  'p', 'b', 't', 'd', 'k', 'g',
  'f', 'v', 'θ', 'ð', 's', 'z',
]);

const isVowelish = (t) => t && (t.kind === 'V' || t.kind === 'G');

/**
 * 철자 참고 조정 (구글 시트 외래어 목록 대조로 확인된 미국식·영국식 차이 보정).
 *  A. 철자가 o인 [ɑ] → [ɔ] (오)  — Donald 도널드, body 보디, comedy 코미디
 *     (미국식은 lot·don의 o를 [ɑ아]로 발음하지만 규정 보기는 영국식 [ɔ오] 기준)
 *  B. 철자가 a이고 r 앞인 [e] → [æ] (애) — Caroline 캐럴라인, parallel 패럴렐
 *     (미국식은 marry·merry 발음이 합쳐져 a가 [e에]로 남)
 * 철자와 발음의 대응은 모음 글자 묶음과 모음 음소의 순서 맞춤으로 추정하고,
 * 개수가 안 맞으면 보수적인 포함 검사로만 적용한다.
 */
function applySpellingHints(tokens, word, notes) {
  const spelling = String(word || '').toLowerCase();
  if (!spelling) return;
  const groups = spelling.match(/[aeiouy]+/g) || [];
  const vTokens = tokens.filter((t) => t.kind === 'V');
  const aligned = groups.length === vTokens.length;
  const letterOf = (t) => (aligned ? groups[vTokens.indexOf(t)] : null);

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.kind !== 'V' || t.diph) continue;

    if (t.ph === 'ɑ') {
      const g = letterOf(t);
      const fromO = g ? g.includes('o') : spelling.includes('o') && !spelling.includes('a');
      if (fromO) {
        t.ph = 'ɔ';
        notes.push('철자 참고 조정: 철자 o의 [ɑ] → [ɔ] (영국식 발음 기준, 오)');
      }
    } else if (t.ph === 'e') {
      const next = tokens[i + 1];
      if (next && next.kind === 'C' && next.ph === 'r') {
        const g = letterOf(t);
        const fromA = g ? g.includes('a') : spelling.includes('ar');
        if (fromA) {
          t.ph = 'æ';
          notes.push('철자 참고 조정: 철자 a의 [e] → [æ] (영국식 발음 기준, 애)');
        }
      }
    }
  }
}

/**
 * @param {string} arpabet 예: "W IH1 L Y AH0 M Z"
 * @param {string} [word] 영어 철자 (철자 참고 조정에 사용, 없으면 조정 생략)
 * @returns {{ tokens: Array, notes: Array<string> }} notes: 정규화 내역(근거 표시용)
 */
export function arpabetToTokens(arpabet, word) {
  const symbols = String(arpabet).trim().split(/\s+/).filter(Boolean);
  const tokens = [];
  const notes = [];

  // 1) 기호 → 토큰
  for (const symbol of symbols) {
    const match = symbol.match(/^([A-Z]+)([0-2])?$/);
    if (!match) continue;
    const [, base, stress] = match;

    if (base === 'W') {
      tokens.push({ kind: 'G', ph: 'w' });
    } else if (base === 'Y') {
      tokens.push({ kind: 'G', ph: 'j' });
    } else if (ARPA_CONSONANTS[base]) {
      tokens.push({ kind: 'C', ph: ARPA_CONSONANTS[base] });
    } else {
      const key = base === 'AH' && stress === '0' ? 'AH0' : base;
      const vowel = ARPA_VOWELS[key];
      if (vowel) tokens.push({ kind: 'V', ...vowel });
    }
  }

  // 1.5) ER(=ə+r) 바로 뒤에 모음이 오면 r을 되살린다 (mystery 미스터리, Margaret 마거릿)
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const t = tokens[i];
    const next = tokens[i + 1];
    if (t.kind === 'V' && t.fromER && next.kind === 'V') {
      tokens.splice(i + 1, 0, { kind: 'C', ph: 'r' });
      notes.push('모음 앞 ER의 r 복원 → [ㄹ] (연결 발음)');
      i += 1;
    }
  }

  // 2) 모음 뒤 r 정규화 (영국식 기준으로 교정)
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (!(t.kind === 'C' && t.ph === 'r')) continue;
    const prev = tokens[i - 1];
    const next = tokens[i + 1];
    if (!prev || prev.kind !== 'V') continue; // 어두·자음 뒤 r은 그대로
    // 모음·[j] 앞 r은 그대로(ㄹ). 단 [w] 앞의 r은 자음 앞처럼 처리한다
    // (barwick 바윅, farwell 파웰, fairway 페어웨이)
    if (next && (next.kind === 'V' || (next.kind === 'G' && next.ph === 'j'))) continue;

    if (prev.diph || ['i', 'u', 'e'].includes(prev.ph)) {
      tokens.splice(i, 1, { kind: 'V', ph: 'ə' });
      notes.push('모음 뒤 r → [ə] (영국식 발음 기준 정규화: 이어·우어·에어)');
    } else {
      tokens.splice(i, 1);
      prev.long = true;
      notes.push('모음 뒤 r 생략 + 앞 모음 장모음 처리 (영국식 발음 기준 정규화, 제7항 연계)');
      i -= 1;
    }
  }

  // 3) [au] + [ə] → [auə] 병합 (제8항: '아워')
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const t = tokens[i];
    const next = tokens[i + 1];
    if (t.kind === 'V' && t.diph === 'au' && next.kind === 'V' && next.ph === 'ə' && !next.diph) {
      tokens.splice(i, 2, { kind: 'V', diph: 'auə' });
      notes.push('[au]+[ə] → [auə] (제8항: 아워)');
    }
  }

  // 4) t+s / d+z 병합 → [ʦ]/[ʣ] (모음 앞이 아닐 때만; Keats 키츠, odds 오즈)
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const t = tokens[i];
    const next = tokens[i + 1];
    const after = tokens[i + 2];
    if (t.kind !== 'C' || next.kind !== 'C' || isVowelish(after)) continue;
    if (t.ph === 't' && next.ph === 's') {
      tokens.splice(i, 2, { kind: 'C', ph: 'ʦ' });
      notes.push('[t]+[s] → [ʦ] 병합 (제4항)');
    } else if (t.ph === 'd' && next.ph === 'z') {
      tokens.splice(i, 2, { kind: 'C', ph: 'ʣ' });
      notes.push('[d]+[z] → [ʣ] 병합 (제4항)');
    }
  }

  // 5) 어말 음절성 l 정규화: 장애음 + [ə] + 어말 [l] → [ə] 제거 (apple 애플)
  const n = tokens.length;
  if (
    n >= 3 &&
    tokens[n - 1].kind === 'C' && tokens[n - 1].ph === 'l' &&
    tokens[n - 2].kind === 'V' && tokens[n - 2].ph === 'ə' && !tokens[n - 2].diph &&
    tokens[n - 3].kind === 'C' && OBSTRUENTS.has(tokens[n - 3].ph)
  ) {
    tokens.splice(n - 2, 1);
    notes.push('어말 음절성 l 정규화: 장애음+[ə]+[l]의 [ə] 제거 (애플·휘슬형)');
  }

  // 6) 철자 참고 조정 (철자를 아는 경우에만)
  applySpellingHints(tokens, word, notes);

  // 7) 관용 표기 조정 — 국립국어원 용례집 대조로 확인된 관행 (로사 님 승인 범위만)
  if (word) {
    const spelling = String(word).trim().toLowerCase();

    // 7-1) 어말 철자 a + 어말 [ə] → ‘아’ (sofa 소파, catalonia 카탈로니아)
    const lastTok = tokens[tokens.length - 1];
    if (
      /a$/.test(spelling) &&
      lastTok && lastTok.kind === 'V' && !lastTok.diph && lastTok.ph === 'ə'
    ) {
      lastTok.ph = 'ɑ';
      notes.push('관용 조정: 어말 철자 a는 ‘아’로 (용례집 관행, 소파·카탈로니아형)');
    }

    // 7-2) 철자 -son + [s][ə][n] → ‘슨’ (jefferson 제퍼슨, johnson 존슨)
    const m = tokens.length;
    if (
      /son$/.test(spelling) && m >= 3 &&
      tokens[m - 1].kind === 'C' && tokens[m - 1].ph === 'n' &&
      tokens[m - 2].kind === 'V' && !tokens[m - 2].diph && tokens[m - 2].ph === 'ə' &&
      tokens[m - 3].kind === 'C' && tokens[m - 3].ph === 's'
    ) {
      tokens.splice(m - 2, 1);
      notes.push('관용 조정: 어말 -son은 ‘슨’으로 (용례집 관행, 제퍼슨형)');
    }
  }

  return { tokens, notes };
}

/** 토큰 열 → 사람이 읽을 발음 문자열 (근거 표시용, 유사 IPA) */
export function tokensToIpaString(tokens) {
  return tokens
    .map((t) => {
      if (t.kind === 'G') return t.ph;
      if (t.diph) return t.diph;
      return t.ph + (t.long ? 'ː' : '');
    })
    .join('');
}
