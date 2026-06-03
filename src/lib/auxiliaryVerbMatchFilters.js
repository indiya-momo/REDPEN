import { isHaeBoPattern } from './compoundPatternCommon.js';
import { bonVerbAllowForItemId } from './bonBojoRules.js';
import { isNounRootHaeHead } from './bonNounHaeBlocklist.js';

/**
 * stem 앞부 `(\S*해)` 캡처가 아래 전체일 때 — 관형어·부사(통해·대해 등), 본용언+보조 아님
 * @type {ReadonlySet<string>}
 */
export const AUX_FALSE_HAE_HEAD_CAPTURES = new Set([
  '대해',
  '관해',
  '위해',
  '오해',
  '통해',
  '비해',
  '관련해',
  '이해',
  '상해',
]);

/** stem `해 X` — 캡처가 2음절이고 `해`로 끝나면 관형어(통해·대해 등) */
export function isLexicalHaeCompoundHead(headCapture) {
  const c = headCapture.trim();
  return c.length === 2 && c.endsWith('해');
}

/** 본용언 3음절 이상은 표기 검사 제외(합성 동사는 추후 시트 except) */
export const BON_VERB_HEAD_MAX_SYLLABLES = 2;

/**
 * @param {string} headCapture
 */
export function bonVerbHeadSyllableCount(headCapture) {
  return (headCapture.match(/[\uAC00-\uD7A3]/gu) ?? []).length;
}

/**
 * regex 캡처 `(\S*해)` 등 — 끝 연결어미(해·어…)는 제외하고 본용언만
 * @param {string} headCapture
 * @param {string} [stemHead] 시트 stem 앞음절(해, 어, 아 …)
 */
export function bonVerbHeadStemPortion(headCapture, stemHead = '') {
  const c = headCapture.trim();
  const head = stemHead.trim();
  if (!head || !c.endsWith(head)) return c;
  return c.slice(0, -head.length).trim();
}

/**
 * 본용언 3음절 이상 — 표기 검사 제외(매달려·기다려 등, 합성 동사는 추후 except)
 * @param {string} headCapture
 * @param {string} [stemHead]
 */
export function isBonVerbHeadTooLongForAuxiliary(headCapture, stemHead = '') {
  return (
    bonVerbHeadSyllableCount(bonVerbHeadStemPortion(headCapture, stemHead)) >
    BON_VERB_HEAD_MAX_SYLLABLES
  );
}

/**
 * 시트 bon_allow — 앞말·본용언 portion이 목록 항목으로 시작하면 3음절 제한 면제
 * @param {string} headCapture
 * @param {string} stemHead
 * @param {readonly string[]} allowList
 */
export function isBonVerbHeadOnAllowList(headCapture, stemHead, allowList) {
  if (!allowList?.length || !headCapture.trim()) return false;
  if (isNounRootHaeHead(headCapture)) return false;

  const head = headCapture.trim();
  const portion = bonVerbHeadStemPortion(head, stemHead);

  for (const raw of allowList) {
    const a = String(raw ?? '').trim();
    if (!a) continue;
    if (head.startsWith(a) || portion.startsWith(a)) return true;
    if (a.endsWith('다') && a.length > 1) {
      const stem = a.slice(0, -1);
      if (head.startsWith(stem) || portion.startsWith(stem)) return true;
    }
  }
  return false;
}

/** @param {RegExpExecArray} match */
export function isGluedAuxiliaryMatch(match) {
  const m = String(match[0] ?? '');
  return m.length > 0 && !/\s/.test(m);
}

/** 국어원 (1) 구 결합 — …싶어 하다 / …들어 하다 (붙임 ×) */
const PHRASE_BOUND_TAIL_BEFORE_HADA =
  /(?:싶어|들어|않아|않으|키지|되지|싶지|말고)$/u;

/** 조사가 앞말에 붙은 뒤 보조 — 먹어도 보다 (붙임 ×) */
const PARTICLE_SUFFIX_ON_HEAD =
  /(?:도|는|만|을|를|에|와|과|로|으로|부터|까지|밖에|조차|마저|라도|이라도|에게|한테|께|께서)$/u;

/** 의존명사+조사 뒤 보조 — 읽은 체를 한다, 올 듯도 하다 (붙임 ×) */
const DEP_NOUN_JOSA_ON_HEAD =
  /(?:체를|체를|듯도|듯이|만은|만도|것을|줄을|줄은|듯을|체는|체가)$/u;

/**
 * @param {string} headCapture
 */
export function headEndsWithParticleBeforeAux(headCapture) {
  return PARTICLE_SUFFIX_ON_HEAD.test(headCapture.trim());
}

/**
 * @param {string} headCapture
 */
export function headEndsWithDepNounJosa(headCapture) {
  return DEP_NOUN_JOSA_ON_HEAD.test(headCapture.trim());
}

/**
 * @param {string} stemHead
 * @param {string} stemTail
 * @param {string} headCapture
 */
export function isPhraseBoundBeforeHada(stemHead, stemTail, headCapture) {
  if (stemTail !== '하') return false;
  if (stemHead !== '어' && stemHead !== '아') return false;
  return PHRASE_BOUND_TAIL_BEFORE_HADA.test(headCapture.trim());
}

/**
 * @param {import('./ruleTypes.js').Rule} rule
 * @param {RegExpExecArray} match
 */
export function shouldSkipAuxiliaryVerbMatch(rule, match) {
  if (rule.patternKind !== 'auxiliary-verb') return false;

  const headCapture = String(match[1] ?? '').trim();
  if (headCapture && isNounRootHaeHead(headCapture)) return true;

  const tailNorm = rule.tailWord?.trim().replace(/\s+/g, '') ?? '';
  const tail = rule.tailWord?.trim() ?? '';
  const parts = tail.split(/\s+/).filter(Boolean);
  const stemHead =
    parts.length === 2 ? parts[0] : isHaeBoPattern(tail) ? '해' : '';

  /** 아는체하다 — 관형어(은·는·ㄴ) 2음절 허용 */
  if (
    tailNorm !== '체하' &&
    headCapture &&
    isBonVerbHeadTooLongForAuxiliary(headCapture, stemHead)
  ) {
    const allow = bonVerbAllowForItemId(rule.bonBojoItemId);
    if (!isBonVerbHeadOnAllowList(headCapture, stemHead, allow)) return true;
  }

  if (parts.length !== 2) return false;
  if (!headCapture) return false;

  const [, stemTail] = parts;
  const glued = isGluedAuxiliaryMatch(match);

  if (stemHead === '해') {
    if (isLexicalHaeCompoundHead(headCapture)) return true;
    if (AUX_FALSE_HAE_HEAD_CAPTURES.has(headCapture)) return true;
  }

  if (glued) {
    if (headEndsWithParticleBeforeAux(headCapture)) return true;
    if (headEndsWithDepNounJosa(headCapture)) return true;
    if (isPhraseBoundBeforeHada(stemHead, stemTail, headCapture)) return true;
  }

  return false;
}
