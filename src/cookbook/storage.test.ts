import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MiseDatabase, SINGLETON_ID, contentHash } from '@contract/db';
import {
  countCooks,
  createCookbookRepository,
  cookCountsByRecipe,
  deleteSavedRecipe,
  findDriftedRecipes,
  getApplicableCalibration,
  getCalibration,
  getSavedRecipe,
  getTechniqueGrid,
  listCookLogsFor,
  listOwnedTechniques,
  listRecentCookLogs,
  listSavedRecipes,
  listTechniqueProgress,
  logCook,
  saveRecipe,
  verifySavedRecipe,
} from './storage';
import { MIN_CALIBRATION_SAMPLE } from './calibration';
import { techniquesInRecipe } from './progression';
import { SAMPLE_GENERATED_FROM, makeRecipe } from './fixtures';

let db: MiseDatabase;
let dbCount = 0;

beforeEach(async () => {
  db = new MiseDatabase(`mise-storage-test-${dbCount++}-${Date.now()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

describe('saved recipes are immutable snapshots', () => {
  it('stores a contentHash that still matches after a round trip through Dexie', async () => {
    const saved = await saveRecipe(
      { recipe: makeRecipe(), generatedFrom: SAMPLE_GENERATED_FROM },
      db,
    );

    expect(saved.contentHash).toMatch(/^[0-9a-f]{8}$/);

    const roundTripped = await getSavedRecipe(saved.id, db);
    expect(roundTripped).toBeDefined();
    // The proof: the hash stored at save time still describes the recipe that
    // came back out of IndexedDB.
    expect(roundTripped!.contentHash).toBe(saved.contentHash);
    expect(contentHash(roundTripped!.recipe)).toBe(saved.contentHash);
    expect(verifySavedRecipe(roundTripped!)).toBe(true);
    expect(await findDriftedRecipes(db)).toEqual([]);
  });

  it('freezes the snapshot so mutating it throws', async () => {
    const saved = await saveRecipe(
      { recipe: makeRecipe(), generatedFrom: SAMPLE_GENERATED_FROM },
      db,
    );

    expect(Object.isFrozen(saved.recipe)).toBe(true);
    expect(() => {
      (saved.recipe as { title: string }).title = 'Something else';
    }).toThrow();
    expect(() => {
      (saved.recipe.steps as unknown as unknown[]).push({});
    }).toThrow();
    expect(() => {
      (saved as { contentHash: string }).contentHash = 'deadbeef';
    }).toThrow();
  });

  it('freezes snapshots read back out of Dexie too', async () => {
    await saveRecipe({ recipe: makeRecipe(), generatedFrom: SAMPLE_GENERATED_FROM }, db);
    const [fromList] = await listSavedRecipes(db);

    expect(Object.isFrozen(fromList!.recipe)).toBe(true);
    expect(() => {
      (fromList!.recipe.difficulty as { stars: number }).stars = 5;
    }).toThrow();
  });

  it('snapshots generatedFrom rather than referencing the live inventory', async () => {
    const inventory = ['chicken thighs', 'butter'];
    const saved = await saveRecipe(
      {
        recipe: makeRecipe(),
        generatedFrom: { ...SAMPLE_GENERATED_FROM, inventorySnapshot: inventory },
      },
      db,
    );

    inventory.push('anchovies-bought-later');

    const roundTripped = await getSavedRecipe(saved.id, db);
    expect(roundTripped!.generatedFrom.inventorySnapshot).toEqual(['chicken thighs', 'butter']);
    expect(roundTripped!.generatedFrom.ambition).toBe('weeknight');
    expect(roundTripped!.generatedFrom.exclusionsActive).toEqual(['seafood']);
  });

  it('does not mutate the snapshot when the caller mutates the recipe it passed in', async () => {
    const recipe = makeRecipe();
    const saved = await saveRecipe({ recipe, generatedFrom: SAMPLE_GENERATED_FROM }, db);

    (recipe as { title: string }).title = 'Renamed after saving';

    const roundTripped = await getSavedRecipe(saved.id, db);
    expect(roundTripped!.recipe.title).toBe('Chicken thighs with a pan sauce');
    expect(verifySavedRecipe(roundTripped!)).toBe(true);
  });

  it('refuses to save twice under the same id rather than overwriting a snapshot', async () => {
    await saveRecipe({ recipe: makeRecipe(), generatedFrom: SAMPLE_GENERATED_FROM, id: 'fixed' }, db);
    await expect(
      saveRecipe(
        { recipe: makeRecipe({ title: 'Different' }), generatedFrom: SAMPLE_GENERATED_FROM, id: 'fixed' },
        db,
      ),
    ).rejects.toThrow();
  });

  it('lists reverse-chronologically off the savedAt index', async () => {
    await saveRecipe(
      { recipe: makeRecipe({ title: 'Oldest' }), generatedFrom: SAMPLE_GENERATED_FROM, savedAt: 1000 },
      db,
    );
    await saveRecipe(
      { recipe: makeRecipe({ title: 'Newest' }), generatedFrom: SAMPLE_GENERATED_FROM, savedAt: 3000 },
      db,
    );
    await saveRecipe(
      { recipe: makeRecipe({ title: 'Middle' }), generatedFrom: SAMPLE_GENERATED_FROM, savedAt: 2000 },
      db,
    );

    expect((await listSavedRecipes(db)).map((r) => r.recipe.title)).toEqual([
      'Newest',
      'Middle',
      'Oldest',
    ]);
  });
});

describe('logging a cook', () => {
  it('does not alter the saved recipe or its contentHash', async () => {
    const saved = await saveRecipe(
      { recipe: makeRecipe(), generatedFrom: SAMPLE_GENERATED_FROM },
      db,
    );
    const before = await getSavedRecipe(saved.id, db);

    await logCook(
      {
        savedRecipeId: saved.id,
        wouldMakeAgain: true,
        actualDifficulty: 2,
        actualActiveMinutes: 40,
        notes: 'Sauce split the first time; too hot when the butter went in.',
        techniquesPerformed: ['maillard_sear', 'pan_sauce'],
      },
      db,
    );

    const after = await getSavedRecipe(saved.id, db);
    expect(after!.contentHash).toBe(before!.contentHash);
    expect(contentHash(after!.recipe)).toBe(before!.contentHash);
    expect(after).toEqual(before);
    expect(await countSavedRecipesUnchanged(saved.id)).toBe(true);
  });

  async function countSavedRecipesUnchanged(id: string): Promise<boolean> {
    const row = await db.savedRecipes.get(id);
    return row !== undefined && verifySavedRecipe(row);
  }

  it('stores the log against the recipe and finds it on the savedRecipeId index', async () => {
    const saved = await saveRecipe(
      { recipe: makeRecipe(), generatedFrom: SAMPLE_GENERATED_FROM },
      db,
    );
    const other = await saveRecipe(
      { recipe: makeRecipe({ title: 'Other' }), generatedFrom: SAMPLE_GENERATED_FROM },
      db,
    );

    await logCook(
      {
        savedRecipeId: saved.id,
        wouldMakeAgain: true,
        actualDifficulty: 3,
        actualActiveMinutes: 30,
        techniquesPerformed: ['maillard_sear'],
        cookedAt: 1000,
      },
      db,
    );
    await logCook(
      {
        savedRecipeId: saved.id,
        wouldMakeAgain: true,
        actualDifficulty: 2,
        actualActiveMinutes: 25,
        techniquesPerformed: ['maillard_sear'],
        cookedAt: 2000,
      },
      db,
    );
    await logCook(
      {
        savedRecipeId: other.id,
        wouldMakeAgain: false,
        actualDifficulty: 4,
        actualActiveMinutes: 55,
        techniquesPerformed: ['pan_sauce'],
        cookedAt: 3000,
      },
      db,
    );

    const logs = await listCookLogsFor(saved.id, db);
    expect(logs).toHaveLength(2);
    expect(logs.map((l) => l.cookedAt)).toEqual([2000, 1000]);

    expect((await listRecentCookLogs(2, db)).map((l) => l.cookedAt)).toEqual([3000, 2000]);
    expect(await countCooks(db)).toBe(3);

    const counts = await cookCountsByRecipe(db);
    expect(counts.get(saved.id)).toBe(2);
    expect(counts.get(other.id)).toBe(1);
  });

  it('omits an empty note rather than storing an empty string', async () => {
    const saved = await saveRecipe(
      { recipe: makeRecipe(), generatedFrom: SAMPLE_GENERATED_FROM },
      db,
    );
    const log = await logCook(
      {
        savedRecipeId: saved.id,
        wouldMakeAgain: true,
        actualDifficulty: 3,
        actualActiveMinutes: 30,
        notes: '',
        techniquesPerformed: [],
      },
      db,
    );
    expect('notes' in log).toBe(false);
  });

  it('rejects a log against a recipe that is not in the cookbook', async () => {
    await expect(
      logCook(
        {
          savedRecipeId: 'nope',
          wouldMakeAgain: true,
          actualDifficulty: 3,
          actualActiveMinutes: 20,
          techniquesPerformed: [],
        },
        db,
      ),
    ).rejects.toThrow(/unknown saved recipe/i);
    expect(await countCooks(db)).toBe(0);
  });

  it('rejects an unknown technique id loudly instead of dropping it', async () => {
    const saved = await saveRecipe(
      { recipe: makeRecipe(), generatedFrom: SAMPLE_GENERATED_FROM },
      db,
    );
    await expect(
      logCook(
        {
          savedRecipeId: saved.id,
          wouldMakeAgain: true,
          actualDifficulty: 3,
          actualActiveMinutes: 20,
          techniquesPerformed: ['flambe_the_cat'],
        },
        db,
      ),
    ).rejects.toThrow(/unknown technique/i);
    expect(await countCooks(db)).toBe(0);
    expect(await listTechniqueProgress(db)).toEqual([]);
  });

  it('counts a technique once per cook even if it is listed twice', async () => {
    const saved = await saveRecipe(
      { recipe: makeRecipe(), generatedFrom: SAMPLE_GENERATED_FROM },
      db,
    );
    await logCook(
      {
        savedRecipeId: saved.id,
        wouldMakeAgain: true,
        actualDifficulty: 3,
        actualActiveMinutes: 30,
        techniquesPerformed: ['maillard_sear', 'maillard_sear'],
      },
      db,
    );
    const [progress] = await listTechniqueProgress(db);
    expect(progress!.timesPerformed).toBe(1);
  });
});

describe('technique progression through storage', () => {
  it('reaches owned after six cooks and shows up on the level index', async () => {
    const saved = await saveRecipe(
      { recipe: makeRecipe(), generatedFrom: SAMPLE_GENERATED_FROM },
      db,
    );

    for (let i = 1; i <= 6; i++) {
      await logCook(
        {
          savedRecipeId: saved.id,
          wouldMakeAgain: true,
          actualDifficulty: 3,
          actualActiveMinutes: 30,
          techniquesPerformed: ['maillard_sear'],
          cookedAt: 1000 * i,
        },
        db,
      );
    }

    const progress = await db.techniqueProgress.get('maillard_sear');
    expect(progress).toMatchObject({
      technique_id: 'maillard_sear',
      level: 3,
      timesPerformed: 6,
      firstPerformedAt: 1000,
      lastPerformedAt: 6000,
    });

    const owned = await listOwnedTechniques(db);
    expect(owned.map((t) => t.technique_id)).toEqual(['maillard_sear']);
  });

  it('builds a grid of all 40 techniques with the rest still locked', async () => {
    const saved = await saveRecipe(
      { recipe: makeRecipe(), generatedFrom: SAMPLE_GENERATED_FROM },
      db,
    );
    await logCook(
      {
        savedRecipeId: saved.id,
        wouldMakeAgain: true,
        actualDifficulty: 3,
        actualActiveMinutes: 30,
        techniquesPerformed: ['maillard_sear'],
      },
      db,
    );

    const grid = await getTechniqueGrid(db);
    const all = grid.flatMap((g) => g.techniques);
    expect(all).toHaveLength(40);
    expect(all.filter((t) => t.progress.level === 0)).toHaveLength(39);
    expect(all.find((t) => t.technique.technique_id === 'maillard_sear')!.progress.level).toBe(1);
  });
});

describe('calibration through storage', () => {
  async function logNCooks(n: number, actualStars: 1 | 2 | 3 | 4 | 5, actualMinutes: number) {
    const saved = await saveRecipe(
      { recipe: makeRecipe(), generatedFrom: SAMPLE_GENERATED_FROM },
      db,
    );
    for (let i = 1; i <= n; i++) {
      await logCook(
        {
          savedRecipeId: saved.id,
          wouldMakeAgain: true,
          actualDifficulty: actualStars,
          actualActiveMinutes: actualMinutes,
          techniquesPerformed: [],
          cookedAt: 1000 * i,
        },
        db,
      );
    }
    return saved;
  }

  it('records calibration from the first cook but does not hand it to the generator', async () => {
    await logNCooks(1, 2, 45);

    const calibration = await getCalibration(db);
    expect(calibration.id).toBe(SINGLETON_ID);
    expect(calibration.sampleSize).toBe(1);
    // The recipe estimates 3 stars and 30 active minutes.
    expect(calibration.starBias).toBe(-1);
    expect(calibration.activeMinuteRatio).toBe(1.5);

    expect(await getApplicableCalibration(db)).toBeUndefined();
  });

  it('applies once the sample reaches the minimum', async () => {
    await logNCooks(MIN_CALIBRATION_SAMPLE, 2, 45);

    const applicable = await getApplicableCalibration(db);
    expect(applicable).toBeDefined();
    expect(applicable!.sampleSize).toBe(MIN_CALIBRATION_SAMPLE);
    expect(applicable!.starBias).toBe(-1);
    expect(applicable!.activeMinuteRatio).toBe(1.5);
  });

  it('returns a neutral record when nothing has been cooked', async () => {
    const calibration = await getCalibration(db);
    expect(calibration).toMatchObject({ starBias: 0, activeMinuteRatio: 1, sampleSize: 0 });
    expect(await getApplicableCalibration(db)).toBeUndefined();
  });
});

describe('deleting a recipe', () => {
  it('removes its logs and rebuilds progression and calibration from what remains', async () => {
    const keep = await saveRecipe(
      { recipe: makeRecipe({ title: 'Keep' }), generatedFrom: SAMPLE_GENERATED_FROM },
      db,
    );
    const drop = await saveRecipe(
      { recipe: makeRecipe({ title: 'Drop' }), generatedFrom: SAMPLE_GENERATED_FROM },
      db,
    );

    for (let i = 1; i <= 3; i++) {
      await logCook(
        {
          savedRecipeId: drop.id,
          wouldMakeAgain: true,
          actualDifficulty: 1,
          actualActiveMinutes: 15,
          techniquesPerformed: ['maillard_sear'],
          cookedAt: 1000 * i,
        },
        db,
      );
    }
    await logCook(
      {
        savedRecipeId: keep.id,
        wouldMakeAgain: true,
        actualDifficulty: 3,
        actualActiveMinutes: 30,
        techniquesPerformed: ['maillard_sear'],
        cookedAt: 9000,
      },
      db,
    );

    expect((await db.techniqueProgress.get('maillard_sear'))!.level).toBe(2);

    await deleteSavedRecipe(drop.id, db);

    expect(await getSavedRecipe(drop.id, db)).toBeUndefined();
    expect(await countCooks(db)).toBe(1);

    const progress = await db.techniqueProgress.get('maillard_sear');
    expect(progress!.timesPerformed).toBe(1);
    expect(progress!.level).toBe(1);

    const calibration = await getCalibration(db);
    expect(calibration.sampleSize).toBe(1);
    expect(calibration.starBias).toBe(0);
    expect(calibration.activeMinuteRatio).toBe(1);
  });
});

describe('no write path touches savedRecipes', () => {
  /**
   * The strongest form of the immutability claim available in a test: replace
   * every mutating method on the table with a booby trap, then run the flows
   * that a careless refactor would route through them. `saveRecipe` uses `add`,
   * which is left alone — creating a snapshot is allowed; changing one is not.
   */
  it('never calls put, update or bulkPut on savedRecipes while logging a cook', async () => {
    const saved = await saveRecipe(
      { recipe: makeRecipe(), generatedFrom: SAMPLE_GENERATED_FROM },
      db,
    );

    const trap = (name: string) => () => {
      throw new Error(`savedRecipes.${name} must never be called`);
    };
    const table = db.savedRecipes as unknown as Record<string, unknown>;
    const original = {
      put: table['put'],
      update: table['update'],
      bulkPut: table['bulkPut'],
      bulkUpdate: table['bulkUpdate'],
    };
    table['put'] = trap('put');
    table['update'] = trap('update');
    table['bulkPut'] = trap('bulkPut');
    table['bulkUpdate'] = trap('bulkUpdate');

    try {
      await logCook(
        {
          savedRecipeId: saved.id,
          wouldMakeAgain: false,
          actualDifficulty: 5,
          actualActiveMinutes: 90,
          notes: 'Nothing here may find its way back onto the recipe.',
          techniquesPerformed: ['maillard_sear'],
        },
        db,
      );
      await getSavedRecipe(saved.id, db);
      await listSavedRecipes(db);
      await getTechniqueGrid(db);
    } finally {
      Object.assign(table, original);
    }

    const after = await getSavedRecipe(saved.id, db);
    expect(verifySavedRecipe(after!)).toBe(true);
    expect(after!.contentHash).toBe(saved.contentHash);
  });
});

describe('techniquesInRecipe', () => {
  it('offers the techniques a recipe teaches, from its skills and its steps', () => {
    expect(techniquesInRecipe(makeRecipe())).toEqual(['maillard_sear', 'pan_sauce']);
  });

  it('drops ids that are not in the contract library', () => {
    const recipe = makeRecipe({
      skills_required: [{ technique_id: 'not_a_technique', name: 'Nope', level: 1 }],
    });
    expect(techniquesInRecipe(recipe)).toEqual(['maillard_sear', 'pan_sauce']);
  });
});

describe('the repository surface', () => {
  it('binds every read and write to the database it was created with', async () => {
    const repo = createCookbookRepository(db);

    const saved = await repo.saveRecipe({
      recipe: makeRecipe(),
      generatedFrom: SAMPLE_GENERATED_FROM,
    });
    await repo.logCook({
      savedRecipeId: saved.id,
      wouldMakeAgain: true,
      actualDifficulty: 2,
      actualActiveMinutes: 45,
      techniquesPerformed: ['maillard_sear'],
    });

    expect(await repo.countSavedRecipes()).toBe(1);
    expect(await repo.countCooks()).toBe(1);
    expect((await repo.listSavedRecipes())[0]!.id).toBe(saved.id);
    expect((await repo.getSavedRecipe(saved.id))!.contentHash).toBe(saved.contentHash);
    expect(await repo.listCookLogsFor(saved.id)).toHaveLength(1);
    expect(await repo.listRecentCookLogs()).toHaveLength(1);
    expect((await repo.cookCountsByRecipe()).get(saved.id)).toBe(1);
    expect(await repo.listTechniqueProgress()).toHaveLength(1);
    expect(await repo.listStartedTechniques()).toHaveLength(1);
    expect(await repo.listOwnedTechniques()).toHaveLength(0);
    expect(await repo.getTechniqueGrid()).toHaveLength(9);
    expect((await repo.getCalibration()).sampleSize).toBe(1);
    expect(await repo.getApplicableCalibration()).toBeUndefined();
    expect(await repo.findDriftedRecipes()).toEqual([]);

    await repo.rebuildDerivedState();
    expect(await repo.listTechniqueProgress()).toHaveLength(1);

    await repo.deleteSavedRecipe(saved.id);
    expect(await repo.countSavedRecipes()).toBe(0);
    expect(await repo.countCooks()).toBe(0);
    expect(await repo.listTechniqueProgress()).toEqual([]);
  });
});
