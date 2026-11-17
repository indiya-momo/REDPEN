/**
 * PDF TextItem 글자별 가로 오프셋 — pdf.js 캔버스가 실제로 그리는 위치 기준.
 *
 * 왜: getTextContent의 item.width는 유니코드 공백마다 Tw(낱말 간격)를 더하지만,
 * 캔버스 showText는 glyph.isSpace(1바이트 코드 32)일 때만 Tw를 더한다.
 * 2바이트(Identity-H) 공백 폰트는 item.width가 실제보다 (공백 수 × Tw)만큼 길어져
 * item.width 비율 분할 시 줄 뒤쪽 하이라이트·⌒∨가 오른쪽으로 밀린다.
 * project-docs/pdf-highlight-origin-p32-2026-11-18.md
 *
 * 방법: page.getOperatorList()를 한 번 걸어 캔버스와 같은 식으로 글리프 원점을 계산
 *   advance = (glyph.width × fontSize × fontMatrix[0] + Tc + (glyph.isSpace ? Tw : 0)) × Th
 *   TJ 숫자: x += -n × fontSize / 1000 × Th
 * item과 글리프가 1:1로 맞지 않으면 null → 기존 charOffsetsInItem 그대로 사용.
 */

/** @typedef {[number, number, number, number, number, number]} Mat */

/**
 * @typedef {{
 *   u: string,
 *   ws: boolean,
 *   ox: number, oy: number,
 *   ex: number, ey: number,
 *   run: number,
 * }} PageGlyph 페이지 사용자 공간 글리프 (원점·잉크 폭 끝)
 */

const IDENTITY = /** @type {Mat} */ ([1, 0, 0, 1, 0, 0]);

/** pdf.js Util.transform 과 같은 곱 (m1 × m2) */
function mul(m1, m2) {
  return /** @type {Mat} */ ([
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ]);
}

