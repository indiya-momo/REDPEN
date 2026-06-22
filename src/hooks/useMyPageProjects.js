import { useCallback, useEffect, useState } from 'react';
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
import { returnToWorkspace } from '../lib/returnToWorkspace.js';
import {
  formatRuleSetSummary,
  loadActiveSetId,
  loadRuleSets,
  saveActiveSetId,
} from '../lib/ruleSetsStorage.js';
import {
  isRuleSetsCloudEnabled,
  loadRuleSetsCloud,
  resolveCloudActiveSetId,
} from '../lib/ruleSetsCloud.js';
import { mergeRuleSetsOnLogin } from '../lib/ruleSetsMerge.js';
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const localSets = normalizeLoadedSets(loadRuleSets());
      let sets = localSets;
      let activeId = loadActiveSetId();

      const trimmedUid = uid.trim();
      if (trimmedUid && isRuleSetsCloudEnabled()) {
        try {
          const cloud = await loadRuleSetsCloud(trimmedUid);
          if (cloud?.ruleSets?.length) {
            const merged = mergeRuleSetsOnLogin(localSets, cloud.ruleSets);
            sets = enforceMaxCriteriaPresets(
              normalizeLoadedSets(merged),
              trimmedUid,
              email,
            );
            activeId =
              resolveCloudActiveSetId(cloud.activeSetId, sets) ??
              resolveCloudActiveSetId(activeId, sets);
          }
        } catch {
          // 로컬 기준 유지
        }
      }

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

  const exempt = isCriteriaPresetLimitExempt(uid, email);
  const maxSlots = exempt ? null : MAX_CRITERIA_PRESETS;
  const emptySlotCount = exempt
    ? 0
    : Math.max(0, MAX_CRITERIA_PRESETS - savedCount);

  const selectProject = useCallback((setId) => {
    saveActiveSetId(setId);
    returnToWorkspace();
  }, []);

  return {
    projects,
    activeSetId,
    loading,
    selectProject,
    savedCount,
    maxSlots,
    exempt,
    emptySlotCount,
    atSlotLimit: !exempt && savedCount >= MAX_CRITERIA_PRESETS,
  };
}
