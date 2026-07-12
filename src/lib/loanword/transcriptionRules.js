/**
 * 외래어 표기법 제3장 제1절 "영어의 표기" (제1항~제10항) 규칙 엔진.
 *
 * 입력: arpabet.js가 만든 음소 토큰 열
 * 출력: 한글 조립 조각(piece) 열 + 적용 조항 근거(trace)
 *
 * 조판에 비유하면 여기가 "조판 규칙집"이다. 활자 견본(table1.js)을 보고
 * 각 음소를 초성·중성·종성(받침)·완성 음절 중 무엇으로 앉힐지 결정한다.
 *
 * piece 형태:
 *   { t: 'onset',  v: 'ㅌ' }   초성으로 대기 (뒤 모음과 결합)
 *   { t: 'medial', v: 'ㅏ' }   중성 (초성이 없으면 ㅇ)
 *   { t: 'coda',   v: 'ㅁ' }   받침 (직전 음절에 붙음)
 *   { t: 'syl',    v: '프' }   완성 음절 ('으'를 붙여 적는 경우 등)
 *
 * 미구현: 제10항(복합어) — 단어 분해(형태소 분석)가 필요해 1차 범위에서 제외.
 *        복합어는 단일어 기준으로 변환된다.
 */

import {
  CONSONANTS,
  VOWELS,
  SH_MEDIAL,
  W_MEDIAL,
  J_MEDIAL,
  DIPH_FIRST,
  DIPH_REST,
} from './table1.js';

export const RULES = {
  T1: { id: '표 1', text: '국제 음성 기호와 한글 대조표에 따라 적는다.' },
  R1_1: { id: '제1항 1', text: '짧은 모음 다음의 어말 무성 파열음([p],[t],[k])은 받침으로 적는다. (보기: gap 갭)' },
  R1_2: { id: '제1항 2', text: '짧은 모음과 유음·비음([l],[r],[m],[n]) 이외의 자음 사이에 오는 무성 파열음은 받침으로 적는다. (보기: setback 셋백)' },
  R1_3: { id: '제1항 3', text: '위 경우 이외의 어말과 자음 앞의 [p],[t],[k]는 ‘으’를 붙여 적는다. (보기: stamp 스탬프)' },
  R2: { id: '제2항', text: '어말과 모든 자음 앞에 오는 유성 파열음([b],[d],[g])은 ‘으’를 붙여 적는다. (보기: bulb 벌브)' },
  R3_1: { id: '제3항 1', text: '어말 또는 자음 앞의 [s],[z],[f],[v],[θ],[ð]는 ‘으’를 붙여 적는다. (보기: jazz 재즈)' },
  R3_2: { id: '제3항 2', text: '어말의 [ʃ]는 ‘시’, 자음 앞은 ‘슈’, 모음 앞은 뒤 모음에 따라 샤·섀·셔·셰·쇼·슈·시로 적는다.' },
  R3_3: { id: '제3항 3', text: '어말 또는 자음 앞의 [ʒ]는 ‘지’, 모음 앞은 ㅈ으로 적는다. (보기: vision 비전)' },
  R4_1: { id: '제4항 1', text: '어말 또는 자음 앞의 [ʦ],[ʣ]는 ‘츠’,‘즈’, [ʧ],[ʤ]는 ‘치’,‘지’로 적는다. (보기: switch 스위치)' },
  R4_2: { id: '제4항 2', text: '모음 앞의 [ʧ],[ʤ]는 ㅊ, ㅈ으로 적는다. (보기: chart 차트)' },
  R5_1: { id: '제5항 1', text: '어말 또는 자음 앞의 비음([m],[n],[ŋ])은 모두 받침으로 적는다. (보기: steam 스팀)' },
  R5_2: { id: '제5항 2', text: '모음과 모음 사이의 [ŋ]은 앞 음절의 받침 ㅇ으로 적는다. (보기: hanging 행잉)' },
  R6_1: { id: '제6항 1', text: '어말 또는 자음 앞의 [l]은 받침으로 적는다. (보기: hotel 호텔)' },
  R6_2: { id: '제6항 2', text: '어중의 [l]이 모음 앞에 오거나 모음이 따르지 않는 비음 앞에 오면 ㄹㄹ로 적는다. (보기: film 필름)' },
  R6_2b: { id: '제6항 2 단서', text: '비음([m],[n]) 뒤의 [l]은 모음 앞에 오더라도 ㄹ로 적는다. (보기: Henley 헨리)' },
  R7: { id: '제7항', text: '장모음의 장음은 따로 표기하지 않는다. (보기: team 팀)' },
  R8: { id: '제8항', text: '중모음은 각 단모음의 음가를 살려서 적되, [ou]는 ‘오’, [auə]는 ‘아워’로 적는다. (보기: time 타임, boat 보트)' },
  R9_1: { id: '제9항 1', text: '[w]는 뒤 모음에 따라 워·와·왜·웨·위·우로 적는다. (보기: word 워드)' },
  R9_2: { id: '제9항 2', text: '자음 뒤의 [w]는 두 음절로 갈라 적되, [gw],[hw],[kw]는 한 음절로 붙여 적는다. (보기: swing 스윙, quarter 쿼터)' },
  R9_3: { id: '제9항 3', text: '[j]는 뒤 모음과 합쳐 야·얘·여·예·요·유·이로 적는다. [d],[l],[n] 뒤의 [jə]는 디어·리어·니어로 적는다. (보기: yard 야드, union 유니언)' },
};

