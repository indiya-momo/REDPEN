/** 맞춤법 오버레이와 같은 붙임·띄움 표시 */
const AUX_GLUE_MARK = '\u2040';
const SPACE_INSERT_MARK = '\u2228';

/**
 * 한 오버레이에 고칠 말이 둘이면 나눈다. 이미 `→수정형`이면 나누지 않는다.
 * @param {unknown} overlay
 * @returns {string[]}
 */
export function splitOverlayForms(overlay) {
  const raw = String(overlay ?? '').trim();
  if (!raw) return [];
  if (raw.startsWith('→')) return [raw];
  if (raw.includes(',')) {
    return raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  if (raw.includes(SPACE_INSERT_MARK) && raw.includes(AUX_GLUE_MARK)) {
    return raw
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [raw];
}

/**
 * @param {string} form
 * @returns {string}
 */
export function stripOverlayArrow(form) {
  const t = String(form ?? '').trim();
  if (t.startsWith('→')) return t.slice(1).trim();
  return t;
}

/**
 * 공통 `→` 옆에 둘 말. 띄어쓰기는 기존 오버레이와 같이 ∨.
 * @param {string} form
 * @returns {string}
 */
export function overlayChoiceLabel(form) {
  const t = stripOverlayArrow(form);
  if (!t) return '';
  return t.replaceAll(' ', SPACE_INSERT_MARK);
}

/**
 * @param {string} form
 * @returns {string | null}
 */
export function formatOverlayAsReplace(form) {
  const raw = String(form ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith('→')) return raw;
  return `→ ${raw}`;
}

/**
 * 수정 추가 원본 = PDF 하이라이트 상자 구간. 수정·메모는 비운다.
 * @param {{
 *   start?: number,
 *   end?: number,
 *   matchedText?: string,
 *   overlayReplace?: string,
 *   tip?: string,
 *   editPayload?: {
 *     pageNum?: number,
 *     index?: number,
 *     start?: number,
 *     end?: number,
 *     matchedText?: string,
 *     find?: string,
 *     suggestedText?: string,
 *     replace?: string,
 *     tip?: string,
 *   },
 * } | null | undefined} highlight
 * @param {{ pageNum?: number, text?: string, visualText?: string } | null | undefined} pageData
 * @param {{ overlayForm?: string, overlayReplace?: string } | null | undefined} [layer]
 */
export function highlightToManualEditPayload(highlight, pageData, layer) {
  if (!highlight) return null;
  const text = String(pageData?.text ?? pageData?.visualText ?? '');
  const start = Number(highlight.start);
  const end = Number(highlight.end);
  const slice =
    Number.isFinite(start) && Number.isFinite(end) && end > start
      ? text.slice(start, end)
      : '';
  const base = highlight.editPayload ?? {};
  const matchedText =
    slice ||
    String(base.matchedText ?? highlight.matchedText ?? base.find ?? '');
  if (!matchedText) return null;
  const pageNum = Number(base.pageNum ?? pageData?.pageNum);
  if (!Number.isFinite(pageNum)) return null;
  const indexRaw = Number(base.index);
  const rangeStart = Number.isFinite(start)
    ? start
    : Number.isFinite(Number(base.start))
      ? Number(base.start)
      : indexRaw;
  if (!Number.isFinite(rangeStart)) return null;
  const rangeEnd =
    Number.isFinite(end) && end > rangeStart
      ? end
      : rangeStart + matchedText.length;
  void layer;
  return {
    pageNum,
    index: Number.isFinite(indexRaw) ? indexRaw : rangeStart,
    start: rangeStart,
    end: rangeEnd,
    matchedText,
    find: String(base.find ?? matchedText),
    suggestedText: '',
    replace: '',
    tip: '',
    fromHighlight: true,
  };
}

/**
 * 하이라이트는 하나. 고칠 말이 둘이면 그 위 레이어만 둘로 연다.
 * @param {{ id?: string, overlayReplace?: string | null, start?: number, end?: number, primary?: boolean }} highlight
 */
export function expandHighlightOverlayLayers(highlight) {
  const source =
    highlight?.overlayReplace ?? highlight?.overlayChoiceSource ?? '';
  const forms = splitOverlayForms(source);
  const baseId = String(highlight?.id ?? '');
  if (forms.length < 2) {
    return [
      {
        ...highlight,
        baseId,
      },
    ];
  }
  const choiceSource =
    String(highlight?.overlayChoiceSource ?? '').trim() ||
    forms.map((form) => stripOverlayArrow(form)).join(', ');
  return [
    {
      ...highlight,
      baseId,
      overlayReplace: undefined,
      overlayChoiceSource: choiceSource,
      overlayLayers: forms.map((form, i) => {
        const label = overlayChoiceLabel(form);
        return {
          id: `${baseId}#${i}`,
          overlayLabel: label,
          overlayForm: stripOverlayArrow(form),
          overlayReplace: formatOverlayAsReplace(label),
        };
      }),
    },
  ];
}

/**
 * 이중 후보 레이어. 이미 전개됐으면 그대로, 아니면 라벨·오버레이 문자열에서 만든다.
 * @param {{ id?: string, overlayLayers?: object[], overlayReplace?: string, overlayChoiceSource?: string } | null | undefined} highlight
 */
export function resolveOverlayChoiceLayers(highlight) {
  const existing = highlight?.overlayLayers ?? [];
  if (existing.length >= 2) return existing;
  const source =
    highlight?.overlayChoiceSource ?? highlight?.overlayReplace ?? '';
  const forms = splitOverlayForms(source);
  if (forms.length < 2) return existing;
  const baseId = String(highlight?.baseId ?? highlight?.id ?? '');
  return forms.map((form, i) => {
    const label = overlayChoiceLabel(form);
    return {
      id: `${baseId}#${i}`,
      overlayLabel: label,
      overlayForm: stripOverlayArrow(form),
      overlayReplace: formatOverlayAsReplace(label),
    };
  });
}

/** @param {{ start?: number, end?: number }} a @param {{ start?: number, end?: number }} b */
function rangesOverlap(a, b) {
  const a0 = Number(a?.start);
  const a1 = Number(a?.end);
  const b0 = Number(b?.start);
  const b1 = Number(b?.end);
  if (![a0, a1, b0, b1].every(Number.isFinite)) return false;
  return a0 < b1 && b0 < a1;
}

/**
 * 같은 자리 발견은 목록에서 고른 것만 남긴다. 두 형태는 하이라이트 하나·레이어만 둘.
 * @param {object[]} highlights
 */
export function applyHighlightOverlayLayers(highlights) {
  const expanded = [];
  for (const row of highlights ?? []) {
    if (!row) continue;
    expanded.push(...expandHighlightOverlayLayers(row));
  }
  const used = new Set();
  /** @type {object[]} */
  const out = [];
  for (let i = 0; i < expanded.length; i += 1) {
    if (used.has(i)) continue;
    const clusterIdx = [i];
    used.add(i);
    for (let j = i + 1; j < expanded.length; j += 1) {
      if (used.has(j)) continue;
      if (clusterIdx.some((ci) => rangesOverlap(expanded[ci], expanded[j]))) {
        clusterIdx.push(j);
        used.add(j);
      }
    }
    const cluster = clusterIdx.map((ci) => expanded[ci]);
    const primary = cluster.find((h) => h.primary);
    if (primary && cluster.length > 1) {
      out.push(primary);
      continue;
    }
    out.push(...cluster);
  }
  return out;
}

function pickedLayerIds(picked) {
  const ids = new Set();
  if (typeof picked === 'string' && picked) ids.add(picked);
  else if (picked && typeof picked === 'object') {
    for (const value of Object.values(picked)) {
      if (value) ids.add(String(value));
    }
  }
  return ids;
}

/**
 * PDF에서 고른 레이어만 남긴다. 하이라이트는 그대로 둔다.
 * 항목마다 고른 값을 기억해서, 다른 항목을 골라도 이미 고른 것은 둘로 돌아가지 않는다.
 * @param {object[]} highlights
 * @param {string | Record<string, string> | null | undefined} picked
 */
export function filterPickedHighlightLayers(highlights, picked) {
  const list = highlights ?? [];
  const ids = pickedLayerIds(picked);
  if (!ids.size) return list;
  return list.map((h) => {
    const layers = resolveOverlayChoiceLayers(h);
    const found = layers.find((layer) => ids.has(layer.id));
    if (!found) return h;
    return {
      ...h,
      overlayLayers: undefined,
      overlayReplace: found.overlayReplace,
    };
  });
}
