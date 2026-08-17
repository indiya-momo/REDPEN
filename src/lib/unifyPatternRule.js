/**
 * 표기 통일 추천 — 세션 스코프 접두·접미 패턴 확장 (2차).
 * seriesTendencyHint(층 C 힌트)와 분리.
 * @see project-docs/unify-phase2-pattern-2026-07-31.md
 */

import { hangulSyllableCount } from './unifyHangulBasics.js';
import {
  isExcludedUnifyCandidateRaw,
  isValidSpacedUnifyVariant,
  normalizeUnifyVariant,
  stripTrailingJosa,
  stripUnifyPeripheralDigits,
  stripUnifyPunctuationNoise,
  unifySpacingKey,
} from './unifyCandidateNormalize.js';
import { isExcludedSeriesAffix } from './unifyCandidateSeriesTrend.js';
import { buildPhraseSlotFindRules } from './phraseSlotPattern.js';
import { runRuleCheck } from './ruleEngine.js';
import { escapeRegex } from './compoundPatternCommon.js';
import { findPhraseInSpan } from './pdfHighlightRange.js';
import {
  isSpacedLeftNoiseEojeol,
  shouldRejectUnifyCandidateNoise,
} from './unifyNoiseList.js';
import { isSpacedLeftAdnominalNoiseEojeol } from './unifyNoiseListAdnominalHeuristic.js';
import { shouldRejectUnifySatelliteSpacedByPos } from './kiwiMorph/unifyExclude.js';
import { isUnifyKiwiNoisePhase2Available } from './kiwiMorph/noiseFilterGate.js';

/** 관형·수식·용언형 앞말 — 접미(@affix) 패턴의 변수(head)에서 제외 (닫힌 낱말) */
export const PATTERN_RULE_HEAD_BLACKLIST = new Set([
  '여러',
  '전',
  '역대',
  '각',
  '한',
  '두',
  '세',
  '이',
  '그',
  '저',
  '새',
  '옛',
  '첫',
  '모든',
  '어떤',
  '어느',
  '이런',
  '그런',
  '저런',
  // 관형사·관형형·의존 수식 (명사+명사 아님) — 닫힌 어미 휴리스틱 보완용
  '다른',
  '같은',
  '많은',
  '적은',
  '큰',
  '작은',
  '좋은',
  '나쁜',
  '새로운',
  '오래된',
  '오래',
  '오래도록',
  '가난한',
  '없는',
  '있는',
  '하는',
  '되는',
  '된',
  '할',
  '될',
  '한',
  '온',
  '전한',
  '아무',
  '몇몇',
  '온갖',
  '각종',
  '벗어난',
]);

/** 줄바꿈 OCR 관형격 조각 — 2차 @패턴 head만. 1차 강의·명의·논의는 건드리지 않음 */
const PATTERN_RULE_HEAD_OCR_POSSESSIVE = new Set(['년의', '련의']);

/**
 * @typedef {'glued' | 'spaced'} PatternRuleDirection
 * @typedef {'prefix' | 'suffix'} PatternAffixType
 *
 * @typedef {{
 *   id: string,
 *   template: string,
 *   affix: string,
 *   affixType: PatternAffixType,
 *   direction: PatternRuleDirection,
 *   confirmedFrom: string,
 *   confirmedKey: string,
 * }} UnifyPatternRule
 *
 * @typedef {{
 *   key: string,
 *   from: string,
 *   to: string,
 *   count: number,
 *   instances: import('./ruleEngine.js').MatchInstance[],
 *   affixType?: PatternAffixType,
 *   template?: string,
 * }} PatternRuleMismatch
 *
 * @typedef {{
 *   occurrenceCount: number,
 *   uniqueHeads: number,
 *   examples: string[],
 * }} PatternRuleSupport
 *
 * @typedef {{
 *   form: string,
 *   count: number,
 * }} PatternCompliantForm
 *
 * @typedef {{
 *   id: string,
 *   rule: UnifyPatternRule,
 *   mismatchCount: number,
 *   exampleFroms: string[],
 *   mismatches: PatternRuleMismatch[],
 *   support: PatternRuleSupport,
 *   score: number,
 *   compliantForms?: import('./unifyCandidateDiscover.js').UnifySpacingCluster[],
 * }} PatternRuleCandidate
 */

/** 패턴 후보 증거 하한 (상수 — 원고 길이에 따라 조정 가능) */
export const PATTERN_SUPPORT_MIN_UNIQUE_HEADS = 2;
export const PATTERN_SUPPORT_MIN_OCCURRENCE = 3;
/** score ≈ occurrence + w1·uniqueHeads − w2·exceptions */
export const PATTERN_SCORE_WEIGHT_HEAD = 10;
export const PATTERN_SCORE_WEIGHT_EXCEPTION = 5;

/**
 * @param {string} head
 */
export function isPatternRuleHeadBlacklisted(head) {
  const h = String(head ?? '').trim();
  if (!h) return true;
  if (PATTERN_RULE_HEAD_BLACKLIST.has(h)) return true;
  if (PATTERN_RULE_HEAD_OCR_POSSESSIVE.has(h)) return true;
  if (hangulSyllableCount(h) < 2) return true;
  // 붙임 head(나라의·무역이나·더해) — Surface-only 경로를 우회해 좌측 잡음과 동일 적용
  if (isSpacedLeftNoiseEojeol(h)) return true;
  if (isSpacedLeftAdnominalNoiseEojeol(h)) return true;
  return false;
}

/**
 * 1차 discover와 같은 표면 정규화 — 기호·주변 숫자(쪽번호┃) 제거.
 * @param {string} s
 */
function cleanPatternSurface(s) {
  return stripUnifyPeripheralDigits(
    stripUnifyPunctuationNoise(normalizeUnifyVariant(s)),
  );
}

/**
 * 1차 discover와 같은 제외·정규화 + 공통 잡음 경로({@link shouldRejectUnifyCandidateNoise}).
 * @param {string} matchedText
 */
export function passesPatternRuleUnifyFilter(matchedText) {
  const raw = String(matchedText ?? '');
  if (!raw.trim()) return false;
  if (isExcludedUnifyCandidateRaw(raw)) return false;
  const cleaned = cleanPatternSurface(raw);
  if (!cleaned) return false;
  if (/\s/.test(cleaned) && !isValidSpacedUnifyVariant(cleaned)) return false;
  const key = unifySpacingKey(cleaned);
  if (!key) return false;
  if (shouldRejectUnifyCandidateNoise(cleaned, key)) return false;
  return true;
}

/**
 * 2차 패턴 mismatch — 1차와 동일 잡음 경로 + (Kiwi ready 시) 명사+명사/동사+동사만.
 * @param {string} from
 * @param {string} to
 * @param {string} key
 * @returns {boolean} true면 제외
 */
export function shouldRejectPatternMismatchByNoiseAndCompound(from, to, key) {
  const surfaces = [from, to, key]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean);
  const spaced = surfaces.find((s) => /\s/.test(s)) || '';
  const pairKey = String(key ?? '').trim();

  if (from && shouldRejectUnifyCandidateNoise(from, pairKey)) return true;
  if (to && shouldRejectUnifyCandidateNoise(to, pairKey)) return true;
  if (pairKey && shouldRejectUnifyCandidateNoise(pairKey, pairKey)) return true;

  if (spaced) {
    // boot 없이 이미 ready일 때만 POS — 명사+명사·동사+동사 아니면 제외
    if (isUnifyKiwiNoisePhase2Available()) {
      try {
        if (shouldRejectUnifySatelliteSpacedByPos(spaced, undefined)) {
          return true;
        }
      } catch {
        /* fail-open for POS only; list already applied */
      }
    }
  }
  return false;
}

/**
 * @param {{ key?: string, variants?: string[] }} cluster
 * @param {string} chosenVariant
 * @returns {{ spaced: string, direction: PatternRuleDirection, key: string, chosen: string } | null}
 */
function baseChoiceParts(cluster, chosenVariant) {
  const chosen = String(chosenVariant ?? '').trim();
  const key = String(cluster?.key ?? chosen.replace(/\s+/g, '')).trim();
  if (!chosen || !key) return null;

  const variants = Array.isArray(cluster?.variants) ? cluster.variants : [];
  const spaced =
    variants.find((v) => /\s/.test(String(v))) ||
    (/\s/.test(chosen) ? chosen : null);
  if (!spaced) return null;

  const direction = /** @type {PatternRuleDirection} */ (
    /\s/.test(chosen) ? 'spaced' : 'glued'
  );
  return { spaced: String(spaced).trim(), direction, key, chosen };
}

