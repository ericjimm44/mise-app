import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MiseDatabase, SINGLETON_ID } from '@contract/db';
import { DEFAULT_EXCLUSIONS } from '@contract/recipe.schema';
import type { InventoryItem, PantryStaple, UserSettings } from '@contract/types';
import {
  EXPORT_FORMAT,
  EXPORT_TABLES,
  EXPORT_VERSION,
  ImportRejected,
  exportAll,
  exportFilename,
  importAll,
  parseImport,
  serializeExport,
  validateImport,
  wipeAll,
} from './exportImport';
import { logCook, saveRecipe } from './storage';
import { SAMPLE_GENERATED_FROM, makeRecipe } from './fixtures';

let db: MiseDatabase;
let dbCount = 0;

const SETTINGS: UserSettings = {
  id: SINGLETON_ID,
  servings: 2,
  spiceTolerance: 'medium',
  weeknightActiveMinuteCeiling: 40,
  onboardingComplete: true,
};

const INVENTORY: InventoryItem[] = [
  { id: 'inv-1', name: 'Chicken thighs', normalized: 'chicken thigh', category: 'protein', addedAt: 10 },
  { id: 'inv-2', name: 'Shallots', normalized: 'shallot', quantity: '3', addedAt: 20 },
];

const STAPLES: PantryStaple[] = [
  { id: 'st-1', name: 'Olive oil', normalized: 'olive oil', enabled: true },
  { id: 'st-2', name: 'Butter', normalized: 'butter', enabled: true },
];

/** Fills every one of the eight tables, so "every table" means something. */
async function seed() {
  const first = await saveRecipe(
    { recipe: makeRecipe(), generatedFrom: SAMPLE_GENERATED_FROM, id: 'rec-1', savedAt: 1000 },
    db,
  );
  await saveRecipe(
    {
      recipe: makeRecipe({ title: 'Braised shoulder' }),
      generatedFrom: SAMPLE_GENERATED_FROM,
      id: 'rec-2',
      savedAt: 2000,
    },
    db,
  );

  for (let i = 1; i <= 3; i++) {
    await logCook(
      {
        savedRecipeId: first.id,
        wouldMakeAgain: true,
        actualDifficulty: 2,
        actualActiveMinutes: 45,
        ...(i === 1 ? { notes: 'Too much heat under the sauce.' } : {}),
        techniquesPerformed: ['maillard_sear', 'pan_sauce'],
        id: `log-${i}`,
        cookedAt: 1000 * i,
      },
      db,
    );
  }

  await db.settings.put(SETTINGS);
  await db.inventory.bulkPut(INVENTORY);
  await db.pantryStaples.bulkPut(STAPLES);
  await db.exclusions.bulkPut(DEFAULT_EXCLUSIONS.map((e) => ({ ...e, terms: [...e.terms] })));
}

async function snapshotAllTables() {
  return {
    savedRecipes: await db.savedRecipes.orderBy('id').toArray(),
    cookLogs: await db.cookLogs.orderBy('id').toArray(),
    techniqueProgress: await db.techniqueProgress.orderBy('technique_id').toArray(),
    calibration: await db.calibration.toArray(),
    settings: await db.settings.toArray(),
    inventory: await db.inventory.orderBy('id').toArray(),
    pantryStaples: await db.pantryStaples.orderBy('id').toArray(),
    exclusions: await db.exclusions.orderBy('id').toArray(),
  };
}

