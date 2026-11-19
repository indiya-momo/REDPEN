/**
 * 맞춤법 탭 「띄어쓰기」 폴더 — 묶음 ↔ 모듈 매핑 (단일 정의).
 * UI·툴팁·runCheckScope 실행이 이 파일만 본다.
 * @see docs/superpowers/specs/2026-11-19-spacing-folder-in-spelling-tab-design.md
 */

/** @typedef {'numberUnit' | 'dependentRieulKka' | 'placeAffix' | 'punct'} SpacingFolderBundleId */

/**
 * @typedef {{
 *   bundleId: SpacingFolderBundleId,
 *   label: string,
 *   moduleIds: readonly string[],
 *   tipLines: readonly string[],
 * }} SpacingFolderBundleDef
 */

/** @type {readonly SpacingFolderBundleDef[]} */
export const SPACING_FOLDER_BUNDLES = Object.freeze([
  Object.freeze({
    bundleId: 'numberUnit',
    label: '수·단위',
    moduleIds: Object.freeze(['numeral', 'man-eok-jo', 'digit-unit']),
    tipLines: Object.freeze(['수사', '만·억·조', '숫자·단위']),
  }),
  Object.freeze({
    bundleId: 'dependentRieulKka',
    label: '의존명사·-ㄹ까 보다',
    moduleIds: Object.freeze([
      'adnominal-dep',
      'n-ji',
      'n-ba',
      'rieul-kka',
    ]),
    tipLines: Object.freeze([
      '관형사형+의존명사',
      '-ㄴ지 기간',
      '-ㄴ바',
      '보다 구문 (rieul-kka ROWS 목록에 한함 · 보조용언 일반 제외)',
    ]),
  }),
  Object.freeze({
    bundleId: 'placeAffix',
    label: '지명·접미',
    moduleIds: Object.freeze(['place-affix']),
    tipLines: Object.freeze(['지명·외자 접미']),
  }),
  Object.freeze({
    bundleId: 'punct',
    label: '문장부호',
    moduleIds: Object.freeze(['punct']),
    tipLines: Object.freeze(['종결·쉼표 뒤 띄어', '닫는 부호와 조사 붙임']),
  }),
]);

/** @type {readonly SpacingFolderBundleId[]} */
export const SPACING_FOLDER_BUNDLE_IDS = Object.freeze(
  SPACING_FOLDER_BUNDLES.map((b) => b.bundleId),
);

/** @returns {readonly SpacingFolderBundleDef[]} */
export function listSpacingFolderBundles() {
  return SPACING_FOLDER_BUNDLES;
}

/** @returns {Record<SpacingFolderBundleId, boolean>} */
export function defaultSpacingFolderEnabled() {
  return {
    numberUnit: false,
    dependentRieulKka: false,
    placeAffix: false,
    punct: false,
  };
}

/**
 * 알려진 묶음 키만 · 비-boolean → false · 알 수 없는 키 무시.
 * @param {unknown} raw
 * @returns {Record<SpacingFolderBundleId, boolean>}
 */
export function normalizeSpacingFolderEnabled(raw) {
  const base = defaultSpacingFolderEnabled();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  /** @type {Record<string, unknown>} */
  const obj = /** @type {Record<string, unknown>} */ (raw);
  for (const id of SPACING_FOLDER_BUNDLE_IDS) {
    base[id] = obj[id] === true;
  }
  return base;
}

/**
 * @param {Record<string, boolean> | null | undefined} map
 */
export function isAnySpacingFolderEnabled(map) {
  const normalized = normalizeSpacingFolderEnabled(map);
  return SPACING_FOLDER_BUNDLE_IDS.some((id) => normalized[id] === true);
}

/**
 * 켠 묶음의 moduleIds를 스펙 순서(묶음 간·안)로 펼친다.
 * @param {Record<string, boolean> | null | undefined} map
 * @returns {{ bundleId: SpacingFolderBundleId, moduleId: string }[]}
 */
export function listEnabledSpacingModuleRefs(map) {
  const normalized = normalizeSpacingFolderEnabled(map);
  /** @type {{ bundleId: SpacingFolderBundleId, moduleId: string }[]} */
  const out = [];
  for (const bundle of SPACING_FOLDER_BUNDLES) {
    if (!normalized[bundle.bundleId]) continue;
    for (const moduleId of bundle.moduleIds) {
      out.push({ bundleId: bundle.bundleId, moduleId });
    }
  }
  return out;
}

/**
 * @param {string} bundleId
 * @returns {SpacingFolderBundleDef | undefined}
 */
export function getSpacingFolderBundle(bundleId) {
  return SPACING_FOLDER_BUNDLES.find((b) => b.bundleId === bundleId);
}

/**
 * @param {string} bundleId
 */
export function spacingCategoryForBundle(bundleId) {
  return `spacing:${bundleId}`;
}
