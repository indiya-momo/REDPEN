import { useEffect, useMemo, useRef, useState } from 'react';
import {
  HANGUL_ORTHOGRAPHY_ARTICLES,
  HANGUL_ORTHOGRAPHY_SOURCE,
  groupHangulOrthographyTree,
  searchHangulOrthographyArticles,
} from '../lib/hangulOrthographyArticles.js';
import { HANGUL_ORTHOGRAPHY_APPENDIX } from '../lib/hangulOrthographyAppendix.js';
import { HANGUL_ORTHOGRAPHY_URL } from '../lib/koreanNormsLinks.js';
import './hangul-orthography.css';

/**
 * 고시 원문의 예문 불릿(U+F00DA)은 글꼴에 없어 □로 깨진다.
 * 데이터는 원문 그대로 두고, 화면에 그릴 때만 ▪로 바꾼다.
 * @param {unknown} text
 */
function ob(text) {
  return boldMarkup(String(text ?? '')
    .replace(/\s*\u{F00DA}\s*/gu, ' ▪ ')
    .trim());
}

/**
 * 부록 줄 목록 — 불릿마다 예문 한 줄, 「ㄴ.」은 들여쓰기, 「[붙임]」은 주석 줄.
 * @param {{ lines: string[] }} props
 */
function AppendixLines({ lines }) {
  return (
    <div className="hangul-ortho__appx-lines">
      {lines.flatMap((line, i) => {
        if (line.includes('\u{F00DA}')) {
          return line
            .split(/\u{F00DA}/u)
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s, j) => (
              <p key={`${i}-${j}`} className="hangul-ortho__appx-ex">
                {s}
              </p>
            ));
        }
        const cls = /^ㄴ\./u.test(line)
          ? 'hangul-ortho__appx-sub'
          : /^\[붙임/u.test(line)
            ? 'hangul-ortho__appx-note'
            : 'hangul-ortho__appx-text';
        return [
          <p key={i} className={cls}>
            {line}
          </p>,
        ];
      })}
    </div>
  );
}

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
              <td key={i}>{ob(row[i] ?? '')}</td>
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

