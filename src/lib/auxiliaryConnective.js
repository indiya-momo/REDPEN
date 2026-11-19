/**
 * 본조(제47항) — 보조용언 바로 앞 본용언 어절의 연결형이 -아/-어인지 가른다.
 *
 * 설계(2026-11-19 결정):
 * - 보조용언과 붙여 쓸 수 있는 것은 본용언이 -아/-어(하다→해 포함)로 끝날 때뿐이다.
 *   써·커·봐·줘·돼·둬·져·려 같은 축약형도 -아/-어다.
 * - -다(가), -(으)라, -(으)러, -(으)려, -지, -게, -고, -도록, -었다 같은 다른 연결은
 *   붙여 쓸 수 없다(사전 한 단어는 호출하는 쪽에서 따로 본다).
 * - 라/러는 '으'가 빠진 -라/-러(하라·가라·하러·놀러)가 흔하므로 기본은 비아/어다.
 *   르 불규칙(따르다→따라, 흐르다→흘러)·러 불규칙(이르다→이르러, 푸르다→푸르러)과
 *   어간이 '라'로 끝나는 동사(자라다→자라, 바라다→바라)만 -아/-어로 본다.
 */

/**
 * 르 불규칙 용언의 -아/-어 활용형 끝 두 글자.
 * 레포 안에 단순 용언 목록이 없어(stdict-verb-forms.json은 붙임표 합성어만,
 * 인디야 verbs.tsv에도 따르다·흐르다 같은 동형어 표제어가 빠져 있음) 손으로 고른 목록을 쓴다.
 * 모음조화가 이미 반영된 표면이라 '놀러'(노르다→노르러)처럼 맞지 않는 것은 자연히 빠진다.
 * 목적 -러와 겹칠 수 있는 '걸러'(걸다+러)·'불러'(불다+러)는 르 불규칙 쪽이 훨씬 흔해 남긴다.
 * '살라'(살다+라, 사르다→살라)는 명령 -라 쪽이 흔해서 뺀다.
 * 합성어(가로질러·휘둘러·짓눌러·배불러 …)는 끝 두 글자로 함께 잡힌다.
 * @type {ReadonlySet<string>}
 */
export const REU_IRREGULAR_AEO_TAILS = new Set([
  // 동사
  '갈라', // 가르다
  '걸러', // 거르다
  '골라', // 고르다
  '굴러', // 구르다
  '길러', // 기르다
  '날라', // 나르다
  '눌러', // 누르다(누르다·짓누르다)
  '둘러', // 두르다(휘두르다·서두르다)
  '말라', // 마르다
  '몰라', // 모르다
  '물러', // 무르다
  '발라', // 바르다
  '별러', // 벼르다
  '불러', // 부르다(배부르다)
  '슬러', // 거스르다·추스르다
  '올라', // 오르다
  '울러', // 아우르다·어우르다
  '일러', // 이르다(말하다·이르다)
  '졸라', // 조르다
  '질러', // 지르다(가로지르다·저지르다·문지르다)
  '찔러', // 찌르다
  '흘러', // 흐르다
  '을러', // 으르다·게으르다
  // 형용사(빨라지다·달라지다처럼 -아/-어 + 지다로 자주 쓰임)
  '글러', // 그르다
  '널러', // 너르다
  '달라', // 다르다
  '빨라', // 빠르다
  '팔라', // 가파르다
  '툴러', // 서투르다
]);

/**
 * 으 탈락 용언인데 -아/-어 표면이 라/러로 끝나는 것. ㄹ 받침 조건 없이 본다.
 * '치러'(치르다)는 '치러 가다'(치다+러)와 겹쳐 넣지 않는다.
 * @type {ReadonlySet<string>}
 */
export const EU_DROP_AEO_TAILS = new Set([
  '따라', // 따르다
  '들러', // 들르다
  '러러', // 우러르다
  '다라', // 다다르다
]);

