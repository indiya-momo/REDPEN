import { publicAssetUrl } from './publicAssetUrl.js';

const STORAGE_PREFIX = 'indiya-user-badges--';

/** public/welcome/badges-trim — trim:badges 로 투명 여백 제거 (1-2 실요소 187×247 기준) */
const BADGE_IMAGE_PATHS = {
  'slot-1': 'welcome/badges-trim/1-1.png',
  'slot-2': 'welcome/badges-trim/1-2.png',
  'slot-3': 'welcome/badges-trim/1-3.png',
  'slot-4': 'welcome/badges-trim/2-1.png',
};

/** 1-2 trim 후 실요소 높이(px) — CSS 표시 스케일 기준 */
export const BADGE_ART_REF_HEIGHT_PX = 247;

/**
 * @param {string} slotId
 */
function badgeImageSrc(slotId) {
  const path = BADGE_IMAGE_PATHS[slotId];
  return path ? publicAssetUrl(path) : undefined;
}

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   description?: string,
 *   imageSrc?: string,
 * }} BadgeDefinition
 */

/** 이미지·지급 로직은 추후 연결 — 슬롯·라벨만 정의 */
export const BADGE_CATALOG = [
  {
    id: 'slot-1',
    name: '초판본 수집가',
    description: '오픈베타 테스터',
    imageSrc: badgeImageSrc('slot-1'),
  },
  {
    id: 'slot-2',
    name: '비밀 연구원',
    description: '피드백 1회 달성',
    imageSrc: badgeImageSrc('slot-2'),
  },
  {
    id: 'slot-3',
    name: '수석 검증관',
    description: '우수 피드백 달성',
    imageSrc: badgeImageSrc('slot-3'),
  },
  {
    id: 'slot-4',
    name: '매의 눈',
    description: '모모의 방 입장',
    imageSrc: badgeImageSrc('slot-4'),
  },
  { id: 'slot-5', name: '국전지 마스터', description: '16일 출석 달성' },
  { id: 'slot-6', name: '???' },
  { id: 'slot-7', name: '???' },
  { id: 'slot-8', name: '???' },
];

/** 배지 모음집 그리드 — 1행 5칸 */
export const BADGE_GRID_COLUMNS = 5;

/** 그리드 미지정 칸 — 표시만 ??? (지급 슬롯은 BADGE_CATALOG slot-6~8 등 추후 연결) */
const BADGE_GRID_UNKNOWN = '???';

/**
 * 5열 × 3행 — 지정 외 칸은 모두 ???
 * 1행: 초판본·비밀·수석 + ???×2
 * 2행: 매의 눈 + ???×4
 * 3행: 국전지 + ???×4
 * @type {string[][]}
 */
export const BADGE_GRID_ROWS = [
  ['slot-1', 'slot-2', 'slot-3', BADGE_GRID_UNKNOWN, BADGE_GRID_UNKNOWN],
  [
    'slot-4',
    BADGE_GRID_UNKNOWN,
    BADGE_GRID_UNKNOWN,
    BADGE_GRID_UNKNOWN,
    BADGE_GRID_UNKNOWN,
  ],
  [
    'slot-5',
    BADGE_GRID_UNKNOWN,
    BADGE_GRID_UNKNOWN,
    BADGE_GRID_UNKNOWN,
    BADGE_GRID_UNKNOWN,
  ],
];

const BADGE_GRID_SLOT_ORDER = BADGE_GRID_ROWS.flat();

/** 그리드에 이름이 있는 획득 가능 배지 (??? 칸 제외) */
export const BADGE_GRID_EARNABLE_IDS = [
  ...new Set(
    BADGE_GRID_SLOT_ORDER.filter((slotId) => slotId !== BADGE_GRID_UNKNOWN),
  ),
];

/** 배지 모음집 분모 — 전체 개수 미공개 */
export const BADGE_COLLECTION_TOTAL_LABEL = '???';

/** 공개 아트 — 그 외 슬롯은 획득 시에만 이미지 표시 */
const BADGE_PUBLIC_ART_SLOT = 'slot-1';

/** 운영·쇼케이스 계정에 미리 부여할 배지 (4개) */
export const BADGE_SHOWCASE_SLOT_IDS = ['slot-1', 'slot-2', 'slot-3', 'slot-4'];

/**
 * @param {string | undefined} raw
 */
