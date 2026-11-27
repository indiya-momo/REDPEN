import bonBojoJson from '../data/bon-bojo-rules.json';
import { partitionBonVerbAllowPhrases } from './bonNounHaeBlocklist.js';
import { assertValidBonBojoRules } from './validateDataJson.js';

/** 일관성 탭·확인·결과 요약 — 본조 기능명 */
export const AUXILIARY_VERB_FEATURE_LABEL =
  '본용언(-아/어) + 보조용언 표기 통일';
/** 결과 카드·PDF 말풍선·헤더 배지 */
export const AUXILIARY_VERB_BADGE_LABEL = '본용언+보조용언';
/** 국립국어원 한글 맞춤법 — 본용언·보조용언 관련 조항 */
export const AUXILIARY_VERB_BASIS_URL =
  'https://www.korean.go.kr/kornorms/regltn/regltnView.do#a198';

/**
 * @typedef {{ id: string, label: string, stems?: string[], enabled?: boolean, displayLabel?: string, except?: string[] }} BonBojoItem
 * @typedef {{ id: string, title?: string, tip: string, bonVerbAllow?: string[], items: BonBojoItem[] }} BonBojoGroup
 * @typedef {{ itemId: string, primaryTail: string, variantTails: string[], displayLabel?: string, enabled: boolean, tip?: string }} BonBojoListItem
 */

/** 시트에 없음 — 아는체하다 등, UI 없이 검사만 */
const BON_BOJO_LOGIC_ONLY_GROUP = {
  id: 'adj-bon',
  tip: '아는체하다·읽은체했다 등 — 관형어(은·는·ㄴ) 뒤 체+하다 붙임.',
  items: [
    {
      id: 'adj-che-hada',
      label: '체하',
      enabled: false,
      stems: ['체하'],
      displayLabel: '아는체하다',
    },
  ],
};

/** 비아/어+보조 띄어쓰기 필수 — 2차 게이트만 (1차 find 없음) */
export const BON_BOJO_NON_AEO_SPACE_ID = 'verb-non-aeo-space';

export const BON_BOJO_NON_AEO_SPACE_LABEL =
  '본용언이 (-아/-어) 가 아닌 경우 : 띄어쓰기 필수';

/** 시트에 없음 — UI 체크만, 1차 찾기 규칙 없음 */
const BON_BOJO_GATE_ONLY_GROUP = {
  id: 'gate-bon',
  tip: '본용언 연결이 -아/-어가 아닌 보조용언 구성은 띄어 쓴다(2차 검사 스위치).',
  items: [
    {
      id: BON_BOJO_NON_AEO_SPACE_ID,
      label: '비아어',
      enabled: false,
      stems: [],
      displayLabel: BON_BOJO_NON_AEO_SPACE_LABEL,
    },
  ],
};

/** 붙여 쓴 3음절 이상 복합·파생 본용언을 띄어 쓰라고 보는 체크 */
export const BON_BOJO_LONG_COMPOUND_SPLIT_ID = 'verb-long-compound-split';

export const BON_BOJO_LONG_COMPOUND_SPLIT_LABEL =
  '본용언이 3음절 이상 복합어 : 띄어쓰기 필수';

/** 시트 sync에 안 지워지게 런타임만 주입 */
const BON_BOJO_LONG_COMPOUND_GROUP = {
  id: 'split-bon',
  tip: '본용언 활용형이 3음절 이상인 복합어·파생어는 보조용언을 띄어 씁니다.',
  items: [
    {
      id: BON_BOJO_LONG_COMPOUND_SPLIT_ID,
      label: '3음절복합',
      enabled: false,
      stems: [],
      displayLabel: BON_BOJO_LONG_COMPOUND_SPLIT_LABEL,
    },
  ],
};

/** @param {typeof bonBojoJson} raw */
export function bonBojoRulesFingerprint(raw) {
  let hash = 0;
  const payload = JSON.stringify(raw);
  for (let i = 0; i < payload.length; i += 1) {
    hash = (Math.imul(31, hash) + payload.charCodeAt(i)) | 0;
  }
  return `${payload.length}:${hash}`;
}

