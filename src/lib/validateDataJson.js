/** @typedef {{ path: string, message: string }} ValidationIssue */

export const CAUTION_MATCH_MODES = new Set([
  'any-before',
  'spaced-before',
  'attached-before',
  'spaced-stem',
  'fixed-phrase',
]);

/**
 * @param {unknown} value
 * @returns {value is boolean}
 */
function isBoolean(value) {
  return typeof value === 'boolean';
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {ValidationIssue[]} issues
 * @param {string} path
 * @param {string} message
 */
function pushIssue(issues, path, message) {
  issues.push({ path, message });
}

/**
 * @param {ValidationIssue[]} issues
 * @param {string} label
 */
export function formatValidationIssues(issues, label = 'data') {
  if (!issues.length) return '';
  const lines = issues.map((i) => `  - ${i.path}: ${i.message}`);
  return `${label} validation failed (${issues.length}):\n${lines.join('\n')}`;
}

/**
 * @param {ValidationIssue[]} issues
 * @param {string} label
 */
export function assertNoValidationIssues(issues, label) {
  if (issues.length) {
    throw new Error(formatValidationIssues(issues, label));
  }
}

/**
 * @param {unknown} data
 * @param {string} [label]
 * @returns {ValidationIssue[]}
 */
export function validateSpellingRules(data, label = 'spelling-rules.json') {
  /** @type {ValidationIssue[]} */
  const issues = [];

  if (!Array.isArray(data)) {
    pushIssue(issues, label, 'root must be an array');
    return issues;
  }

  if (data.length === 0) {
    pushIssue(issues, label, 'must contain at least one rule');
  }

  const seenFindReplace = new Set();

  data.forEach((row, index) => {
    const base = `${label}[${index}]`;

    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      pushIssue(issues, base, 'must be an object');
      return;
    }

    if (!isNonEmptyString(row.find)) {
      pushIssue(issues, `${base}.find`, 'required non-empty string');
    }
    if (!isNonEmptyString(row.replace)) {
      pushIssue(issues, `${base}.replace`, 'required non-empty string');
    }
    if (
      isNonEmptyString(row.find) &&
      isNonEmptyString(row.replace) &&
      row.find.trim() === row.replace.trim()
    ) {
      pushIssue(issues, base, 'find and replace must differ');
    }
    if (!isBoolean(row.enabled)) {
      pushIssue(issues, `${base}.enabled`, 'required boolean');
    }

    if (row.tip !== undefined && typeof row.tip !== 'string') {
      pushIssue(issues, `${base}.tip`, 'must be a string');
    }
    if (row.memo !== undefined && typeof row.memo !== 'string') {
      pushIssue(issues, `${base}.memo`, 'must be a string');
    }
    if (
      row.countsInQuota !== undefined &&
      !isBoolean(row.countsInQuota)
    ) {
      pushIssue(issues, `${base}.countsInQuota`, 'must be a boolean');
    }
    if (row.visible !== undefined && !isBoolean(row.visible)) {
      pushIssue(issues, `${base}.visible`, 'must be a boolean');
    }
    if (
      row.dividerGroup !== undefined &&
      typeof row.dividerGroup !== 'string'
    ) {
      pushIssue(issues, `${base}.dividerGroup`, 'must be a string');
    }
    if (row.overlayReplace !== undefined && typeof row.overlayReplace !== 'string') {
      pushIssue(issues, `${base}.overlayReplace`, 'must be a string');
    }

    if (isNonEmptyString(row.find) && isNonEmptyString(row.replace)) {
      const key = `${row.find.trim()}\0${row.replace.trim()}`;
      if (seenFindReplace.has(key)) {
        pushIssue(
          issues,
          base,
          `duplicate find+replace pair (${row.find} → ${row.replace})`,
        );
      }
      seenFindReplace.add(key);
    }
  });

  return issues;
}

/**
 * @param {unknown} item
 * @param {string} itemPath
 * @param {ValidationIssue[]} issues
 * @param {{ requireMatchMode?: boolean }} options
 */
