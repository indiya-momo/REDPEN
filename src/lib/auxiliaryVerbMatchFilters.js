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

/** 명사+조사 직후 연결 `해`(역할을+해 오다) — 앞말은 목적어, 본용언 길이는 `해`만 */
const BON_NOUN_JOSA_BEFORE_HAE =
  /(?:을|를|에|도|만|와|과|로|으로|부터|까지|한테|에게|께|에서)$/u;

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
 * 3음절 제한에 쓸 본용언 표면.
 * stem `해 …`이고 캡처 앞이 명사+조사(역할을 등)면 연결어미 `해`만 센다.
 * 그 외(상상해·가져다·만들어 등)는 캡처 전체. 면제는 bon_allow만.
 * @param {string} headCapture
 * @param {string} [stemHead]
 */
export function bonVerbHeadForSyllableLimit(headCapture, stemHead = '') {
  const c = headCapture.trim();
  const head = stemHead.trim();
  if (head === '해' && c.endsWith('해')) {
    const portion = bonVerbHeadStemPortion(c, head);
    if (portion && BON_NOUN_JOSA_BEFORE_HAE.test(portion)) {
      return head;
    }
  }
  return c;
}

/**
 * 본용언 3음절 이상인지.
 * 1차는 길이만으로 일반 본조 검사를 빼지 않는다. 칸 분리는 enrichAuxiliaryDictSolid.
 * @param {string} headCapture
 * @param {string} [stemHead]
 */
export function isBonVerbHeadTooLongForAuxiliary(headCapture, stemHead = '') {
  const countTarget = bonVerbHeadForSyllableLimit(headCapture, stemHead);
  return bonVerbHeadSyllableCount(countTarget) > BON_VERB_HEAD_MAX_SYLLABLES;
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
  // ZWSP·BOM은 본조 띄움 gap인데 JS `\s`에 안 들어가 붙임으로 오인됨
  return m.length > 0 && !/[\s\u200B\uFEFF]/u.test(m);
}

/** 국어원 (1) 구 결합 — …싶어 하다 / …들어 하다 (붙임 ×). 띄어 쓴 경로와 공유하지 않음. */
const PHRASE_BOUND_TAIL_BEFORE_HADA =
  /(?:싶어|들어|않아|않으|키지|되지|싶지|말고)$/u;

/** 띄어 쓴 하다 여섯 활용. `하`만 빼면 `싶어 했다`가 남는다. */
const SPACED_HADA_TAILS = new Set(['하', '한', '합', '할', '해', '했']);

/** 조사가 앞말에 붙은 뒤 보조 — 먹어도 보다 (붙임 ×) */
const PARTICLE_SUFFIX_ON_HEAD =
  /(?:도|는|만|을|를|에|와|과|로|으로|부터|까지|밖에|조차|마저|라도|이라도|에게|한테|께|께서)$/u;

/** 의존명사+조사 뒤 보조 — 읽은 체를 한다, 올 듯도 하다 (붙임 ×) */
const DEP_NOUN_JOSA_ON_HEAD =
  /(?:체를|체를|듯도|듯이|만은|만도|것을|줄을|줄은|듯을|체는|체가)$/u;

/**
 * 종결 `-ㄴ가/-은가/-는가/-던가` + 보다(보·봐…) — 해설: 이미 띄어 쓰는 올바른 표기.
 * stem `가 봐` 등이 `사랑인가 봐`를 본조로 오인하지 않게.
 */
const INTERROGATIVE_GA_BEFORE_BODA = /(?:인|은|는|던)가$/u;

/** 보다 계열 onset (stem 뒤절) */
const BODA_TAIL_ONSETS = new Set([
  '보',
  '본',
  '볼',
  '봐',
  '봤',
  '봐서',
  '보니',
]);

/**
 * 이미 완결된 `있어/없어` 뒤의 「보기만」— 명사 「보기」, 보조 보다 아님.
 * (`먹어 보기만`은 본용언 `먹어`라 유지)
 */
