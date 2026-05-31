/** welcome_library_16.png (1071×720) — 창틀 판별·pane 구간 */

export const MOMO_ROOM_CANVAS_W = 1071;
export const MOMO_ROOM_CANVAS_H = 720;

/** 구름 경로 — (622,168) → (814,168), 240s 왕복 */
export const MOMO_ROOM_CLOUD_X1 = 622;
export const MOMO_ROOM_CLOUD_X2 = 814;
export const MOMO_ROOM_CLOUD_Y = 134;
export const MOMO_ROOM_CLOUD_X1_PCT = `${((MOMO_ROOM_CLOUD_X1 / MOMO_ROOM_CANVAS_W) * 100).toFixed(4)}%`;
export const MOMO_ROOM_CLOUD_X2_PCT = `${((MOMO_ROOM_CLOUD_X2 / MOMO_ROOM_CANVAS_W) * 100).toFixed(4)}%`;

/** generate-momo-room-window-front.mjs — 창 상단 하늘 pane (그림 1071×720) */
export const WINDOW_SKY_Y0 = 45;
export const WINDOW_SKY_Y1 = 210;
/** 창틀 가로폭 — (607,182)~(829,182) */
export const WINDOW_FRAME_LEFT = 607;
export const WINDOW_FRAME_RIGHT = 829;
/** 유리 뚫기 안쪽 여백 — 창틀이 구름 가장자리를 살짝 가림 */
export const WINDOW_GLASS_INSET = 5;

export const isWindowFrame = (r, g, b) => {
  const lum = (r + g + b) / 3;
  if (r >= 52 && g >= 45 && b <= 42 && r >= b + 5) return true;
  if (lum < 42 && r >= 35 && g >= 28 && b <= 35 && r >= b && g >= b - 3) return true;
  if (r >= 45 && g >= 38 && b <= 38 && lum < 52) return true;
  return false;
};
