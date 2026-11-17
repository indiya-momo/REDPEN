import { getBuiltInOverlayReplace } from './builtInRules.js';
import {
  BON_BOJO_UI_GROUP,
  bonBojoUiGroupForItemId,
} from './bonBojoRules.js';
import { getConsistencyUnifyOverlayForGroup } from './consistencyUnifyRegister.js';

/** 맞춤법 오버레이와 같은 붙임 표시. `쉬어 가라고` → `→쉬어⁀가라고` */
const AUX_GLUE_MARK = '\u2040';
/** 띄움 표시. `뛰지말라` → `→뛰지∨말라` */
const SPACE_INSERT_MARK = '\u2228';

/**
 * 맞춤법 시트 붙임 표시 `^`를 PDF에서 `⁀`로 보여 준다. `∨`는 띄움이라 그대로 둔다.
 * @param {string} text
 */
function spellingGlueOverlay(text) {
  const raw = String(text ?? '').trim();
  if (!raw.includes('^')) return raw;
  return raw.replaceAll('^', AUX_GLUE_MARK);
}

/** @param {import('./ruleEngine.js').GroupedResult | null | undefined} group */
function isSpellingOverlayGroup(group) {
  if (!group) return false;
  if (group.category === 'spelling') return true;
  return Boolean(String(group.spellingRuleId ?? '').trim());
}

/**
 * 띄어쓰기 필수 줄(3음절 복합·비아/어·말다).
 * @param {import('./ruleEngine.js').GroupedResult | null | undefined} group
 */
function isAuxiliarySpaceRequiredGroup(group) {
  if (!group) return false;
  if (group.auxSplitLongCompound || group.auxNonAeoSpace) return true;
  const ui = bonBojoUiGroupForItemId(group.bonBojoItemId);
  return (
    ui === BON_BOJO_UI_GROUP.SPACE_REQUIRED ||
    ui === BON_BOJO_UI_GROUP.SPACE_REQUIRED_NON_AEO
  );
}

/** 붙여 쓴 말을 띄운 제안. 등재 붙임과 반대다. */
function isAuxiliaryLongSplitInstance(inst) {
  const matched = String(inst?.matchedText ?? '').replace(/\s+/g, '');
  const suggested = String(inst?.suggestedText ?? '').trim();
  if (!matched || !suggested || !/\s/.test(suggested)) return false;
  return suggested.replace(/\s+/g, '') === matched;
}

/**
 * 띄어 쓴 본조. 공백 자리에 기본 붙임 표시를 넣는다.
 * @param {import('./ruleEngine.js').MatchInstance} inst
 * @returns {string | null}
 */
function auxiliarySpacedGlueOverlay(inst) {
  const matched = String(inst?.matchedText ?? '').trim();
  if (!matched || !/\s/.test(matched)) return null;
  return `→${matched.replace(/\s+/g, AUX_GLUE_MARK)}`;
}

/**
 * 띄어쓰기 필수 — 잘못된 붙임→띄움만 ∨. 이미 띄운 올바른 표면은 기호 없음.
 * @param {import('./ruleEngine.js').MatchInstance} inst
 * @returns {string | null}
 */
function auxiliarySpaceInsertOverlay(inst) {
  const matched = String(inst?.matchedText ?? '');
  const suggested = String(inst?.suggestedText ?? '').trim();
  if (!matched || /\s/.test(matched)) return null;
  if (
    suggested &&
    /\s/.test(suggested) &&
    suggested.replace(/\s+/g, '') === matched.replace(/\s+/g, '')
  ) {
    return `→${suggested.replace(/\s+/g, SPACE_INSERT_MARK)}`;
  }
  return null;
}

/**
 * 맞춤법·본조 공통 — 공백만 붙이는 교정. `손 끝`→`손끝` → `→손⁀끝`.
 * 일부만 붙이면(`뒤 끝 없`→`뒤끝 없`) 빠진 공백만 ⁀, 남는 공백은 유지.
 * @param {string} matched
 * @param {string} suggested
 * @returns {string | null}
 */
