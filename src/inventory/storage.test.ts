import { beforeEach, describe, expect, it } from 'vitest';
import { MiseDatabase, SINGLETON_ID } from '@contract/db';
import {
  DEFAULT_EXCLUSIONS,
  isAvailable,
  normalize,
  validateRecipe,
} from '@contract/recipe.schema';
import type { Recipe } from '@contract/types';
import { DEFAULT_PANTRY_STAPLES, DEFAULT_SETTINGS } from './defaults';
import { DexieInventoryRepository, deriveNormalized } from './storage';

let dbCount = 0;

function freshRepo(): { db: MiseDatabase; repo: DexieInventoryRepository } {
  dbCount += 1;
  const db = new MiseDatabase(`mise-inventory-test-${dbCount}-${Date.now()}`);
  return { db, repo: new DexieInventoryRepository(db) };
}

describe('normalisation', () => {
  it('derives `normalized` with the contract normalize(), not a local copy', () => {
    // The whole point: if these two ever differ, Rule 1 starts rejecting
    // recipes for ingredients the user actually has. Asserted against
    // `normalize()` directly so drift fails the build.
    const samples = [
      'Crème Fraîche',
      '  Spring   Onions ',
      "Chef's knife",
      'JALAPEÑO',
      'extra-virgin olive oil',
      'Tomatoes, tinned',
      '10 ml',
    ];
    for (const sample of samples) {
      expect(deriveNormalized(sample)).toBe(normalize(sample));
    }
  });

  it('stores a correctly normalised field on add', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();
    await repo.addInventoryItems([{ name: '  Crème Fraîche  ' }]);

    const items = await repo.listInventory();
    expect(items).toHaveLength(1);
    expect(items[0]?.normalized).toBe('creme fraiche');
    expect(items[0]?.normalized).toBe(normalize('Crème Fraîche'));
    // Display name is preserved; only the matching key is derived.
    expect(items[0]?.name).toBe('Crème Fraîche');
  });

  it('normalised inventory satisfies the validator it will be matched against', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();
    await repo.addInventoryItems([{ name: 'Chicken Thighs' }, { name: 'Crème Fraîche' }]);
    const inventory = (await repo.listInventory()).map((i) => i.normalized);

    const ctx = { inventory, pantryStaples: [], exclusions: [] };
    expect(isAvailable('chicken thigh', ctx)).toBe(true);
    expect(isAvailable('creme fraiche', ctx)).toBe(true);
    expect(isAvailable('duck', ctx)).toBe(false);
  });

  it('strips a leading article so "a lemon" and "lemon" are one item', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();
    await repo.addInventoryItems([{ name: 'a lemon' }, { name: 'Lemon' }]);
    expect(await repo.listInventory()).toHaveLength(1);
  });

  it('ignores input that normalises to nothing', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();
    await repo.addInventoryItems([{ name: '???' }, { name: '   ' }]);
    expect(await repo.listInventory()).toHaveLength(0);
  });
});

describe('inventory', () => {
  it('updates rather than duplicates when the same item is added twice', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();
    await repo.addInventoryItems([{ name: 'Tomatoes', quantity: '4' }]);
    await repo.addInventoryItems([{ name: 'tomatoes', quantity: '6' }]);

    const items = await repo.listInventory();
    expect(items).toHaveLength(1);
    expect(items[0]?.quantity).toBe('6');
  });

  it('round-trips quantity and category, and removes on request', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();
    const [written] = await repo.addInventoryItems([
      { name: 'Chicken thighs', quantity: '6', category: 'protein' },
    ]);
    expect(written?.category).toBe('protein');

    const stored = (await repo.listInventory())[0];
    expect(stored?.quantity).toBe('6');
    expect(stored?.category).toBe('protein');

    await repo.removeInventoryItem(stored?.id ?? '');
    expect(await repo.listInventory()).toHaveLength(0);
  });

  it('clears everything', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();
    await repo.addInventoryItems([{ name: 'Onion' }, { name: 'Garlic' }]);
    await repo.clearInventory();
    expect(await repo.listInventory()).toHaveLength(0);
  });
});

