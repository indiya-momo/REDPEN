export function formatSignedDiff(n) {
  return n > 0 ? `+${n}` : String(n);
}

export function countTextParts(value) {
  let letters = 0;
  let spaces = 0;
  let symbols = 0;
  for (const ch of String(value ?? '')) {
    if (/[\s\u00A0]/.test(ch)) spaces += 1;
    else if (/\p{L}|\p{N}/u.test(ch)) letters += 1;
    else symbols += 1;
  }
  return { letters, spaces, symbols };
}

export function formatReplaceDiff(original, next) {
  const from = countTextParts(original);
  const to = countTextParts(next);
  return `글자수${formatSignedDiff(to.letters - from.letters)} 공백${formatSignedDiff(to.spaces - from.spaces)} 기호${formatSignedDiff(to.symbols - from.symbols)}`;
}

const LEGACY_MANUAL_TIP = '직접 추가한 수정';

/** 사용자가 적은 메모만. 기본 안내·글자수 줄은 메모가 아님. */
export function manualUserMemo(tip) {
  const text = String(tip ?? '').trim();
  if (!text || text === LEGACY_MANUAL_TIP) return '';
  return text;
}

export function manualResultCardTip(group) {
  const memo = manualUserMemo(group?.tip);
  if (memo) return memo;
  return formatReplaceDiff(group?.find, group?.replace);
}
