/**
 * 일본어 가나 → 한글 표기 변환 엔진.
 *
 * 근거: 외래어 표기법 제2장 표 4(일본어의 가나와 한글 대조표)와
 * 제3장 표기 세칙(일본어) 제1항(촉음)·제2항(장모음).
 *
 * 영어와 달리 발음 추정 단계가 없다 — 가나 글자가 곧 발음이라
 * 대조표(활자 견본)를 그대로 바꿔 앉히는 결정적 변환이다.
 * 한자 입력은 읽기를 알 수 없으므로 이 엔진의 대상이 아니다.
 */

export const KANA_RULES = {
  T4: { id: '표 4', text: '일본어의 가나와 한글 대조표에 따라 적는다.' },
  T4_FIRST: {
    id: '표 4 (어두)',
    text: 'カ·タ행 등의 거센소리 계열은 어두에서 예사소리로 적는다. (보기: とうきょう 도쿄)',
  },
  JP1: {
    id: '일본어 제1항',
    text: '촉음(ッ)은 ㅅ으로 통일해서 적는다. (보기: サッポロ 삿포로)',
  },
  JP2: {
    id: '일본어 제2항',
    text: '장모음은 따로 표기하지 않는다. (보기: とうきょう 도쿄)',
  },
};

/**
 * 기본 대조표 — 가나: [모음 계열, 어두 표기, 어중·어말 표기(생략 시 어두와 동일)]
 * @type {Record<string, [string, string, string?]>}
 */
const KANA = {
  あ: ['a', '아'], い: ['i', '이'], う: ['u', '우'], え: ['e', '에'], お: ['o', '오'],
  か: ['a', '가', '카'], き: ['i', '기', '키'], く: ['u', '구', '쿠'], け: ['e', '게', '케'], こ: ['o', '고', '코'],
  さ: ['a', '사'], し: ['i', '시'], す: ['u', '스'], せ: ['e', '세'], そ: ['o', '소'],
  た: ['a', '다', '타'], ち: ['i', '지', '치'], つ: ['u', '쓰'], て: ['e', '데', '테'], と: ['o', '도', '토'],
  な: ['a', '나'], に: ['i', '니'], ぬ: ['u', '누'], ね: ['e', '네'], の: ['o', '노'],
  は: ['a', '하'], ひ: ['i', '히'], ふ: ['u', '후'], へ: ['e', '헤'], ほ: ['o', '호'],
  ま: ['a', '마'], み: ['i', '미'], む: ['u', '무'], め: ['e', '메'], も: ['o', '모'],
  や: ['a', '야'], ゆ: ['u', '유'], よ: ['o', '요'],
  ら: ['a', '라'], り: ['i', '리'], る: ['u', '루'], れ: ['e', '레'], ろ: ['o', '로'],
  わ: ['a', '와'], ゐ: ['i', '이'], ゑ: ['e', '에'], を: ['o', '오'],
  が: ['a', '가'], ぎ: ['i', '기'], ぐ: ['u', '구'], げ: ['e', '게'], ご: ['o', '고'],
  ざ: ['a', '자'], じ: ['i', '지'], ず: ['u', '즈'], ぜ: ['e', '제'], ぞ: ['o', '조'],
  だ: ['a', '다'], ぢ: ['i', '지'], づ: ['u', '즈'], で: ['e', '데'], ど: ['o', '도'],
  ば: ['a', '바'], び: ['i', '비'], ぶ: ['u', '부'], べ: ['e', '베'], ぼ: ['o', '보'],
  ぱ: ['a', '파'], ぴ: ['i', '피'], ぷ: ['u', '푸'], ぺ: ['e', '페'], ぽ: ['o', '포'],
};

/**
 * 요음(작은 ゃ·ゅ·ょ) 대조표 — 기본 가나: { 작은 가나: [모음, 어두, 어중] }
 * @type {Record<string, Record<string, [string, string, string?]>>}
 */
