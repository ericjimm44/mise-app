/**
 * Seed data for first run.
 *
 * IMPORTANT: these are SEEDS, not the runtime source of truth. `ensureSeeded()`
 * writes them into Dexie once; everything afterwards reads the table. Nothing in
 * this file may be consulted at runtime to decide what the user has or excludes
 * — that decision lives in IndexedDB where the user can change it
 * (`docs/decisions.md` §4: nothing personal is hardcoded).
 */

import { normalize } from '@contract/recipe.schema';
import { SINGLETON_ID } from '@contract/db';
import type { PantryStaple, UserSettings } from '@contract/types';

/**
 * Grouping for the staples setup screen only. Never persisted — `PantryStaple`
 * in the contract has no group field, and inventing one locally would be a
 * divergent type.
 */
export type StapleGroup = 'seasoning' | 'fat' | 'acid' | 'pantry' | 'dried spice';

export const STAPLE_GROUP_ORDER: readonly StapleGroup[] = [
  'seasoning',
  'fat',
  'acid',
  'pantry',
  'dried spice',
];

interface StapleSeed {
  id: string;
  name: string;
  group: StapleGroup;
  /**
   * Ships enabled. Be ruthless here.
   *
   * A staple wrongly assumed present is the one Rule 1 violation the validator
   * CANNOT catch: the recipe looks available, so it passes, and then the user
   * opens a cupboard and it isn't there. Everything below that isn't salt,
   * pepper or a bottle of cooking oil ships OFF and waits to be switched on.
   */
  enabled: boolean;
}

const STAPLE_SEEDS: readonly StapleSeed[] = [
  // --- seasoning
  { id: 'salt', name: 'Salt', group: 'seasoning', enabled: true },
  { id: 'black_pepper', name: 'Black pepper', group: 'seasoning', enabled: true },
  { id: 'flaky_salt', name: 'Flaky finishing salt', group: 'seasoning', enabled: false },
  { id: 'white_pepper', name: 'White pepper', group: 'seasoning', enabled: false },

  // --- fat
  { id: 'neutral_oil', name: 'Neutral cooking oil', group: 'fat', enabled: true },
  { id: 'olive_oil', name: 'Olive oil', group: 'fat', enabled: false },
  { id: 'butter', name: 'Butter', group: 'fat', enabled: false },
  { id: 'sesame_oil', name: 'Toasted sesame oil', group: 'fat', enabled: false },

  // --- acid
  { id: 'red_wine_vinegar', name: 'Red wine vinegar', group: 'acid', enabled: false },
  { id: 'white_wine_vinegar', name: 'White wine vinegar', group: 'acid', enabled: false },
  { id: 'cider_vinegar', name: 'Cider vinegar', group: 'acid', enabled: false },
  { id: 'rice_vinegar', name: 'Rice vinegar', group: 'acid', enabled: false },
  { id: 'balsamic_vinegar', name: 'Balsamic vinegar', group: 'acid', enabled: false },

  // --- pantry
  { id: 'soy_sauce', name: 'Soy sauce', group: 'pantry', enabled: false },
  { id: 'dijon_mustard', name: 'Dijon mustard', group: 'pantry', enabled: false },
  { id: 'tomato_paste', name: 'Tomato paste', group: 'pantry', enabled: false },
  { id: 'honey', name: 'Honey', group: 'pantry', enabled: false },
  { id: 'caster_sugar', name: 'Sugar', group: 'pantry', enabled: false },
  { id: 'brown_sugar', name: 'Brown sugar', group: 'pantry', enabled: false },
  { id: 'plain_flour', name: 'Plain flour', group: 'pantry', enabled: false },
  { id: 'cornflour', name: 'Cornflour', group: 'pantry', enabled: false },
  { id: 'stock_cube', name: 'Stock cubes', group: 'pantry', enabled: false },

  // --- dried spice
  { id: 'bay_leaf', name: 'Bay leaves', group: 'dried spice', enabled: false },
  { id: 'chilli_flakes', name: 'Chilli flakes', group: 'dried spice', enabled: false },
  { id: 'ground_cumin', name: 'Ground cumin', group: 'dried spice', enabled: false },
  { id: 'ground_coriander', name: 'Ground coriander', group: 'dried spice', enabled: false },
  { id: 'smoked_paprika', name: 'Smoked paprika', group: 'dried spice', enabled: false },
  { id: 'dried_oregano', name: 'Dried oregano', group: 'dried spice', enabled: false },
  { id: 'dried_thyme', name: 'Dried thyme', group: 'dried spice', enabled: false },
  { id: 'ground_cinnamon', name: 'Ground cinnamon', group: 'dried spice', enabled: false },
  { id: 'ground_turmeric', name: 'Ground turmeric', group: 'dried spice', enabled: false },
  { id: 'garlic_powder', name: 'Garlic powder', group: 'dried spice', enabled: false },
  { id: 'onion_powder', name: 'Onion powder', group: 'dried spice', enabled: false },
  { id: 'curry_powder', name: 'Curry powder', group: 'dried spice', enabled: false },
  { id: 'fennel_seed', name: 'Fennel seeds', group: 'dried spice', enabled: false },
];

/** Seed rows for the `pantryStaples` table. `normalized` is derived, never typed. */
export const DEFAULT_PANTRY_STAPLES: readonly PantryStaple[] = STAPLE_SEEDS.map((s) => ({
  id: s.id,
  name: s.name,
  normalized: normalize(s.name),
  enabled: s.enabled,
}));

/** UI-only grouping, keyed by staple id. Absent id → 'pantry'. */
export const STAPLE_GROUPS: Readonly<Record<string, StapleGroup>> = Object.fromEntries(
  STAPLE_SEEDS.map((s) => [s.id, s.group]),
);

export function stapleGroup(id: string): StapleGroup {
  return STAPLE_GROUPS[id] ?? 'pantry';
}

/**
 * Seed row for the `settings` singleton.
 *
 * These are starting values written to Dexie on first run, not constants the
 * app reads later. Every one of them is editable in the settings screen.
 */
export const DEFAULT_SETTINGS: UserSettings = {
  id: SINGLETON_ID,
  servings: 2,
  spiceTolerance: 'medium',
  /** Hard ceiling on hands-on minutes for `weeknight` ambition. */
  weeknightActiveMinuteCeiling: 40,
  onboardingComplete: false,
};

/** Bounds enforced on the settings screen and again on write. */
export const SETTINGS_BOUNDS = {
  servings: { min: 1, max: 12 },
  weeknightActiveMinuteCeiling: { min: 10, max: 180 },
} as const;

export const SPICE_TOLERANCE_OPTIONS: readonly {
  value: UserSettings['spiceTolerance'];
  label: string;
  hint: string;
}[] = [
  { value: 'none', label: 'None', hint: 'No chilli heat at all.' },
  { value: 'mild', label: 'Mild', hint: 'A background warmth, nothing that lingers.' },
  { value: 'medium', label: 'Medium', hint: 'Heat you notice and enjoy.' },
  { value: 'hot', label: 'Hot', hint: 'Heat as a feature of the dish.' },
];
