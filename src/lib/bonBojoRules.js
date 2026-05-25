import bonBojoJson from '../data/bon-bojo-rules.json';

/**
 * @typedef {{ id: string, label: string, stems?: string[], enabled?: boolean, displayLabel?: string, except?: string[] }} BonBojoItem
 * @typedef {{ id: string, title?: string, tip: string, items: BonBojoItem[] }} BonBojoGroup
 * @typedef {{ tailWord: string, displayLabel?: string, enabled: boolean, tip?: string, seedId: string }} BonBojoSeedEntry
 */

/** @type {BonBojoGroup[]} */
export const BON_BOJO_GROUPS = bonBojoJson.groups ?? [];

/** @param {BonBojoItem} item */
function tailWordsFromItem(item) {
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

/** @type {BonBojoSeedEntry[]} */
export const BON_BOJO_SEED_ENTRIES = BON_BOJO_GROUPS.flatMap((group) => {
  const tip = String(group.tip ?? '').trim();
  return group.items.flatMap((item) =>
    tailWordsFromItem(item).map((tailWord) => ({
      seedId: item.id,
      tailWord,
      displayLabel: item.displayLabel?.trim() || undefined,
      enabled: item.enabled === true,
      ...(tip ? { tip } : {}),
    })),
  );
});

/** @type {Map<string, { displayLabel?: string, tip?: string }>} */
const BON_BOJO_BY_TAIL = new Map(
  BON_BOJO_SEED_ENTRIES.map((e) => [
    e.tailWord,
    { displayLabel: e.displayLabel, tip: e.tip },
  ]),
);

/** @param {string} tailWord */
export function bonBojoDisplayLabelForTail(tailWord) {
  return BON_BOJO_BY_TAIL.get(tailWord.trim())?.displayLabel;
}
