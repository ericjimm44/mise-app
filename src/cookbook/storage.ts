/**
 * The storage layer. Every read and write against `@contract/db` goes through
 * this module — other agents call these functions rather than touching Dexie,
 * which is what keeps a stray `db.savedRecipes.put()` out of Cook Mode.
 *
 * Two rules run through the whole file:
 *
 * 1. A SAVED RECIPE IS NEVER UPDATED. There is no `updateSavedRecipe`, and
 *    there will not be one. The snapshot is deep-frozen on write, its
 *    `contentHash` is stored alongside it, and everything the user learns after
 *    cooking lands on `CookLog` instead. If a field wants to be written back
 *    onto a saved recipe, it belongs on the log.
 *
 * 2. QUERIES RIDE ON DECLARED INDEXES. `savedRecipes.savedAt`,
 *    `cookLogs.savedRecipeId`, `cookLogs.cookedAt`, `techniqueProgress.level`.
 *    Anything else is a full table scan and is done deliberately, on tables
 *    known to be tiny, with a comment saying so.
 */

import {
  MiseDatabase,
  SINGLETON_ID,
  contentHash,
  db as defaultDb,
  deepFreeze,
} from '@contract/db';
import { TECHNIQUE_IDS } from '@contract/techniques';
import type {
  Ambition,
  CookLog,
  DifficultyCalibration,
  DifficultyStars,
  Recipe,
  SavedRecipe,
  TechniqueId,
  TechniqueProgress,
} from '@contract/types';
import {
  computeCalibration,
  calibrationForGeneration,
  NEUTRAL_CALIBRATION,
  type CalibrationSample,
} from './calibration';
import {
  recordPerformance,
  rebuildProgressFromCooks,
  buildTechniqueGrid,
  type FamilyGroup,
} from './progression';

const KNOWN_TECHNIQUES = new Set<TechniqueId>(TECHNIQUE_IDS);

/** Every function takes the database explicitly so tests can use their own. */
export type Db = MiseDatabase;

export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Saved recipes — write once, read forever
// ---------------------------------------------------------------------------

export interface SaveRecipeInput {
  recipe: Recipe;
  /** The context that produced it. Snapshotted, not referenced. */
  generatedFrom: {
    inventorySnapshot: readonly string[];
    ambition: Ambition;
    exclusionsActive: readonly string[];
  };
  /** Overridable for tests and for imports. */
  id?: string;
  savedAt?: number;
}

/**
 * Save a recipe as an immutable snapshot.
 *
 * `generatedFrom` is copied, not referenced: the inventory array the caller
 * passes in is very probably the live inventory, and a snapshot that changes
 * when the fridge changes is not a snapshot.
 *
 * Returns the frozen record. `add` rather than `put` — a save against an id
 * that already exists is a bug, and should say so loudly instead of
 * overwriting a snapshot.
 */
export async function saveRecipe(
  input: SaveRecipeInput,
  database: Db = defaultDb,
): Promise<SavedRecipe> {
  const record: SavedRecipe = {
    id: input.id ?? newId(),
    savedAt: input.savedAt ?? Date.now(),
    recipe: structuredCloneish(input.recipe),
    contentHash: contentHash(input.recipe),
    generatedFrom: {
      inventorySnapshot: [...input.generatedFrom.inventorySnapshot],
      ambition: input.generatedFrom.ambition,
      exclusionsActive: [...input.generatedFrom.exclusionsActive],
    },
  };

  // Write first, freeze second: Dexie serialises the object on the way into
  // IndexedDB, and a frozen graph is fine to read but the freeze buys nothing
  // until the row exists. Freezing the returned object is what stops a caller
  // mutating the snapshot it just made.
  await database.savedRecipes.add(record);
  return deepFreeze(record);
}

/** Reverse-chronological. Rides the `savedAt` index; no sort in memory. */
export async function listSavedRecipes(database: Db = defaultDb): Promise<SavedRecipe[]> {
  const rows = await database.savedRecipes.orderBy('savedAt').reverse().toArray();
  return rows.map((r) => deepFreeze(r));
}

export async function getSavedRecipe(
  id: string,
  database: Db = defaultDb,
): Promise<SavedRecipe | undefined> {
  const row = await database.savedRecipes.get(id);
  return row ? deepFreeze(row) : undefined;
}

export async function countSavedRecipes(database: Db = defaultDb): Promise<number> {
  return database.savedRecipes.count();
}

