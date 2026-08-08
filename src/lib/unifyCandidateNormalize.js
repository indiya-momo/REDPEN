/**
 * 표기통일 variant 정규화·제외 (순수 문자열 정책).
 * PDF 스캔·highlight·클러스터 조립과 분리 — discover는 여기를 import.
 *
 * @see .cursor/rules/shared-policy-functions.mdc
 */

import { isUnifyKiwiJosaEnabled } from './featureFlags.js';
import { stripTrailingJosaKiwi } from './kiwiMorph/stripTrailingJosa.js';
import { isKiwiReady } from './kiwiMorph/runtime.js';
import {
  hangulSyllableCount,
  UNIFY_SPACED_PART_MIN_HANGUL,
  UNIFY_TRAILING_JOSA,
} from './unifyHangulBasics.js';

/** 인용부호 — 어절 중간에 끼어도 제거 (경제왕국’이기 → 경제왕국이기) */
const UNIFY_QUOTE_CHARS_RE = /[''`´‘’“”„«»「」『』]/gu;

/** @type {ReadonlySet<string>} */
const UNIFY_TRAILING_JOSA_SET = new Set(UNIFY_TRAILING_JOSA);

/**
 * 마지막 어절 끝 조사만 제거 (heuristic). 어간이 한글 2음절 미만이면 유지.
 * @param {string} s
 * @param {number} [minStemHangul]
 * @returns {string}
 */
export function stripTrailingJosaHeuristic(
  s,
  minStemHangul = UNIFY_SPACED_PART_MIN_HANGUL,
) {
  const v = normalizeUnifyVariant(s);
  if (!v) return v;
  const parts = v.split(/\s+/).filter(Boolean);
  if (!parts.length) return v;
  const last = parts[parts.length - 1];
  for (const josa of UNIFY_TRAILING_JOSA) {
    if (!last.endsWith(josa) || last.length <= josa.length) continue;
    const stemLast = last.slice(0, -josa.length);
    if (hangulSyllableCount(stemLast) < minStemHangul) continue;
    // 가·이: 어간 끝 음절과 조사 구분 불가
    // (가치평가·경제분석가·분석가). 휴리스틱은 떼지 않고 Kiwi만 제거.
    if (josa === '가' || josa === '이') {
      continue;
    }
    parts[parts.length - 1] = stemLast;
    return parts.join(' ');
  }
  return v;
}

/**
 * 마지막 어절 끝 조사만 제거.
 * `VITE_UNIFY_KIWI_JOSA=true` 이고 Kiwi 로드됨 → morph 경계, 실패 시 heuristic.
 * @param {string} s
 * @param {number} [minStemHangul]
 * @returns {string}
 */
export function stripTrailingJosa(
  s,
  minStemHangul = UNIFY_SPACED_PART_MIN_HANGUL,
) {
  if (isUnifyKiwiJosaEnabled() && isKiwiReady()) {
    try {
      const kiwiStem = stripTrailingJosaKiwi(s, minStemHangul);
      if (kiwiStem != null) return kiwiStem;
    } catch {
      /* heuristic */
    }
  }
  return stripTrailingJosaHeuristic(s, minStemHangul);
}

/**
 * NFC만 (줄바꿈은 splitUnifyScanLines에서 끊음 — 이어 붙이거나 띄움으로 바꾸지 않음).
 * @param {string} s
 * @returns {string}
 */
export function prepareUnifyScanText(s) {
  return String(s ?? '').normalize('NFC');
}

/**
 * 시각 줄마다 잘라 스캔. 줄 경계를 넘는 n-gram/접합 없음 → 줄바꿈 이형태 제외.
 * @param {string} pageText
 * @returns {string[]}
 */
export function splitUnifyScanLines(pageText) {
  return prepareUnifyScanText(pageText)
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0);
}

/**
 * @param {string} s
 * @returns {string}
 */
export function normalizeUnifyScanText(s) {
  return prepareUnifyScanText(s);
}

/**
 * 표기 variant — NFC + 연속 공백을 한 칸으로 (줄바꿈이 있으면 공백으로만 정규화하되,
 * 스캔은 줄 단위라 보통 줄바꿈이 없음).
 * @param {string} s
 * @returns {string}
 */
export function normalizeUnifyVariant(s) {
  return normalizeUnifyScanText(s)
    .replace(/\n+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * 클러스터 키 — 기호 제거·NFC·공백 제거(조사는 떼지 않음).
 * @param {string} s
 * @returns {string}
 */
export function unifySpacingKey(s) {
  return stripUnifyPunctuationNoise(normalizeUnifyVariant(s)).replace(/\s+/g, '');
}

/**
 * 띄움 variant 유효 — 각 덩어리 한글 ≥2음절 (숫자만·1음절 부정부사 등 탈락).
 * @param {string} variant
 * @returns {boolean}
 */
export function isValidSpacedUnifyVariant(variant) {
  const v = normalizeUnifyVariant(variant);
  if (!/\s/.test(v)) return false;
  const parts = v.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  return parts.every(
    (part) => hangulSyllableCount(part) >= UNIFY_SPACED_PART_MIN_HANGUL,
  );
}

/**
 * 쉼표 나열(개인, 은행), 또는 띄움 덩어리가 조사만인 경우(경기 에서)는 제외.
 * 한글 사이에 끼인 문장부호(경제다!라)도 제외.
 * 끝에만 붙은 쉼표·기호는 제외 대상이 아님.
 * @param {string} rawMatched
 */
export function isExcludedUnifyCandidateRaw(rawMatched) {
  const matchedText = normalizeUnifyScanText(rawMatched);
  // 경제다!라 · 경제학·철학 — 한글 사이 기호(가운데점·감탄 등), 공백 허용
  if (
    /[\uAC00-\uD7A3]\s*[^\uAC00-\uD7A3\d\s]+\s*[\uAC00-\uD7A3]/u.test(
      matchedText,
    )
  ) {
    return true;
  }
  const withoutTrailingPunct = matchedText
    .replace(/[^\uAC00-\uD7A3\d\s]+$/gu, '')
    .trim();
  if (withoutTrailingPunct.includes(',')) return true;
  const normalized = normalizeUnifyVariant(withoutTrailingPunct);
  if (!normalized) return true;
  if (/\s/.test(normalized) && spacedPartIsBareJosa(normalized)) return true;
  return false;
}

/**
 * 띄움 어절 중 하나가 조사만으로 이뤄진 경우 (경기 에서).
 * @param {string} variant
 */
export function spacedPartIsBareJosa(variant) {
  const parts = normalizeUnifyVariant(variant).split(/\s+/).filter(Boolean);
  return parts.some((part) => UNIFY_TRAILING_JOSA_SET.has(part));
}

/**
 * 기호·문장부호 제거 — 인용부호는 어절 중간도 제거, 그 외는 앞뒤만.
 * 뉴욕타임스> / 경제왕국’이기 → 뉴욕타임스 / 경제왕국이기
 * @param {string} s
 */
export function stripUnifyPunctuationNoise(s) {
  return normalizeUnifyVariant(s)
    .split(/\s+/)
    .map((part) =>
      part
        .replace(UNIFY_QUOTE_CHARS_RE, '')
        .replace(/^[^\uAC00-\uD7A3\d]+|[^\uAC00-\uD7A3\d]+$/gu, ''),
    )
    .filter(Boolean)
    .join(' ');
}

/**
 * 각주·줄번호 등 주변 숫자 제거.
 * - 순수 숫자 어절은 앞·뒤에서 제거 (174 노동 시장 → 노동 시장)
 * - `331┃`처럼 숫자(+목차 세로선)만인 앞 어절도 제거
 * - 한글과 붙은 앞·뒤 숫자는 남은 한글이 2음절 이상일 때만 제거
 *   (174노동시장 → 노동시장, 331┃케인즈 → 케인즈, 2024년 → 유지, 코로나19 → 코로나)
 * @param {string} s
 */
export function stripUnifyPeripheralDigits(s) {
  /** 쪽번호·목차 세로선·ZWSP 등 — 숫자 뒤 비한글은 전부 구분 잡음으로 본다 */
  const digitJunkOnly = /^\d+[^\uAC00-\uD7A3]*$/u;
  const leadDigitHangul = /^(\d+)[^\uAC00-\uD7A3]*([\uAC00-\uD7A3].*)$/u;
  const trailHangulDigit = /^([\uAC00-\uD7A3].*?)[^\uAC00-\uD7A3]*(\d+)$/u;

  let parts = normalizeUnifyVariant(s).split(/\s+/).filter(Boolean);
  while (parts.length && /^\d+$/.test(parts[0])) parts = parts.slice(1);
  while (parts.length && digitJunkOnly.test(parts[0])) parts = parts.slice(1);
  while (parts.length && /^\d+$/.test(parts[parts.length - 1])) {
    parts = parts.slice(0, -1);
  }
  while (parts.length && digitJunkOnly.test(parts[parts.length - 1])) {
    parts = parts.slice(0, -1);
  }
  parts = parts.map((part) => {
    const lead = part.match(leadDigitHangul);
    if (lead && hangulSyllableCount(lead[2]) >= UNIFY_SPACED_PART_MIN_HANGUL) {
      return lead[2];
    }
    const trail = part.match(trailHangulDigit);
    if (
      trail &&
      hangulSyllableCount(trail[1]) >= UNIFY_SPACED_PART_MIN_HANGUL
    ) {
      return trail[1];
    }
    return part;
  });
  return parts.filter(Boolean).join(' ');
}

/**
 * 끝 조사·접미(기) 제거 후 표기 통일 어간.
 * 경기 침체에서 → 경기 침체, 경기침체기 → 경기침체
 * @param {string} s
 * @param {number} [minStemHangul]
 */
export function stripTrailingUnifyAffixes(
  s,
  minStemHangul = UNIFY_SPACED_PART_MIN_HANGUL,
) {
  let v = stripUnifyPunctuationNoise(s);
  if (!v) return v;
  v = stripTrailingJosa(v, minStemHangul);
  if (!v) return v;
  const parts = v.split(/\s+/).filter(Boolean);
  if (!parts.length) return v;
  let last = parts[parts.length - 1];
  if (last.endsWith('기') && last.length > 1) {
    const stemLast = last.slice(0, -1);
    const lastHangul = hangulSyllableCount(last);
    const stemHangul = hangulSyllableCount(stemLast);
    // 띄움 마지막 어절: 침체기(3)→침체(2) 만. 금융위기(4)는 유지.
    // 붙임 전체: 경기침체기→경기침체 (남은 어간 4음절 이상)
    const shouldStrip =
      parts.length >= 2
        ? lastHangul === 3 && stemHangul === 2
        : stemHangul >= 4;
    if (shouldStrip) {
      last = stemLast;
      parts[parts.length - 1] = last;
      v = parts.join(' ');
      v = stripTrailingJosa(v, minStemHangul);
    }
  }
  return v;
}
