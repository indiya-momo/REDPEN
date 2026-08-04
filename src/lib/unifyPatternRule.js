/**
 * 표기 통일 추천 — 세션 스코프 접두·접미 패턴 확장 (2차).
 * seriesTendencyHint(층 C 힌트)와 분리.
 * @see project-docs/unify-phase2-pattern-2026-07-31.md
 */

import {
  hangulSyllableCount,
  isExcludedUnifyCandidateRaw,
  isValidSpacedUnifyVariant,
  normalizeUnifyVariant,
  stripTrailingJosa,
  stripUnifyPunctuationNoise,
  unifySpacingKey,
} from './unifyCandidateDiscover.js';
import { isExcludedSeriesAffix } from './unifyCandidateSeriesTrend.js';
import { buildPhraseSlotFindRules } from './phraseSlotPattern.js';
import { runRuleCheck } from './ruleEngine.js';
import { escapeRegex } from './compoundPatternCommon.js';
import {
  shouldRejectByNoiseListSurface,
  spacedVariantHitsNoiseDenylist,
  isSpacedLeftNoiseEojeol,
} from './unifyNoiseList.js';
import { hangulOnlyNoise } from './unifyNoiseListData.js';
import { shouldRejectUnifySatelliteSpacedByPos } from './kiwiMorph/unifyExclude.js';
import { isUnifyKiwiNoisePhase2Available } from './kiwiMorph/noiseFilterGate.js';

/** 관형·수식·용언형 앞말 — 접미(@affix) 패턴의 변수(head)에서 제외 */
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
  '이런',
  '그런',
  '저런',
  // 관형사·관형형·의존 수식 (명사+명사 아님)
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
  '어떤',
  '아무',
  '몇몇',
  '온갖',
  '각종',
]);

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
 *   id: string,
 *   rule: UnifyPatternRule,
 *   mismatchCount: number,
 *   exampleFroms: string[],
 *   mismatches: PatternRuleMismatch[],
 *   support: PatternRuleSupport,
 *   score: number,
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
  if (hangulSyllableCount(h) < 2) return true;
  return false;
}

/**
 * 1차 discover와 같은 제외·정규화 + 1차 정적 잡음 리스트(조사끼임 휴리스틱 제외).
 * @param {string} matchedText
 */
export function passesPatternRuleUnifyFilter(matchedText) {
  const raw = String(matchedText ?? '');
  if (!raw.trim()) return false;
  if (isExcludedUnifyCandidateRaw(raw)) return false;
  const cleaned = stripUnifyPunctuationNoise(raw);
  if (!cleaned) return false;
  if (/\s/.test(cleaned) && !isValidSpacedUnifyVariant(cleaned)) return false;
  const key = unifySpacingKey(cleaned);
  if (!key) return false;
  // discover와 동일: 정적 리스트·본보조만 (캐나다정부 ≠ 조사끼임)
  if (shouldRejectByNoiseListSurface(key)) return false;
  if (/\s/.test(cleaned)) {
    if (spacedVariantHitsNoiseDenylist(cleaned)) return false;
    const left = hangulOnlyNoise(cleaned.trim().split(/\s+/).filter(Boolean)[0]);
    if (left && isSpacedLeftNoiseEojeol(left)) return false;
  }
  return true;
}

/**
 * 2차 패턴 mismatch — 1차 잡음 리스트 + (Kiwi ready 시) 명사+명사/동사+동사만.
 * 공통성(@affix)으로 모은 뒤, 최종은 N+N·V+V(또는 리스트)로 거른다.
 * @param {string} from
 * @param {string} to
 * @param {string} key
 * @returns {boolean} true면 제외
 */