/**
 * Does this snapshot still hash to what it hashed to at save time?
 *
 * This is the point of storing `contentHash`: immutability becomes checkable
 * after the fact rather than merely promised in a comment.
 */
export function verifySavedRecipe(saved: SavedRecipe): boolean {
  return contentHash(saved.recipe) === saved.contentHash;
}

/** Any snapshot that has drifted since it was written. Should always be empty. */
export async function findDriftedRecipes(database: Db = defaultDb): Promise<SavedRecipe[]> {
  const rows = await database.savedRecipes.toArray();
  return rows.filter((r) => !verifySavedRecipe(r));
}

/**
 * Remove a recipe from the cookbook, along with its cook logs.
 *
 * Deleting a recipe deletes evidence, so technique progress and calibration are
 * rebuilt from what remains rather than left overstating the history. This is
 * the one place a level can go down, and it is honest that it does.
 */
export async function deleteSavedRecipe(id: string, database: Db = defaultDb): Promise<void> {
  await database.transaction(
    'rw',
    database.savedRecipes,
    database.cookLogs,
    database.techniqueProgress,
    database.calibration,
    async () => {
      await database.savedRecipes.delete(id);
      // Indexed: `cookLogs.savedRecipeId`.
      await database.cookLogs.where('savedRecipeId').equals(id).delete();
    },
  );
  await rebuildDerivedState(database);
}

// ---------------------------------------------------------------------------
// Cook logs — everything learned after the fact
// ---------------------------------------------------------------------------

export interface CookLogInput {
  savedRecipeId: string;
  wouldMakeAgain: boolean;
  actualDifficulty: DifficultyStars;
  actualActiveMinutes: number;
  notes?: string;
  techniquesPerformed: readonly TechniqueId[];
  id?: string;
  cookedAt?: number;
}

/**
 * Record a cook. Writes the log, advances technique progress, recomputes
 * calibration — and does not go near `savedRecipes`.
 *
 * Unknown technique ids throw rather than being dropped: the UI only ever
 * offers ids taken from the recipe's own steps, so an unknown one means
 * something upstream is wrong, and silently discarding it would leave a cook
 * wondering why a technique never levelled.
 */
export async function logCook(input: CookLogInput, database: Db = defaultDb): Promise<CookLog> {
  const recipe = await database.savedRecipes.get(input.savedRecipeId);
  if (!recipe) {
    throw new Error(`Cannot log a cook against unknown saved recipe "${input.savedRecipeId}".`);
  }

  const performed = [...new Set(input.techniquesPerformed)];
  const unknown = performed.filter((t) => !KNOWN_TECHNIQUES.has(t));
  if (unknown.length > 0) {
    throw new Error(`Unknown technique id(s) in cook log: ${unknown.join(', ')}.`);
  }
  if (!Number.isFinite(input.actualActiveMinutes) || input.actualActiveMinutes < 0) {
    throw new Error('actualActiveMinutes must be a non-negative number.');
  }

  const log: CookLog = {
    id: input.id ?? newId(),
    savedRecipeId: input.savedRecipeId,
    cookedAt: input.cookedAt ?? Date.now(),
    wouldMakeAgain: input.wouldMakeAgain,
    actualDifficulty: input.actualDifficulty,
    actualActiveMinutes: input.actualActiveMinutes,
    techniquesPerformed: performed,
    ...(input.notes !== undefined && input.notes !== '' ? { notes: input.notes } : {}),
  };

  // Calibration needs the estimates that live on saved recipes. Those are read
  // BEFORE the write transaction opens, deliberately: saved recipes are
  // immutable, so a read outside the transaction cannot go stale, and keeping
  // `savedRecipes` out of the transaction's table list means no write path in
  // this module can so much as reach for it.
  const samples = await collectCalibrationSamples(database, log);

  await database.transaction(
    'rw',
    database.cookLogs,
    database.techniqueProgress,
    database.calibration,
    async () => {
      await database.cookLogs.add(log);

      if (performed.length > 0) {
        const existing = await database.techniqueProgress.bulkGet(performed);
        const updated = performed.map((id, i) =>
          recordPerformance(existing[i] ?? undefined, id, log.cookedAt),
        );
        await database.techniqueProgress.bulkPut(updated);
      }

      await database.calibration.put(computeCalibration(samples, log.cookedAt));
    },
  );

  return log;
}

