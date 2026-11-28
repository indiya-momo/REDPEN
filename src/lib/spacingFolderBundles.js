/**
 * 맞춤법 탭 「띄어쓰기」 폴더 — 묶음 ↔ 모듈 매핑 (단일 정의).
 * UI·툴팁·runCheckScope 실행이 이 파일만 본다.
 * @see docs/superpowers/specs/2026-11-19-spacing-folder-in-spelling-tab-design.md
 */

/** @typedef {'numberUnit' | 'dependentRieulKka' | 'punct' | 'nonAeoAux' | 'unlistedNounNoun'} SpacingFolderBundleId */

/**
 * @typedef {{
 *   bundleId: SpacingFolderBundleId,
 *   label: string,
 *   moduleIds: readonly string[],
 *   tipLines: readonly string[],
 *   example?: { find: string, replace: string },
 * }} SpacingFolderBundleDef
 */

/** @type {readonly SpacingFolderBundleDef[]} */
export const SPACING_FOLDER_BUNDLES = Object.freeze([
  Object.freeze({
    bundleId: 'numberUnit',
    label: '수·단위 [43항]',
    example: Object.freeze({ find: '이억삼천만', replace: '이억˅삼천만' }),
    moduleIds: Object.freeze(['numeral', 'man-eok-jo', 'digit-unit']),
    tipLines: Object.freeze(['아라비아 숫자와 단위는 붙이고, 한글로 적은 수와 단위는 띄어 씀']),
  }),
  Object.freeze({
    bundleId: 'dependentRieulKka',
    label: '관형사형 뒤 의존명사 [42항]',
    example: Object.freeze({ find: '할수 있다', replace: '할˅수 있다' }),
    moduleIds: Object.freeze([
      'adnominal-dep',
      'n-ji',
      'n-ba',
      'rieul-kka',
    ]),
    tipLines: Object.freeze([
      '관형사형 어미 뒤 의존명사(수·것·거·만큼·지·데·무렵·녘·때문·동안)는 띄어 씀 (맞춤법 제42항·형태소 확인)',
      '무렵·녘·때문·동안은 붙여 쓴 전체가 표준국어대사전 표제어이면 잡지 않는다. 관형사(그·이)나 명사 뒤의 때문·동안은 잡지 않는다.',
      '조사가 붙은 하는데다·좋은데가는 잡고, 연결어미로 쓰인 하는데·없는데·없는데도는 잡지 않는다.',
    ]),
  }),
  Object.freeze({
    bundleId: 'punct',
    label: '문장부호 뒤 띄움 (맞춤법 부록)',
    example: Object.freeze({ find: '갔다.또', replace: '갔다.˅또' }),
    moduleIds: Object.freeze(['punct']),
    tipLines: Object.freeze(['문장 부호 뒤는 띄고, 닫는 부호·따옴표와 조사(라고)는 붙여 씀']),
  }),
  // 2026-11-19: 본조 탭의 비아/어 띄움 필수 줄을 옮겨 옴. 기본 켜짐(아래 default).
  Object.freeze({
    bundleId: 'nonAeoAux',
    label: '본(-아/-어) + 보조용언 아닌 경우 [47항]',
    example: Object.freeze({ find: '먹지마', replace: '먹지˅마' }),
    moduleIds: Object.freeze(['non-aeo-aux']),
    tipLines: Object.freeze([
      '보조용언은 본용언이 -아/-어일 때만 붙여 씀',
      '-다 뒤 보다를 붙인 살다보니·하다보면은 띄어 씀. 들여다보다처럼 사전에 한 단어인 경우는 잡지 않음.',
    ]),
  }),
  Object.freeze({
    bundleId: 'unlistedNounNoun',
    label: '사전에 등재되지 않은 명사+명사 [2항]',
    example: Object.freeze({ find: '무릎위', replace: '무릎˅위' }),
    moduleIds: Object.freeze(['unlisted-noun-noun']),
    tipLines: Object.freeze([
      '사전에 없는 명사+위치 명사(위·아래·앞·뒤·안·밖·옆·속·밑)는 띄어 씀 (맞춤법 제2항)',
      '붙여 쓴 전체가 표준국어대사전 표제어이면 잡지 않음(눈앞·손위·윗사람).',
    ]),
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
    punct: false,
    // 본조 탭에서 보이던 카드를 대신하므로 기본 켜짐.
    nonAeoAux: true,
    unlistedNounNoun: false,
  };
}

/**
 * 알려진 묶음 키만 · 비-boolean·없는 키 → 묶음 기본값(대부분 false) · 알 수 없는 키 무시.
 * @param {unknown} raw
 * @returns {Record<SpacingFolderBundleId, boolean>}
 */
export function normalizeSpacingFolderEnabled(raw) {
  const base = defaultSpacingFolderEnabled();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  /** @type {Record<string, unknown>} */
  const obj = /** @type {Record<string, unknown>} */ (raw);
  for (const id of SPACING_FOLDER_BUNDLE_IDS) {
    if (typeof obj[id] === 'boolean') base[id] = obj[id];
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