const YOON = {
  き: { ゃ: ['a', '갸', '캬'], ゅ: ['u', '규', '큐'], ょ: ['o', '교', '쿄'] },
  し: { ゃ: ['a', '샤'], ゅ: ['u', '슈'], ょ: ['o', '쇼'] },
  ち: { ゃ: ['a', '자', '차'], ゅ: ['u', '주', '추'], ょ: ['o', '조', '초'] },
  に: { ゃ: ['a', '냐'], ゅ: ['u', '뉴'], ょ: ['o', '뇨'] },
  ひ: { ゃ: ['a', '햐'], ゅ: ['u', '휴'], ょ: ['o', '효'] },
  み: { ゃ: ['a', '먀'], ゅ: ['u', '뮤'], ょ: ['o', '묘'] },
  り: { ゃ: ['a', '랴'], ゅ: ['u', '류'], ょ: ['o', '료'] },
  ぎ: { ゃ: ['a', '갸'], ゅ: ['u', '규'], ょ: ['o', '교'] },
  じ: { ゃ: ['a', '자'], ゅ: ['u', '주'], ょ: ['o', '조'] },
  ぢ: { ゃ: ['a', '자'], ゅ: ['u', '주'], ょ: ['o', '조'] },
  び: { ゃ: ['a', '뱌'], ゅ: ['u', '뷰'], ょ: ['o', '뵤'] },
  ぴ: { ゃ: ['a', '퍄'], ゅ: ['u', '퓨'], ょ: ['o', '표'] },
};

/**
 * 가타카나 확장 표기(외래어용) — 표 4 밖이라 관용 근사로 적는다.
 * @type {Record<string, [string, string]>} 두 글자 조합: [모음, 표기]
 */
const EXTENDED = {
  ふぁ: ['a', '파'], ふぃ: ['i', '피'], ふぇ: ['e', '페'], ふぉ: ['o', '포'],
  ゔぁ: ['a', '바'], ゔぃ: ['i', '비'], ゔぇ: ['e', '베'], ゔぉ: ['o', '보'],
  てぃ: ['i', '티'], でぃ: ['i', '디'],
  とぅ: ['u', '투'], どぅ: ['u', '두'],
  うぃ: ['i', '위'], うぇ: ['e', '웨'], うぉ: ['o', '워'],
  しぇ: ['e', '셰'], じぇ: ['e', '제'], ちぇ: ['e', '체'],
};

/** 한 글자 확장 — ゔ(ヴ) 단독 */
const EXTENDED_SINGLE = { ゔ: ['u', '부'] };

const SMALL_VOWELS = 'ぁぃぅぇぉ';
const SMALL_YOON = 'ゃゅょ';
const PURE_VOWEL_OF = { あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o' };

/** 받침 결합 — 완성 음절 + 종성 자모 → 받침 붙은 음절 */
const JONG_INDEX = { ㄴ: 4, ㅅ: 19 };
function attachCoda(syllable, jong) {
  const code = syllable.codePointAt(0);
  if (code < 0xac00 || code > 0xd7a3) return syllable;
  if ((code - 0xac00) % 28 !== 0) return syllable; // 이미 받침 있음
  return String.fromCodePoint(code + JONG_INDEX[jong]);
}

/** 가타카나 → 히라가나 정규화 (장음 부호 ー는 유지) */
export function normalizeKana(text) {
  let out = '';
  for (const ch of String(text ?? '')) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x30a1 && cp <= 0x30f6) {
      out += String.fromCodePoint(cp - 0x60);
    } else {
      out += ch;
    }
  }
  return out;
}

/** 가나(+장음 부호·공백·가운뎃점)로만 이루어진 질의인지 */
export function isKanaQuery(text) {
  const n = normalizeKana(text).replace(/[\s・･·]/g, '');
  if (!n) return false;
  return [...n].every((ch) => {
    const cp = ch.codePointAt(0);
    return (cp >= 0x3041 && cp <= 0x3096) || ch === 'ー';
  });
}

/**
 * 단어 하나(공백 없는 가나 열)를 변환.
 * @param {string} word 히라가나 정규화된 단어
 * @param {Array<{ph: string, out: string, rule: {id: string, text: string}}>} trace
 * @param {Set<string>} notes
 * @returns {string | null} 변환 실패(비가나 글자) 시 null
 */
