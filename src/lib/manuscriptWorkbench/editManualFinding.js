import { addManualFinding, canAddManualFinding } from './addManualFinding.js';
import { removeManualInstance } from './findingsSink.js';
import { MANUAL_SOURCE } from './types.js';

/**
 * 리스트 카드 → 입력창에 채울 초안.
 * @param {{ pageNum?: number, index?: number, matchedText?: string, find?: string, suggestedText?: string, replace?: string, tip?: string } | null | undefined} inst
 * @returns {{
 *   draft: import('./types.js').TextHit,
 *   replace: string,
 *   tip: string,
 *   editingTarget: { pageNum: number, index: number },
 * } | null}
 */
export function instanceToEditDraft(inst) {
  const matchedText = String(inst?.matchedText ?? inst?.find ?? '');
  const pageNum = Number(inst?.pageNum);
  const indexRaw = Number(inst?.index);
  const startRaw = Number(inst?.start);
  const start = Number.isFinite(startRaw) ? startRaw : indexRaw;
  const endRaw = Number(inst?.end);
  const end =
    Number.isFinite(endRaw) && Number.isFinite(start) && endRaw > start
      ? endRaw
      : Number.isFinite(start) && matchedText
        ? start + matchedText.length
        : NaN;
  if (
    !matchedText ||
    !Number.isFinite(pageNum) ||
    !Number.isFinite(start) ||
    !Number.isFinite(end)
  ) {
    return null;
  }
  const findingIndex = Number.isFinite(indexRaw) ? indexRaw : start;
  return {
    draft: {
      pageNum,
      start,
      end,
      matchedText,
      ...(inst?.fromHighlight ? { fromHighlight: true } : {}),
    },
    replace: String(inst?.suggestedText ?? inst?.replace ?? ''),
    tip: String(inst?.tip ?? ''),
    editingTarget: { pageNum, index: findingIndex },
  };
}

/**
 * 고친 내용으로 그 카드를 덮어쓴다. 거부면 목록을 그대로 둔다.
 * @param {import('../ruleEngine.js').GroupedResult[]} groups
 * @param {{ pageNum?: number, index?: number } | null | undefined} editingTarget
 * @param {import('./types.js').ManualFinding} manual
 * @param {{ text?: string, visualText?: string } | null | undefined} [page]
 */
export function commitEditedManual(groups, editingTarget, manual, page) {
  if (!canAddManualFinding(manual, page)) return groups ?? [];
  const next = editingTarget
    ? removeManualInstance(groups, editingTarget)
    : groups ?? [];
  return addManualFinding(next, { ...manual, source: MANUAL_SOURCE }, page);
}