/** All cooks of one recipe, newest first. Indexed: `cookLogs.savedRecipeId`. */
export async function listCookLogsFor(
  savedRecipeId: string,
  database: Db = defaultDb,
): Promise<CookLog[]> {
  const rows = await database.cookLogs.where('savedRecipeId').equals(savedRecipeId).toArray();
  return rows.sort((a, b) => b.cookedAt - a.cookedAt);
}

/** The activity timeline. Indexed: `cookLogs.cookedAt`. */
export async function listRecentCookLogs(
  limit = 20,
  database: Db = defaultDb,
): Promise<CookLog[]> {
  return database.cookLogs.orderBy('cookedAt').reverse().limit(limit).toArray();
}

export async function countCooks(database: Db = defaultDb): Promise<number> {
  return database.cookLogs.count();
}

/** How many times each saved recipe has been cooked, keyed by recipe id. */
export async function cookCountsByRecipe(
  database: Db = defaultDb,
): Promise<ReadonlyMap<string, number>> {
  const counts = new Map<string, number>();
  // `each` over the savedRecipeId index: no rows are materialised, and the
  // callback sees them grouped by recipe.
  await database.cookLogs.orderBy('savedRecipeId').eachKey((key) => {
    const id = String(key);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  });
  return counts;
}

// ---------------------------------------------------------------------------
// Technique progress
// ---------------------------------------------------------------------------

export async function listTechniqueProgress(database: Db = defaultDb): Promise<TechniqueProgress[]> {
  return database.techniqueProgress.toArray();
}

/** Indexed: `techniqueProgress.level`. Partitioning owned from locked is cheap. */
export async function listOwnedTechniques(
  database: Db = defaultDb,
): Promise<TechniqueProgress[]> {
  return database.techniqueProgress.where('level').equals(3).toArray();
}

/** Techniques touched at all, at any level. Indexed: `techniqueProgress.level`. */
export async function listStartedTechniques(
  database: Db = defaultDb,
): Promise<TechniqueProgress[]> {
  return database.techniqueProgress.where('level').above(0).toArray();
}

export async function getTechniqueGrid(database: Db = defaultDb): Promise<FamilyGroup[]> {
  return buildTechniqueGrid(await listTechniqueProgress(database));
}

// ---------------------------------------------------------------------------
// Calibration
// ---------------------------------------------------------------------------

export async function getCalibration(database: Db = defaultDb): Promise<DifficultyCalibration> {
  return (await database.calibration.get(SINGLETON_ID)) ?? NEUTRAL_CALIBRATION;
}

/**
 * What Agent A puts on `GenerationRequest.calibration`. `undefined` below the
 * minimum sample — the generator is told nothing rather than told zero.
 */
export async function getApplicableCalibration(
  database: Db = defaultDb,
): Promise<DifficultyCalibration | undefined> {
  return calibrationForGeneration(await database.calibration.get(SINGLETON_ID));
}

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------

async function collectCalibrationSamples(
  database: Db,
  extra?: CookLog,
): Promise<CalibrationSample[]> {
  const logs = await database.cookLogs.toArray();
  if (extra) logs.push(extra);
  if (logs.length === 0) return [];

  const ids = [...new Set(logs.map((l) => l.savedRecipeId))];
  const recipes = await database.savedRecipes.bulkGet(ids);
  const byId = new Map<string, SavedRecipe>();
  recipes.forEach((r) => {
    if (r) byId.set(r.id, r);
  });

  const samples: CalibrationSample[] = [];
  for (const log of logs) {
    const saved = byId.get(log.savedRecipeId);
    if (!saved) continue; // orphaned log: no estimate to compare against
    samples.push({
      estimatedStars: saved.recipe.difficulty.stars,
      actualStars: log.actualDifficulty,
      estimatedActiveMinutes: saved.recipe.time.active_minutes,
      actualActiveMinutes: log.actualActiveMinutes,
    });
  }
  return samples;
}

/**
 * Recompute technique progress and calibration from the cook history. Used
 * after a deletion or an import, where incremental updates cannot be trusted.
 */
export async function rebuildDerivedState(database: Db = defaultDb): Promise<void> {
  const logs = await database.cookLogs.toArray();
  const samples = await collectCalibrationSamples(database);
  const progress = rebuildProgressFromCooks(logs);
  const now = Date.now();

  await database.transaction(
    'rw',
    database.techniqueProgress,
    database.calibration,
    async () => {
      await database.techniqueProgress.clear();
      if (progress.length > 0) await database.techniqueProgress.bulkPut(progress);

      if (samples.length === 0) {
        await database.calibration.delete(SINGLETON_ID);
      } else {
        await database.calibration.put(computeCalibration(samples, now));
      }
    },
  );
}

