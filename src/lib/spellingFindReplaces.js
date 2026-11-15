import {
  compileLiteralFindBody,
  compileSpellingFindsAlternation,
} from './regexFromFind.js';
import { parseSpellingFindsColumn } from './spellingRuleEntry.js';

/**
 * 시트 finds 칸의 「찾을말>고칠말」 구분 기호: >, →, 전각 ＞
 * 예: `싯구, 갯수>개수, 댓가>대가` → 찾은 말마다 제 고칠 말을 제안.
 */
export const FIND_REPLACE_SEPARATOR_RE = /\s*[>→＞]\s*/;

/**
 * @param {unknown} raw
 * @param {string} primaryFind 시트 find(B) — 고칠 말은 replace(C)
 * @param {string} primaryReplace 시트 replace(C)
 * @returns {{ finds: string[] | null, findReplaces: Record<string, string> | null, warnings: string[] }}
 */
export function parseSpellingFindsWithReplaces(raw, primaryFind, primaryReplace) {
  const text = String(raw ?? '').trim();
  /** @type {string[]} */
  const warnings = [];
  if (!FIND_REPLACE_SEPARATOR_RE.test(text)) {
    // 구분 기호가 없으면 기존 파서 그대로(기존 행 동작·데이터 불변)
    return { finds: parseSpellingFindsColumn(text, primaryFind), findReplaces: null, warnings };
  }

  const primary = String(primaryFind ?? '').trim();
  const primaryRepl = String(primaryReplace ?? '').trim();
  /** @type {string[]} */
  const variants = [];
  /** @type {Record<string, string>} */
  const map = {};

  for (const part of text.split(/[,，]/).map((s) => s.trim()).filter(Boolean)) {
    const pieces = part.split(FIND_REPLACE_SEPARATOR_RE);
    const variant = String(pieces[0] ?? '').trim();
    const repl = pieces.length > 1 ? pieces.slice(1).join('').trim() : '';
    if (!variant) {
      warnings.push(`찾을 말이 빈 항목 무시: "${part}"`);
      continue;
    }
    if (pieces.length > 1 && !repl) {
      warnings.push(`고칠 말이 비어 있어 replace 열을 씀: "${part}"`);
    }
    if (variants.includes(variant)) {
      const prev = map[variant] ?? (variant === primary ? primaryRepl : '');
      if (repl && prev && repl !== prev) {
        warnings.push(`"${variant}" 중복 — 처음 항목만 씀`);
      }
      continue;
    }
    variants.push(variant);
    if (!repl) continue;
    if (repl === variant) {
      warnings.push(`찾을 말과 고칠 말이 같아 무시: "${part}"`);
      continue;
    }
    if (variant === primary) {
      if (repl !== primaryRepl) {
        warnings.push(`대표 find "${primary}"는 replace 열("${primaryRepl}")을 씀 — "${part}" 무시`);
      }
      continue;
    }
    if (repl !== primaryRepl) map[variant] = repl;
  }

  if (primary && !variants.includes(primary)) variants.unshift(primary);
  if (variants.length < 2) return { finds: null, findReplaces: null, warnings };
  return {
    finds: variants,
    findReplaces: Object.keys(map).length ? map : null,
    warnings,
  };
}

/**
 * findReplaces를 finds에 있는 키·빈 값 아닌 것만 남겨 정리.
 * @param {unknown} raw
 * @param {string[] | undefined} finds
 * @returns {Record<string, string> | undefined}
 */
export function normalizeFindReplaces(raw, finds) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const allowed = new Set((finds ?? []).map((f) => String(f).trim()));
  /** @type {Record<string, string>} */
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = String(k).trim();
    const val = String(v ?? '').trim();
    if (key && val && allowed.has(key)) out[key] = val;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * 데이터 행·규칙에 찾은 말별 고칠 말이 있는지
 * @param {{ findReplaces?: unknown } | null | undefined} row
 */
export function hasRowFindReplaces(row) {
  const fr = row?.findReplaces;
  return Boolean(fr && typeof fr === 'object' && !Array.isArray(fr) && Object.keys(fr).length);
}

/** 검사 규칙(빌트인) — findReplaces + 변형 2개 이상 */
export function hasSpellingFindReplaces(rule) {
  return hasRowFindReplaces(rule) && spellingVariantsOf(rule).length >= 2;
}

/** @param {{ spellingFinds?: string[], finds?: string[] }} rule */
function spellingVariantsOf(rule) {
  const list = rule.spellingFinds?.length ? rule.spellingFinds : rule.finds ?? [];
  return list.map((f) => String(f ?? '').trim()).filter(Boolean);
}

/**
 * 긴 말부터(공백 빼고 길이) — 겹치는 변형은 긴 쪽이 먼저 맞도록. 같은 길이는 원래 순서.
 * @param {string[]} finds
 */
export function sortVariantsLongestFirst(finds) {
  const len = (s) => String(s).replace(/\s+/g, '').length;
  return finds
    .map((f, i) => ({ f, i }))
    .sort((a, b) => len(b.f) - len(a.f) || a.i - b.i)
    .map(({ f }) => f);
}

/**
 * findReplaces 행 전용 검사 정규식(긴 말 우선 alternation). 그 외 규칙은 null.
 * @param {import('./ruleTypes.js').Rule} rule
 * @returns {RegExp | null}
 */
