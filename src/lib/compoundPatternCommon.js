/** 붙임·띄움 공통 — 앞말 캡처 (공백 아닌 문자 2자 이상) */
export const COMPOUND_PREFIX = String.raw`(\S{2,})`;

/** 공백·NBSP 1칸 이상 */
export const FLEX_SPACE = String.raw`[ \u00A0]+`;

/** 본용언+보조용언 — 줄바꿈·조판용 공백 포함 */
export const AUXILIARY_FLEX_SPACE = String.raw`(?:[ \t\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\u200B\uFEFF]+|[\r\n])+`;

/** 보조용언·어미 (보면, 보여, 본다 …) */
export const HANGUL_SUFFIX = String.raw`[\uAC00-\uD7A3]+`;

/** stem 뒤 어미·문장 끝 (본 / 본다 / 본.) */
export const STEM_TAIL_END = String.raw`(?:${HANGUL_SUFFIX})?`;

/** stem 매칭 뒤 경계 */
export const STEM_TAIL_BOUNDARY = String.raw`(?=$|[ \u00A0,.!?…「」『』\]\r\n])`;

/** 문장/어절 앞 경계 */
export const PHRASE_START = String.raw`(?:^|[\s\u00A0])`;

/** @param {string} s */
export function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 보조용언 어간(보·본 등) — 앞말+공백+어간+어미 (뚱해 보이는)
 * @param {string} tailWord
 */
export function isAuxiliaryStem(tailWord) {
  const t = tailWord.trim();
  if (!t || /\s/.test(t)) return false;
  return /^[\uAC00-\uD7A3]$/.test(t);
}

/** 해보 / 해˅보 — *해+공백+보 (상상해 보아요, 해 보면) */
export function isHaeBoPattern(tailWord) {
  const parts = tailWord.trim().split(/\s+/).filter(Boolean);
  return parts.join('') === '해보';
}

/**
 * tailWord 안 띄어쓰기 — PDF 추출 공백/NBSP 허용
 * @param {string} tailWord
 */
export function tailRegexFragment(tailWord) {
  const parts = tailWord.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return parts.map(escapeRegex).join(FLEX_SPACE);
}

/**
 * bon-bojo stems — 앞말 유무: (\S*head)+공백+(tail+어미?)
 * @param {string} head stem 앞절 (켜, 해, 어 …)
 * @param {string} tailSyl stem 뒤절 (본, 보, 지 …)
 */
/**
 * @param {string} head
 * @param {string} tailSyl
 * @param {string} [flexSpace]
 */
export function buildSpacedStemFindPattern(head, tailSyl, flexSpace = FLEX_SPACE) {
  return String.raw`(\S*${escapeRegex(head)})${flexSpace}(${escapeRegex(tailSyl)}${STEM_TAIL_END})(?!으로)${STEM_TAIL_BOUNDARY}`;
}
