/**
 * 동음이의어를 하나로 고르지 않고 사전 표제어 번호(01, 02…)별로 직결하는 말. 설계안 §12-10-1.
 * 고칠 말 글자에는 링크하지 않고, 뒤에 작은 어깨번호를 붙여 번호마다 직결한다.
 * gloss는 번호에 마우스를 올릴 때 보이는 짧은 뜻풀이(사전 JSON 2026-11-06).
 */
export const STDICT_NUMBERED_LINKS = {
  신소리: [
    { no: 1, wordNo: 453792, gloss: '신을 끌 때 나는 소리' },
    { no: 2, wordNo: 209783, gloss: '재치 있게 넘기는 말' },
  ],
  애저녁: [
    { no: 1, wordNo: 458440, gloss: '→ 애초' },
    { no: 2, wordNo: 225694, gloss: '→ 초저녁' },
  ],
  경제권: [
    { no: 1, wordNo: 21152, gloss: '經濟圈' },
    { no: 2, wordNo: 21153, gloss: '經濟權' },
  ],
  호박색: [
    { no: 1, wordNo: 517489, gloss: '늙은 호박' },
    { no: 2, wordNo: 376824, gloss: '琥珀' },
  ],
  선소리: [
    { no: 1, wordNo: 178008, gloss: '서툰 말' },
    { no: 2, wordNo: 178010, gloss: '둘러서서 주고받는 속요' },
    { no: 3, wordNo: 178012, gloss: '민요 앞소리' },
  ],
};

/**
 * 번호별로 직결할 말이면 번호 목록을, 아니면 null.
 * 색인에 그 번호들이 모두 있을 때만 쓴다(색인이 아직 없거나 어긋나면 링크하지 않음).
 *
 * @param {string} word 고칠 말
 * @param {Record<string, number[]> | null | undefined} index
 * @returns {{ no: number, wordNo: number, gloss: string }[] | null}
 */
export function stdictNumberedLinksFor(word, index) {
  const list = STDICT_NUMBERED_LINKS[String(word ?? '').trim()];
  if (!list) return null;
  const codes = index?.[String(word).trim()];
  if (!Array.isArray(codes)) return null;
  if (!list.every((e) => codes.includes(e.wordNo))) return null;
  return list;
}

/** 어깨번호 글자. 1 → "01" */
export function stdictNumberLabel(no) {
  return String(no).padStart(2, '0');
}
