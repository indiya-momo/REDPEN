/**
 * soft-wrap·깨진 줄은 Kiwi 대신 heuristic에 맡긴다.
 * @param {string} text
 * @returns {boolean} true면 analyze 해도 됨
 */
export function shouldAnalyzeWithKiwi(text) {
  const s = String(text ?? '').trim();
  if (!s) return false;
  // 한 음절만 공백으로 잘린 나열 (명 지 계 곡) — PDF 세로/자간 유령
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 3 && parts.every((p) => p.length === 1)) {
    return false;
  }
  // 비정상적으로 짧은 토큰이 많으면 스킵
  if (parts.length >= 6) {
    const mono = parts.filter((p) => p.length === 1).length;
    if (mono / parts.length >= 0.7) return false;
  }
  return true;
}
