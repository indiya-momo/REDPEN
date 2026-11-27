import { useEffect, useMemo, useRef, useState } from 'react';
import {
  HANGUL_ORTHOGRAPHY_ARTICLES,
  HANGUL_ORTHOGRAPHY_SOURCE,
  groupHangulOrthographyTree,
  searchHangulOrthographyArticles,
} from '../lib/hangulOrthographyArticles.js';
import { HANGUL_ORTHOGRAPHY_URL } from '../lib/koreanNormsLinks.js';
import './hangul-orthography.css';

function scrollToHash() {
  const id = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  if (!id) {
    window.scrollTo(0, 0);
    return;
  }
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ block: 'start' });
}

/**
 * `A / B` (ㄱ·ㄴ 한 쌍) 또는 `A / B / C / D` (두 쌍) 한 줄 = 표 한 줄.
 * @param {string} item
 * @returns {string[] | null}
 */
function splitRow(item) {
  const parts = String(item).split(/\s+\/\s+/);
  if (parts.length !== 2 && parts.length !== 4) return null;
  return parts;
}

/** 원문 표 머리글 줄: `(본말) (준말)` 또는 `(본말) (준말) (본말) (준말)` */
const TABLE_HEADER_RE = /^\(([^()]+)\)\s+\(([^()]+)\)(?:\s+\(\1\)\s+\(\2\))?$/u;

/**
 * 연속한 표 줄은 표 하나로, 나머지는 줄글 상자로 묶는다.
 * 표 머리글 줄은 다음 표의 열 이름이 된다.
 * @param {string[]} items
 * @returns {({ kind: 'table', rows: string[][], label?: [string, string] } | { kind: 'lines', items: string[] })[]}
 */
function segmentExamples(items) {
  /** @type {({ kind: 'table', rows: string[][], label?: [string, string] } | { kind: 'lines', items: string[] })[]} */
  const segments = [];
  /** @type {[string, string] | undefined} */
  let pendingLabel;
  for (const item of items) {
    const header = String(item).match(TABLE_HEADER_RE);
    if (header) {
      pendingLabel = [header[1], header[2]];
      continue;
    }
    const row = splitRow(item);
    const last = segments[segments.length - 1];
    if (row) {
      if (last?.kind === 'table') last.rows.push(row);
      else {
        segments.push({ kind: 'table', rows: [row], label: pendingLabel });
        pendingLabel = undefined;
      }
    } else if (last?.kind === 'lines') {
      last.items.push(item);
    } else {
      segments.push({ kind: 'lines', items: [item] });
    }
  }
  return segments;
}

/**
 * @param {{ rows: string[][], pairLabel?: [string, string] }} props
 */