function parseShowcaseAllowlist(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * @param {string} uid
 * @param {string} [email]
 */
export function isBadgeShowcaseUid(uid, email = '') {
  const id = uid.trim();
  const mail = email.trim().toLowerCase();
  const uidSet = new Set(
    parseShowcaseAllowlist(import.meta.env.VITE_BETA_QUOTA_ADMIN_UIDS),
  );
  const emailSet = new Set(
    parseShowcaseAllowlist(import.meta.env.VITE_BETA_QUOTA_ADMIN_EMAILS).map(
      (entry) => entry.toLowerCase(),
    ),
  );
  return (id && uidSet.has(id)) || (mail && emailSet.has(mail));
}

/**
 * @param {string} uid
 * @param {string} [email]
 */
export function syncBadgeShowcase(uid, email = '') {
  const id = uid.trim();
  if (!id || !isBadgeShowcaseUid(id, email)) return false;
  let changed = false;
  for (const badgeId of BADGE_SHOWCASE_SLOT_IDS) {
    if (!getEarnedBadgeIds(id).has(badgeId) && earnBadge(id, badgeId)) {
      changed = true;
    }
  }
  return changed;
}

/**
 * @param {string} slotId
 * @param {boolean} earned
 * @param {string | undefined} catalogImageSrc
 */
function resolveBadgeArt(slotId, earned, catalogImageSrc) {
  const showPublicArt =
    slotId === BADGE_PUBLIC_ART_SLOT && Boolean(catalogImageSrc);
  const showEarnedArt = earned && Boolean(catalogImageSrc);
  const showArt = showPublicArt || showEarnedArt;
  return {
    showArt,
    imageSrc: showArt ? catalogImageSrc : undefined,
  };
}

/**
 * @param {string} uid
 * @returns {{ earnedCount: number, totalLabel: string }}
 */
export function getBadgeCollectionStats(uid) {
  const earned = getEarnedBadgeIds(uid);
  const earnedCount = BADGE_GRID_EARNABLE_IDS.filter((id) =>
    earned.has(id),
  ).length;
  return { earnedCount, totalLabel: BADGE_COLLECTION_TOTAL_LABEL };
}

/**
 * @param {string} uid
 */
function storageKey(uid) {
  return `${STORAGE_PREFIX}${uid.trim()}`;
}

/**
 * @param {string} uid
 * @returns {Set<string>}
 */
export function getEarnedBadgeIds(uid) {
  const id = uid.trim();
  if (!id) return new Set();
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.earned) ? parsed.earned : [];
    return new Set(list.filter((entry) => typeof entry === 'string'));
  } catch {
    return new Set();
  }
}

/**
 * @param {string} uid
 * @param {string} badgeId
 */
export function earnBadge(uid, badgeId) {
  const id = uid.trim();
  const badge = badgeId.trim();
  if (!id || !badge) return false;
  const earned = getEarnedBadgeIds(id);
  if (earned.has(badge)) return true;
  earned.add(badge);
  try {
    localStorage.setItem(
      storageKey(id),
      JSON.stringify({ earned: [...earned], updatedAt: Date.now() }),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} badgeId
 * @returns {(BadgeDefinition & { earned?: boolean }) | null}
 */
export function getBadgeDefinition(badgeId) {
  const id = badgeId.trim();
  if (!id) return null;
  return BADGE_CATALOG.find((badge) => badge.id === id) ?? null;
}

/**
 * @param {string} uid
 * @returns {Array<BadgeDefinition & { earned: boolean }>}
 */
export function getUserBadgeCollection(uid) {
  const earned = getEarnedBadgeIds(uid);
  const byId = new Map(
    BADGE_CATALOG.map((badge) => [
      badge.id,
      { ...badge, earned: earned.has(badge.id) },
    ]),
  );
  return BADGE_GRID_SLOT_ORDER.map((slotId, index) => {
    if (slotId === BADGE_GRID_UNKNOWN) {
      return {
        id: `badge-grid-unknown-${index}`,
        name: '???',
        earned: false,
        showArt: true,
      };
    }
    const base = byId.get(slotId);
    if (!base) return null;
    const { showArt, imageSrc } = resolveBadgeArt(
      slotId,
      base.earned,
      base.imageSrc,
    );
    return { ...base, showArt, imageSrc };
  });
}
