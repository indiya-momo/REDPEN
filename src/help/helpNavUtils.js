/**
 * @typedef {{ slug: string, label: string, index?: boolean, description?: string, children?: NavChild[] }} NavChild
 * @typedef {{ id: string, label: string, items: NavChild[] }} NavGroup
 */

/**
 * @param {NavGroup[]} groups
 * @param {string} slug
 * @returns {{ groupLabel: string, crumbs: { slug: string, label: string }[] } | null}
 */
export function findNavTrail(groups, slug) {
  for (const group of groups) {
    const trail = walkItems(group.items, slug, []);
    if (trail) {
      return { groupLabel: group.label, crumbs: trail };
    }
  }
  return null;
}

/**
 * @param {NavChild[]} items
 * @param {string} slug
 * @param {{ slug: string, label: string }[]} prefix
 * @returns {{ slug: string, label: string }[] | null}
 */
function walkItems(items, slug, prefix) {
  for (const item of items) {
    if (item.slug === slug) {
      return [...prefix, { slug: item.slug, label: item.label }];
    }

    if (item.children?.length) {
      const childTrail = walkItems(item.children, slug, [
        ...prefix,
        { slug: item.slug, label: item.label },
      ]);
      if (childTrail) return childTrail;
    }
  }
  return null;
}

/**
 * @param {NavGroup[]} groups
 * @param {string} slug
 * @returns {NavChild | null}
 */
export function findNavItem(groups, slug) {
  for (const group of groups) {
    const found = findInItems(group.items, slug);
    if (found) return found;
  }
  return null;
}

/**
 * @param {NavChild[]} items
 * @param {string} slug
 * @returns {NavChild | null}
 */
function findInItems(items, slug) {
  for (const item of items) {
    if (item.slug === slug) return item;
    if (item.children?.length) {
      const found = findInItems(item.children, slug);
      if (found) return found;
    }
  }
  return null;
}

/**
 * slug가 속한 접이식 트리의 부모 slug (없으면 null)
 * @param {NavGroup[]} groups
 * @param {string} slug
 * @returns {string | null}
 */
export function findExpandableParentSlug(groups, slug) {
  for (const group of groups) {
    const parent = findParentWithChildren(group.items, slug, null);
    if (parent) return parent;
  }
  return null;
}

/**
 * @param {NavChild[]} items
 * @param {string} slug
 * @param {string | null} treeRootSlug
 */
function findParentWithChildren(items, slug, treeRootSlug) {
  for (const item of items) {
    if (!item.children?.length) continue;

    const root = treeRootSlug ?? item.slug;
    if (item.slug === slug) return root;
    if (item.children.some((child) => child.slug === slug)) return item.slug;

    const nested = findParentWithChildren(item.children, slug, root);
    if (nested) return nested;
  }
  return null;
}
