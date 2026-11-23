/** 원고 작업대 모드 레지스트리 — 1차는 검색·수정 추가·조판 기호. */
export const MANUAL_LIST_MODE = 'manual-list';

/** @type {readonly { id: string, label: string, layoutKind?: import('../layoutMark/layoutMarkTypes.js').LayoutMarkKind }[]} */
export const MANUSCRIPT_TOOLBOX_MODES = Object.freeze([
  { id: 'search', label: '검색' },
  { id: 'manual-add', label: '수정 추가' },
  { id: 'layout-paraSplit', label: '줄바꿈', layoutKind: 'paraSplit' },
  { id: 'layout-paraGap', label: '행갈이', layoutKind: 'paraGap' },
  { id: 'layout-indent', label: '들여쓰기', layoutKind: 'indent' },
]);

/** @param {string | null | undefined} modeId */
export function isManuscriptToolboxMode(modeId) {
  return (
    modeId === MANUAL_LIST_MODE ||
    MANUSCRIPT_TOOLBOX_MODES.some((mode) => mode.id === modeId)
  );
}

/** @param {string | null | undefined} modeId */
export function layoutKindFromMode(modeId) {
  const row = MANUSCRIPT_TOOLBOX_MODES.find((m) => m.id === modeId);
  return row?.layoutKind ?? null;
}

/** @param {string | null | undefined} modeId */
export function isLayoutMarkMode(modeId) {
  return layoutKindFromMode(modeId) != null;
}
