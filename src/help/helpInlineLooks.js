/**
 * 도움말 본문 — 작업 가이드 말풍선과 동일한 UI 모사 클래스.
 * 긴 구문을 먼저 매칭한다.
 * @type {{ phrase: string, className: string }[]}
 */
export const HELP_INLINE_LOOKS = [
  {
    phrase: '검수 결과 다운로드',
    className: 'tooltip-guide__export-btn-look',
  },
  {
    phrase: '검수 결과 다운받기',
    className: 'tooltip-guide__export-btn-look',
  },
  {
    phrase: '표기 통일 탭',
    className:
      'tooltip-guide__work-tab-chip tooltip-guide__work-tab-chip--consistency',
  },
  {
    phrase: '맞춤법 탭',
    className: 'tooltip-guide__work-tab-chip tooltip-guide__work-tab-chip--spelling',
  },
  {
    phrase: '여러 항목 찾기',
    className: 'tooltip-guide__criteria-heading-look',
  },
  {
    phrase: '통일형 지정',
    className: 'tooltip-guide__criteria-heading-look',
  },
  {
    phrase: '확인 권장 구간',
    className: 'tooltip-guide__pdf-highlight-look',
  },
  {
    phrase: '편집자 검토',
    className: 'tooltip-guide__gothic-label',
  },
  {
    phrase: '외래어 표기',
    className:
      'tooltip-guide__criteria-summary-label tooltip-guide__criteria-summary-label--loanword',
  },
  {
    phrase: '맞춤법 규칙',
    className:
      'tooltip-guide__criteria-summary-label tooltip-guide__criteria-summary-label--spelling',
  },
  {
    phrase: '정리된 목록',
    className: 'tooltip-guide__criteria-summary-label',
  },
  {
    phrase: '실제 원고',
    className: 'tooltip-guide__criteria-summary-label',
  },
  {
    phrase: '검수 기준 묶음',
    className: 'tooltip-guide__criteria-summary-label',
  },
  {
    phrase: '기준 검수',
    className: 'tooltip-guide__run-btn-look',
  },
  {
    phrase: '표기 통일',
    className:
      'tooltip-guide__criteria-summary-label tooltip-guide__criteria-summary-label--consistency',
  },
  {
    phrase: '하이라이트',
    className: 'tooltip-guide__pdf-highlight-look',
  },
];

const LOOK_PATTERN = new RegExp(
  HELP_INLINE_LOOKS.map((item) => escapeRegExp(item.phrase)).join('|'),
  'g',
);

const LOOK_BY_PHRASE = new Map(
  HELP_INLINE_LOOKS.map((item) => [item.phrase, item.className]),
);

/**
 * @param {string} text
 */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} text
 * @returns {{ type: 'text' | 'look', value: string, className?: string }[]}
 */
export function splitTextByInlineLooks(text) {
  /** @type {{ type: 'text' | 'look', value: string, className?: string }[]} */
  const parts = [];
  let last = 0;

  for (const match of text.matchAll(LOOK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) {
      parts.push({ type: 'text', value: text.slice(last, index) });
    }
    const phrase = match[0];
    parts.push({
      type: 'look',
      value: phrase,
      className: LOOK_BY_PHRASE.get(phrase),
    });
    last = index + phrase.length;
  }

  if (last < text.length) {
    parts.push({ type: 'text', value: text.slice(last) });
  }

  return parts.length ? parts : [{ type: 'text', value: text }];
}

/**
 * @param {string} text
 * @returns {string | null}
 */
export function getLookClassForPhrase(text) {
  return LOOK_BY_PHRASE.get(text.trim()) ?? null;
}
