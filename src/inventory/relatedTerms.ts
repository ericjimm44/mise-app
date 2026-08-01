/**
 * Related-term expansion for custom exclusions.
 *
 * An exclusion is an absolute filter, and a filter with one literal string in it
 * is a filter with a hole in it. "No mushrooms" has to catch porcini, shiitake
 * and truffle or the promise is a lie the first time the generator gets clever.
 *
 * This will never be complete. It does not need to be — it needs to be better
 * than the single word the user typed, and it needs to put the suggestions in
 * front of the user so they can add the ones we missed. Partly right, confirmed
 * by a human, beats a literal string.
 */

import { normalize } from '@contract/recipe.schema';

/**
 * Keyed by a normalised trigger word. Matching is per-word against the label the
 * user typed, so "no blue cheese" hits both `cheese` and `blue cheese`.
 */
const RELATED: Readonly<Record<string, readonly string[]>> = {
  mushroom: [
    'mushroom', 'mushrooms', 'porcini', 'shiitake', 'portobello', 'portabella',
    'cremini', 'chestnut mushroom', 'button mushroom', 'oyster mushroom',
    'enoki', 'maitake', 'shimeji', 'chanterelle', 'morel', 'truffle',
    'truffle oil', 'duxelles', 'mushroom powder', 'mushroom stock',
  ],
  truffle: ['truffle', 'truffle oil', 'truffle paste', 'tartufo'],
  coriander: ['coriander', 'cilantro', 'coriander leaf', 'chinese parsley'],
  cilantro: ['cilantro', 'coriander', 'coriander leaf', 'chinese parsley'],
  onion: [
    'onion', 'onions', 'shallot', 'red onion', 'spring onion', 'scallion',
    'leek', 'chive', 'onion powder', 'french onion',
  ],
  garlic: ['garlic', 'garlic powder', 'garlic paste', 'black garlic', 'aioli', 'ramson'],
  allium: ['onion', 'garlic', 'shallot', 'leek', 'chive', 'scallion', 'spring onion'],
  soy: ['soy', 'soy sauce', 'soya', 'tofu', 'edamame', 'miso', 'tamari', 'tempeh', 'soybean'],
  sesame: ['sesame', 'sesame oil', 'sesame seed', 'tahini', 'halva', 'gomashio', 'za atar'],
  chilli: ['chilli', 'chili', 'chile', 'cayenne', 'jalapeno', 'serrano', 'habanero',
    'gochujang', 'sriracha', 'harissa', 'sambal', 'chipotle', 'chilli flakes',
    'red pepper flakes', 'aleppo'],
  chili: ['chilli', 'chili', 'chile', 'cayenne', 'jalapeno', 'gochujang', 'sriracha',
    'harissa', 'sambal', 'chipotle', 'chilli flakes'],
  spicy: ['chilli', 'chili', 'cayenne', 'jalapeno', 'gochujang', 'sriracha', 'harissa', 'sambal'],
  tomato: ['tomato', 'tomatoes', 'passata', 'tomato paste', 'tomato puree', 'sundried tomato',
    'ketchup', 'san marzano', 'pomodoro'],
  celery: ['celery', 'celeriac', 'celery salt', 'celery seed', 'mirepoix'],
  olive: ['olive', 'olives', 'tapenade', 'kalamata', 'castelvetrano'],
  coconut: ['coconut', 'coconut milk', 'coconut cream', 'coconut oil', 'desiccated coconut'],
  mustard: ['mustard', 'dijon', 'wholegrain mustard', 'mustard seed', 'english mustard'],
  alcohol: ['wine', 'red wine', 'white wine', 'beer', 'brandy', 'cognac', 'sherry',
    'vermouth', 'marsala', 'rum', 'whisky', 'whiskey', 'vodka', 'mirin', 'sake',
    'shaoxing', 'liqueur'],
  wine: ['wine', 'red wine', 'white wine', 'vermouth', 'marsala', 'sherry', 'deglaze with wine'],
  beef: ['beef', 'steak', 'brisket', 'oxtail', 'veal', 'beef stock', 'bone marrow', 'bavette'],
  lamb: ['lamb', 'mutton', 'hogget', 'lamb shoulder', 'lamb neck', 'merguez'],
  chicken: ['chicken', 'poultry', 'chicken stock', 'chicken thigh', 'chicken breast', 'schmaltz'],
  meat: ['beef', 'lamb', 'pork', 'chicken', 'duck', 'veal', 'venison', 'game',
    'stock', 'bone broth', 'gelatin', 'lard', 'dripping'],
  corn: ['corn', 'sweetcorn', 'maize', 'polenta', 'cornmeal', 'cornflour', 'cornstarch',
    'masa', 'tortilla', 'corn syrup'],
  mint: ['mint', 'peppermint', 'spearmint'],
  cheese: ['cheese', 'parmesan', 'parmigiano', 'pecorino', 'cheddar', 'mozzarella',
    'feta', 'gruyere', 'blue cheese', 'gorgonzola', 'roquefort', 'stilton', 'halloumi'],
  banana: ['banana', 'plantain'],
  ginger: ['ginger', 'galangal', 'ground ginger', 'stem ginger'],
  pepper: ['pepper', 'bell pepper', 'capsicum', 'paprika', 'pimento', 'piquillo', 'romesco'],
  capsicum: ['capsicum', 'bell pepper', 'pepper', 'paprika', 'pimento'],
  aubergine: ['aubergine', 'eggplant', 'melanzane', 'baba ganoush'],
  eggplant: ['eggplant', 'aubergine', 'melanzane', 'baba ganoush'],
  courgette: ['courgette', 'zucchini'],
  zucchini: ['zucchini', 'courgette'],
  seaweed: ['seaweed', 'nori', 'wakame', 'kombu', 'kelp', 'dulse', 'hijiki', 'agar'],
  vinegar: ['vinegar', 'balsamic', 'sherry vinegar', 'cider vinegar', 'rice vinegar', 'verjus'],
  citrus: ['lemon', 'lime', 'orange', 'grapefruit', 'yuzu', 'citrus', 'zest'],
  sugar: ['sugar', 'caster sugar', 'brown sugar', 'honey', 'maple syrup', 'molasses',
    'treacle', 'agave', 'golden syrup'],
  legume: ['bean', 'beans', 'chickpea', 'lentil', 'pea', 'butter bean', 'cannellini',
    'black bean', 'kidney bean', 'hummus'],
  nightshade: ['tomato', 'potato', 'aubergine', 'eggplant', 'pepper', 'capsicum',
    'paprika', 'chilli', 'goji'],
};