function validateGroupItem(item, itemPath, issues, options = {}) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    pushIssue(issues, itemPath, 'must be an object');
    return;
  }

  if (!isNonEmptyString(item.id)) {
    pushIssue(issues, `${itemPath}.id`, 'required non-empty string');
  }
  if (!isNonEmptyString(item.label)) {
    pushIssue(issues, `${itemPath}.label`, 'required non-empty string');
  }
  if (!isBoolean(item.enabled)) {
    pushIssue(issues, `${itemPath}.enabled`, 'required boolean');
  }

  if (item.stems !== undefined) {
    if (!Array.isArray(item.stems)) {
      pushIssue(issues, `${itemPath}.stems`, 'must be an array');
    } else {
      item.stems.forEach((stem, si) => {
        if (typeof stem !== 'string' || !stem.trim()) {
          pushIssue(
            issues,
            `${itemPath}.stems[${si}]`,
            'must be a non-empty string',
          );
        }
      });
    }
  }

  if (item.matchMode !== undefined) {
    if (typeof item.matchMode !== 'string' || !CAUTION_MATCH_MODES.has(item.matchMode)) {
      pushIssue(
        issues,
        `${itemPath}.matchMode`,
        `must be one of: ${[...CAUTION_MATCH_MODES].join(', ')}`,
      );
    }
  } else if (options.requireMatchMode) {
    pushIssue(issues, `${itemPath}.matchMode`, 'required for caution rules');
  }

  if (item.except !== undefined) {
    if (!Array.isArray(item.except)) {
      pushIssue(issues, `${itemPath}.except`, 'must be an array');
    } else {
      item.except.forEach((phrase, pi) => {
        if (typeof phrase !== 'string' || !phrase.trim()) {
          pushIssue(
            issues,
            `${itemPath}.except[${pi}]`,
            'must be a non-empty string',
          );
        }
      });
    }
  }

  if (
    item.inventoryOnly !== undefined &&
    !isBoolean(item.inventoryOnly)
  ) {
    pushIssue(issues, `${itemPath}.inventoryOnly`, 'must be a boolean');
  }
  if (item.displayLabel !== undefined && typeof item.displayLabel !== 'string') {
    pushIssue(issues, `${itemPath}.displayLabel`, 'must be a string');
  }
  if (item.tip !== undefined && typeof item.tip !== 'string') {
    pushIssue(issues, `${itemPath}.tip`, 'must be a string');
  }
}

/**
 * @param {unknown} data
 * @param {string} label
 * @param {{ requireMatchMode?: boolean }} options
 * @returns {ValidationIssue[]}
 */
export function validateGroupedRulesDoc(data, label, options = {}) {
  /** @type {ValidationIssue[]} */
  const issues = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    pushIssue(issues, label, 'root must be an object');
    return issues;
  }

  if (!Array.isArray(data.groups)) {
    pushIssue(issues, `${label}.groups`, 'required array');
    return issues;
  }

  if (data.groups.length === 0) {
    pushIssue(issues, `${label}.groups`, 'must contain at least one group');
  }

  const seenGroupIds = new Set();
  const seenItemIds = new Set();

  data.groups.forEach((group, gi) => {
    const groupPath = `${label}.groups[${gi}]`;

    if (!group || typeof group !== 'object' || Array.isArray(group)) {
      pushIssue(issues, groupPath, 'must be an object');
      return;
    }

    if (!isNonEmptyString(group.id)) {
      pushIssue(issues, `${groupPath}.id`, 'required non-empty string');
    } else if (seenGroupIds.has(group.id)) {
      pushIssue(issues, `${groupPath}.id`, `duplicate group id (${group.id})`);
    } else {
      seenGroupIds.add(group.id);
    }

    if (!Array.isArray(group.items)) {
      pushIssue(issues, `${groupPath}.items`, 'required array');
      return;
    }

    if (group.items.length === 0) {
      pushIssue(issues, `${groupPath}.items`, 'must contain at least one item');
    }

    if (group.tip !== undefined && typeof group.tip !== 'string') {
      pushIssue(issues, `${groupPath}.tip`, 'must be a string');
    }

    if (group.bonVerbAllow !== undefined) {
      if (!Array.isArray(group.bonVerbAllow)) {
        pushIssue(issues, `${groupPath}.bonVerbAllow`, 'must be an array');
      } else {
        group.bonVerbAllow.forEach((phrase, pi) => {
          if (!isNonEmptyString(phrase)) {
            pushIssue(
              issues,
              `${groupPath}.bonVerbAllow[${pi}]`,
              'must be a non-empty string',
            );
          }
        });
      }
    }

    group.items.forEach((item, ii) => {
      const itemPath = `${groupPath}.items[${ii}]`;
      validateGroupItem(item, itemPath, issues, options);

      if (item && typeof item === 'object' && isNonEmptyString(item.id)) {
        if (seenItemIds.has(item.id)) {
          pushIssue(
            issues,
            `${itemPath}.id`,
            `duplicate item id (${item.id})`,
          );
        } else {
          seenItemIds.add(item.id);
        }
      }
    });
  });

  return issues;
}

/**
 * @param {unknown} data
 * @param {string} [label]
 */
export function validateCautionRules(data, label = 'caution-rules.json') {
  return validateGroupedRulesDoc(data, label, { requireMatchMode: true });
}

/**
 * @param {unknown} data
 * @param {string} [label]
 */
export function validateBonBojoRules(data, label = 'bon-bojo-rules.json') {
  return validateGroupedRulesDoc(data, label, { requireMatchMode: false });
}

/**
 * @param {unknown} data
 * @param {string} [label]
 */
export function assertValidSpellingRules(data, label) {
  assertNoValidationIssues(validateSpellingRules(data, label), label);
}

/**
 * @param {unknown} data
 * @param {string} [label]
 */
export function assertValidCautionRules(data, label) {
  assertNoValidationIssues(validateCautionRules(data, label), label);
}

/**
 * @param {unknown} data
 * @param {string} [label]
 */
export function assertValidBonBojoRules(data, label) {
  assertNoValidationIssues(validateBonBojoRules(data, label), label);
}