beforeEach(async () => {
  db = new MiseDatabase(`mise-export-test-${dbCount++}-${Date.now()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

describe('export', () => {
  it('includes every table and states its format and version', async () => {
    await seed();
    const payload = await exportAll(db, 12345);

    expect(payload.format).toBe(EXPORT_FORMAT);
    expect(payload.version).toBe(EXPORT_VERSION);
    expect(payload.exportedAt).toBe(12345);
    expect(Object.keys(payload.data).sort()).toEqual([...EXPORT_TABLES].sort());

    expect(payload.data.savedRecipes).toHaveLength(2);
    expect(payload.data.cookLogs).toHaveLength(3);
    expect(payload.data.techniqueProgress).toHaveLength(2);
    expect(payload.data.calibration).toHaveLength(1);
    expect(payload.data.settings).toHaveLength(1);
    expect(payload.data.inventory).toHaveLength(2);
    expect(payload.data.pantryStaples).toHaveLength(2);
    expect(payload.data.exclusions.length).toBe(DEFAULT_EXCLUSIONS.length);
  });

  it('serializes to JSON a human can read, and back again', async () => {
    await seed();
    const payload = await exportAll(db, 12345);
    const text = serializeExport(payload);

    expect(text).toContain('\n  ');
    expect(JSON.parse(text)).toEqual(payload);
    expect(validateImport(JSON.parse(text)).ok).toBe(true);
  });

  it('names the file by date', () => {
    expect(exportFilename(Date.UTC(2026, 7, 1, 12))).toMatch(/^mise-cookbook-2026-08-0\d\.json$/);
  });
});

describe('export → wipe → import', () => {
  it('restores every table exactly', async () => {
    await seed();
    const before = await snapshotAllTables();
    const text = serializeExport(await exportAll(db, 12345));

    await wipeAll(db);
    const wiped = await snapshotAllTables();
    for (const table of EXPORT_TABLES) {
      expect(wiped[table]).toHaveLength(0);
    }

    const report = await importAll(text, db);
    expect(report.ok).toBe(true);
    expect(report.counts.savedRecipes).toBe(2);
    expect(report.counts.cookLogs).toBe(3);

    const after = await snapshotAllTables();
    expect(after).toEqual(before);
  });

  it('restores saved recipes with their content hashes intact', async () => {
    await seed();
    const text = serializeExport(await exportAll(db, 1));
    const originalHash = (await db.savedRecipes.get('rec-1'))!.contentHash;

    await wipeAll(db);
    await importAll(text, db);

    const restored = await db.savedRecipes.get('rec-1');
    expect(restored!.contentHash).toBe(originalHash);
    expect(validateImport(JSON.parse(text)).ok).toBe(true);
  });

  it('replaces rather than merging, so cook logs cannot be double-counted', async () => {
    await seed();
    const text = serializeExport(await exportAll(db, 1));

    // Import on top of a database that already holds the same history.
    await importAll(text, db);

    expect(await db.cookLogs.count()).toBe(3);
    expect((await db.techniqueProgress.get('maillard_sear'))!.timesPerformed).toBe(3);
  });

  it('accepts a parsed object as well as a string', async () => {
    await seed();
    const payload = await exportAll(db, 1);
    await wipeAll(db);
    await importAll(payload, db);
    expect(await db.savedRecipes.count()).toBe(2);
  });
});

describe('a malformed import is rejected without partially writing', () => {
  /** Assumes the database is already seeded: proves nothing was disturbed. */
  async function expectRejected(source: string | unknown, matcher: RegExp) {
    const before = await snapshotAllTables();

    await expect(importAll(source, db)).rejects.toBeInstanceOf(ImportRejected);
    await expect(importAll(source, db)).rejects.toMatchObject({
      errors: expect.arrayContaining([expect.stringMatching(matcher)]),
    });

    expect(await snapshotAllTables()).toEqual(before);
  }

  it('rejects text that is not JSON', async () => {
    await seed();
    await expectRejected('{ this is not json', /not valid JSON/i);
  });

  it('rejects a JSON file that is not a Mise export', async () => {
    await seed();
    await expectRejected(JSON.stringify({ hello: 'world' }), /Not a Mise export/i);
  });

  it('rejects a file from a newer format version rather than guessing', async () => {
    await seed();
    const payload = { format: EXPORT_FORMAT, version: EXPORT_VERSION + 1, exportedAt: 1, data: {} };
    await expectRejected(JSON.stringify(payload), /newer version of Mise/i);
  });

  it('rejects a structurally broken recipe', async () => {
    await seed();
    const payload = await exportAll(db, 1);
    const broken = JSON.parse(serializeExport(payload));
    delete broken.data.savedRecipes[0].recipe.steps;
    const before = await snapshotAllTables();

    await expect(importAll(broken, db)).rejects.toBeInstanceOf(ImportRejected);
    expect(await snapshotAllTables()).toEqual(before);
  });

  it('rejects a saved recipe whose snapshot no longer matches its own hash', async () => {
    await seed();
    const payload = await exportAll(db, 1);
    const tampered = JSON.parse(serializeExport(payload));
    tampered.data.savedRecipes[0].recipe.title = 'Edited in a text editor';

    await expectRejected(tampered, /does not match its own content hash/i);
  });

  it('rejects a cook log pointing at a recipe that is not in the file', async () => {
    await seed();
    const payload = await exportAll(db, 1);
    const orphaned = JSON.parse(serializeExport(payload));
    orphaned.data.savedRecipes = orphaned.data.savedRecipes.filter(
      (r: { id: string }) => r.id !== 'rec-1',
    );

    await expectRejected(orphaned, /refers to missing saved recipe/i);
  });

  it('rejects duplicate primary keys', async () => {
    await seed();
    const payload = await exportAll(db, 1);
    const duped = JSON.parse(serializeExport(payload));
    duped.data.inventory.push({ ...duped.data.inventory[0] });

    await expectRejected(duped, /duplicate primary key/i);
  });

  it('reports several problems at once rather than only the first', () => {
    const result = parseImport(
      JSON.stringify({
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        exportedAt: 1,
        data: {
          savedRecipes: [],
          cookLogs: [{ id: 'x' }],
          techniqueProgress: [],
          calibration: [],
          settings: [],
          inventory: [],
          pantryStaples: [],
          exclusions: [],
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(1);
  });
});
