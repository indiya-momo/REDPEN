import {
  getLookClassForPhrase,
  splitTextByInlineLooks,
} from './helpInlineLooks.js';
import {
  isImageCaptionLine,
  isMarkdownImageLine,
  parseImageCaptionLine,
  parseMarkdownImageLine,
  resolveHelpImageSrc,
} from './helpImagePath.js';

/**
 * @param {string} markdown
 * @param {(slug: string) => void} [onHelpLink]
 * @param {string} [articleSlug]
 */
export function renderHelpMarkdown(markdown, onHelpLink, articleSlug) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  /** @type {import('react').ReactNode[]} */
  const nodes = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('### ')) {
      nodes.push(
        <h3 key={key++} className="help-center__h3">
          {renderInlineContent(line.slice(4), onHelpLink, key)}
        </h3>,
      );
      i += 1;
      continue;
    }

    if (line.startsWith('## ')) {
      nodes.push(
        <h2 key={key++} className="help-center__h2">
          {renderInlineContent(line.slice(3), onHelpLink, key)}
        </h2>,
      );
      i += 1;
      continue;
    }

    if (line.startsWith('# ')) {
      nodes.push(
        <h1 key={key++} className="help-center__h1">
          {renderInlineContent(line.slice(2), onHelpLink, key)}
        </h1>,
      );
      i += 1;
      continue;
    }

    if (line.startsWith('> ')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i += 1;
      }
      nodes.push(renderHelpCallout(quoteLines.join(' '), onHelpLink, key++));
      continue;
    }

    if (isMarkdownImageLine(line)) {
      const image = parseMarkdownImageLine(line);
      if (image) {
        let caption = null;
        if (i + 1 < lines.length && isImageCaptionLine(lines[i + 1])) {
          caption = parseImageCaptionLine(lines[i + 1]);
          i += 1;
        }
        nodes.push(renderHelpFigure(image, articleSlug, key++, caption));
      }
      i += 1;
      continue;
    }

    if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].slice(2));
        i += 1;
      }
      nodes.push(
        <ul key={key++} className="help-center__ul">
          {items.map((item) => (
            <li key={key++}>{renderInlineContent(item, onHelpLink, key)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s*/, ''));
        i += 1;
      }
      nodes.push(
        <ol key={key++} className="help-center__ol">
          {items.map((item) => (
            <li key={key++}>{renderInlineContent(item, onHelpLink, key)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines[i])) {
      paraLines.push(lines[i]);
      i += 1;
    }
    nodes.push(
      <p key={key++} className="help-center__p">
        {renderInlineContent(paraLines.join(' '), onHelpLink, key)}
      </p>,
    );
  }

  return nodes;
}

/**
 * @param {{ alt: string, href: string }} image
 * @param {string | undefined} articleSlug
 * @param {number} key
 * @param {string | null} caption
 */
function renderHelpFigure(image, articleSlug, key, caption) {
  const src = resolveHelpImageSrc(image.href, articleSlug);
  if (!src) return null;

  return (
    <figure key={key} className="help-center__figure">
      <img src={src} alt={image.alt || caption || ''} loading="lazy" decoding="async" />
      {caption ? (
        <figcaption className="help-center__figure-caption">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

/**
 * @param {string} text
 * @param {(slug: string) => void} [onHelpLink]
 * @param {number} key
 */
function renderHelpCallout(text, onHelpLink, key) {
  const labelMatch = text.match(/^\*\*([^*]+)\*\*\s*[—–-]\s*(.*)$/);

  return (
    <aside
      key={key}
      className="tooltip-guide tooltip-guide--no-momo tooltip-guide--help-doc"
      role="note"
    >
      <div className="tooltip-guide__body">
        <div className="tooltip-guide__content">
          <p className="tooltip-guide__message">
            {labelMatch ? (
              <>
                <strong>{labelMatch[1]}</strong>
                {' — '}
                {renderInlineContent(labelMatch[2], onHelpLink, key)}
              </>
            ) : (
              renderInlineContent(text, onHelpLink, key)
            )}
          </p>
        </div>
      </div>
    </aside>
  );
}

/**
 * @param {string} line
 */
function isBlockStart(line) {
  return (
    line.startsWith('#') ||
    line.startsWith('> ') ||
    isMarkdownImageLine(line) ||
    /^[-*] /.test(line) ||
    /^\d+\. /.test(line)
  );
}

/**
 * @param {string} text
 * @param {(slug: string) => void} [onHelpLink]
 * @param {number} keyBase
 */
function renderInlineContent(text, onHelpLink, keyBase) {
  const parts = splitTextByInlineLooks(text);
  /** @type {import('react').ReactNode[]} */
  const nodes = [];
  let partKey = 0;

  for (const part of parts) {
    if (part.type === 'look' && part.className) {
      nodes.push(
        <span key={`${keyBase}-look-${partKey++}`} className={part.className}>
          {part.value}
        </span>,
      );
      continue;
    }

    nodes.push(...renderMarkdownTokens(part.value, onHelpLink, `${keyBase}-${partKey++}`));
  }

  return nodes;
}

/**
 * @param {string} text
 * @param {(slug: string) => void} [onHelpLink]
 * @param {string} keyBase
 */
function renderMarkdownTokens(text, onHelpLink, keyBase) {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\(help:[^)]+\))/g;
  let last = 0;
  let match;
  let partKey = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }

    const token = match[0];
    if (token.startsWith('**')) {
      const inner = token.slice(2, -2);
      const lookClass = getLookClassForPhrase(inner);
      if (lookClass) {
        parts.push(
          <span key={`${keyBase}-b-${partKey++}`} className={lookClass}>
            {inner}
          </span>,
        );
      } else {
        parts.push(
          <strong key={`${keyBase}-b-${partKey++}`}>{inner}</strong>,
        );
      }
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(help:([^)]+)\)$/);
      if (linkMatch && onHelpLink) {
        const [, label, slug] = linkMatch;
        parts.push(
          <button
            key={`${keyBase}-l-${partKey++}`}
            type="button"
            className="help-center__inline-link"
            onClick={() => onHelpLink(slug)}
          >
            {label}
          </button>,
        );
      } else if (linkMatch) {
        parts.push(linkMatch[1]);
      }
    }

    last = match.index + token.length;
  }

  if (last < text.length) {
    parts.push(text.slice(last));
  }

  return parts;
}