export function spacingGlueOverlay(matched, suggested) {
  const a = String(matched ?? '');
  const b = String(suggested ?? '');
  if (!a || !b || !/\s/.test(a)) return null;
  if (a.replace(/\s+/g, '') !== b.replace(/\s+/g, '')) return null;

  let i = 0;
  let j = 0;
  let out = '';
  while (i < a.length) {
    if (/\s/.test(a[i])) {
      let k = i;
      while (k < a.length && /\s/.test(a[k])) k += 1;
      if (j < b.length && /\s/.test(b[j])) {
        out += ' ';
        while (j < b.length && /\s/.test(b[j])) j += 1;
      } else {
        out += AUX_GLUE_MARK;
      }
      i = k;
      continue;
    }
    out += a[i];
    i += 1;
    if (j < b.length && !/\s/.test(b[j])) j += 1;
    else {
      while (j < b.length && /\s/.test(b[j])) j += 1;
      if (j < b.length) j += 1;
    }
  }
  return `→${out}`;
}

/**
 * 통일형 PDF 오버레이 — 통일형(+📌) 표시. 「→ 통일형 📌」는 화살표 유지
 * @param {import('./ruleEngine.js').MatchInstance} _inst
 * @param {string} unifiedRaw
 */
export function formatConsistencyUnifyHighlightOverlay(_inst, unifiedRaw) {
  let unified = String(unifiedRaw ?? '').trim();
  if (!unified) return null;
  // 변형 원고: 「→ 신라시대 📌」
  if (unified.startsWith('→') && unified.includes('📌')) {
    return unified;
  }
  if (unified.startsWith('→')) unified = unified.slice(1).trim();
  const arrow = unified.indexOf('→');
  if (arrow >= 0) unified = unified.slice(arrow + 1).trim();
  return unified || null;
}

/**
 * @param {import('./ruleEngine.js').MatchInstance} inst
 * @param {{
 *   customRules?: import('./ruleTypes.js').Rule[],
 *   group?: import('./ruleEngine.js').GroupedResult | null,
 * }} [options]
 * @returns {string | null}
 */
export function getHighlightOverlayReplace(inst, options = {}) {
  if (!inst?.find) return null;

  const { customRules = [], group = null } = options;
  if (group?.patternKind === 'auxiliary-verb') {
    // 붙임→띄움 제안이면 ∨ (띄어쓰기 필수·아/어 붙임 가능 공통).
    // 예: 해보이는 → 해 보이는. 예전에 붙임 가능 줄은 띄운 표면만 ⁀해서
    // PDF에 기호가 없어 «못 잡은 것»처럼 보였다.
    const spaceInsert = auxiliarySpaceInsertOverlay(inst);
    if (spaceInsert) return spaceInsert;
    if (isAuxiliarySpaceRequiredGroup(group)) return null;
    // 붙여쓰기 가능·필수 — 띄운 표면에 붙임표
    return auxiliarySpacedGlueOverlay(inst);
  }

  // findReplaces 행: 찾은 말마다 제 고칠 말(J overlay_replace 무시)
  const variantReplace = String(inst.variantReplace ?? '').trim();
  if (variantReplace) {
    const glue = spacingGlueOverlay(inst.matchedText, variantReplace);
    if (glue) return glue;
    return `→${variantReplace}`;
  }
  if (group?.tailWord) {
    const consistencyOverlay = getConsistencyUnifyOverlayForGroup(
      customRules,
      group,
    );
    if (consistencyOverlay) {
      return formatConsistencyUnifyHighlightOverlay(inst, consistencyOverlay);
    }
  }

  // 표기 통일 추천 preview 등 — 그룹에 직접 실린 오버레이
  if (!group?.tailWord) {
    const direct = String(group?.overlayReplace ?? '').trim();
    if (direct) {
      return isSpellingOverlayGroup(group) ? spellingGlueOverlay(direct) : direct;
    }
  }

  const text = String(
    getBuiltInOverlayReplace(inst.find, inst.replace, group?.spellingRuleId) ??
      '',
  ).trim();
  if (text) return spellingGlueOverlay(text);

  const suggested = String(inst.suggestedText ?? '').trim();
  if (isSpellingOverlayGroup(group) || group?.category === 'spelling') {
    return spacingGlueOverlay(inst.matchedText, suggested);
  }
  // 검토(caution): 교정 오버레이가 없고 후보 라벨(group.label)만 있다.
  // collectAnnotFindings의 `overlay || group.label`과 같게 화면도 이 라벨을 쓴다.
  if (group?.category === 'caution') {
    const label = String(group.label ?? '').trim();
    return label || null;
  }
  return null;
}