/** @param {typeof bonBojoJson} source */
function buildRuntimeFromSource(source) {
  /** @type {BonBojoGroup[]} */
  const sheetGroups = source.groups ?? [];
  /** 시트에 같은 id가 있으면 합성 그룹을 넣지 않는다(중복 체크 방지). */
  const sheetItemIds = new Set(
    sheetGroups.flatMap((g) =>
      (g.items ?? []).map((it) => String(it.id ?? '').trim()).filter(Boolean),
    ),
  );
  /** @type {BonBojoGroup[]} */
  const groups = [
    ...sheetGroups,
    BON_BOJO_LOGIC_ONLY_GROUP,
    BON_BOJO_GATE_ONLY_GROUP,
    ...(sheetItemIds.has(BON_BOJO_LONG_COMPOUND_SPLIT_ID)
      ? []
      : [BON_BOJO_LONG_COMPOUND_GROUP]),
  ];

  /** @type {Map<string, readonly string[]>} */
  const allowByItemId = new Map();
  for (const group of groups) {
    const rawAllow = Array.isArray(group.bonVerbAllow)
      ? group.bonVerbAllow.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const { kept: allow } = partitionBonVerbAllowPhrases(rawAllow);
    if (!allow.length) continue;
    for (const item of group.items) {
      allowByItemId.set(item.id, allow);
    }
  }
  // 3음절 칸은 시트 verb-bon allow를 공유(합성 그룹에는 bonVerbAllow 없음)
  if (!allowByItemId.has(BON_BOJO_LONG_COMPOUND_SPLIT_ID)) {
    const verbBon = sheetGroups.find((g) => String(g.id ?? '') === 'verb-bon');
    const rawAllow = Array.isArray(verbBon?.bonVerbAllow)
      ? verbBon.bonVerbAllow.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const { kept: allow } = partitionBonVerbAllowPhrases(rawAllow);
    if (allow.length) {
      allowByItemId.set(BON_BOJO_LONG_COMPOUND_SPLIT_ID, allow);
    }
  }

  /** @type {BonBojoListItem[]} */
  const listItems = groups.flatMap((group) => {
    const tip = String(group.tip ?? '').trim();
    return group.items.map((item) => {
      const tails = tailWordsFromBonBojoItem(item);
      const primaryTail = String(item.label ?? '').trim();
      return {
        itemId: item.id,
        primaryTail,
        variantTails: tails.filter((t) => t !== primaryTail),
        displayLabel: item.displayLabel?.trim() || undefined,
        enabled: item.enabled === true,
        ...(tip ? { tip } : {}),
      };
    });
  });

  return {
    groups,
    allowByItemId,
    listItems,
    byItemId: new Map(listItems.map((item) => [item.itemId, item])),
  };
}

/** @type {typeof bonBojoJson} */
let bonBojoSource = bonBojoJson;
let runtime = buildRuntimeFromSource(bonBojoSource);

export const BON_BOJO_RULES_FP = bonBojoRulesFingerprint(bonBojoSource);

/** @returns {BonBojoGroup[]} */
export function getBonBojoGroups() {
  return runtime.groups;
}

/**
 * sync 후 dev에서 반영 시 호출
 * @param {typeof bonBojoJson} data
 */
export function replaceBonBojoRulesData(data) {
  assertValidBonBojoRules(data, 'replaceBonBojoRulesData');
  bonBojoSource = data;
  runtime = buildRuntimeFromSource(data);
}

/** @param {string | undefined} itemId */
export function bonVerbAllowForItemId(itemId) {
  if (itemId == null) return [];
  return runtime.allowByItemId.get(String(itemId).trim()) ?? [];
}

/** @param {BonBojoItem} item */
export function tailWordsFromBonBojoItem(item) {
  const label = String(item.label ?? '').trim();
  const stems = Array.isArray(item.stems)
    ? item.stems.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const tails = [];
  if (label) tails.push(label);
  for (const s of stems) {
    if (!tails.includes(s)) tails.push(s);
  }
  return tails;
}

/**
 * bon-bojo 1음절 stem — 항목 label(가·보·주…)와 같을 때만 허용.
 * @param {BonBojoItem} item
 * @param {string} stem
 */
export function isAllowedBonBojoSearchStem(item, stem) {
  const s = stem.trim();
  if (!/^[\uAC00-\uD7A3]$/.test(s)) return true;
  const label = String(item.label ?? '').trim();
  return s === label;
}

/** @param {BonBojoItem} item */
export function auxiliarySearchTailsFromBonBojoItem(item) {
  const stems = Array.isArray(item.stems)
    ? item.stems
        .map((s) => String(s).trim())
        .filter(Boolean)
        .filter((s) => isAllowedBonBojoSearchStem(item, s))
    : [];
  if (stems.length > 0) return [...new Set(stems)];
  const label = String(item.label ?? '').trim();
  return label ? [label] : [];
}

