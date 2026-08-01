/**
 * Ingredient catalog — search-as-you-type suggestions and category inference.
 *
 * This is an autocomplete aid, not a whitelist. Anything the user types is
 * accepted whether it appears here or not; a kitchen contains things no list
 * anticipates. The catalog only exists to make entering a fridge's worth of food
 * fast enough that the user actually does it.
 */

import { normalize } from '@contract/recipe.schema';
import type { IngredientCategory } from '@contract/types';

export interface CatalogEntry {
  name: string;
  normalized: string;
  category: IngredientCategory;
}

const RAW: readonly (readonly [IngredientCategory, readonly string[]])[] = [
  [
    'produce',
    [
      'Onion', 'Red onion', 'Shallot', 'Spring onion', 'Garlic', 'Ginger', 'Leek',
      'Carrot', 'Celery', 'Potato', 'Sweet potato', 'Parsnip', 'Swede', 'Turnip',
      'Beetroot', 'Tomato', 'Cherry tomatoes', 'Cucumber', 'Courgette', 'Aubergine',
      'Bell pepper', 'Red chilli', 'Green chilli', 'Broccoli', 'Cauliflower',
      'Cabbage', 'Red cabbage', 'Kale', 'Spinach', 'Chard', 'Pak choi', 'Lettuce',
      'Rocket', 'Green beans', 'Peas', 'Sugar snap peas', 'Asparagus', 'Corn',
      'Mushrooms', 'Chestnut mushrooms', 'Butternut squash', 'Pumpkin', 'Fennel',
      'Radish', 'Avocado', 'Lemon', 'Lime', 'Orange', 'Apple', 'Pear', 'Banana',
      'Grapes', 'Berries', 'Rhubarb', 'Parsley', 'Coriander', 'Basil', 'Mint',
      'Dill', 'Thyme', 'Rosemary', 'Sage', 'Tarragon', 'Chives', 'Bay leaf',
    ],
  ],
  [
    'protein',
    [
      'Chicken breast', 'Chicken thighs', 'Whole chicken', 'Chicken wings',
      'Beef mince', 'Steak', 'Beef shin', 'Brisket', 'Lamb chops', 'Lamb shoulder',
      'Lamb mince', 'Pork chops', 'Pork belly', 'Pork shoulder', 'Sausages',
      'Bacon', 'Duck breast', 'Turkey', 'Eggs', 'Tofu', 'Tempeh', 'Chickpeas',
      'Lentils', 'Black beans', 'Cannellini beans', 'Butter beans', 'Kidney beans',
    ],
  ],
  [
    'dairy',
    [
      'Milk', 'Double cream', 'Single cream', 'Soured cream', 'Creme fraiche',
      'Butter', 'Yoghurt', 'Greek yoghurt', 'Cheddar', 'Parmesan', 'Pecorino',
      'Mozzarella', 'Feta', 'Halloumi', 'Ricotta', 'Mascarpone', 'Cream cheese',
      'Gruyere', 'Blue cheese', 'Goats cheese',
    ],
  ],
  [
    'grain',
    [
      'Rice', 'Basmati rice', 'Arborio rice', 'Brown rice', 'Pasta', 'Spaghetti',
      'Penne', 'Orzo', 'Noodles', 'Rice noodles', 'Bread', 'Sourdough',
      'Breadcrumbs', 'Panko', 'Tortillas', 'Couscous', 'Bulgur wheat', 'Quinoa',
      'Polenta', 'Oats', 'Barley', 'Farro', 'Puff pastry', 'Filo pastry',
    ],
  ],
  [
    'condiment',
    [
      'Olive oil', 'Neutral cooking oil', 'Sesame oil', 'Soy sauce', 'Tamari',
      'Rice vinegar', 'Red wine vinegar', 'White wine vinegar', 'Cider vinegar',
      'Balsamic vinegar', 'Dijon mustard', 'Wholegrain mustard', 'Ketchup',
      'Mayonnaise', 'Sriracha', 'Gochujang', 'Miso paste', 'Harissa',
      'Tomato paste', 'Passata', 'Tinned tomatoes', 'Coconut milk', 'Tahini',
      'Honey', 'Maple syrup', 'Stock cubes', 'Chicken stock', 'Vegetable stock',
      'Capers', 'Olives', 'Gherkins', 'Peanut butter',
    ],
  ],
  [
    'spice',
    [
      'Salt', 'Black pepper', 'Chilli flakes', 'Cumin', 'Ground coriander',
      'Smoked paprika', 'Paprika', 'Turmeric', 'Cinnamon', 'Nutmeg', 'Cardamom',
      'Cloves', 'Star anise', 'Fennel seeds', 'Mustard seeds', 'Curry powder',
      'Garam masala', 'Za atar', 'Dried oregano', 'Dried thyme', 'Cayenne',
      'Garlic powder', 'Onion powder', 'Saffron', 'Vanilla',
    ],
  ],
  [
    'baking',
    [
      'Plain flour', 'Self-raising flour', 'Strong bread flour', 'Cornflour',
      'Baking powder', 'Bicarbonate of soda', 'Yeast', 'Sugar', 'Caster sugar',
      'Brown sugar', 'Icing sugar', 'Dark chocolate', 'Cocoa powder',
      'Ground almonds', 'Walnuts', 'Pine nuts', 'Sesame seeds', 'Raisins',
    ],
  ],
  [
    'other',
    ['Red wine', 'White wine', 'Sherry', 'Vermouth', 'Beer', 'Shaoxing wine', 'Mirin'],
  ],
];

export const CATALOG: readonly CatalogEntry[] = RAW.flatMap(([category, names]) =>
  names.map((name) => ({ name, normalized: normalize(name), category })),
);

const BY_KEY = new Map<string, CatalogEntry>(CATALOG.map((e) => [e.normalized, e]));

/**
 * Best-effort category for a typed name. Exact key first, then a containment
 * match so "free range eggs" still lands as protein. Returns undefined rather
 * than guessing 'other' — an absent category is honest, a wrong one isn't.
 */
export function inferCategory(name: string): IngredientCategory | undefined {
  const key = normalize(name);
  if (!key) return undefined;

  const exact = BY_KEY.get(key);
  if (exact) return exact.category;

  let best: CatalogEntry | undefined;
  for (const entry of CATALOG) {
    if (key.includes(entry.normalized) || entry.normalized.includes(key)) {
      // Prefer the longest match: "spring onion" should beat "onion".
      if (!best || entry.normalized.length > best.normalized.length) best = entry;
    }
  }
  return best?.category;
}

/**
 * Search-as-you-type ranking:
 *   0 whole string starts with the query
 *   1 any word starts with the query
 *   2 contains the query anywhere
 * Ties break on shorter names, so "Onion" outranks "Spring onion" for "on".
 */
export function searchCatalog(query: string, limit = 8): CatalogEntry[] {
  const q = normalize(query);
  if (!q) return [];

  const scored: { entry: CatalogEntry; rank: number }[] = [];
  for (const entry of CATALOG) {
    const n = entry.normalized;
    let rank = -1;
    if (n.startsWith(q)) rank = 0;
    else if (n.split(' ').some((w) => w.startsWith(q))) rank = 1;
    else if (n.includes(q)) rank = 2;
    if (rank >= 0) scored.push({ entry, rank });
  }

  scored.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.entry.normalized.length - b.entry.normalized.length ||
      a.entry.name.localeCompare(b.entry.name),
  );
  return scored.slice(0, limit).map((s) => s.entry);
}