describe('seeding', () => {
  it('seeds exclusions with seafood enabled', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();

    const exclusions = await repo.listExclusions();
    expect(exclusions).toHaveLength(DEFAULT_EXCLUSIONS.length);

    const seafood = exclusions.find((e) => e.id === 'seafood');
    expect(seafood?.enabled).toBe(true);
    expect(seafood?.custom).toBe(false);
    // The derived products that trip up every other app came along with it.
    expect(seafood?.terms).toContain('fish sauce');
    expect(seafood?.terms).toContain('worcestershire');
  });

  it('ships everything except seafood disabled', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();
    const enabled = (await repo.listExclusions()).filter((e) => e.enabled).map((e) => e.id);
    expect(enabled).toEqual(['seafood']);
  });

  it('is idempotent and never overwrites a user choice', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();
    await repo.setExclusionEnabled('seafood', false);

    // A second first-run must not resurrect the seeded value: the table is the
    // runtime source of truth, the contract constant is only the seed.
    await repo.ensureSeeded();
    await repo.ensureSeeded();

    const exclusions = await repo.listExclusions();
    expect(exclusions).toHaveLength(DEFAULT_EXCLUSIONS.length);
    expect(exclusions.find((e) => e.id === 'seafood')?.enabled).toBe(false);
  });

  it('seeds pantry staples conservatively', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();

    const staples = await repo.listPantryStaples();
    expect(staples).toHaveLength(DEFAULT_PANTRY_STAPLES.length);

    const enabled = staples.filter((s) => s.enabled).map((s) => s.id).sort();
    expect(enabled).toEqual(['black_pepper', 'neutral_oil', 'salt']);
    // A staple wrongly assumed present is a Rule 1 violation the validator
    // cannot catch, so the seeded-on set stays tiny.
    expect(enabled.length).toBeLessThan(staples.length / 4);
  });

  it('derives staple normalisation with the contract normalize()', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();
    for (const staple of await repo.listPantryStaples()) {
      expect(staple.normalized).toBe(normalize(staple.name));
    }
  });

  it('seeds settings when the table is empty', async () => {
    const { db, repo } = freshRepo();
    await repo.ensureSeeded();
    const stored = await db.settings.get(SINGLETON_ID);
    expect(stored).toEqual(DEFAULT_SETTINGS);
  });
});

describe('exclusions', () => {
  it('persists a toggle and reads it back', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();

    await repo.setExclusionEnabled('dairy', true);
    expect((await repo.listExclusions()).find((e) => e.id === 'dairy')?.enabled).toBe(true);

    await repo.setExclusionEnabled('dairy', false);
    expect((await repo.listExclusions()).find((e) => e.id === 'dairy')?.enabled).toBe(false);
  });

  it('round-trips a custom exclusion with custom: true', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();

    const created = await repo.addCustomExclusion({
      label: 'Mushrooms',
      terms: ['mushroom', 'porcini', 'shiitake', 'truffle'],
    });
    expect(created.custom).toBe(true);
    expect(created.enabled).toBe(true);

    const stored = (await repo.listExclusions()).find((e) => e.id === created.id);
    expect(stored?.custom).toBe(true);
    expect(stored?.label).toBe('Mushrooms');
    expect(stored?.terms).toContain('porcini');
    // The label itself is always a term — an exclusion that doesn't catch its
    // own name is not an exclusion.
    expect(stored?.terms).toContain('mushrooms');
  });

  it('stores exclusion terms deduplicated and normalised', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();
    const created = await repo.addCustomExclusion({
      label: 'Truffle',
      terms: ['Truffle', 'truffle', 'TRUFFLE oil', 'tartufo'],
    });
    expect(created.terms).toEqual(['truffle', 'truffle oil', 'tartufo']);
  });

  it('deletes custom exclusions but never seeded ones', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();
    const created = await repo.addCustomExclusion({ label: 'Coriander', terms: ['cilantro'] });

    await repo.removeCustomExclusion(created.id);
    expect((await repo.listExclusions()).find((e) => e.id === created.id)).toBeUndefined();

    await repo.removeCustomExclusion('seafood');
    expect((await repo.listExclusions()).find((e) => e.id === 'seafood')).toBeDefined();
  });

  it('switches off any pantry staple an enabled exclusion would forbid', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();
    await repo.setPantryStapleEnabled('butter', true);
    expect(
      (await repo.listPantryStaples()).find((s) => s.id === 'butter')?.enabled,
    ).toBe(true);

    await repo.setExclusionEnabled('dairy', true);
    expect(
      (await repo.listPantryStaples()).find((s) => s.id === 'butter')?.enabled,
    ).toBe(false);
  });

  it('produces an exclusion set the validator actually enforces', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();
    const exclusions = await repo.listExclusions();

    const recipe = fishRecipe();
    const outcome = validateRecipe(recipe, {
      inventory: ['salmon fillet', 'butter', 'lemon'],
      pantryStaples: [],
      exclusions,
    });
    expect(outcome.valid).toBe(false);
    if (!outcome.valid) {
      expect(outcome.failures.some((f) => f.reason === 'exclusion_violation')).toBe(true);
    }
  });
});