/** @param {Mat} m @param {number} x @param {number} y */
function apply(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

const WS_RE = /^\s$/u;

/**
 * 연산자 목록 → 페이지 글리프 목록 (캔버스 showText 와 같은 위치).
 * 세로쓰기·Type3·음수 글꼴 크기·글꼴 정보 없음 run은 건너뛴다(그 item은 매칭 실패 → 폴백).
 * @param {{ fnArray: number[], argsArray: any[] }} opList
 * @param {{ OPS: Record<string, number>, getFont: (name: string) => any }} env
 * @returns {PageGlyph[]}
 */
export function buildPageGlyphs(opList, { OPS, getFont }) {
  /** @type {PageGlyph[]} */
  const out = [];
  const fresh = () => ({
    ctm: IDENTITY,
    tm: IDENTITY,
    x: 0,
    y: 0,
    lineX: 0,
    lineY: 0,
    Tc: 0,
    Tw: 0,
    Th: 1,
    leading: 0,
    rise: 0,
    font: null,
    fontSize: 0,
  });
  let st = fresh();
  /** @type {ReturnType<typeof fresh>[]} */
  const stack = [];
  const fontCache = new Map();
  const fontOf = (name) => {
    if (!fontCache.has(name)) {
      let f = null;
      try {
        f = getFont(name) ?? null;
      } catch {
        f = null;
      }
      fontCache.set(name, f);
    }
    return fontCache.get(name);
  };
  let run = 0;
  const { fnArray, argsArray } = opList ?? {};
  if (!fnArray || !argsArray) return out;

  for (let i = 0; i < fnArray.length; i += 1) {
    const fn = fnArray[i];
    const a = argsArray[i];
    switch (fn) {
      case OPS.save:
        stack.push(st);
        st = { ...st };
        break;
      case OPS.restore:
        if (stack.length) st = /** @type {any} */ (stack.pop());
        break;
      case OPS.transform:
        st.ctm = mul(st.ctm, /** @type {Mat} */ (a));
        break;
      case OPS.paintFormXObjectBegin:
        stack.push(st);
        st = { ...st };
        if (a?.[0]) st.ctm = mul(st.ctm, /** @type {Mat} */ (Array.from(a[0])));
        break;
      case OPS.paintFormXObjectEnd:
        if (stack.length) st = /** @type {any} */ (stack.pop());
        break;
      case OPS.beginGroup:
        stack.push(st);
        st = { ...st };
        if (a?.[0]?.matrix) st.ctm = mul(st.ctm, /** @type {Mat} */ (Array.from(a[0].matrix)));
        break;
      case OPS.endGroup:
        if (stack.length) st = /** @type {any} */ (stack.pop());
        break;
      case OPS.beginText:
        st.tm = IDENTITY;
        st.x = st.lineX = 0;
        st.y = st.lineY = 0;
        break;
      case OPS.setTextMatrix: {
        const m = a?.[0] && a[0].length === 6 ? a[0] : a;
        st.tm = /** @type {Mat} */ (Array.from(m));
        st.x = st.lineX = 0;
        st.y = st.lineY = 0;
        break;
      }
      case OPS.moveText:
        st.x = st.lineX += a[0];
        st.y = st.lineY += a[1];
        break;
      case OPS.setLeadingMoveText:
        st.leading = a[1];
        st.x = st.lineX += a[0];
        st.y = st.lineY += a[1];
        break;
      case OPS.setLeading:
        st.leading = -a[0];
        break;
      case OPS.nextLine:
        st.x = st.lineX += 0;
        st.y = st.lineY += st.leading;
        break;
      case OPS.setCharSpacing:
        st.Tc = a[0];
        break;
      case OPS.setWordSpacing:
        st.Tw = a[0];
        break;
      case OPS.setHScale:
        st.Th = a[0] / 100;
        break;
      case OPS.setTextRise:
        st.rise = a[0];
        break;
      case OPS.setFont:
        st.font = fontOf(a[0]);
        st.fontSize = a[1];
        break;
      case OPS.showText: {
        run += 1;
        const glyphs = a?.[0];
        const font = st.font;
        const usable =
          Array.isArray(glyphs) &&
          font &&
          !font.vertical &&
          !font.isType3Font &&
          st.fontSize > 0 &&
          Array.isArray(font.fontMatrix ?? [0.001]);
        const fm0 = (font?.fontMatrix ?? [0.001])[0];
        const widthScale = st.fontSize * fm0;
        const M = mul(st.ctm, st.tm);
        let x = 0;
        if (usable) {
          for (const g of glyphs) {
            if (typeof g === 'number') {
              x += (-g * st.fontSize) / 1000;
              continue;
            }
            if (!g) continue;
            const w = (Number(g.width) || 0) * widthScale;
            const spacing = (g.isSpace ? st.Tw : 0) + st.Tc;
            const tx0 = st.x + x * st.Th;
            const ty = st.y + st.rise;
            const [ox, oy] = apply(M, tx0, ty);
            const [ex, ey] = apply(M, tx0 + w * st.Th, ty);
            const u = String(g.unicode ?? '');
            out.push({ u, ws: WS_RE.test(u), ox, oy, ex, ey, run });
            x += w + spacing;
          }
        } else if (Array.isArray(glyphs)) {
          // 위치 계산 불가 — 진행량만 대략 맞춰 둔다(이 run은 매칭 대상 아님)
          for (const g of glyphs) {
            if (typeof g === 'number') x += (-g * (st.fontSize || 0)) / 1000;
            else if (g) x += (Number(g.width) || 0) * (st.fontSize || 0) * 0.001 + st.Tc;
          }
        }
        st.x += x * st.Th;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

/**
 * item 하나 → 글자 경계 오프셋(item 원점 기준 텍스트 방향, 사용자 공간). 길이 str.length+1.
 * 1:1로 못 맞추면 null.
 * @param {{ str: string, transform: number[] }} item
 * @param {PageGlyph[]} glyphs
 * @returns {number[] | null}
 */
export function glyphOffsetsForItem(item, glyphs) {
  const str = String(item?.str ?? '');
  const t = item?.transform;
  if (!str || !Array.isArray(t) || !glyphs?.length) return null;
  if (/^\s/u.test(str)) return null;
  const sx = Math.hypot(t[0], t[1]);
  const fs = Math.hypot(t[2], t[3]) || sx;
  if (!(sx > 0) || !(fs > 0)) return null;
  const ux = t[0] / sx;
  const uy = t[1] / sx;
  const ex0 = t[4];
  const ey0 = t[5];
  const along = (x, y) => (x - ex0) * ux + (y - ey0) * uy;
  const perp = (x, y) => -(x - ex0) * uy + (y - ey0) * ux;
  const onLine = (g) =>
    Math.abs(perp(g.ox, g.oy)) < 0.25 * fs &&
    (g.ex - g.ox) * ux + (g.ey - g.oy) * uy >= -1e-6 &&
    Math.abs(-(g.ex - g.ox) * uy + (g.ey - g.oy) * ux) < 0.01 * fs;

  /** @param {number} k */
  const walk = (k) => {
    /** @type {number[]} */
    const off = [];
    let i = 0;
    let j = k;
    let cursor = along(glyphs[k].ox, glyphs[k].oy);
    let lastAlong = cursor;
    let endAlong = cursor;
    const okNext = (g) => {
      if (!g || !onLine(g)) return false;
      const a0 = along(g.ox, g.oy);
      return a0 >= lastAlong - 0.5 * fs;
    };
    while (i < str.length) {
      const c = str[i];
      if (WS_RE.test(c)) {
        if (j < glyphs.length && glyphs[j].ws && okNext(glyphs[j])) {
          off[i] = along(glyphs[j].ox, glyphs[j].oy);
          while (j < glyphs.length && glyphs[j].ws && okNext(glyphs[j])) {
            lastAlong = along(glyphs[j].ox, glyphs[j].oy);
            endAlong = along(glyphs[j].ex, glyphs[j].ey);
            j += 1;
          }
        } else {
          off[i] = cursor;
        }
        cursor = off[i];
        i += 1;
        continue;
      }
      // 유니코드 없는 글리프(매핑 누락)는 글자 없이 진행만
      while (j < glyphs.length && glyphs[j].u === '' && okNext(glyphs[j])) j += 1;
      const g = glyphs[j];
      if (!g || g.ws || !okNext(g) || !g.u || !str.startsWith(g.u, i)) return null;
      const surrogatePair = g.u.length === 2 && /[\uD800-\uDBFF]/.test(g.u[0]);
      if (g.u.length > 1 && !surrogatePair) return null;
      const a0 = along(g.ox, g.oy);
      for (let q = 0; q < g.u.length; q += 1) off[i + q] = a0;
      i += g.u.length;
      lastAlong = a0;
      endAlong = along(g.ex, g.ey);
      cursor = endAlong;
      j += 1;
    }
    // 끝 경계: 마지막 글자가 공백이면 다음 글리프 원점, 아니면 잉크 폭 끝
    if (WS_RE.test(str[str.length - 1])) {
      const nx = glyphs[j];
      off[str.length] = nx && okNext(nx) && !nx.ws ? along(nx.ox, nx.oy) : endAlong;
    } else {
      off[str.length] = endAlong;
    }
    for (let q = 1; q < off.length; q += 1) {
      if (!(off[q] >= off[q - 1] - 1e-3)) return null;
    }
    return off;
  };

  const first = str[0];
  /** @type {{ d: number, off: number[] }[]} */
  const hits = [];
  for (let k = 0; k < glyphs.length; k += 1) {
    const g = glyphs[k];
    if (g.ws || !g.u || !str.startsWith(g.u, 0) || g.u[0] !== first) continue;
    if (!onLine(g)) continue;
    const d = along(g.ox, g.oy);
    if (Math.abs(d) > 3 * fs) continue;
    const off = walk(k);
    if (off) hits.push({ d: Math.abs(d), off });
  }
  if (!hits.length) return null;
  hits.sort((p, q) => p.d - q.d);
  const best = hits[0];
  // 거의 같은 거리에 다른 배치가 또 맞으면 모호 → 폴백 (겹친 같은 글자 run은 허용)
  for (const h of hits.slice(1)) {
    if (h.d - best.d > 0.5 * fs) break;
    const same =
      h.off.length === best.off.length &&
      h.off.every((v, idx) => Math.abs(v - best.off[idx]) < 0.05);
    if (!same) return null;
  }
  return best.off;
}

/** @type {WeakMap<object, Promise<PageGlyph[] | null>>} */
const pageGlyphCache = new WeakMap();
/** @type {WeakMap<object, number[] | null>} */
const itemOffsetCache = new WeakMap();

/**
 * 페이지의 글리프 위치를 (한 번만) 계산하고 items 각각의 오프셋을 캐시.
 * 실패해도 throw 하지 않는다 (해당 item은 폴백).
 * @param {{ getOperatorList: Function, commonObjs?: { get: Function } }} page pdf.js PDFPageProxy
 * @param {Array<{ str?: string, transform?: number[] }>} items
 * @param {Record<string, number>} OPS pdfjsLib.OPS
 * @returns {Promise<void>}
 */
export async function ensurePageGlyphOffsets(page, items, OPS) {
  if (!page || !items?.length || !OPS) return;
  if (items.every((it) => !it || typeof it !== 'object' || itemOffsetCache.has(it))) return;
  let p = pageGlyphCache.get(page);
  if (!p) {
    p = (async () => {
      try {
        // annotationMode 0 = DISABLE (주석 외형 글자 제외 — 텍스트 레이어와 같은 범위)
        const opList = await page.getOperatorList({ annotationMode: 0 });
        return buildPageGlyphs(opList, {
          OPS,
          getFont: (name) => page.commonObjs?.get(name),
        });
      } catch {
        return null;
      }
    })();
    pageGlyphCache.set(page, p);
  }
  const glyphs = await p;
  for (const it of items) {
    if (!it || typeof it !== 'object' || itemOffsetCache.has(it)) continue;
    let off = null;
    if (glyphs && typeof it.str === 'string' && it.str) {
      try {
        off = glyphOffsetsForItem(/** @type {any} */ (it), glyphs);
      } catch {
        off = null;
      }
    }
    itemOffsetCache.set(it, off);
  }
}

/**
 * {@link ensurePageGlyphOffsets} 결과. 없거나 매칭 실패면 null.
 * @param {object} item
 * @returns {number[] | null}
 */
export function getItemGlyphOffsets(item) {
  if (!item || typeof item !== 'object') return null;
  return itemOffsetCache.get(item) ?? null;
}