/**
 * 검토 후보 라벨(`한 번, 한번`)은 후보 안의 띄어쓰기를 ∨로 보여 준다 → `한∨번, 한번`.
 * `→`로 시작하는 단일 교정 라벨은 그대로.
 * @param {string} overlay
 * @returns {string}
 */
export function markCandidateSpacing(overlay) {
  const o = String(overlay ?? '');
  if (!o || o.trim().startsWith('→') || !o.includes(',')) return o;
  return o
    .split(',')
    .map((part) => {
      const p = part.trim();
      return p.replace(/\s+/g, SPACE_INSERT_MARK);
    })
    .join(', ');
}

/**
 * 띄어쓰기만 바꾸는 오버레이(`→손⁀끝`, `→할∨때`, `→할 때`)면 교정기호 자리를 matched 오프셋으로 준다.
 * - join: matched[s..e) 공백을 붙임 (⌒)
 * - insert: 글자 사이(또는 기존 공백 자리)에 띄움 (∨)
 * 글자가 하나라도 바뀌거나 바뀐 띄어쓰기가 없으면 null — 그때는 라벨을 그대로 쓴다.
 * @param {string} matched
 * @param {string} overlay
 * @returns {Array<{ type: 'join' | 'insert', s: number, e: number }> | null}
 */
export function spacingOnlyMarks(matched, overlay) {
  const a = String(matched ?? '');
  let o = String(overlay ?? '').trim();
  if (!a || !o.startsWith('→')) return null;
  o = o.slice(1).trim();
  /** @type {Array<{ type: 'join' | 'insert', s: number, e: number }>} */
  const marks = [];
  let i = 0;
  let j = 0;
  while (i < a.length) {
    if (/\s/.test(a[i])) {
      let k = i;
      while (k < a.length && /\s/.test(a[k])) k += 1;
      if (o[j] === AUX_GLUE_MARK) marks.push({ type: 'join', s: i, e: k });
      else if (o[j] === SPACE_INSERT_MARK) {
        marks.push({ type: 'insert', s: i, e: k });
      } else if (o[j] !== ' ') return null;
      i = k;
      j += 1;
      continue;
    }
    if (i > 0 && (o[j] === SPACE_INSERT_MARK || o[j] === ' ')) {
      marks.push({ type: 'insert', s: i, e: i });
      j += 1;
      continue;
    }
    if (o[j] !== a[i]) return null;
    i += 1;
    j += 1;
  }
  if (j !== o.length || !marks.length) return null;
  return marks;
}

/**
 * @deprecated spacingOnlyMarks 사용. 붙임 구간만 [시작, 끝)으로.
 * @param {string} matched
 * @param {string} overlay
 * @returns {Array<[number, number]> | null}
 */
export function glueOnlyGapRuns(matched, overlay) {
  const marks = spacingOnlyMarks(matched, overlay);
  if (!marks || marks.some((m) => m.type !== 'join')) return null;
  return marks.map((m) => [m.s, m.e]);
}

/**
 * 하이라이트 박스 안에서 matched 글자 폭으로 교정기호 x를 잡는다.
 * (긴 PDF item 균등분할 누적 오차로 ∨가 한 글자 오른쪽으로 밀리는 것 방지)
 * @param {{ left: number, top: number, width: number, height: number }} box
 * @param {number} matchLen
 * @param {Array<{ type: 'join' | 'insert', s: number, e: number }>} runs
 * @returns {Array<{ type: 'join' | 'insert', x: number, top: number, size: number }> | null}
 */
export function spacingMarkPositionsInBox(box, matchLen, runs) {
  if (!box || !(matchLen > 0) || !runs?.length) return null;
  if (!(box.width > 0) || !(box.height > 0)) return null;
  const charW = box.width / matchLen;
  return runs.map(({ type, s, e }) => {
    if (type === 'insert') {
      return {
        type,
        x: box.left + s * charW,
        top: box.top,
        size: box.height,
      };
    }
    const left = box.left + s * charW;
    const right = box.left + Math.max(e, s + 1) * charW;
    return {
      type,
      x: (left + right) / 2,
      top: box.top,
      size: box.height,
    };
  });
}