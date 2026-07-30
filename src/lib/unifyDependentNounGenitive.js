/**
 * 의존명사 + 관형격 「의」 — 표기 통일 계열/키로 쓰면 안 되는 형태.
 * 예: 개의 = 개(의존명사) + 의 (명사·용언 어근 아님)
 */

/** 관형격 「의」가 자주 붙는 의존명사 어간 */
const DEPENDENT_NOUN_STEMS_FOR_UI = new Set([
  '개',
  '것',
  '수',
  '바',
  '데',
  '뿐',
  '듯',
  '양',
  '척',
  '체',
  '쪽',
  '치',
  '터',
  '리',
  '지',
  '김',
  '겸',
  '통',
  '바람',
  '무렵',
  '대로',
  '만큼',
  '따름',
  '나름',
  '덕',
]);

/**
 * @param {string} key
 * @returns {string}
 */
function hangulOnly(key) {
  return String(key ?? '')
    .normalize('NFC')
    .replace(/[^\uAC00-\uD7A3]/g, '');
}

/**
 * @param {string} key glued key 또는 계열 affix
 * @returns {string | null} 의존명사 어간 (의 앞)
 */
export function dependentNounStemBeforeUi(key) {
  const h = hangulOnly(key);
  if (h.length < 2 || !h.endsWith('의')) return null;
  const stem = h.slice(0, -1);
  return DEPENDENT_NOUN_STEMS_FOR_UI.has(stem) ? stem : null;
}

/**
 * @param {string} key glued key 또는 계열 affix
 * @returns {boolean}
 */
export function isDependentNounPlusUi(key) {
  return dependentNounStemBeforeUi(key) != null;
}

/**
 * DEV 목록 제외 사유 문구.
 * @param {string} stem 의존명사 어간
 */
export function formatDependentNounGenitiveReason(stem) {
  return `의존명사 '${stem}'+관형격조사 '의'`;
}

/**
 * @param {{ type: string, affix?: string, affixType?: string, label?: string, clusters: { key: string }[] }[]} groups
 * @returns {{
 *   groups: typeof groups,
 *   dropped: { id: string, label: string, reason: string }[],
 * }}
 */
export function stripDependentNounGenitiveFromGroups(groups) {
  /** @type {{ id: string, label: string, reason: string }[]} */
  const dropped = [];
  /** @type {typeof groups} */
  const out = [];

  for (const group of groups ?? []) {
    if (group.type === 'series') {
      const stem = dependentNounStemBeforeUi(group.affix);
      if (stem) {
        dropped.push({
          id: `series:${group.affixType}:${group.affix}`,
          label: group.label || `${group.affix}@`,
          reason: formatDependentNounGenitiveReason(stem),
        });
        continue;
      }
      out.push(group);
      continue;
    }

    if (group.type === 'single' || group.type === 'predicate') {
      /** @type {typeof group.clusters} */
      const kept = [];
      for (const cluster of group.clusters ?? []) {
        const stem = dependentNounStemBeforeUi(cluster.key);
        if (stem) {
          dropped.push({
            id: cluster.key,
            label: cluster.key,
            reason: formatDependentNounGenitiveReason(stem),
          });
        } else {
          kept.push(cluster);
        }
      }
      if (kept.length > 0) {
        out.push({ ...group, clusters: kept });
      }
      continue;
    }

    out.push(group);
  }

  return { groups: out, dropped };
}
