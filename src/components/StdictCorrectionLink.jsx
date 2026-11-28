import { stdictLinkFor, stdictSearchUrl, stdictViewUrl } from '../lib/stdictLinks.js';
import { stdictNumberedLinksFor, stdictNumberLabel } from '../lib/stdictNumberedLinks.js';
import { STANDARD_KOREAN_DICT_TIP } from '../lib/koreanNormsLinks.js';

/** 번호별 직결: 말을 번호마다 한 번씩 쓰고 어깨번호를 붙인다(§12-10-1, §14-2). */
function NumberedLinks({ word, list, stop }) {
  return (
    <span className="spelling-dict-numbered">
      {list.map((e) => {
        const label = stdictNumberLabel(e.no);
        return (
          <a
            key={e.wordNo}
            className="spelling-dict-link spelling-dict-numbered__item"
            href={stdictViewUrl(e.wordNo)}
            target="_blank"
            rel="noopener noreferrer"
            title={e.gloss}
            aria-label={`${word}${label}: ${e.gloss}`}
            onClick={stop}
            onKeyDown={stop}
          >
            {`「${word}`}
            <sup className="spelling-dict-no-group">{label}</sup>
            {'」'}
          </a>
        );
      })}
    </span>
  );
}

/**
 * 결과 카드의 말 한 칸.
 * 색인에 있으면 직결·검색, fallback="search"이면 색인에 없어도 검색 화면.
 * 동음이의를 번호별로 직결하는 말(§12-10-1)은 글자에 링크하지 않고 뒤에 어깨번호를 붙인다.
 * 링크 클릭·Enter가 카드 선택으로 번지지 않도록 막습니다.
 */
export default function StdictCorrectionLink({ word, index, fallback, wordNo, search, numbered: numberedProp }) {
  const stop = (e) => e.stopPropagation();

  if (numberedProp) {
    return <NumberedLinks word={word} list={numberedProp} stop={stop} />;
  }

  if (search) {
    return (
      <a
        className="spelling-dict-link"
        href={stdictSearchUrl(word)}
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

  const hasWordNo = wordNo != null && wordNo !== '';
  const numbered = hasWordNo ? null : stdictNumberedLinksFor(word, index);
  if (numbered) {
    return <NumberedLinks word={word} list={numbered} stop={stop} />;
  }

  const link = stdictLinkFor(word, index ?? null, {
    ...(fallback === 'search' ? { fallback: 'search' } : {}),
    ...(hasWordNo ? { wordNo } : {}),
  });
  if (link.kind === 'none') {
    return <span>{word}</span>;
  }
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
