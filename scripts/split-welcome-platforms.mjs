import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve('.');

function gitShow(rev, file) {
  return execSync(`git show ${rev}:${file}`, { encoding: 'utf8', cwd: root });
}

function renameWelcomeBlock(text, from, to) {
  return text
    .replaceAll(`${from}__`, `${to}__`)
    .replaceAll(`${from}--`, `${to}--`)
    .replaceAll(`.${from} `, `.${to} `)
    .replaceAll(`.${from}.`, `.${to}.`)
    .replaceAll(`.${from},`, `.${to},`)
    .replaceAll(`.${from}{`, `.${to}{`)
    .replaceAll(`.${from}\n`, `.${to}\n`)
    .replaceAll(`className="${from}`, `className="${to}`)
    .replaceAll(`'${from}__`, `'${to}__`);
}

const pcCssExtra = `
.welcome-pc__bottom-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: calc(6px * var(--welcome-scale)) calc(8px * var(--welcome-scale));
  width: auto;
  margin-top: calc(0.15rem * var(--welcome-scale));
}

.welcome-pc__bottom-meta .app-version-badge {
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

.welcome-pc__bottom-meta .app-version-badge__label,
.welcome-pc__bottom-meta .app-version-badge__code {
  font-family: inherit;
  font-size: inherit;
  font-weight: inherit;
  letter-spacing: normal;
  text-transform: none;
  color: inherit;
  background: none;
}

.welcome-pc__bottom-meta .welcome-pc__room-entry {
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

.welcome-pc__bottom-meta .welcome-pc__room-entry:hover {
  color: var(--welcome-text);
}

.welcome-pc__bottom-meta .welcome-pc__room-entry:focus-visible {
  outline: 2px solid var(--welcome-accent);
  outline-offset: 2px;
}
`;

let pcCss = gitShow('HEAD', 'src/styles/welcome-gate.css');
pcCss = renameWelcomeBlock(pcCss, 'welcome-gate', 'welcome-pc');
pcCss = pcCss.replace(/\.welcome-pc__version[\s\S]*?\.welcome-pc \.app-version-badge:not\([\s\S]*?\n\}/, '');
pcCss = pcCss.replace(/\.app-version-badge--prominent[\s\S]*?\.welcome-pc \.app-version-badge:not\([\s\S]*?\n\}/, '');

const moCss = fs.readFileSync(path.join(root, 'src/styles/welcome-gate-mobile.css'), 'utf8');
const moCssClean = renameWelcomeBlock(moCss, 'welcome-gate', 'welcome-mo')
  .replace(/\.welcome-mo--mobile/g, '')
  .replace(/welcome-mo welcome-mo/g, 'welcome-mo');

fs.mkdirSync(path.join(root, 'src/welcome/pc'), { recursive: true });
fs.mkdirSync(path.join(root, 'src/welcome/mobile'), { recursive: true });

fs.writeFileSync(
  path.join(root, 'src/welcome/pc/welcome-pc.css'),
  `/* PC 대문 전용 — welcome-pc (모바일과 클래스 공유 없음) */\n${pcCss}\n${pcCssExtra}\n`,
  'utf8',
);
fs.writeFileSync(
  path.join(root, 'src/welcome/mobile/welcome-mo.css'),
  moCssClean.replace(
    '/* WelcomeScreen mobile only (.welcome-gate--mobile) — git 6b26b31 */',
    '/* 모바일 대문 전용 — welcome-mo (PC와 클래스 공유 없음) — git 6b26b31 */',
  ),
  'utf8',
);

console.log('Wrote welcome-pc.css and welcome-mo.css');
