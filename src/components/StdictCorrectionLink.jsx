import { stdictLinkFor } from '../lib/stdictLinks.js';
import { STANDARD_KOREAN_DICT_TIP } from '../lib/koreanNormsLinks.js';

/**
 * 결과 카드의 말 한 칸.
 * 색인에 있으면 직결·검색, fallback="search"이면 색인에 없어도 검색 화면.
 * 링크 클릭·Enter가 카드 선택으로 번지지 않도록 막습니다.
 */
export default function StdictCorrectionLink({ word, index, fallback, wordNo }) {
  const link = stdictLinkFor(word, index ?? null, {
    ...(fallback === 'search' ? { fallback: 'search' } : {}),
    ...(wordNo != null && wordNo !== '' ? { wordNo } : {}),
  });
  if (link.kind === 'none') {
    return <span>{word}</span>;
  }
  const stop = (e) => e.stopPropagation();
  return (
    <a
      className="spelling-dict-link"
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      title={STANDARD_KOREAN_DICT_TIP}
      onClick={stop}
      onKeyDown={stop}
    >
      {`「${word}」`}
    </a>
  );
}