const isVowel = (t) => Boolean(t && t.kind === 'V');
const isVowelish = (t) => Boolean(t && (t.kind === 'V' || t.kind === 'G'));
const isCons = (t, phs) => Boolean(t && t.kind === 'C' && (!phs || phs.includes(t.ph)));

/**
 * '으'를 붙여 적는 음절의 자모 분해표.
 * 완성 문자열 대신 초성+중성 조각으로 배출해서, 뒤따르는 받침이
 * 이 음절에 붙을 수 있게 한다. (apple 애플: '프' + ㄹ 받침 → 플)
 */
const ALONE_JAMO = {
  프: ['ㅍ', 'ㅡ'],
  브: ['ㅂ', 'ㅡ'],
  트: ['ㅌ', 'ㅡ'],
  드: ['ㄷ', 'ㅡ'],
  크: ['ㅋ', 'ㅡ'],
  그: ['ㄱ', 'ㅡ'],
  스: ['ㅅ', 'ㅡ'],
  즈: ['ㅈ', 'ㅡ'],
  지: ['ㅈ', 'ㅣ'],
  츠: ['ㅊ', 'ㅡ'],
  치: ['ㅊ', 'ㅣ'],
  시: ['ㅅ', 'ㅣ'],
  슈: ['ㅅ', 'ㅠ'],
  흐: ['ㅎ', 'ㅡ'],
  르: ['ㄹ', 'ㅡ'],
};

const VOICELESS_STOPS = ['p', 't', 'k'];
const VOICED_STOPS = ['b', 'd', 'g'];
const PLAIN_FRICATIVES = ['s', 'z', 'f', 'v', 'θ', 'ð'];
const AFFRICATES = ['ʦ', 'ʣ', 'ʧ', 'ʤ'];
const NASALS_MN = ['m', 'n'];

/** 이 자음을 "모음 앞" 위치로 볼 수 있는가 (뒤 모음·[j]와 결합, [gw]·[kw]는 붙여 적기) */
function beforeVowelish(tokens, i) {
  const c = tokens[i];
  const next = tokens[i + 1];
  if (!next) return false;
  if (next.kind === 'V') return true;
  if (next.kind === 'G' && next.ph === 'j') return true;
  if (next.kind === 'G' && next.ph === 'w' && ['g', 'k'].includes(c.ph)) return true;
  return false;
}

/**
 * @param {Array} tokens arpabetToTokens의 결과 토큰
 * @returns {{ pieces: Array, trace: Array<{ph:string, out:string, rule:{id,text}}> }}
 */
