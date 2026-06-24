import { useCallback, useEffect, useRef, useState } from 'react';
import { LEGACY_DEFAULT_CRITERIA_HINT } from '../lib/criteriaName.js';
import {
  countSavedCriteriaPresets,
  isCriteriaPresetLimitExempt,
  MAX_CRITERIA_PRESETS,
} from '../lib/criteriaPresetLimit.js';
import {
  countBuiltInActiveRules,
  countBuiltInGuideActiveRules,
  countConsistencyActiveRules,
  countSpacingReviewActiveRules,
} from '../lib/activeRuleCount.js';
import { normalizeRuleSet } from '../lib/ruleSetNormalize.js';
import {
  formatRuleSetSummary,
  loadActiveSetId,
  loadRuleSets,
  saveActiveSetId,
  saveRuleSets,
} from '../lib/ruleSetsStorage.js';
import {
  isRuleSetsCloudEnabled,
  loadRuleSetsCloud,
  resolveHydratedActiveSetId,
  saveRuleSetsCloud,
} from '../lib/ruleSetsCloud.js';
import { mergeRuleSetsOnLogin, dedupeSavedRuleSetsByName } from '../lib/ruleSetsMerge.js';
import { enforceMaxCriteriaPresets } from '../lib/criteriaPresetLimit.js';

/** @param {import('../lib/ruleSetsStorage.js').RuleSet} set */
export function summarizeProjectRuleSet(set) {
  return formatRuleSetSummary({
    savedAt: set.savedAt,
    builtInRuleCount: countBuiltInActiveRules({
      builtInEnabled: set.builtInEnabled,
    }),
    builtInGuideRuleCount: countBuiltInGuideActiveRules({
      builtInEnabled: set.builtInEnabled,
    }),
    spacingRuleCount: countSpacingReviewActiveRules({
      cautionEnabled: set.cautionEnabled,
    }),
    consistencyRuleCount: countConsistencyActiveRules(set.customRules),
  });
}

/** @param {import('../lib/ruleSetsStorage.js').RuleSet[]} rawSets */
function normalizeLoadedSets(rawSets) {
  return (rawSets ?? []).map((set) => {
    const normalized = normalizeRuleSet(set);
    const trimmedName = (normalized.name || '').trim();
    if (
      trimmedName === '기본 규칙 세트' ||
      trimmedName === LEGACY_DEFAULT_CRITERIA_HINT
    ) {
      return normalizeRuleSet({ ...normalized, name: '' });
    }
    return normalized;
  });
}

/**
 * 마이페이지용 저장 프로젝트(기준 프리셋) 읽기 전용 로드
 * @param {string} [uid]
 * @param {string} [email]
 */
export function useMyPageProjects(uid = '', email = '') {
  const [projects, setProjects] = useState(
    /** @type {import('../lib/ruleSetsStorage.js').RuleSet[]} */ ([]),
  );
  const [activeSetId, setActiveSetId] = useState(
    /** @type {string | null} */ (null),
  );
  const [savedCount, setSavedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const loadedSetsRef = useRef(
    /** @type {import('../lib/ruleSetsStorage.js').RuleSet[]} */ ([]),
  );
  const activeSetIdRef = useRef(/** @type {string | null} */ (null));

  activeSetIdRef.current = activeSetId;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const trimmedUid = uid.trim();
      const localSets = normalizeLoadedSets(loadRuleSets(trimmedUid));
      let sets = localSets;
      let activeId = loadActiveSetId(trimmedUid);

      if (trimmedUid && isRuleSetsCloudEnabled()) {
        try {
          const cloud = await loadRuleSetsCloud(trimmedUid);
          if (cloud?.ruleSets?.length) {
            const merged = mergeRuleSetsOnLogin(localSets, cloud.ruleSets);
            sets = dedupeSavedRuleSetsByName(
              enforceMaxCriteriaPresets(
                normalizeLoadedSets(merged),
                trimmedUid,
                email,
              ),
            );
            activeId = resolveHydratedActiveSetId(
              sets,
              activeId,
              cloud.activeSetId,
            );
          }
        } catch {
          // 로컬 기준 유지
        }
      }

      loadedSetsRef.current = sets;
      activeSetIdRef.current = activeId;
      const saved = sets.filter((s) => Boolean(s.savedAt));
      if (!cancelled) {
        setProjects(saved);
        setActiveSetId(activeId);
        setSavedCount(countSavedCriteriaPresets(sets));
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [uid, email]);

  const flushProjectsSaveAsync = useCallback(async () => {
    const trimmedUid = uid.trim();
    const sets = loadedSetsRef.current;
    const setId = activeSetIdRef.current;
    saveRuleSets(sets, trimmedUid);
    if (setId) saveActiveSetId(setId, trimmedUid);
    if (trimmedUid && isRuleSetsCloudEnabled()) {
      try {
        await saveRuleSetsCloud(trimmedUid, sets, setId);
      } catch (e) {
        console.warn('기준 클라우드 저장 실패 (마이페이지)', e);
      }
    }
  }, [uid]);

  /** 마이페이지 「작업하기」 — activeSetId·ruleSets만 local+cloud 저장 (메인 창 전환 없음) */
  const selectProject = useCallback(
    async (setId) => {
      const trimmedUid = uid.trim();
      const id = String(setId ?? '').trim();
      if (!id || !loadedSetsRef.current.some((set) => set.id === id)) {
        return false;
      }

      saveRuleSets(loadedSetsRef.current, trimmedUid);
      saveActiveSetId(id, trimmedUid);
      activeSetIdRef.current = id;
      setActiveSetId(id);

      if (trimmedUid && isRuleSetsCloudEnabled()) {
        try {
          await saveRuleSetsCloud(trimmedUid, loadedSetsRef.current, id);
        } catch (e) {
          console.warn('기준 클라우드 저장 실패 (작업하기)', e);
          return false;
        }
      }
      return true;
    },
    [uid],
  );

  const exempt = isCriteriaPresetLimitExempt(uid, email);
  const maxSlots = exempt ? null : MAX_CRITERIA_PRESETS;
  const emptySlotCount = exempt
    ? 0
    : Math.max(0, MAX_CRITERIA_PRESETS - savedCount);

  return {
    projects,
    activeSetId,
    loading,
    selectProject,
    flushProjectsSaveAsync,
    savedCount,
    maxSlots,
    exempt,
    emptySlotCount,
    atSlotLimit: !exempt && savedCount >= MAX_CRITERIA_PRESETS,
  };
}