export function compileSpellingFindReplacesRegex(rule) {
  if (!hasSpellingFindReplaces(rule)) return null;
  try {
    const body = compileSpellingFindsAlternation(sortVariantsLongestFirst(spellingVariantsOf(rule)));
    return body ? new RegExp(body, 'gu') : null;
  } catch {
    return null;
  }
}

/** @type {WeakMap<object, { find: string, replace: string, re: RegExp }[]>} */
const variantMatchers = new WeakMap();

/**
 * 매칭된 글자 → 어느 변형인지와 그 고칠 말.
 * @param {import('./ruleTypes.js').Rule} rule
 * @param {string} matchedText
 * @returns {{ find: string, replace: string } | null}
 */
export function resolveSpellingVariant(rule, matchedText) {
  if (!hasSpellingFindReplaces(rule)) return null;
  let list = variantMatchers.get(rule);
  if (!list) {
    const map = /** @type {Record<string, string>} */ (rule.findReplaces);
    list = sortVariantsLongestFirst(spellingVariantsOf(rule)).flatMap((find) => {
      const body = compileLiteralFindBody(find);
      if (!body) return [];
      const repl = String(map[find] ?? '').trim() || String(rule.replace ?? '').trim();
      return [{ find, replace: repl, re: new RegExp(`^(?:${body})$`, 'u') }];
    });
    variantMatchers.set(rule, list);
  }
  const text = String(matchedText ?? '');
  const hit = list.find((v) => v.re.test(text));
  return hit ? { find: hit.find, replace: hit.replace } : null;
}

/**
 * 빌트인 행의 display_label이 →가 없는 분류 이름(사잇소리, ^중 등)인지.
 * 이런 행은 규칙 목록엔 이름 그대로, 결과 카드·엑셀엔 실제로 찾은 쌍을 보인다.
 * @param {{ builtIn?: boolean, displayLabel?: string } | null | undefined} rule
 */
export function isSpellingCategoryLabelRule(rule) {
  const label = String(rule?.displayLabel ?? '').trim();
  return Boolean(rule?.builtIn) && Boolean(label) && !label.includes('→');
}

/** @type {WeakMap<object, { find: string, replace: string, re: RegExp }[]>} */
const labelPairMatchers = new WeakMap();

/**
 * 분류 이름 행(findReplaces 없음)의 결과 쌍 — 매칭된 변형과 그 고칠 말.
 * 붙여쓰기 행(대표 변형에서 공백만 뺀 말이 replace)이면 변형마다 공백을 뺀 말(부재 중 → 부재중),
 * 그 외는 행 replace.
 * @param {import('./ruleTypes.js').Rule} rule
 * @param {string} matchedText
 * @returns {{ find: string, replace: string } | null}
 */
export function resolveSpellingLabelPair(rule, matchedText) {
  let list = labelPairMatchers.get(rule);
  if (!list) {
    const variants = spellingVariantsOf(rule);
    const forms = variants.length
      ? variants
      : rule.pattern === 'regex'
        ? []
        : [String(rule.find ?? '').trim()].filter(Boolean);
    const repl = String(rule.replace ?? '').trim();
    const strip = (s) => s.replace(/\s+/g, '');
    const spacing = forms.some((v) => /\s/.test(v) && strip(v) === repl);
    list = sortVariantsLongestFirst(forms).flatMap((find) => {
      const body = compileLiteralFindBody(find);
      if (!body) return [];
      return [
        {
          find,
          replace: spacing && /\s/.test(find) ? strip(find) : repl,
          re: new RegExp(`^(?:${body})$`, 'u'),
        },
      ];
    });
    labelPairMatchers.set(rule, list);
  }
  const text = String(matchedText ?? '');
  const hit = list.find((v) => v.re.test(text));
  return hit ? { find: hit.find, replace: hit.replace } : null;
}

/**
 * 결과 카드·엑셀 문구 — 실제로 찾은 쌍만(처음 나온 순, 중복 제거).
 * findReplaces 행은 variantFind/variantReplace, 분류 이름 행은 pairFind/pairReplace.
 * @param {{ variantFind?: string, variantReplace?: string, pairFind?: string, pairReplace?: string }[]} instances
 */
export function formatVariantPairsLabel(instances) {
  const seen = new Set();
  /** @type {string[]} */
  const out = [];
  for (const inst of instances ?? []) {
    const f = inst?.variantFind ?? inst?.pairFind;
    const r = inst?.variantReplace ?? inst?.pairReplace;
    if (!f || !r) continue;
    const pair = `${f} → ${r}`;
    if (seen.has(pair)) continue;
    seen.add(pair);
    out.push(pair);
  }
  return out.join(', ');
}

/**
 * 지문(fingerprint) 꼬리 — findReplaces 없는 행은 빈 문자열(기존 지문 그대로).
 * @param {{ findReplaces?: unknown }} row
 */
export function findReplacesFingerprintPart(row) {
  if (!hasRowFindReplaces(row)) return '';
  const entries = Object.entries(/** @type {Record<string, string>} */ (row.findReplaces))
    .map(([k, v]) => `${k}>${v}`)
    .sort();
  return `\0${entries.join('\u0001')}`;
}