/**
 * 어간이 '라'로 끝나 -아가 합쳐진 동사의 -아 활용형(자라다→자라).
 * @type {readonly string[]}
 */
export const RA_STEM_AEO_SURFACES = Object.freeze(['자라', '바라', '놀라', '모자라']);

/** 앞에서부터 먼저 본다. 긴 것 우선. */
export const NON_AEO_ENDINGS = Object.freeze([
  '다가',
  '도록',
  '으라',
  '으러',
  '으려',
  '다', // -다(가) 준말, -었다/-았다
  '지',
  '게',
  '고',
]);

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
/** 중성 인덱스: ㅏ0 ㅐ1 ㅑ2 ㅒ3 ㅓ4 ㅔ5 ㅕ6 ㅖ7 ㅗ8 ㅘ9 ㅙ10 ㅚ11 ㅛ12 ㅜ13 ㅝ14 ㅞ15 ㅟ16 ㅠ17 ㅡ18 ㅢ19 ㅣ20 */
const AEO_FINAL_VOWELS = new Set([0, 1, 4, 5, 6, 9, 10, 14, 15]);
/** 종성 ㄹ 인덱스 */
const JONG_RIEUL = 8;

/** @param {string} ch */
function syllableParts(ch) {
  const code = String(ch ?? '').charCodeAt(0);
  if (!(code >= HANGUL_BASE && code <= HANGUL_LAST)) return null;
  const offset = code - HANGUL_BASE;
  return {
    vowel: Math.floor((offset % 588) / 28),
    jong: offset % 28,
  };
}

/**
 * -아/-어로 끝나는 마지막 음절인가 (받침 없음 + ㅏ ㅐ ㅓ ㅔ ㅕ ㅘ ㅙ ㅝ ㅞ).
 * 먹어·해·봐·줘·돼·써·켜·개·세 …
 * @param {string} ch
 */
export function isAeoFinalSyllable(ch) {
  const parts = syllableParts(ch);
  if (!parts) return false;
  return parts.jong === 0 && AEO_FINAL_VOWELS.has(parts.vowel);
}

/**
 * 라/러로 끝나는 어절이 -아/-어 활용형인가.
 * @param {string} head
 */
export function isAeoRaReoHead(head) {
  const h = String(head ?? '');
  if (h.length < 2) return false;
  const tail2 = h.slice(-2);
  if (EU_DROP_AEO_TAILS.has(tail2)) return true;
  if (REU_IRREGULAR_AEO_TAILS.has(tail2)) {
    // 르 불규칙은 바로 앞 음절에 ㄹ 받침이 있어야 한다(목록 표면은 모두 해당).
    const prev = syllableParts(tail2[0]);
    if (prev?.jong === JONG_RIEUL) return true;
  }
  // 러 불규칙: 이르러·푸르러·누르러·노르러
  if (h.endsWith('르러')) return true;
  return RA_STEM_AEO_SURFACES.some((s) => h === s || h.endsWith(s));
}

/**
 * 보조용언 바로 앞 본용언 어절(한글만)의 연결형.
 * @param {string} head — `먹어`, `먹다가`, `먹으러`, `따라`, `해`
 * @returns {'aeo' | 'non-aeo' | ''} 빈 문자열은 판단 불가(어절 없음)
 */
export function classifyConnectiveBeforeAux(head) {
  const h = String(head ?? '').replace(/[^\uAC00-\uD7A3]/g, '');
  if (!h) return '';
  if (h.endsWith('라') || h.endsWith('러')) {
    if (h.endsWith('으라') || h.endsWith('으러')) return 'non-aeo';
    return isAeoRaReoHead(h) ? 'aeo' : 'non-aeo';
  }
  for (const ending of NON_AEO_ENDINGS) {
    if (h.endsWith(ending)) return 'non-aeo';
  }
  return isAeoFinalSyllable(h[h.length - 1]) ? 'aeo' : 'non-aeo';
}