function transcribeKanaWord(word, trace, notes) {
  /** @type {string[]} */
  const syllables = [];
  let prevVowel = '';
  const chars = [...word];

  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    const next = chars[i + 1] ?? '';
    const atStart = syllables.length === 0;

    if (ch === 'ー') {
      trace.push({ ph: ch, out: '(장음 생략)', rule: KANA_RULES.JP2 });
      continue;
    }
    if (ch === 'っ') {
      if (syllables.length) {
        syllables[syllables.length - 1] = attachCoda(
          syllables[syllables.length - 1],
          'ㅅ',
        );
        trace.push({ ph: 'っ', out: 'ㅅ 받침', rule: KANA_RULES.JP1 });
      }
      continue;
    }
    if (ch === 'ん') {
      if (syllables.length) {
        syllables[syllables.length - 1] = attachCoda(
          syllables[syllables.length - 1],
          'ㄴ',
        );
      } else {
        syllables.push('은');
      }
      trace.push({ ph: 'ん', out: 'ㄴ 받침', rule: KANA_RULES.T4 });
      prevVowel = '';
      continue;
    }

    // 확장 표기(두 글자) — ファ·ティ·ウィ 등
    const pair = ch + next;
    if (next && SMALL_VOWELS.includes(next) && EXTENDED[pair]) {
      const [vowel, syl] = EXTENDED[pair];
      syllables.push(syl);
      trace.push({ ph: pair, out: syl, rule: KANA_RULES.T4 });
      notes.add('확장 가타카나 표기는 대조표 밖이라 근사 표기입니다.');
      prevVowel = vowel;
      i += 1;
      continue;
    }

    // 요음(작은 ゃ·ゅ·ょ)
    if (next && SMALL_YOON.includes(next) && YOON[ch]?.[next]) {
      const [vowel, first, rest] = YOON[ch][next];
      const syl = atStart ? first : (rest ?? first);
      syllables.push(syl);
      trace.push({
        ph: pair,
        out: syl,
        rule: atStart && rest ? KANA_RULES.T4_FIRST : KANA_RULES.T4,
      });
      prevVowel = vowel;
      i += 1;
      continue;
    }

    // 단독 확장(ゔ)
    if (EXTENDED_SINGLE[ch]) {
      const [vowel, syl] = EXTENDED_SINGLE[ch];
      syllables.push(syl);
      trace.push({ ph: ch, out: syl, rule: KANA_RULES.T4 });
      notes.add('확장 가타카나 표기는 대조표 밖이라 근사 표기입니다.');
      prevVowel = vowel;
      continue;
    }

    const entry = KANA[ch];
    if (!entry) return null;
    const [vowel, first, rest] = entry;

    // 장모음 — 같은 모음 반복, お단+う (보기: とうきょう 도쿄, おおさか 오사카)
    const pure = PURE_VOWEL_OF[ch];
    if (
      pure &&
      !atStart &&
      (pure === prevVowel || (pure === 'u' && prevVowel === 'o'))
    ) {
      trace.push({ ph: ch, out: '(장음 생략)', rule: KANA_RULES.JP2 });
      continue;
    }

    const syl = atStart ? first : (rest ?? first);
    syllables.push(syl);
    trace.push({
      ph: ch,
      out: syl,
      rule: atStart && rest ? KANA_RULES.T4_FIRST : KANA_RULES.T4,
    });
    prevVowel = vowel;
  }

  return syllables.join('');
}

/**
 * 가나 구문(공백·가운뎃점 구분) → 한글 표기 추정.
 * 반환 형태는 영어 엔진(convertWordAsync)과 같은 모양이라
 * 변환 도구 UI(추정 표기 + 적용 근거)에 그대로 흘러든다.
 * @param {string} phrase
 * @returns {{
 *   found: boolean,
 *   estimated: boolean,
 *   results: Array<{arpabet: string, ipa: string, hangul: string, trace: Array, notes: string[]}>,
 * }}
 */
export function convertKanaPhrase(phrase) {
  const normalized = normalizeKana(phrase).trim();
  const words = normalized.split(/[\s・･·]+/).filter(Boolean);
  if (!words.length) return { found: false, estimated: false, results: [] };

  /** @type {Array<{ph: string, out: string, rule: {id: string, text: string}}>} */
  const trace = [];
  const notes = new Set(['일본어 가나 → 외래어 표기법 표 4·세칙 적용']);
  const parts = [];
  for (const word of words) {
    const hangul = transcribeKanaWord(word, trace, notes);
    if (hangul == null || !hangul) {
      return { found: false, estimated: false, results: [] };
    }
    parts.push(hangul);
  }

  return {
    found: true,
    estimated: true,
    results: [
      {
        arpabet: normalized,
        ipa: normalized,
        hangul: parts.join(' '),
        trace,
        notes: [...notes],
      },
    ],
  };
}
