import { describe, expect, it } from 'vitest';
import { MiseDatabase } from '@contract/db';
import { containsTerm, normalize } from '@contract/recipe.schema';
import { inferCategory, searchCatalog } from './catalog';
import { suggestRelatedTerms, hasCuratedTerms } from './relatedTerms';
import {
  candidatesToDrafts,
  manualIngredientSource,
  parseQuantity,
  splitEntry,
} from './sources';
import { DexieInventoryRepository } from './storage';

let dbCount = 0;
function freshRepo(): DexieInventoryRepository {
  dbCount += 1;
  return new DexieInventoryRepository(
    new MiseDatabase(`mise-sources-test-${dbCount}-${Date.now()}`),
  );
}

describe('manual ingredient source', () => {
  it('proposes candidates without storing anything', async () => {
    const repo = freshRepo();
    await repo.ensureSeeded();

    const candidates = await manualIngredientSource.propose('2 chicken thighs, half a lemon');
    expect(candidates).toHaveLength(2);
    // The seam: proposing is not storing. Confirmation is a separate step, and
    // it is what makes photo capture a second producer rather than a rewrite.
    expect(await repo.listInventory()).toHaveLength(0);
  });

  it('splits on commas, semicolons, newlines and "and"', () => {
    expect(splitEntry('eggs, milk and butter')).toEqual(['eggs', 'milk', 'butter']);
    expect(splitEntry('onion;garlic\nginger')).toEqual(['onion', 'garlic', 'ginger']);
  });

  it('pulls a leading quantity off the name', () => {
    expect(parseQuantity('2 chicken thighs')).toEqual({ quantity: '2', name: 'chicken thighs' });
    expect(parseQuantity('500g beef mince')).toEqual({ quantity: '500g', name: 'beef mince' });
    expect(parseQuantity('1/2 lemon')).toEqual({ quantity: '1/2', name: 'lemon' });
    expect(parseQuantity('parsley')).toEqual({ name: 'parsley' });
  });

  it('tags candidates as manual with full confidence', async () => {
    const [candidate] = await manualIngredientSource.propose('spinach');
    expect(candidate?.source).toBe('manual');
    expect(candidate?.confidence).toBe(1);
  });

  it('drops duplicates within one proposal', async () => {
    const candidates = await manualIngredientSource.propose('Onion, onion, ONION');
    expect(candidates).toHaveLength(1);
  });

  it('never hands a normalized field to the caller', async () => {
    const [candidate] = await manualIngredientSource.propose('Crème Fraîche');
    // Candidates carry no matching key: deriving one before confirmation is how
    // a second normalisation implementation sneaks into the codebase.
    expect(candidate && 'normalized' in candidate).toBe(false);
  });

  it('confirmed candidates become drafts the repository normalises', async () => {
    const repo = freshRepo();
    await repo.ensureSeeded();

    const candidates = await manualIngredientSource.propose('6 Chicken Thighs');
    await repo.addInventoryItems(candidatesToDrafts(candidates));

    const [stored] = await repo.listInventory();
    expect(stored?.name).toBe('Chicken Thighs');
    expect(stored?.quantity).toBe('6');
    expect(stored?.normalized).toBe(normalize('Chicken Thighs'));
    expect(stored?.category).toBe('protein');
  });
});

describe('catalog', () => {
  it('ranks prefix matches above word and substring matches', () => {
    const results = searchCatalog('on').map((e) => e.name);
    expect(results[0]).toBe('Onion');
    expect(results).toContain('Spring onion');
  });

  it('returns nothing for an empty query', () => {
    expect(searchCatalog('   ')).toEqual([]);
  });

  it('infers a category, preferring the longest match', () => {
    expect(inferCategory('Chicken thighs')).toBe('protein');
    expect(inferCategory('free range eggs')).toBe('protein');
    expect(inferCategory('spring onion')).toBe('produce');
    expect(inferCategory('plain flour')).toBe('baking');
  });

  it('returns undefined rather than guessing', () => {
    expect(inferCategory('kohlrabi')).toBeUndefined();
    expect(inferCategory('')).toBeUndefined();
  });
});

describe('related term suggestions', () => {
  it('expands "mushrooms" past the literal string', () => {
    const terms = suggestRelatedTerms('mushrooms');
    expect(terms).toContain('mushroom');
    expect(terms).toContain('porcini');
    expect(terms).toContain('shiitake');
    expect(terms).toContain('truffle');
  });

  it('produces terms the contract matcher will actually fire on', () => {
    const terms = suggestRelatedTerms('mushrooms');
    const hit = 'Finely chopped porcini, soaked and squeezed dry';
    expect(terms.some((term) => containsTerm(hit, term))).toBe(true);
  });

  it('still yields a usable filter for an unknown label', () => {
    const terms = suggestRelatedTerms('Kohlrabi');
    expect(hasCuratedTerms('Kohlrabi')).toBe(false);
    expect(terms).toContain('kohlrabi');
    expect(terms).toContain('kohlrabis');
  });

  it('matches a multi-word label against its parts', () => {
    const terms = suggestRelatedTerms('blue cheese');
    expect(terms).toContain('gorgonzola');
    expect(terms).toContain('roquefort');
  });

  it('returns normalised terms only', () => {
    for (const term of suggestRelatedTerms('Coriander')) {
      expect(term).toBe(normalize(term));
    }
  });

  it('returns nothing for empty input', () => {
    expect(suggestRelatedTerms('  ')).toEqual([]);
  });
});