const COMPLETE_ITDA_BEFORE_BOGI =
  /(?:있어|없어|있었다|없었다|있으니|없으니|있으면|없으면)$/u;

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
export function isInterrogativeGaBeforeBoda(stemHead, stemTail, headCapture) {
  if (stemHead !== '가') return false;
  const onset = String(stemTail ?? '').charAt(0);
  if (!BODA_TAIL_ONSETS.has(onset) && !BODA_TAIL_ONSETS.has(stemTail)) {
    return false;
  }
  return INTERROGATIVE_GA_BEFORE_BODA.test(headCapture.trim());
}

/**
 * @param {string} stemHead
 * @param {string} stemTail
 * @param {string} headCapture
 * @param {RegExpExecArray} match
 */
export function isNounBogiManAfterItda(stemHead, stemTail, headCapture, match) {
  if (stemHead !== '어' && stemHead !== '아') return false;
  if (stemTail !== '보' && stemTail !== '봐') return false;
  if (!COMPLETE_ITDA_BEFORE_BOGI.test(headCapture.trim())) return false;
  const tailCapture = String(match[2] ?? '').trim();
  return /^보기만/.test(tailCapture);
}

/** 명사 「줄」+조사 — 앞다투어 줄을 서다 (주다 「어 줄」 오인) */
const NOUN_JUL_WITH_JOSA = /^줄(?:을|은|이|도|만)$/u;

/**
 * @param {string} stemHead
 * @param {string} stemTail
 * @param {RegExpExecArray} match
 */
export function isNounJulWithJosa(stemHead, stemTail, match) {
  if (
    stemHead !== '어' &&
    stemHead !== '아' &&
    stemHead !== '여' &&
    stemHead !== '혀'
  ) {
    return false;
  }
  if (stemTail !== '줄') return false;
  return NOUN_JUL_WITH_JOSA.test(String(match[2] ?? '').trim());
}

/**
 * 「해 질 무렵」(해가 지다) — 본용언+보조용언이 아닌 문형.
 * stem `해 질` 오인만 본조에서 뺀다. 침묵 ≠ 맞춤법 OK
 * (붙여 쓴 「해질녘」「해질 무렵」은 맞춤법 S2가 담당).
 * ZWSP·일반 공백 「해 질 무렵」 포함.
 * @param {string} stemHead
 * @param {string} headCapture
 * @param {RegExpExecArray} match
 */