describe('pantry staples', () => {
  it('persists a toggle', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();
    await repo.setPantryStapleEnabled('olive_oil', true);
    expect(
      (await repo.listPantryStaples()).find((s) => s.id === 'olive_oil')?.enabled,
    ).toBe(true);
  });

  it('adds a custom staple and re-enables rather than duplicating', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();

    const added = await repo.addCustomPantryStaple('Fish sauce substitute paste');
    expect(added?.enabled).toBe(true);

    const again = await repo.addCustomPantryStaple('  fish sauce substitute paste ');
    expect(again?.id).toBe(added?.id);
    expect(
      (await repo.listPantryStaples()).filter((s) => s.normalized === added?.normalized),
    ).toHaveLength(1);
  });

  it('refuses a staple that normalises to nothing', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();
    expect(await repo.addCustomPantryStaple('!!!')).toBeNull();
  });
});

describe('settings', () => {
  it('is a genuine singleton — writing twice updates rather than duplicates', async () => {
    const { db, repo } = freshRepo();
    await repo.ensureSeeded();

    await repo.updateSettings({ servings: 4 });
    await repo.updateSettings({ servings: 6, spiceTolerance: 'hot' });

    expect(await db.settings.count()).toBe(1);
    const settings = await repo.getSettings();
    expect(settings.id).toBe(SINGLETON_ID);
    expect(settings.servings).toBe(6);
    expect(settings.spiceTolerance).toBe('hot');
  });

  it('preserves fields the patch does not mention', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();
    await repo.updateSettings({ weeknightActiveMinuteCeiling: 25, spiceTolerance: 'mild' });
    await repo.updateSettings({ servings: 3 });

    const settings = await repo.getSettings();
    expect(settings.weeknightActiveMinuteCeiling).toBe(25);
    expect(settings.spiceTolerance).toBe('mild');
    expect(settings.servings).toBe(3);
  });

  it('keeps onboardingComplete false when explicitly set false', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();
    await repo.updateSettings({ onboardingComplete: true });
    expect((await repo.getSettings()).onboardingComplete).toBe(true);
    await repo.updateSettings({ onboardingComplete: false });
    expect((await repo.getSettings()).onboardingComplete).toBe(false);
  });

  it('clamps nonsense into the allowed range', async () => {
    const { repo } = freshRepo();
    await repo.ensureSeeded();
    await repo.updateSettings({ servings: 0, weeknightActiveMinuteCeiling: 10_000 });
    const settings = await repo.getSettings();
    expect(settings.servings).toBe(1);
    expect(settings.weeknightActiveMinuteCeiling).toBe(180);
  });

  it('creates the singleton on read when it is somehow missing', async () => {
    const { db, repo } = freshRepo();
    await db.settings.clear();
    const settings = await repo.getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(await db.settings.count()).toBe(1);
  });
});

describe('table ownership', () => {
  let repo: DexieInventoryRepository;
  let db: MiseDatabase;

  beforeEach(async () => {
    const fresh = freshRepo();
    db = fresh.db;
    repo = fresh.repo;
    await repo.ensureSeeded();
  });

  it("never writes to Agent D's tables", async () => {
    await repo.addInventoryItems([{ name: 'Onion' }]);
    await repo.setExclusionEnabled('pork', true);
    await repo.addCustomPantryStaple('Rice vinegar');
    await repo.updateSettings({ servings: 4 });

    expect(await db.savedRecipes.count()).toBe(0);
    expect(await db.cookLogs.count()).toBe(0);
    expect(await db.techniqueProgress.count()).toBe(0);
    expect(await db.calibration.count()).toBe(0);
  });
});

/** A recipe that violates the seeded seafood exclusion in more than one place. */
function fishRecipe(): Recipe {
  return {
    title: 'Pan-roasted salmon',
    one_line_pitch: 'Crisp skin, soft centre.',
    ambition: 'weeknight',
    servings: 2,
    difficulty: { stars: 2, rationale: 'Heat control on the skin side.' },
    skills_required: [{ technique_id: 'maillard_sear', name: 'Maillard sear', level: 1 }],
    equipment: { essential: ['frying pan'], helpful: [], substitutions: [] },
    time: { active_minutes: 15, passive_minutes: 0, total_minutes: 15, note: '' },
    ingredients: [
      { item: 'salmon fillet', amount: 2, unit: null, from_inventory: true },
      { item: 'butter', amount: 20, unit: 'g', from_inventory: true },
    ],
    mise_en_place: ['Pat the salmon dry'],
    steps: [
      {
        id: 's1',
        title: 'Sear skin-side down',
        instruction: 'Press the fillet flat for the first thirty seconds.',
        technique_id: 'maillard_sear',
        timer_seconds: 240,
        timer_type: 'active',
        can_start_next_step_during: false,
        doneness_cue: 'The skin releases on its own.',
        failure_mode: 'Lifting early tears the skin.',
        chef_note: 'A cold pan makes it stick.',
      },
    ],
    plating: 'Lemon on the side.',
    what_makes_this_restaurant_grade: 'The skin is genuinely crisp.',
    leftovers: 'Eat cold the next day.',
  };
}
