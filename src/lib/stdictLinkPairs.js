/**
 * 결과 카드(표준국어대사전 등재 묶음)의 「찾은 말 → 고칠 말」 쌍을 뽑습니다.
 *
 * 설계안 6-3: 카드 문자열(group.label)을 자르지 않고, 인스턴스에 담긴 값에서 뽑습니다.
 * - 변형(findReplaces) 행: variantFind → suggestedText
 * - ^ 분류 라벨 행: pairFind → suggestedText
 * - 일반 행: matchedText → suggestedText
 */

export const DICT_BUNDLE_LABEL_PREFIX = '표준국어대사전 등재';

/** @param {{ dividerLabel?: string } | null | undefined} group */
export function isDictBundleGroup(group) {
  return String(group?.dividerLabel ?? '').startsWith(DICT_BUNDLE_LABEL_PREFIX);
}

/**
 * @param {{ instances?: Array<Record<string, unknown>> } | null | undefined} group
 * @returns {{ find: string, replace: string }[]}
 */
export function correctionPairsOfGroup(group) {
  /** @type {{ find: string, replace: string }[]} */
  const pairs = [];
  const seen = new Set();
  for (const inst of group?.instances ?? []) {
    const find = String(
      inst.variantFind ?? inst.pairFind ?? inst.matchedText ?? '',
    ).trim();
    const replace = String(inst.suggestedText ?? '').trim();
    if (!find || !replace) continue;
    const key = `${find}\u0000${replace}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ find, replace });
  }
  return pairs;
}
