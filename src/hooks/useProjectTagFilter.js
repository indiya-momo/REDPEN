import { useEffect, useMemo, useState } from 'react';
import {
  buildProjectTagFilterOptions,
  filterProjectsForLibrary,
} from '../presentation/projectCardViewModel.js';

/**
 * @param {import('../presentation/projectCardViewModel.js').ProjectCardViewModel[]} cards
 */
export function useProjectTagFilter(cards) {
  const [tagFilter, setTagFilter] = useState(/** @type {string | null} */ (null));

  const tagFilterOptions = useMemo(
    () => buildProjectTagFilterOptions(cards),
    [cards],
  );

  const filteredCards = useMemo(
    () => filterProjectsForLibrary(cards, tagFilter),
    [cards, tagFilter],
  );

  useEffect(() => {
    if (!tagFilter) return;
    const stillValid = tagFilterOptions.some((option) => option.id === tagFilter);
    if (!stillValid) setTagFilter(null);
  }, [tagFilter, tagFilterOptions]);

  return {
    tagFilter,
    setTagFilter,
    tagFilterOptions,
    filteredCards,
  };
}
