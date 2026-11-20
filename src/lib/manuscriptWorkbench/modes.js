/** 원고 작업대 모드 레지스트리 — 1차는 검색·수정 추가. 슬롯만 열어 둔다. */
export const MANUAL_LIST_MODE = 'manual-list';

export const MANUSCRIPT_TOOLBOX_MODES = [
  { id: 'search', label: '검색' },
  { id: 'manual-add', label: '수정 추가' },
];

/** @param {string | null | undefined} modeId */
export function isManuscriptToolboxMode(modeId) {
  return (
    modeId === MANUAL_LIST_MODE ||
    MANUSCRIPT_TOOLBOX_MODES.some((mode) => mode.id === modeId)
  );
}