function PairTable({ rows, pairLabel }) {
  const [left, right] = pairLabel ?? ['ㄱ', 'ㄴ'];
  const cols = rows.some((row) => row.length === 4) ? 4 : 2;
  const heads = cols === 4 ? [left, right, left, right] : [left, right];
  return (
    <table className="hangul-ortho__pair">
      <thead>
        <tr>
          {heads.map((label, i) => (
            <th key={i}>{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.join('/')}>
            {heads.map((_, i) => (
              <td key={i}>{row[i] ?? ''}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * 묶음 머리(소제목) + 줄마다 5열 격자 (해설서 제51항 배치).
 * @param {{ groups: { heading: string, rows: string[] }[] }} props
 */
function RuleGroups({ groups }) {
  return (
    <div className="hangul-ortho__examples-box hangul-ortho__rule-groups">
      {groups.map((group) => (
        <section key={group.heading} className="hangul-ortho__rule-group">
          <h5 className="hangul-ortho__rule-group-title">{group.heading}</h5>
          {group.rows.map((row) => (
            <div key={row} className="hangul-ortho__rule-row">
              {row.split(/\s+/).map((word) => (
                <span key={word}>{word}</span>
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * @param {{ items: string[], pairLabel?: [string, string], allowPair?: boolean }} props
 */
function ExampleBlock({ items, pairLabel, allowPair = true }) {
  if (!items?.length) return null;
  const segments = allowPair
    ? segmentExamples(items)
    : [{ kind: /** @type {const} */ ('lines'), items }];
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === 'table' ? (
          <PairTable key={index} rows={segment.rows} pairLabel={segment.label ?? pairLabel} />
        ) : (
          <div key={index} className="hangul-ortho__examples-box">
            {segment.items.map((item) => (
              <span
                key={item}
                className={
                  /^(\[붙임|\(\d+\)|\d+\s?\.\s)/u.test(item) ? 'hangul-ortho__note-line' : undefined
                }
              >
                {item}
              </span>
            ))}
          </div>
        ),
      )}
    </>
  );
}

/**
 * @param {import('../lib/hangulOrthographyArticles.js').HangulOrthographyArticle} article
 */
function pairLabelFor(article) {
  if (/\(본말\)/.test(article.ruleExamples?.[0] ?? '')) return ['본말', '준말'];
  if (article.text.includes('ㄴ을 허용함')) return ['ㄱ', 'ㄴ'];
  if (article.text.includes('ㄴ을 버림')) return ['ㄱ', 'ㄴ'];
  return ['ㄱ', 'ㄴ'];
}

/**
 * @param {{ text: string, query: string }} props
 */
function SearchMark({ text, query }) {
  const q = String(query).trim();
  const raw = String(text);
  if (!q) return raw;
  const at = raw.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return raw;
  return (
    <>
      {raw.slice(0, at)}
      <mark>{raw.slice(at, at + q.length)}</mark>
      {raw.slice(at + q.length)}
    </>
  );
}

function HangulOrthographySearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const results = useMemo(() => searchHangulOrthographyArticles(query), [query]);
  const showList = open && query.trim().length > 0;
  const listId = 'hangul-ortho-search-list';

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!showList) return undefined;
    const onDoc = (event) => {
      if (!boxRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showList]);

  function jump(anchor) {
    if (window.location.hash === `#${anchor}`) scrollToHash();
    else window.location.hash = anchor;
    setOpen(false);
  }

  function onKeyDown(event) {
    if (event.nativeEvent.isComposing || event.key === 'Process') return;
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!query.trim()) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.max(i - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const hit = results[active] ?? results[0];
      if (hit) jump(hit.article.anchor);
    }
  }

  return (
    <div className="hangul-ortho__search" ref={boxRef} role="search">
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="이 규정에서 찾기"
        aria-label="한글 맞춤법 이 페이지에서 찾기"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showList}
        autoComplete="off"
        spellCheck={false}
      />
      {showList ? (
        <div className="hangul-ortho__search-list" id={listId} role="listbox">
          {results.length ? (
            <>
              <p className="hangul-ortho__search-count">{results.length}건</p>
              {results.map((hit, index) => (
                <button
                  key={hit.article.anchor}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  className={
                    index === active
                      ? 'hangul-ortho__search-hit is-active'
                      : 'hangul-ortho__search-hit'
                  }
                  onMouseEnter={() => setActive(index)}
                  onClick={() => jump(hit.article.anchor)}
                >
                  <span className="hangul-ortho__search-hit-kicker">
                    제{hit.article.number}항
                    {hit.article.section ? ` · ${hit.article.section}` : ` · ${hit.article.chapter}`}
                  </span>
                  <span className="hangul-ortho__search-hit-snippet">
                    <SearchMark text={hit.snippet} query={query} />
                  </span>
                </button>
              ))}
            </>
          ) : (
            <p className="hangul-ortho__search-empty">이 규정에 없는 내용입니다.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function HangulOrthographyScreen() {
  const tree = groupHangulOrthographyTree(HANGUL_ORTHOGRAPHY_ARTICLES);

  useEffect(() => {
    scrollToHash();
    const onHash = () => scrollToHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="hangul-ortho">
      <header className="hangul-ortho__header">
        <div className="hangul-ortho__brand">
          <h1>한글 맞춤법</h1>
          <p>
            [시행 {HANGUL_ORTHOGRAPHY_SOURCE.enforced}] {HANGUL_ORTHOGRAPHY_SOURCE.notice}
          </p>
        </div>
        <HangulOrthographySearch />
      </header>
      <div className="hangul-ortho__shell">
        <aside className="hangul-ortho__nav" aria-label="한글 맞춤법 목차">
          <p className="hangul-ortho__tree-label">본문</p>
          <ol className="hangul-ortho__toc">
            {tree.map((chapter) => (
              <li key={chapter.chapter} className="hangul-ortho__toc-chapter">
                <span>{chapter.chapter}</span>
                <ol>
                  {chapter.sections.map((section) => (
                    <li key={section.section || chapter.chapter}>
                      {section.section ? (
                        <span className="hangul-ortho__toc-section">{section.section}</span>
                      ) : null}
                      <ol>
                        {section.articles.map((article) => (
                          <li key={article.anchor}>
                            <a href={`#${article.anchor}`}>제{article.number}항</a>
                          </li>
                        ))}
                      </ol>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
          <p className="hangul-ortho__tree-label">부록</p>
          <p className="hangul-ortho__toc-appendix">
            <a href={HANGUL_ORTHOGRAPHY_URL} target="_blank" rel="noopener noreferrer">
              문장 부호
            </a>
          </p>
        </aside>
        <main className="hangul-ortho__main">
          {tree.map((chapter) => (
            <div key={chapter.chapter} className="hangul-ortho__chapter">
              <h2 className="hangul-ortho__chapter-title" id={chapter.chapter.replace(/\s+/g, '-')}>
                {chapter.chapter}
              </h2>
              {chapter.sections.map((section) => (
                <div key={section.section || chapter.chapter}>
                  {section.articles.map((article, index) => {
                    const commentaryQuotes = article.commentary?.quotes ?? [];
                    const commentaryExamples = article.commentary?.examples ?? [];
                    const hasCommentary =
                      commentaryQuotes.length > 0 || commentaryExamples.length > 0;
                    return (
                      <article
                        key={article.anchor}
                        id={article.anchor}
                        className="hangul-ortho__article"
                      >
                        {index === 0 && section.section ? (
                          <h3 className="hangul-ortho__section-title">{section.section}</h3>
                        ) : null}
                        <h4>
                          <span className="hangul-ortho__art-no">제{article.number}항</span>
                          {article.text}
                        </h4>
                        {article.ruleGroups?.length ? (
                          <RuleGroups groups={article.ruleGroups} />
                        ) : (
                          <ExampleBlock
                            items={article.ruleExamples}
                            pairLabel={pairLabelFor(article)}
                          />
                        )}
                        {article.proviso ? (
                          <>
                            <p className="hangul-ortho__proviso">{article.proviso}</p>
                            <ExampleBlock items={article.provisoExamples ?? []} />
                          </>
                        ) : null}
                        {hasCommentary ? (
                          <details className="hangul-ortho__commentary">
                            <summary>해설</summary>
                            <div className="hangul-ortho__commentary-body">
                              {commentaryQuotes.map((quote) => (
                                <p key={quote}>{quote}</p>
                              ))}
                              <ExampleBlock items={commentaryExamples} allowPair={false} />
                            </div>
                          </details>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
          <footer className="hangul-ortho__footer">
            <p>
              {HANGUL_ORTHOGRAPHY_SOURCE.publisher} {HANGUL_ORTHOGRAPHY_SOURCE.title}{' '}
              {HANGUL_ORTHOGRAPHY_SOURCE.notice}
            </p>
            <p>
              <a href={HANGUL_ORTHOGRAPHY_URL} target="_blank" rel="noopener noreferrer">
                국립국어원 한글 맞춤법 고시
              </a>
            </p>
            <p>
              해설 원문: 국립국어원 「한글 맞춤법·표준어 규정 해설」 (공공누리 제1유형, 출처표시).{' '}
              <a
                href="https://www.korean.go.kr/front/reportData/reportDataView.do?mn_id=45&report_seq=116"
                target="_blank"
                rel="noopener noreferrer"
              >
                해설서 원문 보기
              </a>
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