/**
 * Naive plural/singular pairing, so a user typing "mushrooms" still finds the
 * `mushroom` entry. Deliberately dumb — this only feeds a suggestion list that
 * a human then confirms.
 */
function variants(word: string): string[] {
  const out = new Set<string>([word]);
  if (word.endsWith('ies') && word.length > 4) out.add(`${word.slice(0, -3)}y`);
  if (word.endsWith('es') && word.length > 3) out.add(word.slice(0, -2));
  if (word.endsWith('s') && word.length > 3) out.add(word.slice(0, -1));
  if (!word.endsWith('s')) out.add(`${word}s`);
  return [...out];
}

/**
 * Suggest terms for a custom exclusion label.
 *
 * Always includes the label itself and its simple plural/singular, so a label we
 * know nothing about still produces a usable filter rather than an empty one.
 * Returns normalised terms — the same normalisation `containsTerm()` will apply
 * when the validator enforces them.
 */
export function suggestRelatedTerms(label: string): string[] {
  const normalized = normalize(label);
  if (!normalized) return [];

  const out = new Set<string>();
  for (const v of variants(normalized)) out.add(v);

  const words = normalized.split(' ').filter((w) => w.length > 0);
  // Whole label first (catches multi-word keys like "blue cheese"), then words.
  const probes = [normalized, ...words];
  for (const probe of probes) {
    for (const v of variants(probe)) {
      const hits = RELATED[v];
      if (hits) for (const h of hits) out.add(normalize(h));
    }
  }

  return [...out].filter((t) => t.length > 0);
}

/** True when we have curated knowledge for this label, rather than just plurals. */
export function hasCuratedTerms(label: string): boolean {
  const normalized = normalize(label);
  const probes = [normalized, ...normalized.split(' ')];
  return probes.some((p) => variants(p).some((v) => RELATED[v] !== undefined));
}