export function isHaeJilMuryeop(stemHead, headCapture, match) {
  if (stemHead !== '해' || headCapture !== '해') return false;
  const matched = String(match[0] ?? '');
  const after = String(match.input ?? '').slice(
    (match.index ?? 0) + matched.length,
  );
  return /^[\s\u00A0\u200B\uFEFF\r\n]*무렵/u.test(after);
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

/** 앞 어절 분리 — 일반 공백·줄바꿈 모두 (본조 줄 단위 검색·소프트랩) */
const PREV_EOJEOL_GAP = /[\s\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\u200B\uFEFF]+/u;
const PREV_EOJEOL_GAP_END = /[\s\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\u200B\uFEFF]+$/u;

/**
 * 매치 바로 앞 어절. match.input이 페이지 전체면 윗줄도 본다.
 * @param {RegExpExecArray} match
 */
function previousEojeol(match) {
  const input = String(match.input ?? '');
  const index = match.index ?? 0;
  const before = input.slice(0, index).replace(PREV_EOJEOL_GAP_END, '');
  if (!before) return '';
  const parts = before.split(PREV_EOJEOL_GAP);
  return parts[parts.length - 1] ?? '';
}

/**
 * 띄어 쓴 하다. `싶어`·`않아`는 그 어절만, `들어`는 바로 앞 어절이 `에`로 끝날 때만.
 * @param {string} stemHead
 * @param {string} stemTail
 * @param {string} headCapture
 * @param {RegExpExecArray} match
 */
function isSpacedPhraseBoundBeforeHada(stemHead, stemTail, headCapture, match) {
  if (stemHead !== '어' && stemHead !== '아') return false;
  if (!SPACED_HADA_TAILS.has(stemTail)) return false;
  const head = headCapture.trim();
  if (head.endsWith('싶어') || head.endsWith('않아')) return true;
  return head.endsWith('들어') && previousEojeol(match).endsWith('에');
}

/**
 * @param {import('./ruleTypes.js').Rule} rule
 * @param {RegExpExecArray} match
 */
/**
 * 3음절 복합어 칸. 2음절 이하·허용 목록·거짓 해는 빼고, 명사+해(생각해)는 남긴다.
 * @param {import('./ruleTypes.js').Rule} rule
 * @param {RegExpExecArray} match
 */
export function shouldSkipLongCompoundSplit(rule, match) {
  const matched = String(match?.[0] ?? '');
  if (!matched || /\s/.test(matched)) return true;
  const head = String(match[1] ?? '').trim();
  const tail = String(match[2] ?? '').trim();
  if (!head) return true;
  // 연결 `-다가`(도/는/면/…) — 보조 가다로 오인 (관람하다가·찾아오다가도)
  // nonAeoAuxSpacing DA_GA_CONNECTIVE_TAILS와 같은 취지. tail은 STEM_TAIL_END로 가도·가는 등.
  if (head.endsWith('다') && /^가/.test(tail)) {
    return true;
  }
  if (bonVerbHeadSyllableCount(head) <= BON_VERB_HEAD_MAX_SYLLABLES) return true;
  if (isLexicalHaeCompoundHead(head)) return true;
  if (AUX_FALSE_HAE_HEAD_CAPTURES.has(head)) return true;
  if (headEndsWithParticleBeforeAux(head)) return true;
  if (headEndsWithDepNounJosa(head)) return true;
  const allow = bonVerbAllowForItemId(rule?.bonBojoItemId);
  if (isBonVerbHeadOnAllowList(head, '', allow)) return true;
  return false;
}

export function shouldSkipAuxiliaryVerbMatch(rule, match) {
  if (rule.patternKind !== 'auxiliary-verb') return false;
  if (rule.auxSplitLongCompound) return shouldSkipLongCompoundSplit(rule, match);

  const headCapture = String(match[1] ?? '').trim();
  if (headCapture && isNounRootHaeHead(headCapture)) return true;

  // 3음절+도 1차에서 넓게 받는다. 추출본(/data/stdict-verb-forms.json)은
  // 비동기 로드라 여기선 단일어·복합어를 나누지 않고, dict solid가 칸을 나눈다.
  const tail = rule.tailWord?.trim() ?? '';
  const parts = tail.split(/\s+/).filter(Boolean);
  const stemHead =
    parts.length === 2 ? parts[0] : isHaeBoPattern(tail) ? '해' : '';

  if (parts.length !== 2) return false;
  if (!headCapture) return false;

  const [, stemTail] = parts;
  const glued = isGluedAuxiliaryMatch(match);

  if (stemHead === '해') {
    if (isLexicalHaeCompoundHead(headCapture)) return true;
    if (AUX_FALSE_HAE_HEAD_CAPTURES.has(headCapture)) return true;
  }

  // 본용언+보조용언이 아닌 문형 — 본조 목록에서만 제외. 맞춤법 판정 아님. 후속: 칸 분리 UI.
  if (isNounJulWithJosa(stemHead, stemTail, match)) return true;
  if (isHaeJilMuryeop(stemHead, headCapture, match)) return true;

  if (glued) {
    if (headEndsWithParticleBeforeAux(headCapture)) return true;
    if (headEndsWithDepNounJosa(headCapture)) return true;
    if (isPhraseBoundBeforeHada(stemHead, stemTail, headCapture)) return true;
  } else {
    // 앞 어절이 의존명사+조사(줄을·것을…)면 단독 「해」보조 아님
    if (
      stemHead === '해' &&
      headCapture === '해' &&
      headEndsWithDepNounJosa(previousEojeol(match))
    ) {
      return true;
    }
    if (isSpacedPhraseBoundBeforeHada(stemHead, stemTail, headCapture, match)) {
      return true;
    }
    if (isInterrogativeGaBeforeBoda(stemHead, stemTail, headCapture)) {
      return true;
    }
    if (isNounBogiManAfterItda(stemHead, stemTail, headCapture, match)) {
      return true;
    }
  }

  return false;
}
