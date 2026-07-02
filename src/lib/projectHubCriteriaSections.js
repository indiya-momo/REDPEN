import {
  isAuxiliaryVerbEntryEnabled,
  listAuxiliaryVerbEntries,
  toggleAuxiliaryVerbEntry,
} from './auxiliaryVerbRegister.js';
import { isBonBojoRequiredItem } from './bonBojoRules.js';
import {
  isConsistencyCriteriaEntryEnabled,
  listConsistencyCriteriaEntries,
  toggleConsistencyCriteriaEntry,
} from './consistencyCriteriaEntries.js';

/** @typedef {'consistency' | 'auxiliary'} ProjectHubToggleCriteriaKey */

/**
 * @typedef {{
 *   key: ProjectHubToggleCriteriaKey,
 *   title: string,
 *   ariaLabel: string,
 *   listEntries: (rules: import('./ruleTypes.js').Rule[]) => { tailWord: string, displayLabel?: string, bonBojoItemId?: string }[],
 *   isEnabled: (rules: import('./ruleTypes.js').Rule[], row: { tailWord: string, bonBojoItemId?: string }) => boolean,
 *   toggle: (rules: import('./ruleTypes.js').Rule[], row: { tailWord: string, bonBojoItemId?: string }, enabled: boolean) => import('./ruleTypes.js').Rule[],
 *   isRequired?: (row: { bonBojoItemId?: string }) => boolean,
 * }} ProjectHubToggleCriteriaSection
 */

/** @type {Record<ProjectHubToggleCriteriaKey, ProjectHubToggleCriteriaSection>} */
export const PROJECT_HUB_TOGGLE_CRITERIA = {
  consistency: {
    key: 'consistency',
    title: '표기 통일',
    ariaLabel: '표기 통일',
    listEntries: listConsistencyCriteriaEntries,
    isEnabled: isConsistencyCriteriaEntryEnabled,
    toggle: toggleConsistencyCriteriaEntry,
  },
  auxiliary: {
    key: 'auxiliary',
    title: '본용언 + 보조용언',
    ariaLabel: '본용언과 보조용언',
    listEntries: listAuxiliaryVerbEntries,
    isEnabled: isAuxiliaryVerbEntryEnabled,
    toggle: toggleAuxiliaryVerbEntry,
    isRequired: (row) => isBonBojoRequiredItem(row.bonBojoItemId),
  },
};