/** @param {string} tailWord */
export function bonBojoItemIdForSearchTail(tailWord) {
  const t = tailWord.trim();
  for (const group of runtime.groups) {
    for (const item of group.items) {
      if (auxiliarySearchTailsFromBonBojoItem(item).includes(t)) {
        return item.id;
      }
    }
  }
  return undefined;
}

/**
 * 본조 원고 stem 집계용 — 시트 stems (띄움·붙임 쌍).
 * @returns {readonly { spaced: string, glued: string, itemId: string, displayLabel?: string }[]}
 */
export function listBonBojoUnifyReviewStems() {
  /** @type {{ spaced: string, glued: string, itemId: string, displayLabel?: string }[]} */
  const out = [];
  /** @type {Set<string>} */
  const seen = new Set();
  for (const group of runtime.groups) {
    for (const item of group.items ?? []) {
      const itemId = String(item.id ?? '').trim();
      if (!itemId) continue;
      const displayLabel =
        item.displayLabel?.trim() || item.label?.trim() || undefined;
      for (const raw of item.stems ?? []) {
        const spaced = String(raw ?? '')
          .trim()
          .replace(/\s+/g, ' ');
        if (!spaced || !/\s/.test(spaced)) continue;
        const glued = spaced.replace(/\s+/g, '');
        const dedupe = `${itemId}\0${glued}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        out.push({ spaced, glued, itemId, displayLabel });
      }
    }
  }
  return out;
}

/** 시트·UI에서 기본 체크·「필수」 표시 대상 */
export const BON_BOJO_REQUIRED_ITEM_IDS_LIST = ['verb-jida', 'verb-hada'];

export const BON_BOJO_REQUIRED_ITEM_IDS = new Set(BON_BOJO_REQUIRED_ITEM_IDS_LIST);

export const BON_BOJO_LOGIC_ONLY_ITEM_IDS_LIST = ['adj-che-hada'];

export const BON_BOJO_LOGIC_ONLY_ITEM_IDS = new Set(
  BON_BOJO_LOGIC_ONLY_ITEM_IDS_LIST,
);

export const BON_BOJO_GATE_ONLY_ITEM_IDS_LIST = [BON_BOJO_NON_AEO_SPACE_ID];

export const BON_BOJO_GATE_ONLY_ITEM_IDS = new Set(
  BON_BOJO_GATE_ONLY_ITEM_IDS_LIST,
);

/** @param {string | undefined} itemId */
export function isBonBojoLogicOnlyItem(itemId) {
  return (
    itemId != null && BON_BOJO_LOGIC_ONLY_ITEM_IDS.has(String(itemId).trim())
  );
}

/** @param {string | undefined} itemId */
export function isBonBojoGateOnlyItem(itemId) {
  return (
    itemId != null && BON_BOJO_GATE_ONLY_ITEM_IDS.has(String(itemId).trim())
  );
}

/** @param {string | undefined} itemId */
export function isBonBojoRequiredItem(itemId) {
  return itemId != null && BON_BOJO_REQUIRED_ITEM_IDS.has(String(itemId).trim());
}

/** 일관성 탭 체크 목록 — 그룹 제목(엔진·결과 묶음과 무관) */
export const BON_BOJO_UI_GROUP = {
  GLUE_OPTIONAL: 'glue-optional',
  GLUE_REQUIRED: 'glue-required',
  SPACE_REQUIRED: 'space-required',
  /** 2차 게이트 전용 — 3음절 복합어와 item 공유하지 않음 */
  SPACE_REQUIRED_NON_AEO: 'space-required-non-aeo',
};

/** @type {Readonly<Record<string, string>>} */
export const BON_BOJO_UI_GROUP_TITLES = {
  [BON_BOJO_UI_GROUP.GLUE_OPTIONAL]:
    '본용언(-아/-어) + 보조용언 : 붙여쓰기 가능, 합성어는 붙여쓰기 필수',
  [BON_BOJO_UI_GROUP.GLUE_REQUIRED]: '본용언(-아/-어) + 지다· 하다 :붙여쓰기 필수',
  [BON_BOJO_UI_GROUP.SPACE_REQUIRED_NON_AEO]: BON_BOJO_NON_AEO_SPACE_LABEL,
  [BON_BOJO_UI_GROUP.SPACE_REQUIRED]: BON_BOJO_LONG_COMPOUND_SPLIT_LABEL,
};

/**
 * 일관성 탭 체크 줄 순서.
 * 2026-11-19: 「본용언이 (-아/-어) 가 아닌 경우 : 띄어쓰기 필수」 줄(말다·게이트)은 뺐다.
 * 비아/어 붙임은 맞춤법 탭 「띄어쓰기」 폴더(`nonAeoAuxSpacing.js`)가 낸다.
 * `SPACE_REQUIRED_NON_AEO` 상수·제목은 옛 결과·저장 호환용으로 남긴다.
 * @type {readonly string[]}
 */
export const BON_BOJO_UI_GROUP_ORDER = [
  BON_BOJO_UI_GROUP.GLUE_OPTIONAL,
  BON_BOJO_UI_GROUP.GLUE_REQUIRED,
  BON_BOJO_UI_GROUP.SPACE_REQUIRED,
];

/**
 * 비아/어 띄어쓰기 줄에 묶던 보조 (말다 등).
 * 2026-11-19부터 본조 탭에서 검사하지 않는다(규칙은 만들되 항상 꺼짐, 결과에서도 뺌).
 */
export const BON_BOJO_NON_AEO_AUX_ITEM_IDS = Object.freeze(['verb-malda']);

/** @param {string | undefined} itemId */
export function isBonBojoNonAeoAuxItem(itemId) {
  const id = String(itemId ?? '').trim();
  return BON_BOJO_NON_AEO_AUX_ITEM_IDS.includes(id);
}

/** @param {string | undefined} itemId */
export function bonBojoUiGroupForItemId(itemId) {
  const id = String(itemId ?? '').trim();
  if (id === BON_BOJO_NON_AEO_SPACE_ID || isBonBojoNonAeoAuxItem(id)) {
    return BON_BOJO_UI_GROUP.SPACE_REQUIRED_NON_AEO;
  }
  if (id === 'verb-boida') {
    // 화면은 맞춤법 탭 띄어쓰기 제47항 칸. 검사는 띄움 필수(∨) 유지.
    return BON_BOJO_UI_GROUP.SPACE_REQUIRED_NON_AEO;
  }
  if (id === BON_BOJO_LONG_COMPOUND_SPLIT_ID) {
    return BON_BOJO_UI_GROUP.SPACE_REQUIRED;
  }
  if (isBonBojoRequiredItem(id)) {
    return BON_BOJO_UI_GROUP.GLUE_REQUIRED;
  }
  return BON_BOJO_UI_GROUP.GLUE_OPTIONAL;
}

/**
 * UI 마스터 체크 줄 — 각 줄이 켜면 묶인 itemId 규칙 전부 on
 * @returns {readonly { id: string, label: string, itemIds: readonly string[] }[]}
 */
export function listBonBojoBundleDefinitions() {
  /** @type {Map<string, string[]>} */
  const itemIdsByGroup = new Map(
    BON_BOJO_UI_GROUP_ORDER.map((g) => [g, /** @type {string[]} */ ([])]),
  );
  for (const group of getBonBojoGroups()) {
    for (const item of group.items ?? []) {
      const id = String(item.id ?? '').trim();
      if (!id || isBonBojoLogicOnlyItem(id)) continue;
      const uiGroup = bonBojoUiGroupForItemId(id);
      itemIdsByGroup.get(uiGroup)?.push(id);
    }
  }
  return BON_BOJO_UI_GROUP_ORDER.map((groupId) => ({
    id: groupId,
    label: BON_BOJO_UI_GROUP_TITLES[groupId] ?? '',
    itemIds: itemIdsByGroup.get(groupId) ?? [],
  }));
}

/** @param {string} itemId */
export function bonBojoListItem(itemId) {
  return runtime.byItemId.get(itemId.trim());
}

/** @param {string} tailWord */
export function bonBojoItemIdForTail(tailWord) {
  const t = tailWord.trim();
  for (const item of runtime.listItems) {
    if (item.primaryTail === t || item.variantTails.includes(t)) {
      return item.itemId;
    }
  }
  return undefined;
}

/** @param {string} itemId */
export function bonBojoDisplayLabelForItem(itemId) {
  return bonBojoListItem(itemId)?.displayLabel;
}

