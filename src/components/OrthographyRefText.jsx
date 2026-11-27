import { Fragment } from 'react';
import { openHangulOrthographyWindow } from '../lib/openHangulOrthographyWindow.js';

/** 설명문 속 「제N항」·「N항」·「부록」 — 표시할 때만 링크로 감싼다(데이터 문자열은 그대로). */
const REF_RE = /(제?\d+항|부록)/g;
const ARTICLE_MAX = 57;

/**
 * @param {string} token
 * @returns {string | null} 맞춤법 창 앵커 (부록 = #appendix, 제N항 = #art-N)
 */
function anchorForToken(token) {
  if (token === '부록') return 'appendix';
  const n = Number(token.replace(/^제/, '').replace(/항$/, ''));
  if (!Number.isInteger(n) || n < 1 || n > ARTICLE_MAX) return null;
  return `art-${n}`;
}

/**
 * @param {string} text
 * @returns {import('react').ReactNode[]}
 */
export function renderOrthographyRefs(text) {
  const src = String(text ?? '');
  const out = [];
  let last = 0;
  let key = 0;
  for (const m of src.matchAll(REF_RE)) {
    const token = m[0];
    const anchor = anchorForToken(token);
    if (anchor === null) continue;
    const start = m.index ?? 0;
    if (start > last) out.push(<Fragment key={key++}>{src.slice(last, start)}</Fragment>);
    out.push(
      <a
        key={key++}
        className="orthography-ref-link"
        href={`#${anchor}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openHangulOrthographyWindow(anchor);
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {token}
      </a>,
    );
    last = start + token.length;
  }
  if (last < src.length) out.push(<Fragment key={key++}>{src.slice(last)}</Fragment>);
  return out;
}

/**
 * @param {{ text?: string | null }} props
 */
export default function OrthographyRefText({ text }) {
  return <>{renderOrthographyRefs(text ?? '')}</>;
}