/** `**굵게**` 표시를 <strong>으로 바꾼다. */
function boldMarkup(text) {
  return String(text)
    .split(/\*\*(.+?)\*\*/)
    .map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

/**
 * 원문 표 여러 개가 가운데 세로선으로 나뉘어 나란히 있는 배치 (제6항).
 * 머리글과 칸은 `**…**`로 굵게 표시.
 * @param {{ tables: { header: string[], rows: string[][] }[] }} props
 */
function RuleTables({ tables }) {
  return (
    <div className="hangul-ortho__examples-box hangul-ortho__rule-tables">
      {tables.map((t, ti) => (
        <table key={ti} className="hangul-ortho__rule-table">
          <thead>
            <tr>
              {t.header.map((h, i) => (
                <th key={i}>{boldMarkup(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td key={ci}>{boldMarkup(c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}

/**
 * 원문 격자 (해설서 제43항처럼 한 줄에 여러 칸). 칸은 원문 순서대로, 굵은 글씨는 `**…**`.
 * @param {{ rows: string[][] }} props
 */
function RuleGrid({ rows }) {
  const cols = Math.max(...rows.map((r) => r.length));
  return (
    <div className="hangul-ortho__examples-box hangul-ortho__rule-grid" style={{ '--rule-cols': cols }}>
      {rows.flat().map((cell, i) => (
        <span key={i} className="hangul-ortho__rule-cell">
          {boldMarkup(cell)}
        </span>
      ))}
    </div>
  );
}

/**
 * @param {{ items: string[], pairLabel?: [string, string], allowPair?: boolean }} props
 */
/** 해설 안의 표 예시 — 상자 없이 열만 맞춘다 (원문: 꽃이[꼬치] … [꼬ㅊ]). */
function CommentaryGrid({ rows }) {
  const cols = Math.max(...rows.map((r) => r.length));
  return (
    <div className="hangul-ortho__rule-grid hangul-ortho__commentary-grid" style={{ '--rule-cols': cols }}>
      {rows.flat().map((cell, i) => (
        <span key={i} className="hangul-ortho__rule-cell">{boldMarkup(cell)}</span>
      ))}
    </div>
  );
}

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
            {segment.items.map((item, itemIndex) => (
              <span
                key={`${itemIndex}-${item}`}
                className={
                  /^(\[붙임|\(\d+\)|\d+\s?\.\s)/u.test(item) ? 'hangul-ortho__note-line' : undefined
                }
              >
                {ob(item)}
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

/**
 * 묶음별 「규정 → 해설」 (제18·57항 등). 해설 문단과 용례는 원문 순서 그대로 묶음 안에 둔다.
 * @param {{ groups: { heading?: string, heads?: string[], rules: string[], commentary: string[] }[] }} props
 */
function WordGroups({ groups }) {
  return (
    <div className="hangul-ortho__word-groups">
      {groups.map((group, gi) => (
        <section key={gi} className="hangul-ortho__word-group">
          {group.heading ? (
            <p className="hangul-ortho__word-heading">{ob(group.heading)}</p>
          ) : null}
          <div className="hangul-ortho__word-rules">
            {group.rules.map((rule, ri) =>
              typeof rule === 'string' ? (
                <p key={ri}>{ob(rule)}</p>
              ) : (
                <div
                  key={ri}
                  className="hangul-ortho__rule-row"
                  style={rule.cols ? { '--rule-cols': rule.cols } : undefined}
                >
                  {rule.cells.map((cell, ci) => (
                    <span key={ci}>{boldMarkup(cell)}</span>
                  ))}
                </div>
              ),
            )}
          </div>
          {group.commentary.length ? (
            <div className="hangul-ortho__word-commentary">
              {group.commentary.map((para, pi) => (
                <p key={pi}>{ob(para)}</p>
              ))}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

/** 부록 · 문장 부호 (고시 원문, 21개 항목) — 목차·「부록」 링크는 #appendix */
function AppendixSection() {
  const app = HANGUL_ORTHOGRAPHY_APPENDIX;
  return (
    <section className="hangul-ortho__chapter hangul-ortho__appendix" id={app.anchor}>
      <h2 className="hangul-ortho__chapter-title">{app.title}</h2>
      <p className="hangul-ortho__appendix-intro">{app.intro}</p>
      {app.items.map((item) => (
        <article key={item.anchor} id={item.anchor} className="hangul-ortho__article">
          <h4>
            <span className="hangul-ortho__art-no">{item.number}.</span>
            {item.title}
          </h4>
          {item.body.length ? <AppendixLines lines={item.body} /> : null}
          {item.rules.map((rule) => (
            <div key={rule.number} className="hangul-ortho__appendix-rule">
              <p className="hangul-ortho__appendix-rule-text">
                ({rule.number}) {rule.text}
              </p>
              {rule.body.length ? <AppendixLines lines={rule.body} /> : null}
            </div>
          ))}
        </article>
      ))}
    </section>
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
            <a href={`#${HANGUL_ORTHOGRAPHY_APPENDIX.anchor}`}>{HANGUL_ORTHOGRAPHY_APPENDIX.title}</a>
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
                    // 묶음(wordGroups)이 있으면 묶음별 해설은 묶음 안에 있고, 여기에는 항 전체 해설만 있다.
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
                          {ob(article.text)}
                        </h4>
                        {article.wordGroups?.length ? (
                          <WordGroups groups={article.wordGroups} />
                        ) : article.ruleTables?.length ? (
                          <>
                            <RuleTables tables={article.ruleTables} />
                            <ExampleBlock
                              items={article.ruleExamples
                                .slice(article.ruleTables[0].rows.length)
                                .filter((item) => item !== article.proviso && !(article.provisoExamples ?? []).includes(item))}
                              pairLabel={pairLabelFor(article)}
                            />
                          </>
                        ) : article.ruleGroups?.length ? (
                          <RuleGroups groups={article.ruleGroups} />
                        ) : article.ruleGrid?.length ? (
                          <>
                            <RuleGrid rows={article.ruleGrid} />
                            <ExampleBlock
                              items={article.ruleExamples.slice(article.ruleGrid.length)}
                              pairLabel={pairLabelFor(article)}
                            />
                          </>
                        ) : (
                          <ExampleBlock
                            items={article.ruleExamples}
                            pairLabel={pairLabelFor(article)}
                          />
                        )}
                        {article.proviso ? (
                          <>
                            <p className="hangul-ortho__proviso">{ob(article.proviso)}</p>
                            <ExampleBlock items={article.provisoExamples ?? []} />
                          </>
                        ) : null}
                        {hasCommentary ? (
                          <details className="hangul-ortho__commentary">
                            <summary>해설</summary>
                            <div className="hangul-ortho__commentary-body">
                              {commentaryQuotes.map((quote, qi) =>
                                typeof quote === 'string' ? (
                                  <p key={quote}>{ob(quote)}</p>
                                ) : (
                                  <CommentaryGrid key={qi} rows={quote.grid} />
                                ),
                              )}
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
          <AppendixSection />
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
