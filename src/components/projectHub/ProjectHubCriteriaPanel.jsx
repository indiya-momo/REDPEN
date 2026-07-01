import { useMemo } from 'react';
import { PROJECT_HUB_TOGGLE_CRITERIA } from '../../lib/projectHubCriteriaSections.js';
import { useProjectHubCriteriaMutations } from '../../hooks/useProjectHubCriteriaMutations.js';
import ProjectHubCriteriaConsistencySection from './ProjectHubCriteriaConsistencySection.jsx';
import ProjectHubCriteriaSpellingSection from './ProjectHubCriteriaSpellingSection.jsx';
import ProjectHubCriteriaToggleSection from './ProjectHubCriteriaToggleSection.jsx';

/** @typedef {'spelling' | 'consistency' | 'auxiliary'} ProjectHubCriteriaSection */

/**
 * @param {{
 *   section: ProjectHubCriteriaSection,
 *   ruleSet: import('../../lib/ruleSetsStorage.js').RuleSet,
 *   criteriaSaving?: boolean,
 *   onCriteriaChange: (patch: {
 *     customRules?: import('../../lib/ruleTypes.js').Rule[],
 *     builtInEnabled?: Record<string, boolean>,
 *     cautionEnabled?: Record<string, boolean>,
 *   }) => void | Promise<void>,
 *   onStartWork?: () => void,
 * }} props
 */
export default function ProjectHubCriteriaPanel({
  section,
  ruleSet,
  criteriaSaving = false,
  onCriteriaChange,
  onStartWork,
}) {
  const { customRules, applyCriteriaPatch, applyCustomRules } =
    useProjectHubCriteriaMutations({
      ruleSet,
      onCriteriaChange,
    });

  const toggleConfig = useMemo(() => {
    if (section === 'auxiliary') {
      return PROJECT_HUB_TOGGLE_CRITERIA.auxiliary;
    }
    return null;
  }, [section]);

  const auxiliaryEntries = useMemo(() => {
    if (!toggleConfig) return [];
    return toggleConfig.listEntries(customRules);
  }, [toggleConfig, customRules]);

  if (section === 'spelling') {
    return <ProjectHubCriteriaSpellingSection onStartWork={onStartWork} />;
  }

  if (section === 'consistency') {
    return (
      <ProjectHubCriteriaConsistencySection
        customRules={customRules}
        criteriaSaving={criteriaSaving}
        applyCustomRules={applyCustomRules}
      />
    );
  }

  if (!toggleConfig) return null;

  return (
    <ProjectHubCriteriaToggleSection
      pillarKey={toggleConfig.key}
      ariaLabel={toggleConfig.ariaLabel}
      entries={auxiliaryEntries}
      customRules={customRules}
      isEnabled={toggleConfig.isEnabled}
      onToggle={(row, enabled) =>
        applyCriteriaPatch({
          customRules: toggleConfig.toggle(customRules, row, enabled),
        })
      }
      isRequired={toggleConfig.isRequired}
      criteriaSaving={criteriaSaving}
    />
  );
}
