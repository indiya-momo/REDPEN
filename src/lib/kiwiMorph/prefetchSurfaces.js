/**
 * 맞춤법/규칙 검수 전 Kiwi 서버 prefetch용 표면형 수집.
 * compound-find는 줄 단위, 그 외는 page.text 단위로 shouldSkipMatch에 넘어간다.
 */
import { clampAnalyzeText, KIWI_ANALYZE_MAX_CHARS } from './serverContract.js';
import { shouldAnalyzeWithKiwi } from './shouldAnalyze.js';

const MAX_SURFACES = 800;

/**
 * @param {{ text?: string }[]} pages
 * @returns {string[]}
 */
export function collectRuleCheckKiwiPrefetchSurfaces(pages) {
  /** @type {Set<string>} */
  const out = new Set();
  for (const page of pages ?? []) {
    const text = String(page?.text ?? '');
    if (!text) continue;
    if (text.length <= KIWI_ANALYZE_MAX_CHARS && shouldAnalyzeWithKiwi(text)) {
      out.add(text);
    }
    for (const line of text.split('\n')) {
      const t = line.trimEnd();
      if (!t || !shouldAnalyzeWithKiwi(t)) continue;
      out.add(clampAnalyzeText(t));
    }
  }
  return [...out].slice(0, MAX_SURFACES);
}