/**
 * @param {{ key?: string, variants?: string[] }} cluster
 * @param {string} chosenVariant
 * @returns {UnifyPatternRule | null}
 */
export function buildSuffixPatternRuleFromChoice(cluster, chosenVariant) {
  const base = baseChoiceParts(cluster, chosenVariant);
  if (!base) return null;

  const parts = base.spaced.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const affix = parts[parts.length - 1];
  if (isExcludedSeriesAffix(affix)) return null;
  if (!base.key.endsWith(affix) || base.key.length <= affix.length) return null;

  return {
    id: `suffix:${affix}:${base.direction}`,
    template: `@${affix}`,
    affix,
    affixType: 'suffix',
    direction: base.direction,
    confirmedFrom: base.chosen,
    confirmedKey: base.key,
  };
}

/**
 * @param {{ key?: string, variants?: string[] }} cluster
 * @param {string} chosenVariant
 * @returns {UnifyPatternRule | null}
 */
export function buildPrefixPatternRuleFromChoice(cluster, chosenVariant) {
  const base = baseChoiceParts(cluster, chosenVariant);
  if (!base) return null;

  const parts = base.spaced.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const affix = parts[0];
  if (isExcludedSeriesAffix(affix)) return null;
  if (hangulSyllableCount(affix) < 2) return null;
  if (!base.key.startsWith(affix) || base.key.length <= affix.length) return null;

  return {
    id: `prefix:${affix}:${base.direction}`,
    template: `${affix}@`,
    affix,
    affixType: 'prefix',
    direction: base.direction,
    confirmedFrom: base.chosen,
    confirmedKey: base.key,
  };
}

/**
 * @param {Pick<UnifyPatternRule, 'template' | 'affix' | 'direction' | 'confirmedFrom'>} rule
 */
export function formatSuffixPatternRuleConfirmMessage(rule) {
  const affix = rule.affix || String(rule.template ?? '').replace(/^@/, '');
  const dirLabel = rule.direction === 'glued' ? '붙여 쓰는' : '띄어 쓰는';
  const template = rule.template || `@${affix}`;
  return (
    `${template}(○○${affix} 형태) 전체를 ${dirLabel} 쪽으로 통일할까요?\n` +
    `기준: ${rule.confirmedFrom}`
  );
}

/**
 * @param {string} matchedText
 * @param {string} affix
 */
export function glueSpacedAffixMatch(matchedText, affix) {
  const t = String(matchedText ?? '');
  const a = String(affix ?? '');
  if (!t || !a) return t;
  return t.replace(new RegExp(`[\\s\\u00A0]+${escapeRegex(a)}$`), a);
}

/**
 * @param {string} matchedText
 * @param {string} affix
 */
export function spaceGluedAffixMatch(matchedText, affix) {
  const t = String(matchedText ?? '').trim();
  const a = String(affix ?? '');
  if (!t || !a || !t.endsWith(a) || t.length <= a.length) return t;
  if (/\s/.test(t)) return t;
  const head = t.slice(0, -a.length);
  return head ? `${head} ${a}` : a;
}

/**
 * @param {string} matchedText
 * @param {string} head
 */
export function glueSpacedPrefixMatch(matchedText, head) {
  const t = String(matchedText ?? '');
  const h = String(head ?? '');
  if (!t || !h) return t;
  return t.replace(new RegExp(`^${escapeRegex(h)}[\\s\\u00A0]+`), h);
}

/**
 * @param {string} matchedText
 * @param {string} head
 */
export function spaceGluedPrefixMatch(matchedText, head) {
  const t = String(matchedText ?? '').trim();
  const h = String(head ?? '');
  if (!t || !h || !t.startsWith(h) || t.length <= h.length) return t;
  if (/\s/.test(t)) return t;
  const tail = t.slice(h.length);
  return tail ? `${h} ${tail}` : h;
}

/**
 * @param {string} matchedText
 * @param {string} affix
 */
function headBeforeAffix(matchedText, affix) {
  const glued = glueSpacedAffixMatch(matchedText, affix).replace(/\s+/g, '');
  if (!glued.endsWith(affix)) return '';
  return glued.slice(0, -affix.length);
}

/**
 * @param {string} matchedText
 * @param {string} head
 */
function tailAfterPrefix(matchedText, head) {
  const glued = glueSpacedPrefixMatch(matchedText, head).replace(/\s+/g, '');
  if (!glued.startsWith(head)) return '';
  return glued.slice(head.length);
}

/**
 * 접미 → 앞말(head), 접두 → 뒷말(tail). 계열 다양성 카운트용.
 * @param {Pick<UnifyPatternRule, 'affix' | 'affixType'>} rule
 * @param {string} text
 */
export function patternRuleVariablePart(rule, text) {
  const t = String(text ?? '');
  if (!t || !rule?.affix) return '';
  if (rule.affixType === 'prefix') return tailAfterPrefix(t, rule.affix);
  return headBeforeAffix(t, rule.affix);
}

/**
 * @param {UnifyPatternRule} rule
 * @param {PatternRuleMismatch[]} mismatches
 * @returns {PatternRuleSupport}
 */
export function buildPatternRuleSupport(rule, mismatches) {
  /** @type {Set<string>} */
  const heads = new Set();
  const confirmedVar = patternRuleVariablePart(rule, rule.confirmedFrom);
  if (confirmedVar) heads.add(confirmedVar);

  let occurrenceCount = 0;
  /** @type {string[]} */
  const examples = [];
  for (const m of mismatches ?? []) {
    occurrenceCount += Number(m.count) || 0;
    const v =
      patternRuleVariablePart(rule, m.from) ||
      patternRuleVariablePart(rule, m.key);
    if (v) heads.add(v);
    if (m.from && examples.length < 3 && !examples.includes(m.from)) {
      examples.push(m.from);
    }
  }

  return {
    occurrenceCount,
    uniqueHeads: heads.size,
    examples,
  };
}

/**
 * mismatch 없이 이미 맞는 표기만 있을 때 지지 점수 (전부 붙여쓰기 등).
 * @param {UnifyPatternRule} rule
 * @param {import('./unifyCandidateDiscover.js').UnifySpacingCluster[]} compliantForms
 * @returns {PatternRuleSupport}
 */
export function buildPatternRuleSupportFromCompliant(rule, compliantForms) {
  /** @type {Set<string>} */
  const heads = new Set();
  const confirmedVar = patternRuleVariablePart(rule, rule.confirmedFrom);
  if (confirmedVar) heads.add(confirmedVar);

  let occurrenceCount = 0;
  /** @type {string[]} */
  const examples = [];
  for (const c of compliantForms ?? []) {
    const n = Number(c?.totalCount) || 0;
    if (n <= 0) continue;
    occurrenceCount += n;
    const sample =
      (c.variants ?? []).find((v) =>
        rule.direction === 'spaced' ? /\s/.test(v) : !/\s/.test(v),
      ) ||
      c.variants?.[0] ||
      c.key;
    const v =
      patternRuleVariablePart(rule, sample) ||
      patternRuleVariablePart(rule, c.key);
    if (v) heads.add(v);
    if (sample && examples.length < 3 && !examples.includes(sample)) {
      examples.push(String(sample));
    }
  }

  return {
    occurrenceCount,
    uniqueHeads: heads.size,
    examples,
  };
}

/**
 * @param {PatternRuleSupport} support
 * @param {number} [exceptionCount]
 */
export function scorePatternRuleCandidate(support, exceptionCount = 0) {
  const occ = Number(support?.occurrenceCount) || 0;
  const heads = Number(support?.uniqueHeads) || 0;
  const ex = Number(exceptionCount) || 0;
  return (
    occ +
    PATTERN_SCORE_WEIGHT_HEAD * heads -
    PATTERN_SCORE_WEIGHT_EXCEPTION * ex
  );
}

/**
 * @param {PatternRuleSupport} support
 */
export function meetsPatternSupportThreshold(support) {
  return (
    (Number(support?.uniqueHeads) || 0) >= PATTERN_SUPPORT_MIN_UNIQUE_HEADS &&
    (Number(support?.occurrenceCount) || 0) >= PATTERN_SUPPORT_MIN_OCCURRENCE
  );
}

/**
 * UI용 한 줄 설명 (Rule 메타 → 표시). DEV·테스트용. 2차 목록에는
 * {@link formatPhase2PrimaryFormsLine} 을 쓴다.
 * @param {PatternRuleSupport} support
 * @param {number} [score]
 */