export function transcribe(tokens) {
  const pieces = [];
  const trace = [];
  const consumed = new Set();

  const emit = (piece, ph, out, rule) => {
    pieces.push(piece);
    if (rule) trace.push({ ph, out, rule });
  };

  /** '으'류 음절을 초성+중성 조각으로 배출 (뒤 받침이 붙을 수 있음) */
  const emitAlone = (syl, ph, rule) => {
    const [cho, jung] = ALONE_JAMO[syl];
    pieces.push({ t: 'onset', v: cho });
    pieces.push({ t: 'medial', v: jung });
    if (rule) trace.push({ ph, out: syl, rule });
  };

  /** 이중모음 나머지 요소를 열린 음절(중성)로 배출 */
  const emitDiphRest = (diph, ph) => {
    const rest = DIPH_REST[diph];
    for (const syl of rest) {
      const medial = { 아: 'ㅏ', 이: 'ㅣ', 우: 'ㅜ', 워: 'ㅝ' }[syl];
      emit({ t: 'medial', v: medial }, ph, syl, null);
    }
  };

  for (let i = 0; i < tokens.length; i += 1) {
    if (consumed.has(i)) continue;
    const t = tokens[i];
    const prev = tokens[i - 1];
    const next = tokens[i + 1];
    const last = i === tokens.length - 1;

    /* ─── 모음 ─── */
    if (t.kind === 'V') {
      if (t.diph) {
        if (t.diph === 'ou') {
          emit({ t: 'medial', v: 'ㅗ' }, '[ou]', '오', RULES.R8);
        } else {
          const first = DIPH_FIRST[t.diph];
          emit({ t: 'medial', v: VOWELS[first] }, `[${t.diph}]`, VOWELS[first], RULES.R8);
          emitDiphRest(t.diph, `[${t.diph}]`);
        }
      } else {
        emit({ t: 'medial', v: VOWELS[t.ph] }, `[${t.ph}${t.long ? 'ː' : ''}]`, VOWELS[t.ph], t.long ? RULES.R7 : RULES.T1);
      }
      continue;
    }

    /* ─── 반모음 [w] (제9항 1·2) ─── */
    if (t.kind === 'G' && t.ph === 'w') {
      if (!isVowel(next)) {
        emit({ t: 'medial', v: 'ㅜ' }, '[w]', '우', RULES.T1);
        continue;
      }
      consumed.add(i + 1);
      let onsetJamo = 'ㅇ';
      let rule = RULES.R9_1;
      if (isCons(prev, ['g', 'k'])) {
        onsetJamo = CONSONANTS[prev.ph].onset; // [gw],[kw] 한 음절 (자음 배출은 여기서)
        rule = RULES.R9_2;
      } else if (prev && prev.kind === 'C') {
        rule = RULES.R9_2; // 갈라 적기 (자음은 이미 '으' 음절로 배출됨)
      }
      if (next.diph === 'ou') {
        emit({ t: 'onset', v: onsetJamo }, '[wou]', '', null);
        emit({ t: 'medial', v: 'ㅝ' }, '[wou]', '워', rule);
      } else if (next.diph) {
        const first = DIPH_FIRST[next.diph];
        emit({ t: 'onset', v: onsetJamo }, `[w${next.diph}]`, '', null);
        emit({ t: 'medial', v: W_MEDIAL[first] }, `[w${next.diph}]`, '', rule);
        emitDiphRest(next.diph, `[w${next.diph}]`);
      } else {
        emit({ t: 'onset', v: onsetJamo }, `[w${next.ph}]`, '', null);
        emit({ t: 'medial', v: W_MEDIAL[next.ph] }, `[w${next.ph}]`, '', rule);
      }
      continue;
    }

    /* ─── 반모음 [j] (제9항 3) ─── */
    if (t.kind === 'G' && t.ph === 'j') {
      if (!isVowel(next)) {
        emit({ t: 'medial', v: 'ㅣ' }, '[j]', '이', RULES.T1);
        continue;
      }
      consumed.add(i + 1);
      if (isCons(prev, ['d', 'l', 'n']) && !next.diph && next.ph === 'ə') {
        // [d],[l],[n] + [jə] → 디어·리어·니어 (직전 자음은 초성으로 대기 중)
        emit({ t: 'medial', v: 'ㅣ' }, '[jə]', '이', RULES.R9_3);
        emit({ t: 'medial', v: 'ㅓ' }, '[jə]', '어', null);
      } else if (next.diph) {
        const first = DIPH_FIRST[next.diph];
        const firstPh = first === 'ou' ? 'o' : first;
        emit({ t: 'medial', v: J_MEDIAL[firstPh] }, `[j${next.diph}]`, '', RULES.R9_3);
        if (next.diph !== 'ou') emitDiphRest(next.diph, `[j${next.diph}]`);
      } else {
        emit({ t: 'medial', v: J_MEDIAL[next.ph] }, `[j${next.ph}]`, '', RULES.R9_3);
      }
      continue;
    }

    /* ─── 자음 ─── */
    const ph = `[${t.ph}]`;
    const table = CONSONANTS[t.ph];
    const beforeV = beforeVowelish(tokens, i);

    // [g],[k]가 [w] 앞이면 배출을 [w] 단계로 미룸 (한 음절 붙여 적기)
    if (isCons(t, ['g', 'k']) && next && next.kind === 'G' && next.ph === 'w') {
      continue;
    }

    // 무성 파열음 [p],[t],[k] — 제1항
    if (VOICELESS_STOPS.includes(t.ph)) {
      if (beforeV) {
        emit({ t: 'onset', v: table.onset }, ph, table.onset, RULES.T1);
      } else {
        const prevShort = isVowel(prev) && !prev.diph && !prev.long;
        if (prevShort && last) {
          emit({ t: 'coda', v: table.coda }, ph, `${table.coda} 받침`, RULES.R1_1);
        } else if (prevShort && isCons(next) && !['l', 'r', 'm', 'n'].includes(next.ph)) {
          emit({ t: 'coda', v: table.coda }, ph, `${table.coda} 받침`, RULES.R1_2);
        } else {
          emitAlone(table.alone, ph, RULES.R1_3);
        }
      }
      continue;
    }

    // 유성 파열음 [b],[d],[g] — 제2항
    if (VOICED_STOPS.includes(t.ph)) {
      if (beforeV) emit({ t: 'onset', v: table.onset }, ph, table.onset, RULES.T1);
      else emitAlone(table.alone, ph, RULES.R2);
      continue;
    }

    // 마찰음 [s],[z],[f],[v],[θ],[ð] — 제3항 1
    if (PLAIN_FRICATIVES.includes(t.ph)) {
      if (beforeV) emit({ t: 'onset', v: table.onset }, ph, table.onset, RULES.T1);
      else emitAlone(table.alone, ph, RULES.R3_1);
      continue;
    }

    // [ʃ] — 제3항 2
    if (t.ph === 'ʃ') {
      if (last) {
        emitAlone('시', ph, RULES.R3_2);
      } else if (isVowel(next)) {
        consumed.add(i + 1);
        if (next.diph === 'ou') {
          emit({ t: 'onset', v: 'ㅅ' }, '[ʃou]', '', null);
          emit({ t: 'medial', v: 'ㅛ' }, '[ʃou]', '쇼', RULES.R3_2);
        } else if (next.diph) {
          const first = DIPH_FIRST[next.diph];
          emit({ t: 'onset', v: 'ㅅ' }, `[ʃ${next.diph}]`, '', null);
          emit({ t: 'medial', v: SH_MEDIAL[first] }, `[ʃ${next.diph}]`, '', RULES.R3_2);
          emitDiphRest(next.diph, `[ʃ${next.diph}]`);
        } else {
          emit({ t: 'onset', v: 'ㅅ' }, `[ʃ${next.ph}]`, '', null);
          emit({ t: 'medial', v: SH_MEDIAL[next.ph] }, `[ʃ${next.ph}]`, '', RULES.R3_2);
        }
      } else {
        emitAlone('슈', ph, RULES.R3_2);
      }
      continue;
    }

    // [ʒ] — 제3항 3
    if (t.ph === 'ʒ') {
      if (beforeV) emit({ t: 'onset', v: table.onset }, ph, table.onset, RULES.R3_3);
      else emitAlone(table.alone, ph, RULES.R3_3);
      continue;
    }

    // 파찰음 — 제4항
    if (AFFRICATES.includes(t.ph)) {
      if (beforeV) emit({ t: 'onset', v: table.onset }, ph, table.onset, RULES.R4_2);
      else emitAlone(table.alone, ph, RULES.R4_1);
      continue;
    }

    // 비음 [m],[n] — 제5항
    if (NASALS_MN.includes(t.ph)) {
      if (beforeV) emit({ t: 'onset', v: table.onset }, ph, table.onset, RULES.T1);
      else emit({ t: 'coda', v: table.coda }, ph, `${table.coda} 받침`, RULES.R5_1);
      continue;
    }

    // [ŋ] — 제5항 (모음 앞이면 앞 음절 받침 ㅇ, 제5항 2)
    if (t.ph === 'ŋ') {
      emit({ t: 'coda', v: 'ㅇ' }, ph, 'ㅇ 받침', isVowelish(next) ? RULES.R5_2 : RULES.R5_1);
      continue;
    }

    // 유음 [l] — 제6항
    if (t.ph === 'l') {
      if (beforeV) {
        if (isCons(prev, NASALS_MN)) {
          emit({ t: 'onset', v: 'ㄹ' }, ph, 'ㄹ', RULES.R6_2b);
        } else if (prev) {
          // 어중(모음·자음 뒤)의 [l] → ㄹㄹ (slide 슬라이드, flash 플래시)
          emit({ t: 'coda', v: 'ㄹ' }, ph, 'ㄹㄹ', RULES.R6_2);
          emit({ t: 'onset', v: 'ㄹ' }, ph, '', null);
        } else {
          emit({ t: 'onset', v: 'ㄹ' }, ph, 'ㄹ', RULES.T1);
        }
      } else if (isCons(next, NASALS_MN) && !isVowelish(tokens[i + 2]) && isVowel(prev)) {
        // 모음이 따르지 않는 비음 앞 → ㄹㄹ (film 필름)
        emit({ t: 'coda', v: 'ㄹ' }, ph, 'ㄹㄹ', RULES.R6_2);
        emit({ t: 'onset', v: 'ㄹ' }, ph, '', null);
      } else {
        emit({ t: 'coda', v: 'ㄹ' }, ph, 'ㄹ 받침', RULES.R6_1);
      }
      continue;
    }

    // [r], [h] — 표 1
    if (t.ph === 'r' || t.ph === 'h') {
      if (beforeV) emit({ t: 'onset', v: table.onset }, ph, table.onset, RULES.T1);
      else emitAlone(table.alone, ph, RULES.T1);
      continue;
    }
  }

  return { pieces, trace };
}
