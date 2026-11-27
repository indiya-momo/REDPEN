import { useEffect } from 'react';
import {
  HANGUL_ORTHOGRAPHY_ARTICLES,
  HANGUL_ORTHOGRAPHY_SOURCE,
  groupHangulOrthographyTree,
} from '../lib/hangulOrthographyArticles.js';
import { HANGUL_ORTHOGRAPHY_URL } from '../lib/koreanNormsLinks.js';
import './hangul-orthography.css';

function scrollToHash() {
  const id = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  const main = document.querySelector('.hangul-ortho__main');
  if (!id) {
    if (main) main.scrollTop = 0;
    else window.scrollTo(0, 0);
    return;
  }
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ block: 'start' });
}

/**
 * @param {string} item
 * @returns {[string, string] | null}
 */
function splitPair(item) {
  const parts = String(item).split(/\s+\/\s+/);
  if (parts.length !== 2) return null;
  return [parts[0], parts[1]];
}

/**
 * @param {string[]} items
 */
function pairRows(items) {
  const rows = items.map(splitPair);
  if (!rows.length || rows.some((row) => !row)) return null;
  return rows;
}

/**
 * @param {{ items: string[], pairLabel?: [string, string], allowPair?: boolean }} props
 */
function ExampleBlock({ items, pairLabel, allowPair = true }) {
  if (!items?.length) return null;
  const rows = allowPair ? pairRows(items) : null;
  if (rows) {
    const [left, right] = pairLabel ?? ['ㄱ', 'ㄴ'];
    return (
      <table className="hangul-ortho__pair">
        <thead>
          <tr>
            <th>{left}</th>
            <th>{right}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b]) => (
            <tr key={`${a}/${b}`}>
              <td>{a}</td>
              <td>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <div className="hangul-ortho__examples-box">
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
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
        <h1>한글 맞춤법</h1>
        <p>
          [시행 {HANGUL_ORTHOGRAPHY_SOURCE.enforced}] {HANGUL_ORTHOGRAPHY_SOURCE.notice}
        </p>
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
                    const constructions = article.constructions ?? [];
                    const hasCommentary =
                      commentaryQuotes.length > 0 ||
                      commentaryExamples.length > 0 ||
                      constructions.length > 0;
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
                        <ExampleBlock
                          items={article.ruleExamples}
                          pairLabel={pairLabelFor(article)}
                        />
                        {article.proviso ? (
                          <>
                            <p className="hangul-ortho__proviso">{article.proviso}</p>
                            <ExampleBlock items={article.provisoExamples ?? []} />
                          </>
                        ) : null}
                        {hasCommentary ? (
                          <section className="hangul-ortho__commentary" aria-label="해설">
                            <h5>해설</h5>
                            {commentaryQuotes.map((quote) => (
                              <p key={quote}>{quote}</p>
                            ))}
                            {constructions.length ? (
                              <ul>
                                {constructions.map((row) => (
                                  <li key={row}>{row}</li>
                                ))}
                              </ul>
                            ) : null}
                            <ExampleBlock items={commentaryExamples} allowPair={false} />
                          </section>
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
          </footer>
        </main>
      </div>
    </div>
  );
}
