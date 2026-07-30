import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  findExpandableParentSlug,
  findNavItem,
  findNavTrail,
} from './helpNavUtils.js';
import { getAllHelpArticles, getHelpArticle, getHelpNav } from './loadHelpContent.js';
import { renderHelpMarkdown } from './renderMarkdown.jsx';
import { getHelpSlugFromUrl, setHelpSlugInUrl } from './helpUrl.js';
import './help-center.css';

/**
 * @param {{ slug: string, label: string, index?: boolean, children?: import('./helpNavUtils.js').NavChild[] }} item
 * @param {string} activeSlug
 * @param {Set<string>} expanded
 * @param {(id: string) => void} onToggleExpand
 * @param {(slug: string) => void} onNavigate
 */
function NavTreeItem({ item, activeSlug, expanded, onToggleExpand, onNavigate }) {
  const hasChildren = Boolean(item.children?.length);
  const isExpanded = expanded.has(item.slug);
  const isActive = activeSlug === item.slug;
  const childActive = hasChildren && item.children.some((c) => c.slug === activeSlug);

  if (!hasChildren) {
    return (
      <button
        type="button"
        className={`help-center__nav-link${isActive ? ' is-active' : ''}`}
        onClick={() => onNavigate(item.slug)}
      >
        {item.label}
      </button>
    );
  }

  const treeId = `help-nav-${item.slug.replace(/\//g, '-')}`;

  return (
    <li className="help-center__nav-tree-item">
      <div className="help-center__nav-tree-row">
        <button
          type="button"
          className="help-center__nav-tree-toggle"
          aria-expanded={isExpanded}
          aria-controls={treeId}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(item.slug);
          }}
        >
          <span className="help-center__nav-tree-chev-closed" aria-hidden="true">
            ›
          </span>
          <span className="help-center__nav-tree-chev-open" aria-hidden="true">
            ∨
          </span>
        </button>
        <button
          type="button"
          className={`help-center__nav-tree-link${isActive || childActive ? ' is-active' : ''}`}
          onClick={() => onNavigate(item.slug)}
        >
          {item.label}
        </button>
      </div>
      {!isExpanded ? null : (
        <ul id={treeId} className="help-center__nav-tree-children">
          {item.children.map((child) => (
            <li key={child.slug}>
              <button
                type="button"
                className={`help-center__nav-tree-child-link${activeSlug === child.slug ? ' is-active' : ''}`}
                onClick={() => onNavigate(child.slug)}
              >
                {child.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * @param {{ children: import('./helpNavUtils.js').NavChild[], onNavigate: (slug: string) => void }} props
 */
function HelpTopicDl({ items, onNavigate }) {
  return (
    <dl className="help-center__topic-dl">
      {items.map((child) => (
        <div key={child.slug} className="help-center__topic-dl-group">
          <dt className="help-center__topic-dl-term">{child.label}</dt>
          <dd className="help-center__topic-dl-desc">
            {child.description ? <p>{child.description}</p> : null}
            <button
              type="button"
              className="help-center__topic-dl-link"
              onClick={() => onNavigate(child.slug)}
            >
              자세히 보기
            </button>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * @param {{ onNavigate: (slug: string) => void }} props
 */
function HelpHub({ onNavigate }) {
  const nav = getHelpNav();
  const [query, setQuery] = useState('');
  const allArticles = useMemo(() => getAllHelpArticles(), []);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allArticles
      .filter((a) => a.searchText.includes(q))
      .slice(0, 8);
  }, [allArticles, query]);

  return (
    <>
      <h1 className="help-center__hub-title">무엇을 도와드릴까요?</h1>
      <p className="help-center__hub-lead">
        인디야 사용 방법을 단계별로 안내합니다. 작업 중 막히는 부분이 있으면 검색하거나 아래
        주제에서 찾아보세요.
      </p>

      <div className="help-center__search" role="search">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="예: 하이라이트, 검수권, 프로젝트"
          aria-label="도움말 검색"
        />
      </div>

      {searchResults.length > 0 ? (
        <div className="help-center__search-results">
          {searchResults.map((article) => (
            <button
              key={article.slug}
              type="button"
              className="help-center__search-hit"
              onClick={() => onNavigate(article.slug)}
            >
              <span className="help-center__search-hit-title">
                {String(article.meta.title ?? article.slug)}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="help-center__chips">
        {nav.chips.map((chip) => (
          <button
            key={chip.slug}
            type="button"
            className="help-center__chip"
            onClick={() => onNavigate(chip.slug)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <p className="help-center__section-label">자주 찾는 주제</p>
      <div className="help-center__topic-grid">
        {nav.popular.map((topic) => (
          <button
            key={topic.slug}
            type="button"
            className="help-center__topic-card"
            onClick={() => onNavigate(topic.slug)}
          >
            <h3>{topic.title}</h3>
            <p>{topic.description}</p>
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * @param {{ slug: string, onNavigate: (slug: string) => void }} props
 */
function HelpArticleView({ slug, onNavigate }) {
  const nav = getHelpNav();
  const article = getHelpArticle(slug);
  const navItem = findNavItem(nav.groups, slug);
  const trail = findNavTrail(nav.groups, slug);

  if (!article) {
    return (
      <div className="help-center__article">
        <p>해당 도움말을 찾을 수 없습니다.</p>
        <button type="button" className="help-center__inline-link" onClick={() => onNavigate('')}>
          도움말 홈으로
        </button>
      </div>
    );
  }

  const title = String(article.meta.title ?? slug);
  const readMinutes = article.meta.readMinutes;
  const isIndex = article.meta.index === true;
  const children = navItem?.children ?? [];
  const related = Array.isArray(article.meta.related) ? article.meta.related : [];

  const metaLine = isIndex && children.length
    ? `주제 묶음 · 하위 항목 ${children.length}개`
    : readMinutes
      ? `읽는 데 약 ${readMinutes}분`
      : null;

  return (
    <article className="help-center__article">
      <p className="help-center__breadcrumb">
        <button type="button" onClick={() => onNavigate('')}>
          도움말 홈
        </button>
        {trail ? (
          <>
            {' · '}
            {trail.groupLabel}
            {trail.crumbs.slice(0, -1).map((crumb) => (
              <span key={crumb.slug}>
                {' · '}
                <button type="button" onClick={() => onNavigate(crumb.slug)}>
                  {crumb.label}
                </button>
              </span>
            ))}
            {trail.crumbs.length > 0 ? (
              <span>
                {' · '}
                {trail.crumbs[trail.crumbs.length - 1].label}
              </span>
            ) : null}
          </>
        ) : null}
      </p>

      <h1>{title}</h1>
      {metaLine ? <p className="help-center__meta">{metaLine}</p> : null}

      {renderHelpMarkdown(article.body, onNavigate, slug)}

      {isIndex && children.length > 0 ? (
        <HelpTopicDl items={children} onNavigate={onNavigate} />
      ) : null}

      {related.length > 0 ? (
        <div className="help-center__related">
          <h2>다음에 읽기</h2>
          <div className="help-center__related-links">
            {related.map((relatedSlug) => {
              const relatedArticle = getHelpArticle(relatedSlug);
              const relatedNav = findNavItem(nav.groups, relatedSlug);
              const label =
                relatedArticle?.meta.title ??
                relatedNav?.label ??
                relatedSlug;
              return (
                <button
                  key={relatedSlug}
                  type="button"
                  onClick={() => onNavigate(relatedSlug)}
                >
                  {String(label)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function HelpCenterScreen() {
  const nav = getHelpNav();
  const [slug, setSlug] = useState(getHelpSlugFromUrl);
  const [expanded, setExpanded] = useState(() => new Set());

  const navigate = useCallback((nextSlug) => {
    setSlug(nextSlug);
    setHelpSlugInUrl(nextSlug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPopState = () => setSlug(getHelpSlugFromUrl());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!slug) return;
    const parent = findExpandableParentSlug(nav.groups, slug);
    if (!parent) return;
    setExpanded((prev) => {
      if (prev.has(parent)) return prev;
      const next = new Set(prev);
      next.add(parent);
      return next;
    });
  }, [nav.groups, slug]);

  const toggleExpand = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isHub = !slug;

  return (
    <div className="help-center">
      <div className="help-center__shell">
        <aside className="help-center__sidebar" aria-label="도움말 목차">
          <div className="help-center__sidebar-brand">
            <button type="button" className="help-center__brand-link" onClick={() => navigate('')}>
              인디야 도움말
            </button>
            <span>출판 PDF 검수 가이드</span>
          </div>

          <nav>
            <button
              type="button"
              className={`help-center__nav-link help-center__nav-link--hub${isHub ? ' is-active' : ''}`}
              onClick={() => navigate('')}
            >
              도움말 홈
            </button>

            {nav.groups.map((group) => (
              <div key={group.id} className="help-center__nav-group">
                <div className="help-center__nav-group-label">{group.label}</div>
                {group.items.map((item) =>
                  item.children?.length ? (
                    <ul key={item.slug} className="help-center__nav-tree">
                      <NavTreeItem
                        item={item}
                        activeSlug={slug}
                        expanded={expanded}
                        onToggleExpand={toggleExpand}
                        onNavigate={navigate}
                      />
                    </ul>
                  ) : (
                    <button
                      key={item.slug}
                      type="button"
                      className={`help-center__nav-link${slug === item.slug ? ' is-active' : ''}`}
                      onClick={() => navigate(item.slug)}
                    >
                      {item.label}
                    </button>
                  ),
                )}
              </div>
            ))}
          </nav>
        </aside>

        <main className="help-center__main">
          <div className="help-center__main-inner">
            {isHub ? (
              <HelpHub onNavigate={navigate} />
            ) : (
              <HelpArticleView slug={slug} onNavigate={navigate} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
