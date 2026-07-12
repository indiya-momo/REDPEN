/**
 * 조립 조각(piece) 열 → 완성 한글 문자열. ("제본" 단계)
 *
 * 초성·중성·종성 자모를 유니코드 완성형 음절로 조합한다.
 * 규칙 엔진이 순서대로 배출한 조각을 앞에서부터 받아
 * 음절 하나가 완성될 때마다 확정한다.
 */

const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

function composeSyllable(cho, jung, jong) {
  const ci = CHO.indexOf(cho);
  const ji = JUNG.indexOf(jung);
  const gi = jong ? JONG.indexOf(jong) : 0;
  if (ci < 0 || ji < 0 || gi < 0) return '';
  return String.fromCharCode(0xac00 + (ci * 21 + ji) * 28 + gi);
}

/**
 * @param {Array<{t:string, v:string}>} pieces
 * @returns {string} 완성 한글
 */
export function assemble(pieces) {
  let out = '';
  let cho = null;
  let jung = null;
  let jong = null;

  const flush = () => {
    if (cho && jung) out += composeSyllable(cho, jung, jong);
    else if (cho) out += composeSyllable(cho, 'ㅡ', jong); // 초성만 남으면 '으'를 붙임
    cho = null;
    jung = null;
    jong = null;
  };

  for (const piece of pieces) {
    switch (piece.t) {
      case 'onset':
        if (cho || jung) flush();
        cho = piece.v;
        break;
      case 'medial':
        if (jung) flush(); // 이미 완성 대기 중인 음절이 있으면 확정
        if (!cho) cho = 'ㅇ';
        jung = piece.v;
        break;
      case 'coda':
        if (jung && !jong) {
          jong = piece.v;
          flush();
        } else if (cho && !jung) {
          jung = 'ㅡ'; // 초성 대기 중 받침이 오면 '으' 음절에 받침 (른)
          jong = piece.v;
          flush();
        } else {
          // 붙을 음절이 없는 받침 — '으'를 붙인 음절로 안전 처리
          out += composeSyllable(piece.v, 'ㅡ', null);
        }
        break;
      case 'syl':
        flush();
        out += piece.v;
        break;
      default:
        break;
    }
  }
  flush();
  return out;
}
