/** 모모 펜 원 궤도 — 순수 함수 (MomoHero + 테스트) */

export const ORBIT_CX = 50;
export const ORBIT_CY = 48;
export const ORBIT_R = 39;
export const ORBIT_START_DEG = 45;
export const ORBIT_START_RAD = (ORBIT_START_DEG * Math.PI) / 180;
export const TRAIL_PATH_LENGTH = 1000;
export const TRAIL_DONE = 0.997;

export const PEN_ROTATE_DEG = -270;
export const PEN_W = 16;
export const PEN_H = 30;
export const PEN_TIP_X = 2.2;
export const PEN_TIP_Y = 26.4;

const TWO_PI = Math.PI * 2;

export function orbitPoint(progress) {
  const angle = ORBIT_START_RAD + progress * TWO_PI;
  return {
    x: ORBIT_CX + ORBIT_R * Math.cos(angle),
    y: ORBIT_CY + ORBIT_R * Math.sin(angle),
  };
}

export function buildPenTransform(x, y) {
  return `translate(${x} ${y}) rotate(${PEN_ROTATE_DEG}) translate(${-PEN_TIP_X} ${-PEN_TIP_Y})`;
}

export function applyTrailStroke(trail, progress) {
  const p = Math.min(1, Math.max(0, progress));

  if (p >= TRAIL_DONE) {
    trail.style.strokeDasharray = 'none';
    trail.style.strokeDashoffset = '0';
    return;
  }

  trail.style.strokeDasharray = `${TRAIL_PATH_LENGTH}`;
  trail.style.strokeDashoffset = `${TRAIL_PATH_LENGTH * (1 - p)}`;
}