export function shouldRejectPatternMismatchByNoiseAndCompound(from, to, key) {
  const surfaces = [from, to, key].map((s) => String(s ?? '').trim()).filter(Boolean);
  const spaced = surfaces.find((s) => /\s/.test(s)) || '';
  const glued = surfaces.find((s) => s && !/\s/.test(s)) || key;

  if (glued && shouldRejectByNoiseListSurface(glued)) return true;
  if (key && shouldRejectByNoiseListSurface(key)) return true;
  if (spaced) {
    if (spacedVariantHitsNoiseDenylist(spaced)) return true;
    const left = hangulOnlyNoise(spaced.trim().split(/\s+/).filter(Boolean)[0]);
    if (left && isSpacedLeftNoiseEojeol(left)) return true;
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
 * UI용 한 줄 설명 (Rule 메타 → 표시).
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
 * @param {string} from
 * @param {UnifyPatternRule} rule
 * @returns {{ key: string, to: string } | null}
 */
function normalizeMismatchPair(from, rule) {
  if (!passesPatternRuleUnifyFilter(from)) return null;
  const cleaned = stripTrailingJosa(
    normalizeUnifyVariant(stripUnifyPunctuationNoise(from)),
  );
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
  if (shouldRejectByNoiseListSurface(head)) return null;
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
  const pages = pagesForRuleCheck(pageTexts);
  if (!pages.length) return [];

  const skipKeys = new Set(
    opts.skipKeys instanceof Set
      ? opts.skipKeys
      : Array.isArray(opts.skipKeys)
        ? opts.skipKeys
        : [],
  );
  if (rule.confirmedKey) skipKeys.add(rule.confirmedKey);

  let pattern;
  if (rule.affixType === 'prefix') {
    pattern =
      rule.direction === 'glued' ? `${rule.affix} @` : `${rule.affix}@`;
  } else {
    pattern = rule.direction === 'glued' ? `@ ${rule.affix}` : `@${rule.affix}`;
  }

  const rules = buildPhraseSlotFindRules(pattern);
  if (!rules.length) return [];

  const { results } = runRuleCheck(pages, rules);
  /** @type {Map<string, PatternRuleMismatch>} */
  const byKey = new Map();

  for (const group of results ?? []) {
    for (const inst of group.instances ?? []) {
      const from = String(inst.matchedText ?? '');
      if (!from) continue;
      const pair = normalizeMismatchPair(from, rule);
      if (!pair) continue;
      if (skipKeys.has(pair.key)) continue;

      const existing = byKey.get(pair.key);
      if (existing) {
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

  return [...byKey.values()].sort(
    (a, b) => b.count - a.count || a.from.localeCompare(b.from, 'ko'),
  );
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
 * 1차 등록에서 접두·접미 패턴 규칙만 모은다 (매칭 전).
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
    if (!cluster) continue;
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
 * 증거 하한 미달 후보는 제외한다.
 * @param {Map<string, string> | Iterable<[string, string]>} registeredVariants
 * @param {import('./unifyCandidateDiscover.js').UnifySpacingCluster[]} clusters
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @returns {PatternRuleCandidate[]}
 */
export function collectPatternRuleCandidates(
  registeredVariants,
  clusters,
  pageTexts,
) {
  const entries =
    registeredVariants instanceof Map
      ? [...registeredVariants.entries()]
      : [...registeredVariants];
  const rules = collectPatternRulesFromRegistrations(
    registeredVariants,
    clusters,
  );

  const skipKeys = new Set(entries.map(([k]) => k));
  /** @type {PatternRuleCandidate[]} */
  const out = [];
  for (const rule of rules) {
    const mismatches = findPatternMismatches(pageTexts, rule, { skipKeys });
    if (!mismatches.length) continue;
    const support = buildPatternRuleSupport(rule, mismatches);
    if (!meetsPatternSupportThreshold(support)) continue;
    const score = scorePatternRuleCandidate(support, 0);
    out.push({
      id: rule.id,
      rule,
      mismatchCount: support.occurrenceCount,
      exampleFroms: support.examples.slice(0, 2),
      mismatches,
      support,
      score,
    });
  }

  out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ta = a.rule.affixType === 'suffix' ? 0 : 1;
    const tb = b.rule.affixType === 'suffix' ? 0 : 1;
    if (ta !== tb) return ta - tb;
    return a.rule.template.localeCompare(b.rule.template, 'ko');
  });
  return out;
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
 *   supportExplain?: string,
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
   *   supportExplain?: string,
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
        supportExplain: cand?.support
          ? formatPatternSupportExplain(cand.support, cand.score)
          : undefined,
      };
      byPattern.set(groupKey, group);
    }
    group.clusters.push(mismatchToUnifyCluster(m));
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
  /** @type {Record<string, import('./unifyCandidateDiscover.js').UnifyVariantOccurrence[]>} */
  const occurrencesByVariant = {
    [from]: (m.instances ?? []).map((inst) => ({
      pageNum: inst.pageNum,
      index: inst.index,
      matchedText: inst.matchedText || from,
    })),
  };
  if (to !== from) occurrencesByVariant[to] = [];

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
 * 보이는 1차 목록 키가 모두 등록됐는지.
 * @param {{ clusters?: { key?: string }[] }[]} grouped
 * @param {Map<string, string>} registeredVariants
 */
export function isPrimaryUnifyComplete(grouped, registeredVariants) {
  const keys = [];
  for (const g of grouped ?? []) {
    for (const c of g.clusters ?? []) {
      if (c?.key) keys.push(c.key);
    }
  }
  if (!keys.length) return false;
  return keys.every((k) => registeredVariants.has(k));
}
