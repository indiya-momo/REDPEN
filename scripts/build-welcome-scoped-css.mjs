import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve('.');

function gitShow(rev, file) {
  return execSync(`git show ${rev}:${file}`, { cwd: root, encoding: 'utf8' });
}

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function unwrapMediaBlock(css, maxWidth, selectorNeedle = '') {
  const open = `@media (max-width: ${maxWidth}px) {`;
  let searchFrom = 0;
  while (searchFrom < css.length) {
    const start = css.indexOf(open, searchFrom);
    if (start === -1) return '';
    let depth = 0;
    let body = '';
    for (let i = start + open.length - 1; i < css.length; i += 1) {
      const ch = css[i];
      if (ch === '{') depth += 1;
      if (depth > 1) body += ch;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (!selectorNeedle || body.includes(selectorNeedle)) {
      return body.trim();
    }
    searchFrom = start + open.length;
  }
  return '';
}

function parseCssRules(css) {
  const rules = [];
  let i = 0;
  while (i < css.length) {
    while (i < css.length && /\s/.test(css[i])) i += 1;
    if (i >= css.length) break;

    if (css[i] === '@') {
      const headerStart = i;
      while (i < css.length && css[i] !== '{') i += 1;
      if (i >= css.length) break;
      i += 1;
      let depth = 1;
      const bodyStart = i;
      while (i < css.length && depth > 0) {
        if (css[i] === '{') depth += 1;
        if (css[i] === '}') depth -= 1;
        i += 1;
      }
      rules.push({
        kind: 'at',
        prelude: css.slice(headerStart, css.indexOf('{', headerStart)).trim(),
        body: css.slice(bodyStart, i - 1).trim(),
      });
      continue;
    }

    const selectorStart = i;
    while (i < css.length && css[i] !== '{') i += 1;
    if (i >= css.length) break;
    const selector = css.slice(selectorStart, i).trim();
    i += 1;
    let depth = 1;
    const bodyStart = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      if (css[i] === '}') depth -= 1;
      i += 1;
    }
    rules.push({
      kind: 'rule',
      selector,
      body: css.slice(bodyStart, i - 1).trim(),
    });
  }
  return rules;
}

function scopeSelector(selector, scopeClass) {
  return selector
    .split(',')
    .map((part) => {
      const s = part.trim();
      if (!s) return s;
      if (s === '.welcome-gate') return `.welcome-gate${scopeClass}`;
      if (s.startsWith('.welcome-gate ')) {
        return `.welcome-gate${scopeClass} ${s.slice('.welcome-gate '.length)}`;
      }
      if (s.startsWith('.welcome-gate.')) {
        return `.welcome-gate${scopeClass}${s.slice('.welcome-gate'.length)}`;
      }
      return `${scopeClass} ${s}`;
    })
    .join(',\n');
}

function emitScopedCss(css, scopeClass) {
  const rules = parseCssRules(stripCssComments(css));
  const chunks = [`/* ${scopeClass} only — do not share with other viewport */`];

  for (const rule of rules) {
    if (rule.kind === 'at') {
      if (rule.prelude.startsWith('@media')) {
        chunks.push(`${rule.prelude} {`);
        chunks.push(
          emitScopedCss(rule.body, scopeClass).replace(/^\/\*[\s\S]*?\*\/\n?/, ''),
        );
        chunks.push('}');
      }
      continue;
    }
    if (!rule.selector) continue;
    chunks.push(`${scopeSelector(rule.selector, scopeClass)} {\n${rule.body}\n}`);
  }

  return `${chunks.join('\n\n')}\n`;
}

function extractBlock(css, startNeedle, endNeedle) {
  const start = css.indexOf(startNeedle);
  const end = css.indexOf(endNeedle, start);
  if (start === -1 || end === -1) {
    throw new Error(`Missing block: ${startNeedle}`);
  }
  return css.slice(start, end);
}

const desktopExtras = `
.welcome-gate__bottom-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: calc(6px * var(--welcome-scale)) calc(8px * var(--welcome-scale));
  width: auto;
  margin-top: calc(0.15rem * var(--welcome-scale));
}

.welcome-gate__bottom-meta .app-version-badge {
  display: inline-flex;
  align-items: baseline;
  gap: calc(4px * var(--welcome-scale));
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 0;
  background: none;
  font-size: calc(0.7rem * var(--welcome-scale));
  line-height: 1.5;
  color: var(--welcome-text-muted-strong);
}

.welcome-gate__bottom-meta .app-version-badge__label,
.welcome-gate__bottom-meta .app-version-badge__code {
  font-family: inherit;
  font-size: inherit;
  font-weight: inherit;
  letter-spacing: normal;
  text-transform: none;
  color: inherit;
  background: none;
}

.welcome-gate__bottom-meta .welcome-gate__room-entry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--welcome-text-muted-strong);
  background: none;
  border: none;
  border-radius: 0;
  cursor: pointer;
  transition: color 0.15s ease;
}

.welcome-gate__bottom-meta .welcome-gate__room-entry:hover {
  color: var(--welcome-text);
}

.welcome-gate__bottom-meta .welcome-gate__room-entry:focus-visible {
  outline: 2px solid var(--welcome-accent);
  outline-offset: 2px;
}
`;

let headDesktop = gitShow('HEAD', 'src/styles/welcome-gate.css');
headDesktop = headDesktop
  .replace(/@media \(min-width: 961px\)[\s\S]*?\n\}/, '')
  .replace(/\.welcome-gate__version[\s\S]*?\.welcome-gate \.app-version-badge:not\([\s\S]*?\n\}/, '')
  .replace(/\.app-version-badge--prominent[\s\S]*?\.welcome-gate \.app-version-badge:not\([\s\S]*?\n\}/, '')
  .replace(/\.welcome-gate__layout \{[\s\S]*?gap:[^;]+;\n\}/, (block) =>
    block.replace(
      /clamp\(calc\(4\.5rem[^)]+\)[^;]+;/,
      'clamp(calc(2rem * var(--welcome-scale)), 4vw, calc(2.75rem * var(--welcome-scale)));',
    ),
  );

const index612 = gitShow('6b26b31', 'src/index.css');
const indexLines = index612.split('\n');
const mobileShared = indexLines.slice(3907, 4429).join('\n');
const mobileLayout960 = unwrapMediaBlock(index612, 960, '.welcome-gate__layout');
const mobileLayout640 = unwrapMediaBlock(index612, 640, '.welcome-gate__panels');

const mobileSharedWithoutPcLayout = mobileShared.replace(
  /\.welcome-gate__layout \{[\s\S]*?\n\}/,
  '',
);

const mobileSource = `${mobileSharedWithoutPcLayout}\n${mobileLayout960}\n${mobileLayout640}`;

fs.writeFileSync(
  path.join(root, 'src/styles/welcome-gate-desktop.css'),
  emitScopedCss(`${headDesktop}\n${desktopExtras}`, '.welcome-gate--desktop'),
  'utf8',
);

console.log('Rebuilt welcome-gate-desktop.css (mobile CSS is maintained manually)');