export function formatPatternSupportExplain(support, score) {
  if (!support) return '';
  const parts = [
    `${support.occurrenceCount}회 발견`,
    `${support.uniqueHeads}개 계열에서 확인`,
  ];
  if (Number.isFinite(score)) parts.push(`점수 ${score}`);
  if (support.examples?.length) {
    parts.push(`예) ${support.examples.slice(0, 3).join(' · ')}`);
  }
  return parts.join(' · ');
}

/** 2차 계열 아래 — 1차 표기 표기명 최대 개수 */
export const PHASE2_PRIMARY_FORMS_MAX = 4;
/** 2차 「1차 통일형(…) 적용 단어」요약 — 접힘 시 상위 개수 */
export const PHASE2_COMPLIANT_FORMS_PREVIEW = 3;

/**
 * 2차 계열 summary — `1차` + 방향 뱃지(붙여쓰기/띄어쓰기).
 * 방향과 반대인 1차 선택 표기는 exceptions(뱃지용).
 * @param {'glued' | 'spaced' | null | undefined} direction
 * @param {string[]} forms
 * @returns {{
 *   prefix: string,
 *   dirLabel: string,
 *   text: string,
 *   exceptions: string[],
 * }}
 */
export function formatPhase2SeriesCriterionModel(direction, forms) {
  const list = (forms ?? [])
    .map((f) => String(f ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const uniq = [];
  for (const f of list) {
    if (!uniq.includes(f)) uniq.push(f);
  }
  const dirLabel =
    direction === 'spaced'
      ? '띄어쓰기'
      : direction === 'glued'
        ? '붙여쓰기'
        : '';
  if (!dirLabel) {
    return { prefix: '', dirLabel: '', text: '', exceptions: [] };
  }
  /** @type {string[]} */
  const exceptions = [];
  if (direction === 'glued' || direction === 'spaced') {
    for (const f of uniq) {
      const spaced = /\s/.test(f);
      if (
        (direction === 'glued' && spaced) ||
        (direction === 'spaced' && !spaced)
      ) {
        exceptions.push(f);
      }
    }
  }
  const prefix = '1차';
  return {
    prefix,
    dirLabel,
    text: `${prefix} ${dirLabel}`,
    exceptions,
  };
}

/**
 * 2차 계열 박스 summary용: `1차 붙여쓰기`
 * @param {'glued' | 'spaced' | null | undefined} direction
 * @param {string[]} forms
 */
export function formatPhase2SeriesCriterionLine(direction, forms) {
  return formatPhase2SeriesCriterionModel(direction, forms).text;
}

/**
 * 2차 진행 배너 한 줄(레거시): `@무늬(붙여쓰기)  → 두꺼비무늬`
 * @param {string} template
 * @param {string[]} forms
 * @param {'glued' | 'spaced' | null | undefined} [direction]
 */
export function formatPhase2InProgressSegment(template, forms, direction) {
  const list = (forms ?? [])
    .map((f) => String(f ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const uniq = [];
  for (const f of list) {
    if (!uniq.includes(f)) uniq.push(f);
    if (uniq.length >= PHASE2_PRIMARY_FORMS_MAX) break;
  }
  if (!uniq.length) return '';
  const t = String(template ?? '').trim() || '@';
  const dir =
    direction === 'spaced'
      ? '띄어쓰기'
      : direction === 'glued'
        ? '붙여쓰기'
        : '';
  const dirParen = dir ? `(${dir})` : '';
  return `${t}${dirParen}  → ${uniq.join(' · ')}`;
}

/**
 * 2차 상단 배너 모델 — 제목만(적용 줄은 계열 박스로 이동).
 * @param {{ template?: string, direction?: 'glued' | 'spaced' | null, forms?: string[] }[]} [_entries]
 * @returns {{ title: string, lines: string[] }}
 */
export function formatPhase2InProgressBannerModel(_entries) {
  return {
    title: '2차 표기 통일 기준(1차 표기 통일형)',
    lines: [],
  };
}

/**
 * @param {{ template?: string, direction?: 'glued' | 'spaced' | null, forms?: string[] }[]} entries
 * @returns {string}
 */
export function formatPhase2InProgressBannerTitle(entries) {
  const { title, lines } = formatPhase2InProgressBannerModel(entries);
  if (!lines.length) return title;
  return [title, ...lines].join('\n');
}

/**
 * 계열 안 라벨: `1차 통일형(붙여쓰기) 적용 단어`
 * @param {'glued' | 'spaced' | null | undefined} direction
 */
export function formatPhase2CompliantAppliedLabel(direction) {
  const dir =
    direction === 'spaced'
      ? '띄어쓰기'
      : direction === 'glued'
        ? '붙여쓰기'
        : '';
  if (!dir) return '1차 통일형 적용 단어';
  return `1차 통일형(${dir}) 적용 단어`;
}

/**
 * @deprecated 배너는 {@link formatPhase2InProgressBannerModel} 사용
 * @param {string} template
 * @param {string[]} forms
 * @param {'glued' | 'spaced' | null | undefined} [direction]
 */
export function formatPhase2PrimaryFormsLine(template, forms, direction) {
  const seg = formatPhase2InProgressSegment(template, forms, direction);
  if (!seg) return '';
  return `2차 표기 통일 기준(1차 표기 통일형)\n${seg}`;
}

/**
 * 1차에서 고른 표기 중 이 패턴(접두/접미)에 해당하는 것을 발견 수 순으로 모은다.
 * 반환 문자열은 선택값 그대로(띄어쓰기 유지).
 * @param {{
 *   affixType?: string,
 *   affix?: string,
 *   template?: string,
 * }} group
 * @param {import('./unifyCandidateDiscover.js').UnifySpacingCluster[]} primaryClusters
 * @param {Map<string, string>} chosenByKey
 * @returns {string[]}
 */
export function collectPrimaryFormsForPatternGroup(
  group,
  primaryClusters,
  chosenByKey,
) {
  const affix = String(group?.affix ?? '').trim();
  if (!affix || !(chosenByKey instanceof Map)) return [];
  const isPrefix = group?.affixType === 'prefix';
  /** @type {{ form: string, count: number }[]} */
  const scored = [];
  for (const cluster of primaryClusters ?? []) {
    const key = String(cluster?.key ?? '');
    const chosen = chosenByKey.get(key);
    if (!chosen) continue;
    const form = String(chosen).replace(/\s+/g, ' ').trim();
    if (!form) continue;
    const compact = form.replace(/\s+/g, '');
    if (isPrefix) {
      if (!compact.startsWith(affix)) continue;
    } else if (!compact.endsWith(affix)) {
      continue;
    }
    scored.push({ form, count: Number(cluster.totalCount) || 0 });
  }
  scored.sort(
    (a, b) =>
      b.count - a.count || a.form.localeCompare(b.form, 'ko'),
  );
  const out = [];
  for (const row of scored) {
    if (!out.includes(row.form)) out.push(row.form);
    if (out.length >= PHASE2_PRIMARY_FORMS_MAX) break;
  }
  return out;
}

/**
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 */
function pagesForRuleCheck(pageTexts) {
  return (pageTexts ?? [])
    .map((p, i) => ({
      pageNum: Number(p?.pageNum) || i + 1,
      text: String(p?.textLayout || p?.text || ''),
    }))
    .filter((p) => p.text);
}

/**
 * layout과 다른 visual만 — 이형태 없이 visual에만 띄움이 있는 N+N(분위기 경제)용.
 * layout===visual이면 pagesForRuleCheck와 중복이므로 생략.
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 */
function pagesForVisualDistinctRuleCheck(pageTexts) {
  return (pageTexts ?? [])
    .map((p, i) => {
      const pageNum = Number(p?.pageNum) || i + 1;
      const visual = String(p?.text ?? '');
      const layout = String(p?.textLayout ?? '');
      if (!visual || !layout || visual === layout) return null;
      return { pageNum, text: visual };
    })
    .filter(Boolean);
}

/**
 * layout 스캔이 놓친 띄움(또는 visualAttests가 붙임만 인정한 경우)을
 * page.text∪textLayout에서 직접 보강. runRuleCheck 경로와 별도 안전망.
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @param {UnifyPatternRule} rule
 * @param {Map<string, PatternRuleMismatch>} byKey
 * @param {Set<string>} skipKeys
 */
function backfillSpacedAffixMismatchesFromPageText(
  pageTexts,
  rule,
  byKey,
  skipKeys,
) {
  if (rule.affixType !== 'suffix' || rule.direction !== 'glued') return;
  const affix = String(rule.affix ?? '').trim();
  if (!affix) return;
  const re = new RegExp(`([가-힣]{2,})\\s+${escapeRegex(affix)}`, 'gu');

  for (let i = 0; i < (pageTexts ?? []).length; i += 1) {
    const p = pageTexts[i];
    const pageNum = Number(p?.pageNum) || i + 1;
    const visual = String(p?.text ?? '');
    const layout = String(p?.textLayout ?? '');
    const sources = [visual, layout].filter(Boolean);
    /** @type {Set<string>} */
    const seenAt = new Set();
    for (const source of sources) {
      re.lastIndex = 0;
      let m = re.exec(source);
      while (m) {
        const idx = m.index;
        const head = m[1];
        const fromRaw = `${head} ${affix}`;
        const stamp = `${pageNum}:${idx}:${fromRaw}`;
        if (seenAt.has(stamp)) {
          m = re.exec(source);
          continue;
        }
        seenAt.add(stamp);
        if (hangulContinuesBeforeVisual(source, idx)) {
          m = re.exec(source);
          continue;
        }
        const pair = normalizeMismatchPair(fromRaw, rule);
        if (!pair || skipKeys.has(pair.key)) {
          m = re.exec(source);
          continue;
        }
        if (!patternMismatchAttestedOnPage(p, pair)) {
          m = re.exec(source);
          continue;
        }
        /** @type {import('./ruleEngine.js').MatchInstance} */
        const inst = {
          pageNum,
          index: idx,
          matchedText: pair.from,
        };
        const existing = byKey.get(pair.key);
        if (existing) {
          const dup = existing.instances.some(
            (x) =>
              Number(x.pageNum) === pageNum &&
              String(x.matchedText ?? '') === pair.from &&
              Number(x.index) === idx,
          );
          if (!dup) {
            existing.instances.push(inst);
            existing.count += 1;
          }
        } else {
          byKey.set(pair.key, {
            key: pair.key,
            from: pair.from,
            to: pair.to,
            count: 1,
            instances: [inst],
            affixType: rule.affixType,
            template: rule.template,
          });
        }
        m = re.exec(source);
      }
    }
  }
}

/**
 * page.text 기준 — 직전 한글이 줄바꿈만 건너뛴 채 이어지면 soft-wrap 앞잘림.
 * 어절 사이 일반 공백은 경계로 본다.
 * @param {string} source
 * @param {number} idx
 */
function hangulContinuesBeforeVisual(source, idx) {
  let i = idx - 1;
  while (i >= 0 && (source[i] === '\n' || source[i] === '\r')) i -= 1;
  if (i < 0) return false;
  const c = source.charCodeAt(i);
  return c >= 0xac00 && c <= 0xd7a3;
}

/**
 * 2차 mismatch/compliant — layout 스캔 결과를 page.text에 실재할 때만 인정.
 * `세\n계금융위기 경제`처럼 줄바꿈 앞잘림 조각은 거부.
 * @param {string} pageText visual (`page.text`)
 * @param {string} surface
 * @returns {boolean}
 */
export function visualAttestsPatternSurface(pageText, surface) {
  const source = String(pageText ?? '').normalize('NFC');
  const needle = normalizeUnifyVariant(surface);
  if (!source || !needle) return false;

  let pos = 0;
  while (pos <= source.length) {
    const idx = source.indexOf(needle, pos);
    if (idx < 0) break;
    if (!hangulContinuesBeforeVisual(source, idx)) return true;
    pos = idx + 1;
  }

  if (!/\s/.test(needle)) return false;

  pos = 0;
  while (pos < source.length) {
    const hit = findPhraseInSpan(source.slice(pos), needle);
    if (!hit) break;
    const idx = pos + hit.start;
    if (!hangulContinuesBeforeVisual(source, idx)) return true;
    pos = idx + 1;
  }
  return false;
}

/**
 * 2차 mismatch — page.text 우선. layout-only 띄움은 붙임키(to/key)가 text에 있을 때만.
 * @param {{ text?: string, textLayout?: string }} page
 * @param {{ from: string, to: string, key: string }} pair
 * @returns {boolean}
 */
function patternMismatchAttestedOnPage(page, pair, opts = {}) {
  const visual = String(page?.text ?? '');
  const layout = String(page?.textLayout ?? '');
  if (visualAttestsPatternSurface(visual, pair.from)) return true;
  if (visualAttestsPatternSurface(visual, pair.to)) return true;
  if (visualAttestsPatternSurface(visual, pair.key)) return true;
  if (!layout || layout === visual) {
    for (const surface of opts.bridgedSurfaces ?? []) {
      if (visualAttestsPatternSurface(visual, surface)) return true;
    }
    return false;
  }
  if (visualAttestsPatternSurface(layout, pair.from)) {
    return (
      visualAttestsPatternSurface(visual, pair.to) ||
      visualAttestsPatternSurface(visual, pair.key)
    );
  }
  for (const surface of opts.bridgedSurfaces ?? []) {
    if (
      visualAttestsPatternSurface(visual, surface) ||
      visualAttestsPatternSurface(layout, surface)
    ) {
      return true;
    }
  }
  return false;
}

/** @param {string} head @param {string} affix */
function bridgedAffixSurfaces(head, affix) {
  const h = String(head ?? '').trim();
  const a = String(affix ?? '').trim();
  if (!h || !a) return [];
  return [
    `${h}와 ${a}`,
    `${h}과 ${a}`,
    `${h}·${a}`,
    `${h} · ${a}`,
    `${h}•${a}`,
    `${h} • ${a}`,
  ];
}

/**
 * layout/runRuleCheck가 놓친 `분위기와 경제`·`분위기·경제` 등 — canonical `head affix` mismatch로 보강.
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @param {UnifyPatternRule} rule
 * @param {Map<string, PatternRuleMismatch>} byKey
 * @param {Set<string>} skipKeys
 */
function backfillBridgedAffixMismatchesFromPageText(
  pageTexts,
  rule,
  byKey,
  skipKeys,
) {
  if (rule.affixType !== 'suffix' || rule.direction !== 'glued') return;
  const affix = String(rule.affix ?? '').trim();
  if (!affix) return;
  const re = new RegExp(
    `([가-힣]{2,})\\s*(?:와|과|[·•・])\\s*${escapeRegex(affix)}`,
    'gu',
  );

  for (let i = 0; i < (pageTexts ?? []).length; i += 1) {
    const p = pageTexts[i];
    const pageNum = Number(p?.pageNum) || i + 1;
    const visual = String(p?.text ?? '');
    const layout = String(p?.textLayout ?? '');
    const sources = [visual, layout].filter(Boolean);
    /** @type {Set<string>} */
    const seenAt = new Set();
    for (const source of sources) {
      re.lastIndex = 0;
      let m = re.exec(source);
      while (m) {
        const idx = m.index;
        const head = m[1];
        const bridgedRaw = m[0];
        const fromCanonical = `${head} ${affix}`;
        const stamp = `${pageNum}:${idx}:${fromCanonical}`;
        if (seenAt.has(stamp)) {
          m = re.exec(source);
          continue;
        }
        seenAt.add(stamp);
        if (hangulContinuesBeforeVisual(source, idx)) {
          m = re.exec(source);
          continue;
        }
        const pair = normalizeMismatchPair(fromCanonical, rule);
        if (!pair || skipKeys.has(pair.key)) {
          m = re.exec(source);
          continue;
        }
        if (
          !patternMismatchAttestedOnPage(p, pair, {
            bridgedSurfaces: [bridgedRaw, ...bridgedAffixSurfaces(head, affix)],
          })
        ) {
          m = re.exec(source);
          continue;
        }
        /** @type {import('./ruleEngine.js').MatchInstance} */
        const inst = {
          pageNum,
          index: idx,
          matchedText: pair.from,
        };
        const existing = byKey.get(pair.key);
        if (existing) {
          const dup = existing.instances.some(
            (x) =>
              Number(x.pageNum) === pageNum &&
              String(x.matchedText ?? '') === pair.from &&
              Number(x.index) === idx,
          );
          if (!dup) {
            existing.instances.push(inst);
            existing.count += 1;
          }
        } else {
          byKey.set(pair.key, {
            key: pair.key,
            from: pair.from,
            to: pair.to,
            count: 1,
            instances: [inst],
            affixType: rule.affixType,
            template: rule.template,
          });
        }
        m = re.exec(source);
      }
    }
  }
}

/**
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @returns {Map<number, string>}
 */
function buildVisualTextByPageNum(pageTexts) {
  /** @type {Map<number, string>} */
  const map = new Map();
  for (let i = 0; i < (pageTexts ?? []).length; i += 1) {
    const p = pageTexts[i];
    const n = Number(p?.pageNum) || i + 1;
    const visual = String(p?.text ?? '');
    if (n && visual) map.set(n, visual);
  }
  return map;
}

/**
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @returns {Map<number, { pageNum?: number, text?: string, textLayout?: string }>}
 */
function buildPageRecordByNum(pageTexts) {
  /** @type {Map<number, { pageNum?: number, text?: string, textLayout?: string }>} */
  const map = new Map();
  for (let i = 0; i < (pageTexts ?? []).length; i += 1) {
    const p = pageTexts[i];
    const n = Number(p?.pageNum) || i + 1;
    if (n) map.set(n, p);
  }
  return map;
}

/**
 * @param {string} from
 * @param {UnifyPatternRule} rule
 * @returns {{ key: string, to: string } | null}
 */
function normalizeMismatchPair(from, rule) {
  const cleaned = stripTrailingJosa(cleanPatternSurface(from));
  if (!cleaned || !passesPatternRuleUnifyFilter(cleaned)) return null;

  if (rule.affixType === 'prefix') {
    const tail = tailAfterPrefix(cleaned, rule.affix);
    if (!tail || hangulSyllableCount(tail) < 2) return null;
    const key = `${rule.affix}${tail}`;
    const to =
      rule.direction === 'glued'
        ? glueSpacedPrefixMatch(cleaned, rule.affix)
        : spaceGluedPrefixMatch(cleaned, rule.affix);
    if (!to || to === cleaned) return null;
    const pairKey = unifySpacingKey(key) || key;
    if (shouldRejectPatternMismatchByNoiseAndCompound(cleaned, to, pairKey)) {
      return null;
    }
    return { key: pairKey, from: cleaned, to };
  }

  const head = headBeforeAffix(cleaned, rule.affix);
  if (isPatternRuleHeadBlacklisted(head)) return null;
  const key = `${head}${rule.affix}`;
  const to =
    rule.direction === 'glued'
      ? glueSpacedAffixMatch(cleaned, rule.affix)
      : spaceGluedAffixMatch(cleaned, rule.affix);
  if (!to || to === cleaned) return null;
  const pairKey = unifySpacingKey(key) || key;
  if (shouldRejectPatternMismatchByNoiseAndCompound(cleaned, to, pairKey)) {
    return null;
  }
  return { key: pairKey, from: cleaned, to };
}

/**
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @param {UnifyPatternRule} rule
 * @param {{ skipKeys?: Set<string> | string[] }} [opts]
 * @returns {PatternRuleMismatch[]}
 */
export function findPatternMismatches(pageTexts, rule, opts = {}) {
  if (!rule?.affix || !rule.direction || !rule.affixType) return [];
  const layoutPages = pagesForRuleCheck(pageTexts);
  const visualPages = pagesForVisualDistinctRuleCheck(pageTexts);
  if (!layoutPages.length && !visualPages.length) return [];
  const visualByPage = buildVisualTextByPageNum(pageTexts);
  const pageByNum = buildPageRecordByNum(pageTexts);

  // skipKeys는 호출부가 명시할 때만. confirmedKey(시드)를 넣지 않는다 —
  // 시드 키=붙임키라서 soft 1순위로 시드가 되면「분위기 경제」같은 남은 띄움이 통째로 사라짐.
  const skipKeys = new Set(
    opts.skipKeys instanceof Set
      ? opts.skipKeys
      : Array.isArray(opts.skipKeys)
        ? opts.skipKeys
        : [],
  );

  let pattern;
  if (rule.affixType === 'prefix') {
    pattern =
      rule.direction === 'glued' ? `${rule.affix} @` : `${rule.affix}@`;
  } else {
    pattern = rule.direction === 'glued' ? `@ ${rule.affix}` : `@${rule.affix}`;
  }

  const rules = buildPhraseSlotFindRules(pattern);
  if (!rules.length) return [];

  /** @type {Map<string, PatternRuleMismatch>} */
  const byKey = new Map();

  /** @param {import('./ruleEngine.js').GroupedResult[] | undefined} results */
  const ingest = (results) => {
    for (const group of results ?? []) {
      for (const inst of group.instances ?? []) {
        const from = String(inst.matchedText ?? '');
        if (!from) continue;
        const pair = normalizeMismatchPair(from, rule);
        if (!pair) continue;
        if (skipKeys.has(pair.key)) continue;
        const pageNum = Number(inst.pageNum) || 0;
        if (
          !patternMismatchAttestedOnPage(
            pageByNum.get(pageNum) ?? { text: visualByPage.get(pageNum) ?? '' },
            pair,
          )
        ) {
          continue;
        }

        const existing = byKey.get(pair.key);
        if (existing) {
          const dup = existing.instances.some(
            (x) =>
              Number(x.pageNum) === pageNum &&
              String(x.matchedText ?? '') === pair.from &&
              Number(x.index) === Number(inst.index),
          );
          if (dup) continue;
          existing.instances.push(inst);
          existing.count += 1;
        } else {
          byKey.set(pair.key, {
            key: pair.key,
            from: pair.from,
            to: pair.to,
            count: 1,
            instances: [inst],
            affixType: rule.affixType,
            template: rule.template,
          });
        }
      }
    }
  };

  if (layoutPages.length) {
    ingest(runRuleCheck(layoutPages, rules).results);
  }
  if (visualPages.length) {
    ingest(runRuleCheck(visualPages, rules).results);
  }

  // runRuleCheck·visualAttests가 놓친 띄움(@ affix) — 본문 직접 보강
  backfillSpacedAffixMismatchesFromPageText(
    pageTexts,
    rule,
    byKey,
    skipKeys,
  );
  backfillBridgedAffixMismatchesFromPageText(
    pageTexts,
    rule,
    byKey,
    skipKeys,
  );

  return [...byKey.values()].sort(
    (a, b) => b.count - a.count || a.from.localeCompare(b.from, 'ko'),
  );
}

/**
 * 규칙 방향에 **이미 맞는** 표기(어긋남 목록의 반대쪽)를 출현 수 순으로 모은다.
 * 붙임 규칙 → 붙인 `@affix` / 띄움 규칙 → 띄운 `@ affix`.
 * 반환 클러스터는 붙임·띄움 두 줄(한쪽 count, 반대 0).
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @param {UnifyPatternRule} rule
 * @returns {import('./unifyCandidateDiscover.js').UnifySpacingCluster[]}
 */
export function findPatternCompliantForms(pageTexts, rule) {
  if (!rule?.affix || !rule.direction || !rule.affixType) return [];
  const pages = pagesForRuleCheck(pageTexts);
  if (!pages.length) return [];

  let pattern;
  if (rule.affixType === 'prefix') {
    pattern =
      rule.direction === 'glued' ? `${rule.affix}@` : `${rule.affix} @`;
  } else {
    pattern = rule.direction === 'glued' ? `@${rule.affix}` : `@ ${rule.affix}`;
  }

  const rules = buildPhraseSlotFindRules(pattern);
  if (!rules.length) return [];

  const { results } = runRuleCheck(pages, rules);
  /** @type {Map<string, { form: string, instances: import('./ruleEngine.js').MatchInstance[] }>} */
  const byKey = new Map();
  const visualByPage = buildVisualTextByPageNum(pageTexts);

  for (const group of results ?? []) {
    for (const inst of group.instances ?? []) {
      const from = String(inst.matchedText ?? '');
      if (!from) continue;
      const pair = normalizeCompliantForm(from, rule);
      if (!pair) continue;
      const pageNum = Number(inst.pageNum) || 0;
      const visual = visualByPage.get(pageNum) ?? '';
      if (!visualAttestsPatternSurface(visual, pair.form)) continue;

      const existing = byKey.get(pair.key);
      if (existing) {
        existing.instances.push(inst);
      } else {
        byKey.set(pair.key, { form: pair.form, instances: [inst] });
      }
    }
  }

  return [...byKey.entries()]
    .map(([key, row]) =>
      compliantToUnifyCluster({
        key,
        form: row.form,
        instances: row.instances,
        direction: rule.direction,
        affix: rule.affix,
        affixType: rule.affixType,
      }),
    )
    .sort(
      (a, b) =>
        (b.totalCount || 0) - (a.totalCount || 0) ||
        a.key.localeCompare(b.key, 'ko'),
    );
}

/**
 * MatchInstance → 쪽 칩/하이라이트용 occ (itemIndexes·좌표 유지 → 빨간 줄)
 * @param {import('./ruleEngine.js').MatchInstance} inst
 * @param {string} fallbackText
 */
function occurrenceFromMatchInstance(inst, fallbackText) {
  return {
    pageNum: inst.pageNum,
    index: inst.index,
    matchedText: inst.matchedText || fallbackText,
    ...(Array.isArray(inst.itemIndexes) && inst.itemIndexes.length
      ? { itemIndexes: inst.itemIndexes }
      : {}),
    ...(typeof inst.x === 'number' ? { x: inst.x } : {}),
    ...(typeof inst.y === 'number' ? { y: inst.y } : {}),
    ...(typeof inst.column === 'number' ? { column: inst.column } : {}),
  };
}

/**
 * @param {{
 *   key: string,
 *   form: string,
 *   instances: import('./ruleEngine.js').MatchInstance[],
 *   direction: PatternRuleDirection,
 *   affix: string,
 *   affixType: PatternAffixType,
 * }} row
 * @returns {import('./unifyCandidateDiscover.js').UnifySpacingCluster}
 */
function compliantToUnifyCluster(row) {
  const glued = String(row.form).replace(/\s+/g, '');
  const spaced =
    row.affixType === 'prefix'
      ? spaceGluedPrefixMatch(glued, row.affix)
      : spaceGluedAffixMatch(glued, row.affix);
  const count = row.instances?.length || 0;
  const isGlued = row.direction === 'glued';
  const variants =
    glued === spaced ? [glued] : [glued, spaced];
  /** @type {Record<string, number>} */
  const counts = {};
  /** @type {import('./unifyCandidateDiscover.js').UnifyVariantOccurrence[]} */
  const occList = (row.instances ?? []).map((inst) =>
    occurrenceFromMatchInstance(inst, row.form),
  );
  /** @type {Record<string, import('./unifyCandidateDiscover.js').UnifyVariantOccurrence[]>} */
  const occurrencesByVariant = {};
  for (const v of variants) {
    const hit = isGlued ? !/\s/.test(v) : /\s/.test(v);
    counts[v] = hit ? count : 0;
    // 이형태(반대 칸)에도 같은 쪽 칩 — 출현 위치는 문서에 있는 표기 기준
    occurrencesByVariant[v] = occList.map((o) => ({ ...o }));
  }
  return {
    key: row.key,
    variants,
    counts,
    occurrencesByVariant,
    recommendedUnify: isGlued ? glued : spaced,
    totalCount: count,
    kind: 'conflict',
  };
}

/**
 * @param {string} from
 * @param {UnifyPatternRule} rule
 * @returns {{ key: string, form: string } | null}
 */
function normalizeCompliantForm(from, rule) {
  const cleaned = stripTrailingJosa(cleanPatternSurface(from));
  if (!cleaned || !passesPatternRuleUnifyFilter(cleaned)) return null;

  const wantSpaced = rule.direction === 'spaced';
  if (wantSpaced !== /\s/.test(cleaned)) return null;

  if (rule.affixType === 'prefix') {
    const tail = tailAfterPrefix(cleaned, rule.affix);
    if (!tail || hangulSyllableCount(tail) < 2) return null;
    const key = `${rule.affix}${tail}`;
    const pairKey = unifySpacingKey(key) || key;
    if (
      shouldRejectPatternMismatchByNoiseAndCompound(cleaned, cleaned, pairKey)
    ) {
      return null;
    }
    return { key: pairKey, form: cleaned };
  }

  const head = headBeforeAffix(cleaned, rule.affix);
  if (isPatternRuleHeadBlacklisted(head)) return null;
  const key = `${head}${rule.affix}`;
  const pairKey = unifySpacingKey(key) || key;
  if (
    shouldRejectPatternMismatchByNoiseAndCompound(cleaned, cleaned, pairKey)
  ) {
    return null;
  }
  return { key: pairKey, form: cleaned };
}

/**
 * UI/테스트: `1차 표기 통일형이 적용된 단어 · 넝쿨무늬 16 · …` (클러스터 또는 {form,count}).
 * @param {PatternRuleDirection} direction
 * @param {(PatternCompliantForm | import('./unifyCandidateDiscover.js').UnifySpacingCluster)[]} forms
 * @param {{ expanded?: boolean, previewMax?: number }} [opts]
 */
export function formatPhase2CompliantFormsLine(direction, forms, opts = {}) {
  /** @type {PatternCompliantForm[]} */
  const list = [];
  for (const f of forms ?? []) {
    if (!f) continue;
    if ('form' in f && f.form) {
      const count = Number(f.count) || 0;
      if (count > 0) list.push({ form: String(f.form), count });
      continue;
    }
    const cluster = /** @type {import('./unifyCandidateDiscover.js').UnifySpacingCluster} */ (
      f
    );
    const count = Number(cluster.totalCount) || 0;
    if (count <= 0) continue;
    const form =
      direction === 'spaced'
        ? (cluster.variants ?? []).find((v) => /\s/.test(v)) ||
          cluster.variants?.[0]
        : (cluster.variants ?? []).find((v) => !/\s/.test(v)) ||
          cluster.variants?.[0];
    if (!form) continue;
    list.push({ form: String(form), count });
  }
  if (!list.length) return '';
  const previewMax = opts.previewMax ?? PHASE2_COMPLIANT_FORMS_PREVIEW;
  const expanded = Boolean(opts.expanded);
  const shown = expanded ? list : list.slice(0, previewMax);
  const parts = shown.map((f) => `${f.form} ${f.count}`);
  return `1차 통일형이 적용된 단어 · ${parts.join(' · ')}`;
}

/**
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @param {UnifyPatternRule} rule
 * @param {{ skipKeys?: Set<string> | string[] }} [opts]
 */
export function findSuffixPatternMismatches(pageTexts, rule, opts = {}) {
  return findPatternMismatches(
    pageTexts,
    { ...rule, affixType: rule.affixType || 'suffix' },
    opts,
  );
}

/**
 * 이중 key: 접미 > 접두 (결정론적 기본값, 베타 후 재검토 가능).
 * @param {PatternRuleMismatch[]} mismatches
 * @returns {PatternRuleMismatch[]}
 */
export function dedupeMismatchesSuffixOverPrefix(mismatches) {
  /** @type {Map<string, PatternRuleMismatch>} */
  const byKey = new Map();
  const rank = (m) => (m.affixType === 'suffix' ? 2 : 1);
  for (const m of mismatches ?? []) {
    if (!m?.key) continue;
    const prev = byKey.get(m.key);
    if (!prev || rank(m) > rank(prev)) byKey.set(m.key, m);
  }
  return [...byKey.values()].sort(
    (a, b) => b.count - a.count || a.from.localeCompare(b.from, 'ko'),
  );
}

/**
 * @param {Pick<UnifyPatternRule, 'template' | 'direction'>} rule
 * @returns {string} 예: `청자@(붙여쓰기)`
 */
export function formatPatternRuleConditionLabel(rule) {
  const template = String(rule?.template ?? '').trim();
  if (!template) return '';
  const dir = rule.direction === 'spaced' ? '띄어쓰기' : '붙여쓰기';
  return `${template}(${dir})`;
}

/**
 * `청자@(붙여쓰기)` 형태 라벨을 붙여쓰기/띄어쓰기 묶음으로 나눈다.
 * @param {string[]} labels
 * @returns {{ glued: string[], spaced: string[] }}
 */
export function groupPatternConditionLabelsByDirection(labels) {
  /** @type {string[]} */
  const glued = [];
  /** @type {string[]} */
  const spaced = [];
  for (const raw of labels ?? []) {
    const label = String(raw ?? '').trim();
    if (!label) continue;
    const m = label.match(/^(.*)\((붙여쓰기|띄어쓰기)\)$/u);
    if (!m) continue;
    const template = m[1].trim();
    if (!template) continue;
    if (m[2] === '띄어쓰기') spaced.push(template);
    else glued.push(template);
  }
  return { glued, spaced };
}

/**
 * 제품 2단(@확장) 시드에 쓸 1차 클러스터인지.
 * soft 80%·확정 등록은 동일 취급. 본+보조·용언 검토도 2차 시드에 포함한다.
 * @param {import('./unifyCandidateDiscover.js').UnifySpacingCluster | null | undefined} cluster
 * @returns {boolean}
 */
export function isUnifyPatternSeedEligibleCluster(cluster) {
  return Boolean(cluster?.key);
}

/**
 * 1차 등록(및 soft 미리찍기 병합 chosen)에서 접두·접미 패턴 규칙만 모은다 (매칭 전).
 * soft 80%는 사용자가 안 건드린 채택이므로 확정 등록과 동일하게 시드한다.
 * @param {Map<string, string> | Iterable<[string, string]>} registeredVariants
 * @param {import('./unifyCandidateDiscover.js').UnifySpacingCluster[]} clusters
 * @returns {UnifyPatternRule[]}
 */
export function collectPatternRulesFromRegistrations(
  registeredVariants,
  clusters,
) {
  const clusterByKey = new Map((clusters ?? []).map((c) => [c.key, c]));
  const entries =
    registeredVariants instanceof Map
      ? [...registeredVariants.entries()]
      : [...registeredVariants];

  /** @type {Map<string, UnifyPatternRule>} */
  const rulesById = new Map();
  for (const [key, chosen] of entries) {
    const cluster = clusterByKey.get(key);
    if (!isUnifyPatternSeedEligibleCluster(cluster)) continue;
    for (const builder of [
      buildSuffixPatternRuleFromChoice,
      buildPrefixPatternRuleFromChoice,
    ]) {
      const rule = builder(cluster, chosen);
      if (!rule) continue;
      if (!rulesById.has(rule.id)) rulesById.set(rule.id, rule);
    }
  }

  const rules = [...rulesById.values()];
  rules.sort((a, b) => {
    const ta = a.affixType === 'suffix' ? 0 : 1;
    const tb = b.affixType === 'suffix' ? 0 : 1;
    if (ta !== tb) return ta - tb;
    return a.template.localeCompare(b.template, 'ko');
  });
  return rules;
}

/**
 * 1차 등록에서 2차 패턴 후보(+건수·예시·score)를 모은다.
 * 증거 하한(uniqueHeads·occurrence) 미달·시드 부적격 후보는 제외한다.
 * mismatch가 없어도(전부 붙여쓰기 등) 이미 맞는 표기가 충분하면 후보로 둔다.
 * @param {Map<string, string> | Iterable<[string, string]>} registeredVariants
 * @param {import('./unifyCandidateDiscover.js').UnifySpacingCluster[]} clusters
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @returns {PatternRuleCandidate[]}
 */
/**
 * @param {UnifyPatternRule} rule
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @returns {PatternRuleCandidate | null}
 */
function buildPatternRuleCandidateForRule(rule, pageTexts) {
  const mismatches = findPatternMismatches(pageTexts, rule);
  const compliantForms = findPatternCompliantForms(pageTexts, rule);
  if (!mismatches.length && !compliantForms.length) return null;

  const support = mismatches.length
    ? buildPatternRuleSupport(rule, mismatches)
    : buildPatternRuleSupportFromCompliant(rule, compliantForms);
  if (!meetsPatternSupportThreshold(support)) return null;
  const score = scorePatternRuleCandidate(support, 0);
  return {
    id: rule.id,
    rule,
    mismatchCount: support.occurrenceCount,
    exampleFroms: support.examples.slice(0, 2),
    mismatches,
    support,
    score,
    compliantForms,
  };
}

/**
 * @param {PatternRuleCandidate[]} candidates
 * @returns {PatternRuleCandidate[]}
 */
function sortPatternRuleCandidates(candidates) {
  return [...(candidates ?? [])].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ta = a.rule.affixType === 'suffix' ? 0 : 1;
    const tb = b.rule.affixType === 'suffix' ? 0 : 1;
    if (ta !== tb) return ta - tb;
    return a.rule.template.localeCompare(b.rule.template, 'ko');
  });
}

export function collectPatternRuleCandidates(
  registeredVariants,
  clusters,
  pageTexts,
) {
  const rules = collectPatternRulesFromRegistrations(
    registeredVariants,
    clusters,
  );

  // 1차 soft/등록 키를 skip하지 않음 — 시드 confirmedKey도 mismatch에서 빼지 않음.
  // (시드 키 skip 시 soft 1순위 N+N이 2차에서 사라짐)
  /** @type {PatternRuleCandidate[]} */
  const out = [];
  for (const rule of rules) {
    const candidate = buildPatternRuleCandidateForRule(rule, pageTexts);
    if (candidate) out.push(candidate);
  }
  return sortPatternRuleCandidates(out);
}

/**
 * 2차 진입용 — 규칙마다 양보해 메인 스레드·로딩 UI가 살아 있게.
 * @param {Map<string, string> | Iterable<[string, string]>} registeredVariants
 * @param {import('./unifyCandidateDiscover.js').UnifySpacingCluster[]} clusters
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @param {{ yieldMs?: number }} [opts]
 * @returns {Promise<PatternRuleCandidate[]>}
 */
export async function collectPatternRuleCandidatesAsync(
  registeredVariants,
  clusters,
  pageTexts,
  opts = {},
) {
  const yieldMs = opts.yieldMs ?? 12;
  const rules = collectPatternRulesFromRegistrations(
    registeredVariants,
    clusters,
  );
  /** @type {PatternRuleCandidate[]} */
  const out = [];
  let lastYield =
    typeof performance !== 'undefined' ? performance.now() : 0;
  for (const rule of rules) {
    const candidate = buildPatternRuleCandidateForRule(rule, pageTexts);
    if (candidate) out.push(candidate);
    if (
      yieldMs > 0 &&
      typeof performance !== 'undefined' &&
      performance.now() - lastYield >= yieldMs
    ) {
      await new Promise((r) => setTimeout(r, 0));
      lastYield = performance.now();
    }
  }
  return sortPatternRuleCandidates(out);
}

/**
 * 1차 conflict 클러스터를 열린 2차 계열에 합친다.
 * 패턴 find/visualAttests가 놓친 N+N(분위기 경제 등)이 1차에 있으면 2차에도 남긴다.
 * 추가 PDF 스캔 없음.
 * @param {ReturnType<typeof buildSecondaryGroupsFromCandidates>} groups
 * @param {import('./unifyCandidateDiscover.js').UnifySpacingCluster[]} primaryClusters
 * @returns {ReturnType<typeof buildSecondaryGroupsFromCandidates>}
 */
export function mergePrimaryConflictsIntoSecondaryGroups(groups, primaryClusters) {
  if (!groups?.length || !primaryClusters?.length) return groups ?? [];
  return groups.map((group) => {
    const affix = String(group?.affix ?? '').trim();
    if (!affix) return group;
    const isPrefix = group.affixType === 'prefix';
    const direction = group.direction === 'spaced' ? 'spaced' : 'glued';
    const byKey = new Map(
      (group.clusters ?? [])
        .filter((c) => c?.key)
        .map((c) => [String(c.key), c]),
    );
    for (const cluster of primaryClusters) {
      const key = String(cluster?.key ?? '').trim();
      if (!key || byKey.has(key)) continue;
      if (isPrefix) {
        if (!key.startsWith(affix) || key.length <= affix.length) continue;
      } else if (!key.endsWith(affix) || key.length <= affix.length) {
        continue;
      }
      const variants = cluster.variants ?? [];
      const spaced = variants.find((v) => /\s/.test(String(v)));
      const glued = variants.find((v) => !/\s/.test(String(v))) || key;
      if (!spaced) continue;
      const spacedCount = Number(cluster.counts?.[spaced]) || 0;
      const gluedCount = Number(cluster.counts?.[glued]) || 0;
      const wrongCount = direction === 'glued' ? spacedCount : gluedCount;
      if (wrongCount <= 0) continue;
      byKey.set(key, {
        ...cluster,
        key,
        kind: cluster.kind || 'conflict',
      });
    }
    const clusters = [...byKey.values()].sort(
      (a, b) =>
        (b.totalCount || 0) - (a.totalCount || 0) ||
        String(a.key).localeCompare(String(b.key), 'ko'),
    );
    return { ...group, clusters };
  });
}

/**
 * 선택된 패턴들의 mismatch → 2차용 계열 그룹 (접미>접두 중복 제거, `백자@` / `@모양` 헤더).
 * @param {PatternRuleCandidate[]} candidates
 * @param {Iterable<string>} selectedIds
 * @returns {{
 *   type: 'series',
 *   affixType: PatternAffixType,
 *   affix: string,
 *   label: string,
 *   template: string,
 *   direction: PatternRuleDirection,
 *   clusters: import('./unifyCandidateDiscover.js').UnifySpacingCluster[],
 *   support?: PatternRuleSupport,
 *   score?: number,
 *   compliantForms?: import('./unifyCandidateDiscover.js').UnifySpacingCluster[],
 * }[]}
 */
/**
 * 선택된 패턴들의 mismatch → 2차용 계열 그룹 (접미>접두 중복 제거, `백자@` / `@모양` 헤더).
 * @param {PatternRuleCandidate[]} candidates
 * @param {Iterable<string>} selectedIds
 * @returns {{
 *   type: 'series',
 *   affixType: PatternAffixType,
 *   affix: string,
 *   label: string,
 *   template: string,
 *   direction: PatternRuleDirection,
 *   clusters: import('./unifyCandidateDiscover.js').UnifySpacingCluster[],
 *   support?: PatternRuleSupport,
 *   score?: number,
 *   compliantForms?: import('./unifyCandidateDiscover.js').UnifySpacingCluster[],
 * }[]}
 */
export function buildSecondaryGroupsFromCandidates(candidates, selectedIds) {
  const idSet = new Set(selectedIds);
  /** @type {Map<string, PatternRuleDirection>} */
  const directionByTemplate = new Map();
  /** @type {Map<string, PatternRuleCandidate>} */
  const candidateByTemplate = new Map();
  /** @type {PatternRuleMismatch[]} */
  const all = [];
  for (const c of candidates ?? []) {
    if (!idSet.has(c.id)) continue;
    const template = c.rule?.template;
    if (template && (c.rule.direction === 'glued' || c.rule.direction === 'spaced')) {
      const affixType = c.rule.affixType === 'prefix' ? 'prefix' : 'suffix';
      directionByTemplate.set(`${affixType}:${template}`, c.rule.direction);
      candidateByTemplate.set(`${affixType}:${template}`, c);
    }
    all.push(...(c.mismatches ?? []));
  }
  const deduped = dedupeMismatchesSuffixOverPrefix(all);

  /** @type {Map<string, {
   *   type: 'series',
   *   affixType: PatternAffixType,
   *   affix: string,
   *   label: string,
   *   template: string,
   *   direction: PatternRuleDirection,
   *   clusters: import('./unifyCandidateDiscover.js').UnifySpacingCluster[],
 *   support?: PatternRuleSupport,
 *   score?: number,
 *   compliantForms?: import('./unifyCandidateDiscover.js').UnifySpacingCluster[],
 * }>} */
  const byPattern = new Map();

  for (const m of deduped) {
    const affixType = m.affixType === 'prefix' ? 'prefix' : 'suffix';
    const template =
      m.template ||
      (affixType === 'prefix'
        ? `${String(m.key).slice(0, 2)}@`
        : `@${String(m.key).slice(-2)}`);
    const direction = /** @type {PatternRuleDirection} */ (
      /\s/.test(m.to) ? 'spaced' : 'glued'
    );
    const groupKey = `${affixType}:${template}`;
    let group = byPattern.get(groupKey);
    if (!group) {
      const affix =
        affixType === 'suffix'
          ? String(template).replace(/^@/, '')
          : String(template).replace(/@$/, '');
      const hinted = directionByTemplate.get(groupKey);
      const cand = candidateByTemplate.get(groupKey);
      group = {
        type: 'series',
        affixType,
        affix,
        label: template,
        template,
        direction: hinted || direction,
        clusters: [],
        support: cand?.support,
        score: cand?.score,
        compliantForms: cand?.compliantForms ?? [],
      };
      byPattern.set(groupKey, group);
    }
    group.clusters.push(mismatchToUnifyCluster(m));
  }

  // mismatch 0이어도(전부 붙여쓰기) 선택 후보는 계열로 남긴다
  for (const [groupKey, cand] of candidateByTemplate) {
    if (byPattern.has(groupKey)) continue;
    const rule = cand.rule;
    const affixType = rule.affixType === 'prefix' ? 'prefix' : 'suffix';
    const template = rule.template;
    const affix =
      affixType === 'suffix'
        ? String(template).replace(/^@/, '')
        : String(template).replace(/@$/, '');
    byPattern.set(groupKey, {
      type: 'series',
      affixType,
      affix,
      label: template,
      template,
      direction: rule.direction,
      clusters: [],
      support: cand.support,
      score: cand.score,
      compliantForms: cand.compliantForms ?? [],
    });
  }

  const groups = [...byPattern.values()];
  groups.sort((a, b) => {
    const sa = Number(a.score) || 0;
    const sb = Number(b.score) || 0;
    if (sb !== sa) return sb - sa;
    const ta = a.affixType === 'suffix' ? 0 : 1;
    const tb = b.affixType === 'suffix' ? 0 : 1;
    if (ta !== tb) return ta - tb;
    const ca = sumClusterFindingsLocal(a.clusters);
    const cb = sumClusterFindingsLocal(b.clusters);
    if (cb !== ca) return cb - ca;
    return a.label.localeCompare(b.label, 'ko');
  });
  for (const g of groups) {
    g.clusters.sort(
      (a, b) =>
        (b.totalCount || 0) - (a.totalCount || 0) ||
        a.key.localeCompare(b.key, 'ko'),
    );
  }
  return groups;
}

/**
 * @param {PatternRuleCandidate[]} candidates
 * @param {Iterable<string>} selectedIds
 * @returns {import('./unifyCandidateDiscover.js').UnifySpacingCluster[]}
 */
export function buildSecondaryClustersFromCandidates(candidates, selectedIds) {
  return buildSecondaryGroupsFromCandidates(candidates, selectedIds).flatMap(
    (g) => g.clusters,
  );
}

/** @param {{ totalCount?: number }[]} clusters */
function sumClusterFindingsLocal(clusters) {
  return (clusters ?? []).reduce((s, c) => s + (c.totalCount || 0), 0);
}

/**
 * @param {PatternRuleMismatch} m
 * @returns {import('./unifyCandidateDiscover.js').UnifySpacingCluster}
 */
export function mismatchToUnifyCluster(m) {
  const from = normalizeUnifyVariant(m.from);
  const to = normalizeUnifyVariant(m.to);
  const variants =
    from === to ? [from] : /\s/.test(to) ? [from, to] : [to, from];
  /** @type {import('./unifyCandidateDiscover.js').UnifyVariantOccurrence[]} */
  const occList = (m.instances ?? []).map((inst) =>
    occurrenceFromMatchInstance(inst, from),
  );
  /** @type {Record<string, import('./unifyCandidateDiscover.js').UnifyVariantOccurrence[]>} */
  const occurrencesByVariant = {
    [from]: occList.map((o) => ({ ...o })),
  };
  // 이형태(목표 표기) 칸에도 쪽 칩 — 문서 출현은 from 위치
  if (to !== from) {
    occurrencesByVariant[to] = occList.map((o) => ({ ...o }));
  }

  return {
    key: m.key,
    variants,
    counts: {
      [from]: m.count,
      ...(to !== from ? { [to]: 0 } : {}),
    },
    occurrencesByVariant,
    recommendedUnify: to,
    totalCount: m.count,
    kind: 'conflict',
  };
}

/**
 * 미리보기용 GroupedResult — 틀린 표기(from)만 하이라이트.
 * @param {PatternRuleMismatch[]} mismatches
 * @returns {import('./ruleEngine.js').GroupedResult[]}
 */
export function buildPatternRulePreviewGroups(mismatches) {
  /** @type {import('./ruleEngine.js').GroupedResult[]} */
  const groups = [];
  for (const m of mismatches ?? []) {
    if (!m?.instances?.length) continue;
    groups.push({
      find: m.from,
      replace: m.to,
      label: m.from,
      category: 'consistency',
      patternKind: 'compound-spacing',
      tip: `「${m.to}」으로 통일`,
      instances: m.instances.map((inst) => ({
        ...inst,
        find: m.from,
        replace: m.to,
        suggestedText: m.to,
        matchedText: inst.matchedText || m.from,
      })),
    });
  }
  return groups;
}

/**
 * 보이는 1차 목록 키가 모두 채워졌는지 (확정 등록 또는 soft 미리 찍기).
 * @param {{ clusters?: { key?: string }[] }[]} grouped
 * @param {Map<string, string>} registeredVariants
 * @param {Map<string, string>} [preSelected]
 */
export function isPrimaryUnifyComplete(
  grouped,
  registeredVariants,
  preSelected,
) {
  const keys = [];
  for (const g of grouped ?? []) {
    for (const c of g.clusters ?? []) {
      if (c?.key) keys.push(c.key);
    }
  }
  if (!keys.length) return false;
  return keys.every(
    (k) => registeredVariants.has(k) || Boolean(preSelected?.has(k)),
  );
}