// ---------------------------------------------------------------------------
// The repository — one named surface for the rest of the app
// ---------------------------------------------------------------------------

/**
 * Everything the rest of Mise may do to the cookbook tables, as one interface.
 *
 * The free functions above are the implementation and stay exported for tests
 * and for callers that already hold a database; this is the surface other
 * modules bind to. It exists for two reasons:
 *
 *   - Integration. Agent C's inventory repository covers `inventory`,
 *     `pantryStaples`, `exclusions` and `settings`; this covers the other four
 *     plus export/import across all eight. Two named interfaces reconcile at
 *     merge; two piles of loose functions do not.
 *   - Substitutability. A caller that takes a `CookbookRepository` can be handed
 *     one bound to a test database without knowing that Dexie exists.
 *
 * Note what is absent and will stay absent: there is no `updateSavedRecipe`.
 */
export interface CookbookRepository {
  saveRecipe(input: SaveRecipeInput): Promise<SavedRecipe>;
  getSavedRecipe(id: string): Promise<SavedRecipe | undefined>;
  listSavedRecipes(): Promise<SavedRecipe[]>;
  countSavedRecipes(): Promise<number>;
  deleteSavedRecipe(id: string): Promise<void>;
  /** Does the stored snapshot still hash to what it hashed to at save time? */
  findDriftedRecipes(): Promise<SavedRecipe[]>;

  logCook(input: CookLogInput): Promise<CookLog>;
  listCookLogsFor(savedRecipeId: string): Promise<CookLog[]>;
  listRecentCookLogs(limit?: number): Promise<CookLog[]>;
  countCooks(): Promise<number>;
  cookCountsByRecipe(): Promise<ReadonlyMap<string, number>>;

  /** For `GenerationRequest.techniqueProgress`. */
  listTechniqueProgress(): Promise<TechniqueProgress[]>;
  listOwnedTechniques(): Promise<TechniqueProgress[]>;
  listStartedTechniques(): Promise<TechniqueProgress[]>;
  getTechniqueGrid(): Promise<FamilyGroup[]>;

  getCalibration(): Promise<DifficultyCalibration>;
  /** For `GenerationRequest.calibration` — `undefined` below the sample floor. */
  getApplicableCalibration(): Promise<DifficultyCalibration | undefined>;

  /** Recompute progression and calibration from the surviving cook history. */
  rebuildDerivedState(): Promise<void>;
}

/** Bind the repository to a database. Tests pass their own; the app uses the default. */
export function createCookbookRepository(database: Db = defaultDb): CookbookRepository {
  return {
    saveRecipe: (input) => saveRecipe(input, database),
    getSavedRecipe: (id) => getSavedRecipe(id, database),
    listSavedRecipes: () => listSavedRecipes(database),
    countSavedRecipes: () => countSavedRecipes(database),
    deleteSavedRecipe: (id) => deleteSavedRecipe(id, database),
    findDriftedRecipes: () => findDriftedRecipes(database),

    logCook: (input) => logCook(input, database),
    listCookLogsFor: (id) => listCookLogsFor(id, database),
    listRecentCookLogs: (limit) => listRecentCookLogs(limit, database),
    countCooks: () => countCooks(database),
    cookCountsByRecipe: () => cookCountsByRecipe(database),

    listTechniqueProgress: () => listTechniqueProgress(database),
    listOwnedTechniques: () => listOwnedTechniques(database),
    listStartedTechniques: () => listStartedTechniques(database),
    getTechniqueGrid: () => getTechniqueGrid(database),

    getCalibration: () => getCalibration(database),
    getApplicableCalibration: () => getApplicableCalibration(database),

    rebuildDerivedState: () => rebuildDerivedState(database),
  };
}

/** The app's instance, bound to the singleton database in `@contract/db`. */
export const cookbookRepository: CookbookRepository = createCookbookRepository();

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Detach the recipe from whatever object graph the caller handed us, so the
 * snapshot cannot be mutated through a reference the caller kept. Structured
 * clone when it exists; a JSON round-trip otherwise — a Recipe is plain data
 * by contract, so the round-trip is lossless.
 */
function structuredCloneish<T>(value: T): T {
  const sc = (globalThis as { structuredClone?: <V>(v: V) => V }).structuredClone;
  if (typeof sc === 'function') return sc(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
