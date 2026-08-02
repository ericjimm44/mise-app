/**
 * What's actually in the kitchen right now, grouped by category.
 *
 * Grouping is by `category`, which is inferred and may be absent — an
 * uncategorised item sits under "Other" rather than being guessed into the
 * wrong shelf.
 */

import type { IngredientCategory, InventoryItem } from '@contract/types';
import { Empty, GroupLabel, RowButton } from './ui';

const CATEGORY_ORDER: readonly IngredientCategory[] = [
  'produce',
  'protein',
  'dairy',
  'grain',
  'condiment',
  'spice',
  'baking',
  'other',
];

const CATEGORY_LABEL: Readonly<Record<IngredientCategory, string>> = {
  produce: 'Produce',
  protein: 'Protein',
  dairy: 'Dairy',
  grain: 'Grains & starch',
  condiment: 'Condiments',
  spice: 'Spices',
  baking: 'Baking',
  other: 'Other',
};

export function InventoryList({
  items,
  onRemove,
  onClear,
}: {
  items: readonly InventoryItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (items.length === 0) {
    return <Empty>Nothing here yet. Add what's in the fridge and the cupboard.</Empty>;
  }

  const grouped = new Map<IngredientCategory, InventoryItem[]>();
  for (const item of items) {
    const key = item.category ?? 'other';
    const bucket = grouped.get(key);
    if (bucket) bucket.push(item);
    else grouped.set(key, [item]);
  }

  return (
    <div>
      <p className="text-small text-ink-muted">
        {items.length} {items.length === 1 ? 'item' : 'items'}
      </p>

      {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((category) => (
        <div key={category}>
          <GroupLabel>{CATEGORY_LABEL[category]}</GroupLabel>
          <ul className="mt-2 divide-y divide-rule border-t border-rule">
            {(grouped.get(category) ?? []).map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-4 py-1">
                <span className="min-w-0 py-2 text-body text-ink">
                  {item.quantity ? (
                    <span className="tnum mr-2 font-mono text-small text-ink-muted">
                      {item.quantity}
                    </span>
                  ) : null}
                  {item.name}
                </span>
                <RowButton label={`Remove ${item.name}`} onClick={() => onRemove(item.id)}>
                  Remove
                </RowButton>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="mt-8">
        <button
          type="button"
          onClick={onClear}
          className="min-h-tap font-sans text-small text-ink-faint hover:text-danger"
        >
          Clear everything
        </button>
      </div>
    </div>
  );
}
